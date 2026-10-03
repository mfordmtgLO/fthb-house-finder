// Copyright (c) 2026 Mike Ford, NMLS #288455. All Rights Reserved.
/**
 * Property Notes & Two-Way Conversations Engine
 * Homebuyer property_conversations pattern: {propertyId}_{leadId}
 * 
 * Persistent Firestore storage in collection `property_threads/{threadId}`,
 * strict audit ledger writes, TCPA opt-in tracking, question auto-detection,
 * and dynamic LO + Agent co-branded pairings lookup from Firestore via Admin SDK.
 */

import { sanitizePiiInput, detectBuyerActionItems, recordAuditLedger, pushToMikeIPhone } from './compliance.ts';
import { MIKE_FORD_LO_PROFILE, getPairedAgentForCity, type LoanOfficerProfile, type AgentProfile } from './agentPairings.ts';
import { queryCuratedListings } from './curatedData.ts';
import { getAdminFirestore } from './firebaseAdmin.ts';

export interface PropertyNoteMessage {
  id: string;
  sender: 'buyer' | 'lo' | 'agent';
  authorName: string;
  text: string;
  timestamp: string;
  isQuestion: boolean;
  actionCategory?: string | null;
}

export interface PropertyThread {
  threadId: string;
  propertyId: string;
  leadId: string;
  propertyAddress: string;
  createdAt: string;
  updatedAt: string;
  messages: PropertyNoteMessage[];
  loProfile: LoanOfficerProfile;
  agentProfile: AgentProfile | null; // null if unassigned (honest empty state)
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

  // 3. Initialize new thread
  const listings = await queryCuratedListings({ listingId: propertyId });
  const listing = listings[0];
  const propertyAddress = listing ? `${listing.address}, ${listing.city}` : 'Curated Home';
  const pairedAgent = listing ? await getPairedAgentForCity(listing.city) : null;

  const newThread: PropertyThread = {
    threadId,
    propertyId,
    leadId,
    propertyAddress,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [],
    loProfile: MIKE_FORD_LO_PROFILE,
    agentProfile: pairedAgent
  };

  threadCache.set(threadId, newThread);

  if (db) {
    try {
      await db.collection('property_threads').doc(threadId).set(newThread);
    } catch (err: any) {
      console.warn('[Property Thread Firestore Init Warning]', err.message);
    }
  }

  return newThread;
}

/**
 * Adds a buyer property note with PII sanitization, TCPA audit stamping,
 * auto question routing, and persistent Firestore write.
 */
export async function addPropertyNote(params: {
  propertyId: string;
  leadId: string;
  authorName: string;
  text: string;
  ipAddress: string;
  tcpaAccepted?: boolean;
}): Promise<PropertyNoteMessage> {
  const { propertyId, leadId, authorName, text, ipAddress, tcpaAccepted } = params;
  const thread = await getOrCreatePropertyThread(propertyId, leadId);
  const cleanText = sanitizePiiInput(text);

  const actionCheck = detectBuyerActionItems(cleanText);

  // If TCPA opt-in was checked, record in audit ledger
  if (tcpaAccepted) {
    recordAuditLedger({
      leadId,
      actionType: 'TCPA_OPT_IN',
      propertyId,
      ipAddress,
      redactedPayload: { authorName: sanitizePiiInput(authorName), textPreview: cleanText.substring(0, 40) }
    });
  }

  // Record note in audit ledger
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
  threadCache.set(thread.threadId, thread);

  // Persist to Firestore
  const db = getAdminFirestore();
  if (db) {
    try {
      await db.collection('property_threads').doc(thread.threadId).set(thread, { merge: true });
    } catch (err: any) {
      console.warn('[Property Thread Firestore Write Warning]', err.message);
    }
  }

  // If question detected, notify Mike Ford's iPhone
  if (actionCheck.isQuestion) {
    await pushToMikeIPhone({
      title: `Buyer Question on ${thread.propertyAddress}`,
      body: `[${noteMsg.authorName}]: ${cleanText}`,
      leadId,
      propertyId,
      category: actionCheck.actionCategory || 'PROPERTY_NOTE_QUESTION'
    });
  }

  return noteMsg;
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
    authorName: 'Mike Ford (NMLS #288455)',
    text: cleanText,
    timestamp: new Date().toISOString(),
    isQuestion: false
  };

  thread.messages.push(replyMsg);
  thread.updatedAt = new Date().toISOString();
  threadCache.set(thread.threadId, thread);

  const db = getAdminFirestore();
  if (db) {
    try {
      await db.collection('property_threads').doc(thread.threadId).set(thread, { merge: true });
    } catch (err: any) {
      console.warn('[Property Thread Firestore Write Warning]', err.message);
    }
  }

  return replyMsg;
}
