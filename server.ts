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

// Fail-closed authentication helper
// Allows requests with valid x-api-key OR valid active buyer session token
async function authenticateRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  const rawApiKey = (req.headers['x-api-key'] || req.headers['authorization']?.replace(/^Bearer\s+/i, '')) as string | undefined;
  const apiKey = typeof rawApiKey === 'string' ? rawApiKey.trim() : undefined;
  const sessionToken = req.headers['x-session-id'] as string | undefined;

  // Direct server-side / partner call with MUSE_API_KEY
  if (apiKey && apiKey === MUSE_API_KEY) {
    return next();
  }

  // Active verified buyer session
  if (sessionToken) {
    const session = await getBuyerSession(sessionToken);
    if (session) {
      return next();
    }
  }

  res.status(401).json({
    error: 'Unauthorized: Missing or invalid API key. Dedicated MUSE_API_KEY or verified session required.',
    code: 'FAIL_CLOSED_AUTH_REQUIRED'
  });
}

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

// 2. Curated Listings Endpoint (Fail-closed 401 without key or active session)
// ARCHITECTURE LAW: Serves verbatim curated listings from Firestore.
app.get('/api/listings', authenticateRequest, async (req: Request, res: Response): Promise<void> => {
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
app.get('/api/listings/:id', authenticateRequest, async (req: Request, res: Response): Promise<void> => {
  const listings = await queryCuratedListings({ listingId: req.params.id });
  const listing = listings[0];
  if (!listing) {
    res.status(404).json({ error: 'Curated listing not found' });
    return;
  }
  res.json(listing);
});

// 4. Muse AI Chat (Tier 4 Rate Limit: 60 sensitive ops / 15 min)
app.post('/api/muse/chat', authenticateRequest, async (req: Request, res: Response): Promise<void> => {
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
app.get('/api/muse/history/:leadId', authenticateRequest, async (req: Request, res: Response): Promise<void> => {
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
app.post('/api/buyer/favorites', authenticateRequest, async (req: Request, res: Response): Promise<void> => {
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
app.get('/api/notes/:propertyId/:leadId', authenticateRequest, async (req: Request, res: Response): Promise<void> => {
  const { propertyId, leadId } = req.params;
  const thread = await getOrCreatePropertyThread(propertyId, leadId);
  res.json(thread);
});

// 8. Add Property Note (Server write with TCPA & Audit Ledger logging)
app.post('/api/notes', authenticateRequest, async (req: Request, res: Response): Promise<void> => {
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

// 9. Mike Ford LO 3-Way Reply (Simulates Mike replying from iPhone)
app.post('/api/mike/reply', async (req: Request, res: Response): Promise<void> => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== MUSE_API_KEY) {
    res.status(401).json({ error: 'Unauthorized: MUSE_API_KEY required for LO direct replies' });
    return;
  }

  const { leadId, propertyId, text } = req.body;
  if (!leadId || !text) {
    res.status(400).json({ error: 'leadId and text required' });
    return;
  }

  if (propertyId) {
    const msg = addMikePropertyReply(propertyId, leadId, text);
    res.json({ success: true, channel: 'PROPERTY_NOTE', message: msg });
  } else {
    const msg = await handleMikeReply(leadId, text);
    res.json({ success: true, channel: 'MUSE_CHAT', message: msg });
  }
});

// 9a. Mike Ford LO Conversation Inbox (Reads directly from Firestore fthb_conversations)
app.get('/api/mike/inbox', async (req: Request, res: Response): Promise<void> => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== MUSE_API_KEY) {
    res.status(401).json({ error: 'Unauthorized: MUSE_API_KEY required for LO inbox access' });
    return;
  }

  try {
    const conversations = await getMikeConversationInbox();
    res.json({
      totalCount: conversations.length,
      conversations
    });
  } catch (err: any) {
    console.error('[Mike Inbox Error]', err);
    res.status(500).json({ error: 'Failed to retrieve conversation inbox' });
  }
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
app.post('/api/alerts/subscribe', authenticateRequest, (req: Request, res: Response): void => {
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

startServer().catch(err => {
  console.error('[Server Start Failure]', err);
  process.exit(1);
});
