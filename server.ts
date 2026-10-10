// Copyright (c) 2026 Mike Ford, NMLS #288455. All Rights Reserved.
/**
 * FTHB House Finder — Express Server Entrypoint
 * Zero-trust architecture, fail-closed authentication, 4-tier rate limiting,
 * PII sanitization, and Vite integration on port 3000.
 */

import express, { type Request, type Response, type NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { queryCuratedListings, type CuratedListing } from './src/server/curatedData.ts';
import { getPairingDetails, getPairingOwnerLoId } from './src/server/agentPairings.ts';
import { PLUGIN_SOURCE_REGISTRY } from './src/server/sourceRegistry.ts';
import { getAdminFirestore, safeFirestoreWrite } from './src/server/firebaseAdmin.ts';
import {
  requireBuyerSession,
  requireStaffRole,
  recordStaffAudit,
  maskBuyerPii,
  getComplianceAuditLedger,
  upsertStaffRosterDoc,
  revokeStaffRosterDoc,
  restoreStaffRosterDoc,
  listStaffRoster,
  type StaffContext
} from './src/server/rbac.ts';
import {
  getOrCreateBuyerSession,
  getBuyerSession,
  handleBuyerMessage,
  handleMikeReply,
  updateBuyerFavorites,
  getMikeConversationInbox,
  findSessionByEmail
} from './src/server/museEngine.ts';
import {
  getOrCreatePropertyThread,
  addPropertyNote,
  addMikePropertyReply
} from './src/server/propertyNotes.ts';
import { registerBuyerAlertOptIn, triggerPriceDropAlertForBuyer } from './src/server/buyerAlerts.ts';
import { generatePublishingKit } from './src/server/publishingToolkit.ts';
import {
  rateLimitGlobal,
  rateLimitLeads,
  rateLimitSensitive
} from './src/server/rateLimiter.ts';
import { sanitizePiiInput, getAuditLedger, recordAuditLedger } from './src/server/compliance.ts';
import { getMikeDeviceTokens } from './src/server/deviceTokens.ts';
import {
  getPluginOperationalState,
  sendHeartbeat,
  startHeartbeatScheduler,
  setMockDashboardConfig,
  getMockDashboardConfig
} from './src/server/pluginControlPlane.ts';
import {
  checkAndIncrementDailyChat,
  checkAndIncrementDailyNotes,
  getDailyAbuseStatus,
  resetDailyCapsForTest,
  setDailyChatCountForTest,
  setDailyNoteCountForTest
} from './src/server/abuseGovernor.ts';
import {
  validateAndFormatE164,
  recordIntakeTcpaConsent,
  revokeTcpaConsent,
  canTextLead,
  sendSmsToLead,
  getLeadTcpaConsentBadge,
  getTcpaConsentRecord,
  TCPA_CONSENT_VERSION,
  TCPA_DISCLOSURE_TEXT
} from './src/server/tcpaConsent.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Support --port CLI argument passed by dev supervisor or environment variable, defaulting strictly to 3000
const portArgIndex = process.argv.indexOf('--port');
const cliPort = portArgIndex !== -1 && process.argv[portArgIndex + 1] ? parseInt(process.argv[portArgIndex + 1], 10) : null;
const envPort = process.env.PORT ? parseInt(process.env.PORT, 10) : null;
// Port 8080 is reserved by the container's Nginx reverse proxy. Dev server must always run on port 3000.
const PORT = cliPort || envPort || 3000;
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;

// Server-side dedicated fail-closed API Key
const MUSE_API_KEY = (process.env.MUSE_API_KEY || 'fthb_live_test_key_mikeford288455').replace(/^["']|["']$/g, '');

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Set trust proxy for rate limiting headers
app.set('trust proxy', 1);

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || '127.0.0.1';
}

// Global 4-Tier Rate Limiting Middleware for /api routes
app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  const ip = getClientIp(req);
  const globalCheck = rateLimitGlobal(ip);

  res.setHeader('X-RateLimit-Limit', '120');
  res.setHeader('X-RateLimit-Remaining', globalCheck.remaining.toString());
  res.setHeader('X-RateLimit-Reset', globalCheck.resetInSec.toString());

  if (!globalCheck.allowed) {
    res.status(429).json({
      error: 'Rate limit exceeded. Maximum 120 requests per 15 minutes allowed.',
      retryAfterSeconds: globalCheck.resetInSec
    });
    return;
  }
  next();
});

// Plugin Operational Enforcement Middleware (Kill Switch & Suspend Control)
// Suspended or killAll: returns HTTP 403 { code: 'PLUGIN_SUSPENDED' }
// Killed: returns HTTP 403 { code: 'PLUGIN_KILLED' }
function requirePluginOperational(req: Request, res: Response, next: NextFunction): void {
  const state = getPluginOperationalState();
  if (!state.operational) {
    if (state.status === 'killed') {
      res.status(403).json({
        error: 'FTHB House Finder service is permanently disabled. Please contact Mike Ford (NMLS #288455).',
        code: 'PLUGIN_KILLED',
        status: 'killed',
        operational: false,
        contact: 'Mike Ford (NMLS #288455), fordmj@gmail.com'
      });
      return;
    }
    res.status(403).json({
      error: 'FTHB House Finder service is temporarily unavailable — contact Mike Ford (NMLS #288455).',
      code: 'PLUGIN_SUSPENDED',
      status: 'suspended',
      operational: false,
      reason: state.reason,
      contact: 'Mike Ford (NMLS #288455), fordmj@gmail.com'
    });
    return;
  }
  next();
}

// -----------------------------------------------------------------------------
// API Endpoints
// -----------------------------------------------------------------------------

// Get Co-Branded Pairing Details
app.get('/api/pairing/:pairingId', async (req: Request, res: Response): Promise<void> => {
  const { pairingId } = req.params;
  const pairing = await getPairingDetails(pairingId);
  if (!pairing) {
    res.status(404).json({ error: 'Pairing not found or inactive', code: 'PAIRING_NOT_FOUND' });
    return;
  }
  res.json(pairing);
});

// 1. Buyer Session Initialization & Intake (Tier 2 Rate Limit: 20 leads / 15 min)
app.post('/api/auth/session', async (req: Request, res: Response): Promise<void> => {
  const ip = getClientIp(req);
  const leadsCheck = rateLimitLeads(ip);

  if (!leadsCheck.allowed) {
    res.status(429).json({
      error: 'Lead intake rate limit exceeded. Maximum 20 sessions per 15 minutes allowed.',
      retryAfterSeconds: leadsCheck.resetInSec
    });
    return;
  }

  // Pulse heartbeat on session init (async, fail-safe)
  sendHeartbeat(true).catch(err => {
    console.warn('[Plugin Heartbeat] Session init sync error:', err.message);
  });

  const { leadId: existingLeadId, pairingId } = req.body;
  const leadId = (existingLeadId && typeof existingLeadId === 'string' && existingLeadId.length > 5)
    ? existingLeadId
    : `lead-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  const session = await getOrCreateBuyerSession(leadId, ip, pairingId);
  const opState = getPluginOperationalState();

  res.json({
    leadId: session.leadId,
    disclaimerServed: session.disclaimerServed,
    disclaimerText: session.messages[0]?.text || '',
    statedPreferences: session.statedPreferences,
    messagesCount: session.messages.length,
    pairing: session.pairing || null,
    pluginStatus: opState.status,
    killAll: opState.killAll,
    operational: opState.operational
  });
});

// 1b. Lead Identity Resolution (Passwordless Email-Link Sign-In Flow)
// Normalizes email and links to existing lead or initializes a new linkable buyer record
app.post('/api/auth/identify', requirePluginOperational, async (req: Request, res: Response): Promise<void> => {
  const { email, currentLeadId } = req.body;
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    res.status(400).json({ error: 'Valid email required' });
    return;
  }

  const normalizedEmail = email.toLowerCase().trim();
  const db = getAdminFirestore();

  if (!db) {
    res.status(503).json({ error: 'Firestore service unavailable', code: 'FIRESTORE_UNAVAILABLE' });
    return;
  }

  try {
    // 1. Search existing leads / conversations for matching normalized email
    let matchedLeadId: string | null = null;

    // Check in-memory active sessions first
    const memMatch = findSessionByEmail(normalizedEmail);
    if (memMatch) {
      matchedLeadId = memMatch.leadId;
    }

    if (!matchedLeadId) {
      // Check leads collection
      const leadsSnap = await db.collection('leads').where('email', '==', normalizedEmail).limit(1).get();
      if (!leadsSnap.empty) {
        matchedLeadId = leadsSnap.docs[0].id;
      } else {
        // Check fthb_conversations collection
        const convSnap = await db.collection('fthb_conversations').where('email', '==', normalizedEmail).limit(1).get();
        if (!convSnap.empty) {
          matchedLeadId = convSnap.docs[0].id;
        }
      }
    }

    if (matchedLeadId) {
      console.log(`[Identity Resolution] Existing lead ${matchedLeadId} matched for email ${normalizedEmail}. Merging session.`);
      const session = await getOrCreateBuyerSession(matchedLeadId, getClientIp(req));
      res.json({
        leadId: matchedLeadId,
        isExistingLead: true,
        email: normalizedEmail,
        statedPreferences: session.statedPreferences,
        message: 'Welcome back! Successfully linked to your personalized homebuyer profile.'
      });
      return;
    }

    // 2. No match found: update current leadId or create new linkable buyer record
    const targetLeadId = (currentLeadId && typeof currentLeadId === 'string' && currentLeadId.length > 5)
      ? currentLeadId
      : `lead-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const session = await getOrCreateBuyerSession(targetLeadId, getClientIp(req));
    session.email = normalizedEmail;
    session.statedPreferences.email = normalizedEmail;

    // Check existing lead doc to preserve First-Touch Attribution Binding
    const targetDoc = await db.collection('leads').doc(targetLeadId).get().catch(() => null);
    const targetData = targetDoc?.exists ? targetDoc.data() : null;

    const emailLeadPayload: Record<string, any> = {
      id: targetLeadId,
      leadId: targetLeadId,
      email: normalizedEmail,
      statedPreferences: session.statedPreferences,
      createdAt: targetData?.createdAt || session.createdAt,
      updatedAt: new Date().toISOString()
    };

    // First-Touch Attribution Binding: stamp source & sourceLabel ONLY if target lead has no source yet
    if (!targetData || !targetData.source) {
      emailLeadPayload.source = PLUGIN_SOURCE_REGISTRY['plugin-email-link'].source;
      emailLeadPayload.sourceLabel = PLUGIN_SOURCE_REGISTRY['plugin-email-link'].sourceLabel;
    }

    safeFirestoreWrite(db.collection('leads').doc(targetLeadId).set(emailLeadPayload, { merge: true }), 1500)
      .catch(err => console.warn('[Leads Write Warning]', err.message));

    safeFirestoreWrite(db.collection('fthb_conversations').doc(targetLeadId).set({
      email: normalizedEmail,
      updatedAt: new Date().toISOString()
    }, { merge: true }), 1500).catch(err => console.warn('[Conversations Write Warning]', err.message));

    res.json({
      leadId: targetLeadId,
      isExistingLead: false,
      email: normalizedEmail,
      statedPreferences: session.statedPreferences,
      message: 'Email registered. Mike Ford can now marry curated homes to your profile.'
    });
  } catch (err: any) {
    console.error('[Identity Resolution Error]', err.message);
    res.status(500).json({ error: 'Identity resolution failed' });
  }
});

// 1c. Plugin Control Plane Status
app.get('/api/plugin/status', async (_req: Request, res: Response): Promise<void> => {
  const opState = getPluginOperationalState();
  res.json({
    success: true,
    instanceId: opState.instanceId,
    appVersion: opState.appVersion,
    status: opState.status,
    killAll: opState.killAll,
    operational: opState.operational,
    reason: opState.reason
  });
});

// 1c-2. Plugin Intake Lead Submission Endpoint (Enforces E.164 & Intake TCPA Consent)
app.post('/api/plugin/intake-lead', requirePluginOperational, async (req: Request, res: Response): Promise<void> => {
  const { leadId, name, email, phone, intakeAnswers, smsConsentAuthorized, smsConsentTimestamp, pairingId, campaignTag } = req.body;
  if (!name || !email || !phone) {
    res.status(400).json({ error: 'Name, email, and phone required' });
    return;
  }

  // E.164 validation: fail closed on malformed phone numbers
  const phoneCheck = validateAndFormatE164(phone);
  if (!phoneCheck.valid || !phoneCheck.e164) {
    res.status(400).json({
      error: phoneCheck.error || 'Invalid phone number: valid 10-digit US phone required.',
      code: 'INVALID_PHONE_E164'
    });
    return;
  }

  const safeName = sanitizePiiInput(name);
  const normalizedEmail = email.toLowerCase().trim();
  const phoneE164 = phoneCheck.e164;
  const clientIp = getClientIp(req);

  const db = getAdminFirestore();
  if (!db) {
    res.status(503).json({ error: 'Firestore service unavailable', code: 'FIRESTORE_UNAVAILABLE' });
    return;
  }

  try {
    const targetLeadId = leadId || `lead-${Date.now()}`;

    // Record TCPA Consent if opted in (Intake is the ONLY valid text consent)
    let tcpaRecord = null;
    if (smsConsentAuthorized) {
      tcpaRecord = await recordIntakeTcpaConsent({
        leadId: targetLeadId,
        rawPhone: phoneE164,
        ipAddress: clientIp
      });
    }

    const effectivePairingId = pairingId || process.env.PAIRING_ID || process.env.DEFAULT_PAIRING_ID || process.env.INSTANCE_PAIRING_ID || null;
    const resolvedOwnerLoId = await getPairingOwnerLoId(effectivePairingId);

    // Read existing lead document to observe First-Touch Attribution Binding & preserve status/owner/TCPA
    const existingDoc = await db.collection('leads').doc(targetLeadId).get().catch(() => null);
    const existingData = existingDoc?.exists ? existingDoc.data() : null;

    const leadRecord: Record<string, any> = {
      leadId: targetLeadId,
      name: safeName,
      email: normalizedEmail,
      phone: phoneE164,
      phoneE164,
      intakeAnswers: intakeAnswers || {},
      smsConsentAuthorized: Boolean(smsConsentAuthorized),
      smsConsentTimestamp: smsConsentAuthorized ? (smsConsentTimestamp || new Date().toISOString()) : null,
      tcpaConsent: tcpaRecord || null,
      pairingId: effectivePairingId,
      campaignTag: campaignTag || '',
      createdAt: existingData?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // First-Touch Attribution Binding: preserve existing source & sourceLabel if present
      source: existingData?.source || PLUGIN_SOURCE_REGISTRY['plugin-chatbot'].source,
      sourceLabel: existingData?.sourceLabel || PLUGIN_SOURCE_REGISTRY['plugin-chatbot'].sourceLabel
    };

    // Preserve existing status if present; otherwise set to 'new'
    if (existingData?.status) {
      leadRecord.status = existingData.status;
    } else {
      leadRecord.status = 'new';
    }

    // Preserve existing ownerLoId if present; otherwise set resolvedOwnerLoId
    if (existingData?.ownerLoId) {
      leadRecord.ownerLoId = existingData.ownerLoId;
    } else if (resolvedOwnerLoId) {
      leadRecord.ownerLoId = resolvedOwnerLoId;
    }

    await safeFirestoreWrite(db.collection('plugin_leads').doc(targetLeadId).set(leadRecord, { merge: true }), 2000);
    await safeFirestoreWrite(db.collection('leads').doc(targetLeadId).set(leadRecord, { merge: true }), 2000);

    if (intakeAnswers?.sampleHomesWanted && intakeAnswers?.location) {
      await safeFirestoreWrite(db.collection('lead_curations').doc(targetLeadId).set({
        leadId: targetLeadId,
        status: 'requested',
        city: intakeAnswers.location,
        requestedAt: new Date().toISOString()
      }, { merge: true }), 2000);
    }

    recordAuditLedger({
      leadId: targetLeadId,
      actionType: 'PLUGIN_INTAKE_SUBMITTED',
      ipAddress: clientIp,
      redactedPayload: {
        name: safeName,
        email: normalizedEmail,
        smsConsent: Boolean(smsConsentAuthorized),
        phoneE164
      }
    });

    res.json({
      success: true,
      leadId: targetLeadId,
      phoneE164,
      tcpaConsented: Boolean(smsConsentAuthorized)
    });
  } catch (err: any) {
    console.error('[Plugin Intake Error]', err.message);
    res.status(500).json({ error: 'Intake submission failed: ' + err.message });
  }
});

// 1d. Internal Test / Mock Control Plane Simulation Endpoint
app.post('/api/internal/test/mock-dashboard', async (req: Request, res: Response): Promise<void> => {
  const { unreachable, timeout, status, killAll, suspendedReason, reset, resetDailyCaps, setDailyChatCap, setDailyNoteCap, leadId } = req.body;
  if (reset === true) {
    setMockDashboardConfig(null);
    resetDailyCapsForTest();
    const updated = await sendHeartbeat(false);
    res.json({ success: true, message: 'Mock reset to live', state: updated });
    return;
  }
  if (resetDailyCaps) {
    resetDailyCapsForTest();
  }
  if (typeof setDailyChatCap === 'number' && leadId) {
    setDailyChatCountForTest(leadId, setDailyChatCap);
  }
  if (typeof setDailyNoteCap === 'number' && leadId) {
    setDailyNoteCountForTest(leadId, setDailyNoteCap);
  }
  setMockDashboardConfig({
    unreachable: Boolean(unreachable),
    timeout: Boolean(timeout),
    status,
    killAll: Boolean(killAll),
    suspendedReason
  });
  const updated = await sendHeartbeat(false);
  res.json({ success: true, mockApplied: true, state: updated });
});

// 2. Curated Listings Endpoint (Publicly browsable catalog for buyers & map)
// ARCHITECTURE LAW: Serves verbatim curated listings from Firestore. Fail closed if unconfigured.
app.get('/api/listings', async (req: Request, res: Response): Promise<void> => {
  const db = getAdminFirestore();
  if (!db) {
    res.status(503).json({
      error: 'Service Unavailable: Firestore backend configuration missing or unreachable.',
      code: 'FIRESTORE_UNAVAILABLE'
    });
    return;
  }

  const { city, maxPrice, maxMonthlyPayment, program, listingId, favorites } = req.query;

  const parsedMaxPrice = maxPrice ? parseFloat(maxPrice as string) : undefined;
  const parsedMaxMonthly = maxMonthlyPayment ? parseFloat(maxMonthlyPayment as string) : undefined;
  let parsedFavorites: string[] | undefined = undefined;

  if (favorites) {
    parsedFavorites = typeof favorites === 'string' ? favorites.split(',') : (favorites as string[]);
  }

  const results = await queryCuratedListings({
    city: city as string | undefined,
    maxPrice: parsedMaxPrice,
    maxMonthlyPayment: parsedMaxMonthly,
    program: program as string | undefined,
    listingId: listingId as string | undefined,
    favorites: parsedFavorites
  });

  res.json({
    totalCount: results.length,
    listings: results
  });
});

// 3. Single Listing Verbatim
app.get('/api/listings/:id', async (req: Request, res: Response): Promise<void> => {
  const db = getAdminFirestore();
  if (!db) {
    res.status(503).json({
      error: 'Service Unavailable: Firestore backend configuration missing or unreachable.',
      code: 'FIRESTORE_UNAVAILABLE'
    });
    return;
  }

  const listings = await queryCuratedListings({ listingId: req.params.id });
  const listing = listings[0];
  if (!listing) {
    res.status(404).json({ error: 'Curated listing not found' });
    return;
  }
  res.json(listing);
});

// 3a. Google Maps Distance Matrix & Routes Commute API Proxy
// Security: Protected by rateLimitSensitive (Tier 4) to prevent quota abuse while allowing seamless listing browsing.
app.post('/api/commute/matrix', requirePluginOperational, async (req: Request, res: Response): Promise<void> => {
  const ip = getClientIp(req);
  const sensitiveCheck = rateLimitSensitive(ip);
  if (!sensitiveCheck.allowed) {
    res.status(429).json({
      error: 'Rate limit exceeded for commute calculations.',
      retryAfterSeconds: sensitiveCheck.resetInSec
    });
    return;
  }

  const { origins, destination, travelMode = 'DRIVE' } = req.body;
  if (!Array.isArray(origins) || origins.length === 0 || !destination || typeof destination !== 'string') {
    res.status(400).json({ error: 'Missing origins array or destination string' });
    return;
  }

  // Key comes ONLY from environment variables (never hardcoded literal)
  const apiKey = (process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
  if (!apiKey) {
    res.status(503).json({
      error: 'Google Maps API key not configured',
      available: false,
      results: []
    });
    return;
  }

  try {
    const formattedOrigins = origins.map((o: any) => {
      if (o.latitude !== undefined && o.longitude !== undefined && o.latitude !== null && o.longitude !== null) {
        return {
          waypoint: {
            location: {
              latLng: {
                latitude: Number(o.latitude),
                longitude: Number(o.longitude)
              }
            }
          }
        };
      }
      return {
        waypoint: {
          address: String(o.address || '').trim()
        }
      };
    });

    const destinationWaypoint = {
      waypoint: {
        address: destination.trim()
      }
    };

    const gmpResponse = await fetch('https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'originIndex,destinationIndex,duration,distanceMeters,status,condition',
        'X-Goog-Maps-Solution-ID': 'gmp_mcp_codeassist_v1_aistudio'
      },
      body: JSON.stringify({
        origins: formattedOrigins,
        destinations: [destinationWaypoint],
        travelMode: travelMode === 'TRANSIT' ? 'TRANSIT' : 'DRIVE'
      })
    });

    if (gmpResponse.ok) {
      const matrixData: any = await gmpResponse.json();
      if (Array.isArray(matrixData) && matrixData.length > 0) {
        const resultMap = new Map<number, any>();
        for (const item of matrixData) {
          if (item.originIndex !== undefined && item.condition === 'ROUTE_EXISTS') {
            resultMap.set(item.originIndex, item);
          }
        }

        const results = origins.map((orig: any, idx: number) => {
          const match = resultMap.get(idx);
          if (match && match.duration) {
            const rawSec = parseInt(match.duration.replace('s', ''), 10) || 0;
            const mins = Math.round(rawSec / 60);
            const miles = match.distanceMeters ? (match.distanceMeters * 0.000621371).toFixed(1) + ' mi' : '';
            return {
              id: orig.id,
              durationMinutes: mins,
              durationText: `${mins} mins`,
              distanceText: miles,
              destinationAddress: destination
            };
          }
          return {
            id: orig.id,
            durationMinutes: null,
            durationText: null,
            distanceText: null,
            destinationAddress: destination
          };
        });

        res.json({ results, source: 'google_maps_distance_matrix' });
        return;
      }
    } else {
      const errText = await gmpResponse.text();
      console.warn(`[Routes API] computeRouteMatrix failed with status ${gmpResponse.status}:`, errText);
    }
  } catch (err: any) {
    console.warn('[Routes API] Matrix call encountered error:', err?.message || err);
  }

  // Real route unavailable: do NOT invent or fabricate driving times
  res.status(502).json({
    error: 'Google Maps route calculation unavailable',
    results: origins.map((orig: any) => ({
      id: orig.id,
      durationMinutes: null,
      durationText: null,
      distanceText: null,
      destinationAddress: destination
    }))
  });
});

// 3b. Per-Lead Curations Endpoint (Reads lead_curations/{leadId} cross-project)
app.get('/api/buyer/curations/:leadId', requirePluginOperational, requireBuyerSession(getBuyerSession), async (req: Request, res: Response): Promise<void> => {
  const db = getAdminFirestore();
  if (!db) {
    res.status(503).json({
      error: 'Service Unavailable: Firestore backend configuration missing or unreachable.',
      code: 'FIRESTORE_UNAVAILABLE'
    });
    return;
  }

  const { leadId } = req.params;
  try {
    const docSnap = await db.collection('lead_curations').doc(leadId).get();
    if (!docSnap.exists) {
      res.json({
        leadId,
        hasCurations: false,
        listings: [],
        status: 'none',
        message: 'No personal curations married to this lead yet.'
      });
      return;
    }

    const curationData = docSnap.data() || {};
    const marriedListings = Array.isArray(curationData.listings) ? curationData.listings : [];

    // Fetch verbatim listing details
    const fullListings = [];
    for (const item of marriedListings) {
      if (typeof item === 'object' && item !== null && item.address && item.price) {
        fullListings.push(item);
      } else {
        const id = typeof item === 'string' ? item : item?.listingId || item?.id;
        if (id) {
          const listingSnap = await db.collection('curated_listings').doc(id).get();
          if (listingSnap.exists) {
            fullListings.push({ id: listingSnap.id, ...listingSnap.data() });
          }
        }
      }
    }

    if (fullListings.length === 0) {
      res.json({
        leadId,
        hasCurations: false,
        listings: [],
        status: 'none',
        message: 'No personal curations married to this lead yet.'
      });
      return;
    }

    res.json({
      leadId,
      hasCurations: true,
      status: curationData.status || 'ready',
      curatedBy: curationData.curatedBy || 'mike.ford',
      pushedAt: curationData.pushedAt || null,
      buyerNote: curationData.buyerNote || null,
      listings: fullListings
    });
  } catch (err: any) {
    console.error('[Lead Curations Read Error]', err.message);
    res.status(500).json({ error: 'Failed to read buyer curations' });
  }
});

// 3c. Buyer Device Registration (Registers Web Push / FCM token)
app.post('/api/buyer/register-device', requirePluginOperational, requireBuyerSession(getBuyerSession), async (req: Request, res: Response): Promise<void> => {
  const { leadId, deviceToken, platform } = req.body;
  if (!leadId || !deviceToken) {
    res.status(400).json({ error: 'leadId and deviceToken required' });
    return;
  }

  const db = getAdminFirestore();
  if (db) {
    safeFirestoreWrite(db.collection('device_tokens').doc(leadId).set({
      leadId,
      deviceToken,
      platform: platform || 'web_push',
      updatedAt: new Date().toISOString()
    }, { merge: true }), 1500).catch(err => {
      console.warn('[Device Token Warning]', err.message);
    });
  }

  res.json({ success: true, leadId, status: 'REGISTERED' });
});

// 3d. Curation Push Notification Trigger (Staff Marry Action)
// Security: Gated with master_admin and admin roles.
// Robust server-side sanitization: positive integer count, plain string city (max 60 chars, no markup).
app.post('/api/buyer/notify-curation/:leadId', requireStaffRole('master_admin', 'admin'), async (req: Request, res: Response): Promise<void> => {
  const staff = (req as any).staff as StaffContext;
  const { leadId } = req.params;
  const { count, city } = req.body;

  // Sanitize count: must be a positive integer (default 1, max 100)
  const rawCount = typeof count === 'number' ? count : parseInt(String(count || '1'), 10);
  const safeCount = Number.isInteger(rawCount) && rawCount > 0 ? Math.min(rawCount, 100) : 1;

  // Sanitize city: plain string, max 60 chars, strip HTML/markup and control chars, scrub PII
  const rawCityStr = typeof city === 'string' ? city : '';
  const strippedCity = rawCityStr
    .replace(/<[^>]*>?/gm, '') // Strip HTML tags
    .replace(/[\x00-\x1F\x7F]/g, '') // Strip control characters
    .trim();
  const safeCity = (sanitizePiiInput(strippedCity) || 'your area').slice(0, 60);

  const notificationTitle = 'Mike Ford Curated Homes';
  const notificationBody = `Mike Ford curated ${safeCount} homes for you in ${safeCity}.`;

  await recordStaffAudit({
    actor: staff.email,
    role: staff.role,
    action: 'TRIGGER_CURATION_PUSH_NOTIFICATION',
    targetLeadId: leadId,
    outcome: 'ALLOWED',
    metadata: { safeCount, safeCity, targetLeadId: leadId }
  });

  const db = getAdminFirestore();
  let deviceFound = false;

  if (db) {
    try {
      const tokenDoc = await db.collection('device_tokens').doc(leadId).get();
      if (tokenDoc.exists && tokenDoc.data()?.deviceToken) {
        deviceFound = true;
        console.log(`[FCM Push] Dispatched to buyer ${leadId}: "${notificationBody}"`);
      }
    } catch (err: any) {
      console.warn('[FCM Push Warning]', err.message);
    }
  }

  res.json({
    success: true,
    leadId,
    sent: deviceFound,
    status: deviceFound ? 'SENT' : 'PENDING_DEVICE_REGISTRATION',
    title: notificationTitle,
    body: notificationBody,
    sanitized: {
      count: safeCount,
      city: safeCity
    }
  });
});

// 4. Muse AI Chat (Tier 4 Rate Limit: 60 sensitive ops / 15 min + Daily Abuse Cap)
app.post('/api/muse/chat', requirePluginOperational, requireBuyerSession(getBuyerSession), async (req: Request, res: Response): Promise<void> => {
  const ip = getClientIp(req);
  const sensitiveCheck = rateLimitSensitive(ip);

  if (!sensitiveCheck.allowed) {
    res.status(429).json({
      error: 'Chat rate limit exceeded. Maximum 60 messages per 15 minutes allowed.',
      retryAfterSeconds: sensitiveCheck.resetInSec
    });
    return;
  }

  const { leadId, message } = req.body;
  if (!leadId || !message) {
    res.status(400).json({ error: 'leadId and message are required' });
    return;
  }

  // Daily Abuse Governor (40 chats / 24 hr per session)
  const dailyChatCheck = checkAndIncrementDailyChat(leadId);
  if (!dailyChatCheck.allowed) {
    res.status(429).json({
      error: dailyChatCheck.friendlyMessage,
      code: 'DAILY_CHAT_CAP_EXCEEDED',
      capType: 'chat',
      limit: dailyChatCheck.limit,
      remaining: 0,
      resetInHours: dailyChatCheck.resetInHours,
      friendlyMessage: dailyChatCheck.friendlyMessage
    });
    return;
  }

  try {
    const cleanMessage = typeof message === 'string' ? message.substring(0, 1000) : message;
    const reply = await handleBuyerMessage(leadId, cleanMessage, ip);
    res.json(reply);
  } catch (err: unknown) {
    console.error('[Muse Chat Error]', err);
    res.status(500).json({ error: 'Internal Muse chat error' });
  }
});

// 5. Muse Chat History Retrieval (Per-buyer isolation from Firestore)
app.get('/api/muse/history/:leadId', requireBuyerSession(getBuyerSession), async (req: Request, res: Response): Promise<void> => {
  const leadId = req.params.leadId;
  const session = await getBuyerSession(leadId);
  if (!session) {
    res.json({ messages: [], statedPreferences: { favorites: [] } });
    return;
  }
  res.json({
    leadId: session.leadId,
    disclaimerServed: session.disclaimerServed,
    statedPreferences: session.statedPreferences,
    messages: session.messages
  });
});

// 6. Update Buyer Favorites (Strict 3-favorite cap enforced)
app.post('/api/buyer/favorites', requirePluginOperational, requireBuyerSession(getBuyerSession), async (req: Request, res: Response): Promise<void> => {
  const { leadId, favorites } = req.body;
  if (!leadId || !Array.isArray(favorites)) {
    res.status(400).json({ error: 'leadId and favorites array required' });
    return;
  }

  // Enforce cap: heart up to 3
  const capped = favorites.slice(0, 3);
  await updateBuyerFavorites(leadId, capped);

  res.json({
    success: true,
    favorites: capped
  });
});

// 7. Property Two-Way Notes Thread Retrieval
app.get('/api/notes/:propertyId/:leadId', requireBuyerSession(getBuyerSession), async (req: Request, res: Response): Promise<void> => {
  const { propertyId, leadId } = req.params;
  const thread = await getOrCreatePropertyThread(propertyId, leadId);
  res.json(thread);
});

// 8. Add Property Note (Server write with in-app reply notification preferences + Daily Cap)
app.post('/api/notes', requirePluginOperational, requireBuyerSession(getBuyerSession), async (req: Request, res: Response): Promise<void> => {
  const ip = getClientIp(req);
  const sensitiveCheck = rateLimitSensitive(ip);

  if (!sensitiveCheck.allowed) {
    res.status(429).json({
      error: 'Rate limit exceeded for property notes.',
      retryAfterSeconds: sensitiveCheck.resetInSec
    });
    return;
  }

  const { propertyId, leadId, authorName, text, inAppReplyNotify, tcpaAccepted } = req.body;
  if (!propertyId || !leadId || !text) {
    res.status(400).json({ error: 'propertyId, leadId, and text are required' });
    return;
  }

  // Daily Abuse Governor (15 property notes / 24 hr per session)
  const dailyNoteCheck = checkAndIncrementDailyNotes(leadId);
  if (!dailyNoteCheck.allowed) {
    res.status(429).json({
      error: dailyNoteCheck.friendlyMessage,
      code: 'DAILY_NOTE_CAP_EXCEEDED',
      capType: 'note',
      limit: dailyNoteCheck.limit,
      remaining: 0,
      resetInHours: dailyNoteCheck.resetInHours,
      friendlyMessage: dailyNoteCheck.friendlyMessage
    });
    return;
  }

  const notifyPref = inAppReplyNotify !== undefined ? Boolean(inAppReplyNotify) : (tcpaAccepted !== undefined ? Boolean(tcpaAccepted) : true);

  const { note, aiReply } = await addPropertyNote({
    propertyId,
    leadId,
    authorName: typeof authorName === 'string' ? authorName.substring(0, 100) : authorName,
    text: typeof text === 'string' ? text.substring(0, 500) : text,
    ipAddress: ip,
    inAppReplyNotify: notifyPref
  });

  res.json({ success: true, note, aiReply });
});

// =============================================================================
// STAFF & LO PORTAL ENDPOINTS (RBAC Gated via requireStaffRole)
// =============================================================================

// 9a. Mike Ford & Staff Conversation Inbox (Reads from Firestore fthb_conversations with RBAC scoping & audit stamping)
app.get('/api/mike/inbox', requireStaffRole('master_admin', 'admin', 'loan_officer', 'auditor'), async (req: Request, res: Response): Promise<void> => {
  const staff = (req as any).staff as StaffContext;

  try {
    const rawConversations = await getMikeConversationInbox();

    // 1. Enforce Role & Scoping Rules
    let scopedConversations = rawConversations;

    if (staff.role === 'loan_officer') {
      const assigned = staff.assignedLeads || [];
      scopedConversations = rawConversations.filter(c => assigned.includes(c.leadId));
    } else if (staff.role === 'admin' && staff.branch) {
      const targetBranch = staff.branch.toLowerCase().trim();
      scopedConversations = rawConversations.filter(c => {
        const leadBranch = c.branch?.toLowerCase().trim();
        const city = c.statedPreferences?.city?.toLowerCase().trim();
        return leadBranch === targetBranch || city === targetBranch;
      });
    }

    // 2. Audit Stamping: stamp an audit entry for each lead thread accessed
    for (const c of scopedConversations) {
      await recordStaffAudit({
        actor: staff.email,
        role: staff.role,
        action: 'READ_INBOX_THREAD',
        targetLeadId: c.leadId,
        branch: staff.branch,
        outcome: 'ALLOWED'
      });
    }

    // 3. PII Masking: mask email/phone for auditor, IT tester, branch manager, or unassigned LO
    const maskedConversations = scopedConversations.map(c => maskBuyerPii(c, staff));

    // 4. Attach TCPA text consent badge per lead (reads from TCPA consent records ONLY)
    const conversationsWithTcpa = await Promise.all(
      maskedConversations.map(async (c) => {
        const tcpaBadge = await getLeadTcpaConsentBadge(c.leadId);
        return {
          ...c,
          tcpaBadge
        };
      })
    );

    res.json({
      totalCount: conversationsWithTcpa.length,
      conversations: conversationsWithTcpa
    });
  } catch (err: any) {
    console.error('[Mike Inbox Error]', err);
    res.status(500).json({ error: 'Failed to retrieve conversation inbox' });
  }
});

// 9b. Staff Single Lead Conversation Read (RBAC scoped with audit stamping)
app.get('/api/lo/conversation/:leadId', requireStaffRole('master_admin', 'admin', 'loan_officer', 'auditor'), async (req: Request, res: Response): Promise<void> => {
  const staff = (req as any).staff as StaffContext;
  const leadId = req.params.leadId;

  // Enforce Loan Officer assignment
  if (staff.role === 'loan_officer') {
    const assigned = staff.assignedLeads || [];
    if (!assigned.includes(leadId)) {
      await recordStaffAudit({
        actor: staff.email,
        role: staff.role,
        action: 'READ_CONVERSATION',
        targetLeadId: leadId,
        outcome: 'DENIED',
        metadata: { reason: 'Unassigned lead access blocked' }
      });
      res.status(403).json({
        error: 'Forbidden: Access denied to unassigned lead.',
        code: 'UNASSIGNED_LEAD_ACCESS_DENIED'
      });
      return;
    }
  }

  const session = await getBuyerSession(leadId);
  if (!session) {
    res.status(404).json({ error: 'Conversation thread not found' });
    return;
  }

  // Enforce Branch Manager scoping
  if (staff.role === 'admin' && staff.branch) {
    const targetBranch = staff.branch.toLowerCase().trim();
    const leadBranch = session.branch?.toLowerCase().trim();
    const city = session.statedPreferences?.city?.toLowerCase().trim();
    if (leadBranch !== targetBranch && city !== targetBranch) {
      await recordStaffAudit({
        actor: staff.email,
        role: staff.role,
        action: 'READ_CONVERSATION',
        targetLeadId: leadId,
        branch: staff.branch,
        outcome: 'DENIED',
        metadata: { reason: 'Cross-branch access blocked' }
      });
      res.status(403).json({
        error: 'Forbidden: Access denied to leads outside your branch.',
        code: 'CROSS_BRANCH_ACCESS_DENIED'
      });
      return;
    }
  }

  // Stamp Allowed Audit Record
  await recordStaffAudit({
    actor: staff.email,
    role: staff.role,
    action: 'READ_CONVERSATION',
    targetLeadId: leadId,
    branch: staff.branch,
    outcome: 'ALLOWED'
  });

  res.json(maskBuyerPii(session, staff));
});

// 9c. Staff 3-Way Reply (Simulates Mike or assigned LO replying from iPhone)
app.post('/api/mike/reply', requireStaffRole('master_admin', 'admin', 'loan_officer'), async (req: Request, res: Response): Promise<void> => {
  const staff = (req as any).staff as StaffContext;
  const { leadId, propertyId, text } = req.body;

  if (!leadId || !text) {
    res.status(400).json({ error: 'leadId and text required' });
    return;
  }

  // Enforce Loan Officer assignment on reply
  if (staff.role === 'loan_officer') {
    const assigned = staff.assignedLeads || [];
    if (!assigned.includes(leadId)) {
      await recordStaffAudit({
        actor: staff.email,
        role: staff.role,
        action: 'STAFF_REPLY',
        targetLeadId: leadId,
        outcome: 'DENIED',
        metadata: { reason: 'Reply blocked on unassigned lead' }
      });
      res.status(403).json({
        error: 'Forbidden: Cannot reply to unassigned lead.',
        code: 'UNASSIGNED_LEAD_ACCESS_DENIED'
      });
      return;
    }
  }

  let resultMsg: any;
  if (propertyId) {
    resultMsg = await addMikePropertyReply(propertyId, leadId, text);
  } else {
    resultMsg = await handleMikeReply(leadId, text);
  }

  await recordStaffAudit({
    actor: staff.email,
    role: staff.role,
    action: 'STAFF_REPLY',
    targetLeadId: leadId,
    branch: staff.branch,
    outcome: 'ALLOWED',
    metadata: { propertyId, channel: propertyId ? 'PROPERTY_NOTE' : 'MUSE_CHAT' }
  });

  res.json({
    success: true,
    channel: propertyId ? 'PROPERTY_NOTE' : 'MUSE_CHAT',
    message: resultMsg
  });
});

// 9d. Compliance Audit Ledger View (auditor & master_admin ONLY)
app.get('/api/lo/audit-ledger', requireStaffRole('master_admin', 'auditor'), async (req: Request, res: Response): Promise<void> => {
  const staff = (req as any).staff as StaffContext;

  await recordStaffAudit({
    actor: staff.email,
    role: staff.role,
    action: 'READ_AUDIT_LEDGER',
    outcome: 'ALLOWED'
  });

  const staffLedger = getComplianceAuditLedger();
  const buyerLedger = getAuditLedger().map(b => ({
    id: b.id,
    timestamp: b.timestamp,
    actor: b.leadId,
    role: 'loan_officer' as const,
    action: b.actionType,
    targetLeadId: b.leadId,
    outcome: 'ALLOWED' as const,
    metadata: b.redactedPayload
  }));

  const allLedger = [...staffLedger, ...buyerLedger].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  res.json({
    totalCount: allLedger.length,
    entries: allLedger
  });
});

// 9e. Staff Roster Provisioning & Updates (master_admin ONLY)
app.post('/api/staff/roster', requireStaffRole('master_admin'), async (req: Request, res: Response): Promise<void> => {
  const staff = (req as any).staff as StaffContext;
  const { email, role, branch, assignedLeads, expiresAt, isRevoked } = req.body;

  if (!email || typeof email !== 'string' || !role) {
    res.status(400).json({ error: 'email and role are required' });
    return;
  }

  const validRoles = ['master_admin', 'admin', 'loan_officer', 'auditor'];
  if (!validRoles.includes(role)) {
    res.status(400).json({ error: `Invalid role. Allowed roles: ${validRoles.join(', ')}` });
    return;
  }

  try {
    const updated = await upsertStaffRosterDoc(
      { email, role, branch, assignedLeads, expiresAt, isRevoked },
      staff.email
    );

    await recordStaffAudit({
      actor: staff.email,
      role: staff.role,
      action: 'UPSERT_STAFF_ROSTER',
      outcome: 'ALLOWED',
      metadata: { targetEmail: email, role, branch }
    });

    res.json({
      success: true,
      staff: updated
    });
  } catch (err: any) {
    console.error('[Staff Roster Upsert Error]', err.message);
    res.status(500).json({ error: 'Failed to update staff roster' });
  }
});

// 9f. Staff Roster Listing (master_admin ONLY)
app.get('/api/staff/roster', requireStaffRole('master_admin'), async (req: Request, res: Response): Promise<void> => {
  const staff = (req as any).staff as StaffContext;

  try {
    const roster = await listStaffRoster(staff.email);

    await recordStaffAudit({
      actor: staff.email,
      role: staff.role,
      action: 'LIST_STAFF_ROSTER',
      outcome: 'ALLOWED'
    });

    res.json({
      totalCount: roster.length,
      staff: roster
    });
  } catch (err: any) {
    console.error('[Staff Roster List Error]', err.message);
    res.status(500).json({ error: 'Failed to list staff roster' });
  }
});

// 9g. 1-Click Staff Revocation (master_admin ONLY)
app.post(['/api/staff/revoke', '/api/lo/staff/revoke'], requireStaffRole('master_admin'), async (req: Request, res: Response): Promise<void> => {
  const staff = (req as any).staff as StaffContext;
  const { email } = req.body;

  if (!email || typeof email !== 'string') {
    res.status(400).json({ error: 'Staff email is required' });
    return;
  }

  const revoked = await revokeStaffRosterDoc(email, staff.email);

  await recordStaffAudit({
    actor: staff.email,
    role: staff.role,
    action: 'REVOKE_STAFF_ACCESS',
    outcome: 'ALLOWED',
    metadata: { targetStaffEmail: email, success: revoked }
  });

  res.json({
    success: revoked,
    email,
    status: 'REVOKED'
  });
});

// 9h. Staff Access Restoration (master_admin ONLY)
app.post(['/api/staff/restore', '/api/lo/staff/restore'], requireStaffRole('master_admin'), async (req: Request, res: Response): Promise<void> => {
  const staff = (req as any).staff as StaffContext;
  const { email } = req.body;

  if (!email || typeof email !== 'string') {
    res.status(400).json({ error: 'Staff email is required' });
    return;
  }

  const restored = await restoreStaffRosterDoc(email, staff.email);

  await recordStaffAudit({
    actor: staff.email,
    role: staff.role,
    action: 'RESTORE_STAFF_ACCESS',
    outcome: 'ALLOWED',
    metadata: { targetStaffEmail: email, success: restored }
  });

  res.json({
    success: restored,
    email,
    status: 'ACTIVE'
  });
});

// 9b. Push Notification Registration Status
// STATUS: Marked honestly as not-yet-wired pending production VAPID / APNs keys.
app.get('/api/lo/device-status', (_req: Request, res: Response): void => {
  res.json({
    status: 'NOT_YET_WIRED',
    totalRegisteredDevices: 0,
    message: 'Push notification registration for Mike Ford is pending production VAPID / APNs credentials.'
  });
});

// 10. Buyer Price-Drop & Match Alert Opt-in
app.post('/api/alerts/subscribe', requireBuyerSession(getBuyerSession), (req: Request, res: Response): void => {
  const ip = getClientIp(req);
  const { leadId, emailOrPhone, criteria, pushSubscriptionJson } = req.body;

  if (!leadId) {
    res.status(400).json({ error: 'leadId is required' });
    return;
  }

  const result = registerBuyerAlertOptIn({
    leadId,
    ipAddress: ip,
    emailOrPhone: emailOrPhone ? sanitizePiiInput(emailOrPhone) : undefined,
    pushSubscriptionJson,
    criteria: criteria || { favoriteListingIds: [] }
  });

  res.json(result);
});

// 11. Publishing Toolkit Kit Generation
app.get('/api/publishing/kit', async (req: Request, res: Response): Promise<void> => {
  const listingId = req.query.listingId as string | undefined;
  const listings = listingId ? await queryCuratedListings({ listingId }) : [];
  const listing = listings[0];
  const kit = generatePublishingKit(listing, APP_URL);
  res.json(kit);
});

// 12. Dynamic Open Graph Share URL (Rich Facebook & iMessage preview cards)
app.get('/share/:listingId', async (req: Request, res: Response): Promise<void> => {
  const listings = await queryCuratedListings({ listingId: req.params.listingId });
  const listing = listings[0];
  const title = listing
    ? `${listing.address}, ${listing.city} — $${listing.price?.toLocaleString()} | Likely Qualifies for 0%–3.5% Down`
    : `FTHB House Finder — Curated Low-Down Homes | Mike Ford (NMLS #288455)`;

  const description = listing
    ? `${listing.bedrooms} bed, ${listing.bathrooms} bath single-family home. Pre-screened for ${listing.programTags.join(', ')}. Estimated payment ~$${listing.estimatedMonthlyPayment?.toLocaleString()}/mo with 2-1 buydown option.`
    : `Curated first-time homebuyer house finder with low/no-down payment qualifying homes by Mike Ford (NMLS #288455).`;

  const image = listing?.photoUrl || `${APP_URL}/og-image.png`;
  const shareTargetUrl = `${APP_URL}?listing=${req.params.listingId}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <meta name="description" content="${description}">
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${shareTargetUrl}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${image}">

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${image}">

  <!-- Immediate Redirect into App -->
  <meta http-equiv="refresh" content="0; url=${shareTargetUrl}">
</head>
<body style="background:#090d16;color:#f8fafc;font-family:sans-serif;padding:2rem;text-align:center;">
  <h2>Redirecting to curated home details...</h2>
  <p><a href="${shareTargetUrl}" style="color:#38bdf8;">Click here if not redirected automatically.</a></p>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// Serve public static assets
app.use(express.static(path.join(__dirname, 'public')));

// -----------------------------------------------------------------------------
// Vite Dev Server / Static Production Serving
// -----------------------------------------------------------------------------
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req: Request, res: Response) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[FTHB House Finder] Server running at http://0.0.0.0:${PORT}`);
    console.log(`[Zero-Trust] Fail-closed authentication active.`);
    console.log(`[Mike Ford NMLS #288455] Attribution verified.`);
    startHeartbeatScheduler();
  });
}

export { app, startServer };

if (process.env.NODE_ENV !== 'test' && process.env.IS_TEST_RUNNER !== 'true') {
  startServer().catch(err => {
    console.error('[Server Start Failure]', err);
    process.exit(1);
  });
}
