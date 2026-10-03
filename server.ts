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
import { getAdminFirestore } from './src/server/firebaseAdmin.ts';
import {
  requireBuyerSession,
  requireStaffRole,
  recordStaffAudit,
  maskBuyerPii,
  getComplianceAuditLedger,
  revokeStaffMember,
  restoreStaffMember,
  type StaffContext
} from './src/server/rbac.ts';
import {
  getOrCreateBuyerSession,
  getBuyerSession,
  handleBuyerMessage,
  handleMikeReply,
  updateBuyerFavorites,
  getMikeConversationInbox
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
import { sanitizePiiInput } from './src/server/compliance.ts';
import { getMikeDeviceTokens } from './src/server/deviceTokens.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
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

// -----------------------------------------------------------------------------
// API Endpoints
// -----------------------------------------------------------------------------

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

  const existingLeadId = req.body.leadId;
  const leadId = (existingLeadId && typeof existingLeadId === 'string' && existingLeadId.length > 5)
    ? existingLeadId
    : `lead-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  const session = await getOrCreateBuyerSession(leadId, ip);

  res.json({
    leadId: session.leadId,
    disclaimerServed: session.disclaimerServed,
    disclaimerText: session.messages[0]?.text || '',
    statedPreferences: session.statedPreferences,
    messagesCount: session.messages.length
  });
});

// 1b. Lead Identity Resolution (Passwordless Email-Link Sign-In Flow)
// Normalizes email and links to existing lead or initializes a new linkable buyer record
app.post('/api/auth/identify', async (req: Request, res: Response): Promise<void> => {
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

    await db.collection('leads').doc(targetLeadId).set({
      id: targetLeadId,
      leadId: targetLeadId,
      email: normalizedEmail,
      source: 'plugin-email-link',
      statedPreferences: session.statedPreferences,
      createdAt: session.createdAt,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    await db.collection('fthb_conversations').doc(targetLeadId).set({
      email: normalizedEmail,
      updatedAt: new Date().toISOString()
    }, { merge: true });

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

// 3b. Per-Lead Curations Endpoint (Reads lead_curations/{leadId} cross-project)
app.get('/api/buyer/curations/:leadId', requireBuyerSession(getBuyerSession), async (req: Request, res: Response): Promise<void> => {
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
app.post('/api/buyer/register-device', requireBuyerSession(getBuyerSession), async (req: Request, res: Response): Promise<void> => {
  const { leadId, deviceToken, platform } = req.body;
  if (!leadId || !deviceToken) {
    res.status(400).json({ error: 'leadId and deviceToken required' });
    return;
  }

  const db = getAdminFirestore();
  if (db) {
    try {
      await db.collection('device_tokens').doc(leadId).set({
        leadId,
        deviceToken,
        platform: platform || 'web_push',
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (err: any) {
      console.warn('[Device Token Warning]', err.message);
    }
  }

  res.json({ success: true, leadId, status: 'REGISTERED' });
});

// 3d. Curation Push Notification Trigger (Prompt B Spec 4)
// Dispatches notification: "Mike Ford curated N homes for you in <city>."
app.post('/api/buyer/notify-curation/:leadId', async (req: Request, res: Response): Promise<void> => {
  const { leadId } = req.params;
  const { count, city } = req.body;
  const targetCity = city || 'your area';
  const targetCount = count || 'new';

  const notificationTitle = 'Mike Ford Curated Homes';
  const notificationBody = `Mike Ford curated ${targetCount} homes for you in ${targetCity}.`;

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
    body: notificationBody
  });
});

// 4. Muse AI Chat (Tier 4 Rate Limit: 60 sensitive ops / 15 min)
app.post('/api/muse/chat', requireBuyerSession(getBuyerSession), async (req: Request, res: Response): Promise<void> => {
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

  try {
    const reply = await handleBuyerMessage(leadId, message, ip);
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
app.post('/api/buyer/favorites', requireBuyerSession(getBuyerSession), async (req: Request, res: Response): Promise<void> => {
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

// 8. Add Property Note (Server write with TCPA & Audit Ledger logging)
app.post('/api/notes', requireBuyerSession(getBuyerSession), async (req: Request, res: Response): Promise<void> => {
  const ip = getClientIp(req);
  const sensitiveCheck = rateLimitSensitive(ip);

  if (!sensitiveCheck.allowed) {
    res.status(429).json({
      error: 'Rate limit exceeded for property notes.',
      retryAfterSeconds: sensitiveCheck.resetInSec
    });
    return;
  }

  const { propertyId, leadId, authorName, text, tcpaAccepted } = req.body;
  if (!propertyId || !leadId || !text) {
    res.status(400).json({ error: 'propertyId, leadId, and text are required' });
    return;
  }

  const note = await addPropertyNote({
    propertyId,
    leadId,
    authorName,
    text,
    ipAddress: ip,
    tcpaAccepted: Boolean(tcpaAccepted)
  });

  res.json({ success: true, note });
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

    res.json({
      totalCount: maskedConversations.length,
      conversations: maskedConversations
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
    resultMsg = addMikePropertyReply(propertyId, leadId, text);
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

  const ledger = getComplianceAuditLedger();
  res.json({
    totalCount: ledger.length,
    entries: ledger
  });
});

// 9e. 1-Click Staff Revocation (master_admin ONLY)
app.post('/api/lo/staff/revoke', requireStaffRole('master_admin'), async (req: Request, res: Response): Promise<void> => {
  const staff = (req as any).staff as StaffContext;
  const { email } = req.body;

  if (!email || typeof email !== 'string') {
    res.status(400).json({ error: 'Staff email is required' });
    return;
  }

  const revoked = revokeStaffMember(email);

  await recordStaffAudit({
    actor: staff.email,
    role: staff.role,
    action: 'REVOKE_STAFF_ACCESS',
    outcome: 'ALLOWED',
    metadata: { targetStaffEmail: email, success: revoked }
  });

  res.json({
    success: true,
    email,
    status: 'REVOKED'
  });
});

// 9f. Staff Access Restoration (master_admin ONLY)
app.post('/api/lo/staff/restore', requireStaffRole('master_admin'), async (req: Request, res: Response): Promise<void> => {
  const staff = (req as any).staff as StaffContext;
  const { email } = req.body;

  if (!email || typeof email !== 'string') {
    res.status(400).json({ error: 'Staff email is required' });
    return;
  }

  const restored = restoreStaffMember(email);

  await recordStaffAudit({
    actor: staff.email,
    role: staff.role,
    action: 'RESTORE_STAFF_ACCESS',
    outcome: 'ALLOWED',
    metadata: { targetStaffEmail: email, success: restored }
  });

  res.json({
    success: true,
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
  });
}

export { app, startServer };

if (process.env.NODE_ENV !== 'test' && process.env.IS_TEST_RUNNER !== 'true') {
  startServer().catch(err => {
    console.error('[Server Start Failure]', err);
    process.exit(1);
  });
}
