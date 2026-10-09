// Copyright (c) 2026 Mike Ford, NMLS #288455. All Rights Reserved.
/**
 * Property Notes & Two-Way Conversations Engine (Tiered Architecture)
 * Homebuyer property_conversations pattern: {propertyId}_{leadId}
 * 
 * Triage Layer:
 * - Tier 1 (Educational/Informational/Buydown/Cost-of-Waiting/General): Instant grounded Muse AI reply.
 * - Tier 2 (Transactional/Showing/Application): Zero AI, warm routing to Mike Ford + partner agent.
 * 
 * Persistent Firestore storage in collection `property_threads/{threadId}`.
 * Full GLBA compliance audit ledger stamping, zero-trust PII sanitization.
 */

import { sanitizePiiInput, detectBuyerActionItems, recordAuditLedger } from './compliance.ts';
import { getPairingDetails, type LoanOfficerProfile, type AgentProfile } from './agentPairings.ts';
import { queryCuratedListings, type CuratedListing } from './curatedData.ts';
import { getAdminFirestore } from './firebaseAdmin.ts';
import { getBuyerSession } from './museEngine.ts';

export interface PropertyNoteMessage {
  id: string;
  sender: 'buyer' | 'lo' | 'agent' | 'muse';
  authorName: string;
  text: string;
  timestamp: string;
  isQuestion: boolean;
  actionCategory?: string | null;
  tier?: 1 | 2;
  citations?: string[];
  isAi?: boolean;
}

export interface PropertyThread {
  threadId: string;
  propertyId: string;
  leadId: string;
  propertyAddress: string;
  createdAt: string;
  updatedAt: string;
  messages: PropertyNoteMessage[];
  loProfile: LoanOfficerProfile | null;
  agentProfile: AgentProfile | null;
}

// In-memory cache for fast hot-path retrieval (mirrored to Firestore property_threads)
const threadCache = new Map<string, PropertyThread>();

export function clearPropertyNotesMemoryCache(): void {
  threadCache.clear();
}

/**
 * Loads or creates a property thread from Firestore `property_threads/{threadId}`
 */
export async function getOrCreatePropertyThread(propertyId: string, leadId: string): Promise<PropertyThread> {
  const threadId = `${propertyId}_${leadId}`;
  
  // 1. Check in-memory cache
  if (threadCache.has(threadId)) {
    return threadCache.get(threadId)!;
  }

  const db = getAdminFirestore();

  // 2. Check Firestore persistence
  if (db) {
    try {
      const docSnap = await db.collection('property_threads').doc(threadId).get();
      if (docSnap.exists) {
        const data = docSnap.data() as PropertyThread;
        threadCache.set(threadId, data);
        return data;
      }
    } catch (err: any) {
      console.warn('[Property Thread Firestore Read Warning]', err.message);
    }
  }

  // 3. Initialize new thread; never assume the buyer belongs to Mike Ford.
  const session = await getBuyerSession(leadId);
  const verifiedPairing = session?.pairing?.id ? await getPairingDetails(session.pairing.id) : null;
  const listings = await queryCuratedListings({ listingId: propertyId });
  const listing = listings[0];
  const propertyAddress = listing ? `${listing.address}, ${listing.city}` : 'Curated Home';
  const pairedAgent = verifiedPairing?.agent || null;

  const newThread: PropertyThread = {
    threadId,
    propertyId,
    leadId,
    propertyAddress,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [],
    loProfile: verifiedPairing?.lo || null,
    agentProfile: pairedAgent
  };

  if (!db) throw new Error('PROPERTY_NOTES_STORAGE_UNAVAILABLE');
  await db.collection('property_threads').doc(threadId).create(newThread).catch(async (err: any) => {
    // Another request may have created the thread concurrently.
    if (err.code !== 6 && err.code !== 'already-exists') throw err;
    const existing = await db.collection('property_threads').doc(threadId).get();
    if (!existing.exists) throw err;
    threadCache.set(threadId, existing.data() as PropertyThread);
  });
  if (threadCache.has(threadId)) return threadCache.get(threadId)!;
  threadCache.set(threadId, newThread);
  return newThread;
}

/**
 * Generates a Tier-1 Grounded Muse AI Reply for property note inquiries.
 * Uses exact Cost of Waiting calculations or Vantage Grounding KB.
 * Golden tongue voice: warm, encouraging, demystifies jargon, qualified language.
 */
export async function generateMuseNoteResponse(params: {
  noteText: string;
  listing: CuratedListing | null;
  authorName: string;
  loanOfficerName?: string | null;
}): Promise<{ text: string; citations: string[]; isCostOfWaiting: boolean }> {
  const loName = params.loanOfficerName?.trim();
  const handoff = loName ? loName : 'your assigned loan officer';
  const text = /\\b(?:tour|showing|visit|open house|neighborhood|schools|hoa)\\b/i.test(params.noteText)
    ? 'Thanks for your question about this home. Your real estate agent can verify the property details. Your homebuying team will review your note.'
    : `Thanks for your question about this home. ${handoff} can review the details for your situation. Your note has been saved for your homebuying team to review.`;
  // Only reviewed, fixed text. No Gemini, grounding prose, payment quote, or eligibility claim.
  return { text, citations: [], isCostOfWaiting: false };
}

/**
 * Adds a buyer property note with Tier 1/2 triage, PII sanitization,
 * TCPA audit stamping, and persistent Firestore write.
 */
export async function addPropertyNote(params: {
  propertyId: string;
  leadId: string;
  authorName: string;
  text: string;
  ipAddress: string;
  tcpaAccepted?: boolean;
}): Promise<{ note: PropertyNoteMessage; aiReply?: PropertyNoteMessage | null }> {
  const { propertyId, leadId, authorName, text, ipAddress } = params;
  const thread = await getOrCreatePropertyThread(propertyId, leadId);
  // Zero-trust PII sanitization + 500 char defensive length cap
  const cleanText = sanitizePiiInput(text).substring(0, 500);

  const actionCheck = detectBuyerActionItems(cleanText);

  // Property-note acknowledgement is never SMS/TCPA consent.
  // The legacy tcpaAccepted field is deliberately ignored here.

  // Record buyer note in audit ledger
  recordAuditLedger({
    leadId,
    actionType: 'PROPERTY_NOTE',
    propertyId,
    ipAddress,
    redactedPayload: { authorName: sanitizePiiInput(authorName), isQuestion: actionCheck.isQuestion }
  });

  const noteMsg: PropertyNoteMessage = {
    id: `note-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    sender: 'buyer',
    authorName: sanitizePiiInput(authorName) || 'Homebuyer',
    text: cleanText,
    timestamp: new Date().toISOString(),
    isQuestion: actionCheck.isQuestion,
    actionCategory: actionCheck.actionCategory
  };

  thread.messages.push(noteMsg);
  thread.updatedAt = new Date().toISOString();

  let aiReplyMsg: PropertyNoteMessage | null = null;

  const isShowingOrHighIntent =
    actionCheck.actionCategory === 'SHOWING_REQUEST' ||
    cleanText.toLowerCase().includes('tour') ||
    cleanText.toLowerCase().includes('schedule') ||
    cleanText.toLowerCase().includes('see this') ||
    cleanText.toLowerCase().includes('show this') ||
    cleanText.toLowerCase().includes('show me') ||
    cleanText.toLowerCase().includes('showing') ||
    cleanText.toLowerCase().includes('visit') ||
    cleanText.toLowerCase().includes('apply now') ||
    cleanText.toLowerCase().includes('apply for') ||
    cleanText.toLowerCase().includes('loan application') ||
    cleanText.toLowerCase().includes('mortgage application') ||
    cleanText.toLowerCase().includes('submit application') ||
    cleanText.toLowerCase().includes('take my application') ||
    cleanText.toLowerCase().includes('pull my credit') ||
    cleanText.toLowerCase().includes('credit report');

  // Save the buyer's own note. No automatic push or external delivery claim.
  // A separate authenticated, confirmed workflow routes to the assigned team.
  noteMsg.tier = isShowingOrHighIntent ? 2 : 1;
  const listings = await queryCuratedListings({ listingId: propertyId });
  const reply = await generateMuseNoteResponse({
    noteText: cleanText, listing: listings[0] || null,
    authorName: noteMsg.authorName, loanOfficerName: thread.loProfile?.name
  });
  aiReplyMsg = {
    id: `note-${Date.now()}-muse`,
    sender: 'muse', authorName: 'Geo · Homebuyer Guide',
    text: reply.text, timestamp: new Date().toISOString(),
    isQuestion: false, tier: noteMsg.tier, citations: [],
    isAi: false
  };
  thread.messages.push(aiReplyMsg);

  const db = getAdminFirestore();
  if (!db) throw new Error('PROPERTY_NOTES_STORAGE_UNAVAILABLE');
  await db.collection('property_threads').doc(thread.threadId).set(thread, { merge: true });
  threadCache.set(thread.threadId, thread);
  // Only return success after Firestore confirms the write.
  return { note: noteMsg, aiReply: aiReplyMsg };
}

/**
 * Adds a 3-way LO response to a property thread
 */
export async function addMikePropertyReply(propertyId: string, leadId: string, replyText: string): Promise<PropertyNoteMessage> {
  const thread = await getOrCreatePropertyThread(propertyId, leadId);
  const cleanText = sanitizePiiInput(replyText);

  const replyMsg: PropertyNoteMessage = {
    id: `reply-${Date.now()}-mike`,
    sender: 'lo',
    authorName: thread.loProfile?.name || 'Loan Officer',
    text: cleanText,
    timestamp: new Date().toISOString(),
    isQuestion: false
  };

  thread.messages.push(replyMsg);
  thread.updatedAt = new Date().toISOString();
  const db = getAdminFirestore();
  if (!db) throw new Error('PROPERTY_NOTES_STORAGE_UNAVAILABLE');
  await db.collection('property_threads').doc(thread.threadId).set(thread, { merge: true });
  threadCache.set(thread.threadId, thread);
  return replyMsg;
}
