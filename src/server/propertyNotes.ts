// Copyright (c) 2026 Mike Ford, NMLS #288455. All Rights Reserved.
/**
 * Property Notes & Two-Way Conversations Engine
 * Homebuyer property_conversations pattern: {propertyId}_{leadId}
 * Strict audit ledger writes, TCPA opt-in tracking, question auto-detection,
 * and dynamic LO + Agent co-branded pairings lookup from Firestore via Admin SDK.
 */

import { sanitizePiiInput, detectBuyerActionItems, recordAuditLedger, pushToMikeIPhone } from './compliance.ts';
import { MIKE_FORD_LO_PROFILE, getPairedAgentForCity, type LoanOfficerProfile, type AgentProfile } from './agentPairings.ts';
import { queryCuratedListings } from './curatedData.ts';

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

// Server property thread store
const threadStore = new Map<string, PropertyThread>();

export async function getOrCreatePropertyThread(propertyId: string, leadId: string): Promise<PropertyThread> {
  const threadId = `${propertyId}_${leadId}`;
  let thread = threadStore.get(threadId);

  if (!thread) {
    const listings = await queryCuratedListings({ listingId: propertyId });
    const listing = listings[0];
    const propertyAddress = listing ? `${listing.address}, ${listing.city}` : 'Curated Home';
    const pairedAgent = listing ? await getPairedAgentForCity(listing.city) : null;

    thread = {
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
    threadStore.set(threadId, thread);
  }

  return thread;
}

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

  // If TCPA opt-in was checked or implied, record in audit ledger
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

export function addMikePropertyReply(propertyId: string, leadId: string, replyText: string): PropertyNoteMessage {
  const threadId = `${propertyId}_${leadId}`;
  let thread = threadStore.get(threadId);

  if (!thread) {
    thread = {
      threadId,
      propertyId,
      leadId,
      propertyAddress: 'Curated Home',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
      loProfile: MIKE_FORD_LO_PROFILE,
      agentProfile: null
    };
    threadStore.set(threadId, thread);
  }

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

  return replyMsg;
}
