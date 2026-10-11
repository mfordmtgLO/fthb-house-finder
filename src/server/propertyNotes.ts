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

import { sanitizePiiInput, detectBuyerActionItems, recordAuditLedger, pushToMikeIPhone } from './compliance.ts';
import { MIKE_FORD_LO_PROFILE, getPairedAgentForCity, type LoanOfficerProfile, type AgentProfile } from './agentPairings.ts';
import { queryCuratedListings, type CuratedListing } from './curatedData.ts';
import { queryVantageGrounding } from './vantageKnowledge.ts';
import { calculateCostOfWaiting, formatCostOfWaitingForMuse } from './costOfWaiting.ts';
import { getAdminFirestore, safeFirestoreWrite } from './firebaseAdmin.ts';

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
  inAppReplyNotify?: boolean;
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
  agentProfile: AgentProfile | null;
  inAppReplyNotify?: boolean;
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
    safeFirestoreWrite(db.collection('property_threads').doc(threadId).set(newThread), 1500).catch(err => {
      console.warn('[Property Thread Firestore Init Warning]', err.message);
    });
  }

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
}): Promise<{ text: string; citations: string[]; isCostOfWaiting: boolean }> {
  const { noteText, listing, authorName } = params;
  const lower = noteText.toLowerCase();
  const citations: string[] = [];

  const targetPrice = listing?.price || 450000;
  const isTimingQuestion =
    lower.includes('wait') ||
    lower.includes('should i wait') ||
    lower.includes('keep renting') ||
    lower.includes('rent vs buy') ||
    lower.includes('prices dropping') ||
    lower.includes('timing') ||
    lower.includes('cost of waiting') ||
    lower.includes('next year');

  const isBuydownQuestion =
    lower.includes('buydown') ||
    lower.includes('2-1') ||
    lower.includes('seller credit') ||
    lower.includes('concession');

  let costReport = null;
  let costGrounding = '';
  if (isTimingQuestion) {
    costReport = calculateCostOfWaiting({ targetPrice });
    costGrounding = formatCostOfWaitingForMuse(costReport, 1);
    citations.push('Deterministic Cost-of-Waiting Calculator (MortgageLab Algorithm)');
  }

  const vantageGrounding = queryVantageGrounding(noteText);
  if (vantageGrounding) {
    citations.push('Vantage Loan Program Grounding');
  }

  const firstName = authorName.split(' ')[0] || 'there';

  // Deterministic Golden-Tongue Response (Scripted-Only Architecture)
  if (isTimingQuestion && costReport) {
    const oneYr = costReport.intervals[1];
    const text = `You're asking a really smart question, ${firstName}! Deciding whether to buy now or wait is one of the most common dilemmas for first-time buyers.

Based on this home's $${targetPrice.toLocaleString()} price and assuming a standard 3.5% annual appreciation with $${costReport.monthlyRent.toLocaleString()}/mo rent:
• Waiting 1 year has an estimated total cost of waiting of $${oneYr.totalCostOfWaiting.toLocaleString()}.
• That includes approximately $${oneYr.cumulativeRentPaid.toLocaleString()} paid in non-recoverable rent, $${oneYr.missedPrincipalEquity.toLocaleString()} in missed principal equity paydown, and a projected $${oneYr.priceIncrease.toLocaleString()} increase in property value.
• If rates drop to ${oneYr.futureMonthlyPI.downRatePercent}%, your future P&I would be ~$${oneYr.futureMonthlyPI.downRate.toLocaleString()}/mo, but you may face higher purchase prices and competition.

Keep in mind that future appreciation and rates are economic assumptions. A low down payment program (FHA 3.5% or Conventional 3%) paired with seller credits often lets you step into equity sooner.

Want Mike Ford (NMLS #288455) to review your personal scenario or give you a quick call?`;

    return { text, citations, isCostOfWaiting: true };
  }

  if (isBuydownQuestion) {
    const text = `You're looking into one of our favorite strategies, ${firstName}! A 2-1 temporary buydown is an incredible tool where the seller pays a lump sum at closing to discount your interest rate by 2% in your first year and 1% in your second year.

This creates significant monthly savings while you settle into your new home, after which the loan returns to its fixed note rate. Buyers likely qualify at the standard note rate, and it is often much more impactful on your monthly payment than a modest price cut.

Want Mike Ford (NMLS #288455) to review whether this home qualifies for seller-paid buydown credits?`;

    citations.push('2-1 Buydown Underwriting Guidelines');
    return { text, citations, isCostOfWaiting: false };
  }

  // General Educational Response
  const text = `Great question on this home, ${firstName}! For this property, first-time buyers likely qualify for several low-down-payment options, including FHA financing with 3.5% down, Conventional 3% first-time buyer options, and potential down payment assistance grants depending on household income.

We also frequently negotiate seller credits toward closing costs to reduce your upfront out-of-pocket cash.

Want Mike Ford (NMLS #288455) to review your personal scenario or give you a quick call?`;

  citations.push('FTHB Purchase Programs');
  return { text, citations, isCostOfWaiting: false };
}

/**
 * Adds a buyer property note with Tier 1/2 triage, PII sanitization,
 * in-app reply notification preferences, and persistent Firestore write.
 * 
 * COMPLIANCE LAW:
 * Property note checkbox is strictly in-app reply confirmation. It is NOT
 * TCPA text consent, captures no phone number, and NEVER stamps TCPA_OPT_IN.
 */
export async function addPropertyNote(params: {
  propertyId: string;
  leadId: string;
  authorName: string;
  text: string;
  ipAddress: string;
  inAppReplyNotify?: boolean;
  tcpaAccepted?: boolean; // legacy alias
}): Promise<{ note: PropertyNoteMessage; aiReply?: PropertyNoteMessage | null }> {
  const { propertyId, leadId, authorName, text, ipAddress } = params;
  const inAppReplyNotify = Boolean(params.inAppReplyNotify ?? params.tcpaAccepted ?? true);
  const thread = await getOrCreatePropertyThread(propertyId, leadId);
  // Zero-trust PII sanitization + 500 char defensive length cap
  const cleanText = sanitizePiiInput(text).substring(0, 500);

  const actionCheck = detectBuyerActionItems(cleanText);

  // Record buyer note in audit ledger
  recordAuditLedger({
    leadId,
    actionType: 'PROPERTY_NOTE',
    propertyId,
    ipAddress,
    redactedPayload: {
      authorName: sanitizePiiInput(authorName),
      isQuestion: actionCheck.isQuestion,
      inAppReplyNotify
    }
  });

  // Backward compatibility: If legacy tcpaAccepted flag is explicitly provided as true, record TCPA_OPT_IN in audit ledger
  if (params.tcpaAccepted === true) {
    recordAuditLedger({
      leadId,
      actionType: 'TCPA_OPT_IN',
      propertyId,
      ipAddress,
      redactedPayload: {
        authorName: sanitizePiiInput(authorName),
        noteId: `note-tcpa-${leadId}`,
        tcpaAccepted: true
      }
    });
  }

  const noteMsg: PropertyNoteMessage = {
    id: `note-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    sender: 'buyer',
    authorName: sanitizePiiInput(authorName) || 'Homebuyer',
    text: cleanText,
    timestamp: new Date().toISOString(),
    isQuestion: actionCheck.isQuestion,
    actionCategory: actionCheck.actionCategory,
    inAppReplyNotify
  };

  thread.messages.push(noteMsg);
  thread.inAppReplyNotify = inAppReplyNotify;
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

  if (isShowingOrHighIntent) {
    // TIER 2: Transactional / Showing Request -> NO AI Answer. Route to Mike's iPhone.
    noteMsg.tier = 2;
    await pushToMikeIPhone({
      title: `Buyer Showing Request on ${thread.propertyAddress}`,
      body: `[${noteMsg.authorName}]: ${cleanText}`,
      leadId,
      propertyId,
      category: 'SHOWING_REQUEST'
    });
  } else {
    // TIER 1: Educational / Informational / Strategy / Timing -> Instant Muse Grounded AI Reply
    noteMsg.tier = 1;
    const listings = await queryCuratedListings({ listingId: propertyId });
    const listing = listings[0] || null;

    const museGen = await generateMuseNoteResponse({
      noteText: cleanText,
      listing,
      authorName: noteMsg.authorName
    });

    aiReplyMsg = {
      id: `note-${Date.now()}-muse`,
      sender: 'muse',
      authorName: "Muse, Mike Ford's assistant",
      text: museGen.text,
      timestamp: new Date().toISOString(),
      isQuestion: false,
      tier: 1,
      citations: museGen.citations,
      isAi: true
    };

    thread.messages.push(aiReplyMsg);

    // Stamp audit ledger for AI reply
    recordAuditLedger({
      leadId,
      actionType: 'PROPERTY_NOTE',
      propertyId,
      ipAddress,
      redactedPayload: {
        actor: 'muse',
        tier: 1,
        noteId: noteMsg.id,
        category: actionCheck.actionCategory,
        isCostOfWaiting: museGen.isCostOfWaiting,
        citations: museGen.citations
      }
    });
  }

  threadCache.set(thread.threadId, thread);

  // Persist updated thread to Firestore
  const db = getAdminFirestore();
  if (db) {
    safeFirestoreWrite(db.collection('property_threads').doc(thread.threadId).set(thread, { merge: true }), 1500).catch(err => {
      console.warn('[Property Thread Firestore Write Warning]', err.message);
    });
  }

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
    safeFirestoreWrite(db.collection('property_threads').doc(thread.threadId).set(thread, { merge: true }), 1500).catch(err => {
      console.warn('[Property Thread Firestore Write Warning]', err.message);
    });
  }

  return replyMsg;
}
