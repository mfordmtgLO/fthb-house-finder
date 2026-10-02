// Copyright (c) 2026 Mike Ford, NMLS #288455. All Rights Reserved.
/**
 * Property Notes & Two-Way Conversations Engine
 * Homebuyer property_conversations pattern: {propertyId}_{leadId}
 * Strict audit ledger writes, TCPA opt-in tracking, question auto-detection,
 * and LO + Agent co-branded pairings lookup.
 */

import { sanitizePiiInput, detectBuyerActionItems, recordAuditLedger, pushToMikeIPhone } from './compliance.ts';
import { MIKE_FORD_LO_PROFILE, getPairedAgentForCity, type LoanOfficerProfile, type AgentProfile } from './agentPairings.ts';
import { CURATED_LISTINGS } from './curatedData.ts';

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

// In-memory property threads keyed by `${propertyId}_${leadId}` (mirrored to Firestore)
const threadStore = new Map<string, PropertyThread>();

export function getOrCreatePropertyThread(propertyId: string, leadId: string): PropertyThread {
  const threadId = `${propertyId}_${leadId}`;
  let thread = threadStore.get(threadId);

  if (!thread) {
    const listing = CURATED_LISTINGS.find(l => l.id === propertyId);
    const propertyAddress = listing ? `${listing.address}, ${listing.city}` : 'Curated Home';
    const pairedAgent = listing ? getPairedAgentForCity(listing.city) : null;

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
  const thread = getOrCreatePropertyThread(propertyId, leadId);
  const cleanText = sanitizePiiInput(text);

  const actionCheck = detectBuyerActionItems(cleanText);

  // If TCPA opt-in was checked or implied, record in audit ledger
  if (tcpaAccepted) {
    recordAuditLedger({
      leadId,
      actionType: 'TCPA_OPT_IN',
      propertyId,
      ipAddress,
      redactedPayload: { noteExcerpt: cleanText.substring(0, 50) },
      tcpaLanguageVersion: 'TCPA_CONSENT_V1_2026'
    });
  }

  // Record note in audit ledger
  recordAuditLedger({
    leadId,
    actionType: 'PROPERTY_NOTE',
    propertyId,
    ipAddress,
    redactedPayload: { noteExcerpt: cleanText.substring(0, 100) }
  });

  const message: PropertyNoteMessage = {
    id: `note-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    sender: 'buyer',
    authorName: sanitizePiiInput(authorName || 'Buyer'),
    text: cleanText,
    timestamp: new Date().toISOString(),
    isQuestion: actionCheck.isQuestion,
    actionCategory: actionCheck.actionCategory
  };

  thread.messages.push(message);
  thread.updatedAt = new Date().toISOString();

  // If question detected, push to Mike's iPhone
  if (actionCheck.isQuestion) {
    await pushToMikeIPhone({
      title: `Property Note Question: ${thread.propertyAddress}`,
      body: cleanText,
      leadId,
      propertyId,
      category: actionCheck.actionCategory || 'NOTE_QUESTION'
    });
  }

  return message;
}

export function addMikePropertyReply(propertyId: string, leadId: string, replyText: string): PropertyNoteMessage {
  const thread = getOrCreatePropertyThread(propertyId, leadId);
  const cleanText = sanitizePiiInput(replyText);

  const message: PropertyNoteMessage = {
    id: `note-${Date.now()}-mike`,
    sender: 'lo',
    authorName: 'Mike Ford (NMLS #288455)',
    text: cleanText,
    timestamp: new Date().toISOString(),
    isQuestion: false
  };

  thread.messages.push(message);
  thread.updatedAt = new Date().toISOString();
  return message;
}
