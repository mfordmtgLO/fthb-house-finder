// Copyright (c) 2026 Mike Ford, NMLS #288455. All Rights Reserved.
/**
 * Muse AI Conversational Engine
 * Persistent memory backed by Firestore Admin SDK (collection: fthb_conversations/{leadId}).
 * In-memory Map serves as transient cache only — Firestore is the sole source of truth.
 * Every chat message (buyer, Muse, and Mike replies) is PII-scrubbed before write.
 * Mike's conversation inbox reads directly from fthb_conversations.
 */

import { GoogleGenAI } from '@google/genai';
import { queryVantageGrounding } from './vantageKnowledge.ts';
import { queryCuratedListings, type CuratedListing } from './curatedData.ts';
import { pushToMikeIPhone, sanitizePiiInput, detectBuyerActionItems, recordAuditLedger } from './compliance.ts';
import { calculateCostOfWaiting, formatCostOfWaitingForMuse } from './costOfWaiting.ts';
import { getAdminFirestore } from './firebaseAdmin.ts';

export interface ChatMessage {
  id: string;
  sender: 'muse' | 'buyer' | 'mike';
  text: string;
  timestamp: string;
  suggestedAction?: 'SCHEDULE_MIKE_CALL' | 'BOOK_TOUR' | 'EXPLAIN_BUYDOWN' | 'VIEW_PLATTER';
  citations?: string[];
  platterListings?: CuratedListing[];
  isEscalation?: boolean;
}

export interface BuyerSessionState {
  leadId: string;
  createdAt: string;
  lastActiveAt: string;
  disclaimerServed: boolean;
  intakeCompleted: boolean;
  branch?: string;
  email?: string;
  phone?: string;
  assignedLo?: string;
  leadCurationRequest?: {
    status: 'requested' | 'pushed';
    city: string;
    priceRange?: string;
    maxMonthlyPayment?: number;
    source: string;
    requestedAt: string;
  };
  statedPreferences: {
    city?: string;
    maxPrice?: number;
    maxMonthlyPayment?: number;
    incomeBracket?: string;
    timeline?: string;
    downPaymentResources?: string;
    favorites: string[];
    viewedListingIds: string[];
    email?: string;
    phone?: string;
  };
  messages: ChatMessage[];
}

export const MANDATORY_SESSION_DISCLAIMER =
  'Price caps, income qualifiers, census tracts, listing price, status, and program eligibility are not guaranteed; pre-screened for your curated experience; must be confirmed by your licensed loan officer and local real estate agent. Pre-approval must be obtained from your loan officer.';

// In-memory cache (transient cache only; Firestore is source of truth)
const sessionCache = new Map<string, BuyerSessionState>();

export function clearSessionStore(): void {
  sessionCache.clear();
}

/**
 * Persists session state and messages to Firestore fthb_conversations/{leadId}
 * Every message text has PII scrub applied before write.
 */
async function saveConversationToFirestore(session: BuyerSessionState): Promise<void> {
  sessionCache.set(session.leadId, session);

  const db = getAdminFirestore();
  if (!db) {
    return;
  }

  try {
    // PII scrub applied before write to every message
    const sanitizedMessages = session.messages.map(m => ({
      ...m,
      text: sanitizePiiInput(m.text)
    }));

    await db.collection('fthb_conversations').doc(session.leadId).set({
      leadId: session.leadId,
      createdAt: session.createdAt,
      lastActiveAt: session.lastActiveAt,
      disclaimerServed: session.disclaimerServed,
      intakeCompleted: session.intakeCompleted,
      branch: session.branch,
      email: session.email,
      phone: session.phone,
      assignedLo: session.assignedLo,
      leadCurationRequest: session.leadCurationRequest,
      statedPreferences: session.statedPreferences,
      messages: sanitizedMessages,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    // If a curation request was made, mirror to the leads collection for Mike's queue
    if (session.leadCurationRequest) {
      await db.collection('leads').doc(session.leadId).set({
        id: session.leadId,
        leadId: session.leadId,
        leadCurationRequest: session.leadCurationRequest,
        city: session.statedPreferences.city || session.leadCurationRequest.city,
        statedPreferences: session.statedPreferences,
        email: session.email || null,
        phone: session.phone || null,
        source: 'plugin-chat',
        updatedAt: new Date().toISOString()
      }, { merge: true });
    }
  } catch (err: any) {
    console.warn('[Firebase Admin] Error persisting conversation to fthb_conversations:', err.message);
  }
}

/**
 * Loads conversation state from Firestore fthb_conversations/{leadId} via Admin SDK.
 * Returns null if no document exists or Firestore is unreachable.
 */
async function loadConversationFromFirestore(leadId: string): Promise<BuyerSessionState | null> {
  const db = getAdminFirestore();
  if (!db) {
    return null;
  }

  try {
    const doc = await db.collection('fthb_conversations').doc(leadId).get();
    if (!doc.exists) {
      return null;
    }
    const data = doc.data();
    if (!data) return null;

    const session: BuyerSessionState = {
      leadId: doc.id,
      createdAt: data.createdAt || new Date().toISOString(),
      lastActiveAt: data.lastActiveAt || new Date().toISOString(),
      disclaimerServed: Boolean(data.disclaimerServed),
      intakeCompleted: Boolean(data.intakeCompleted),
      branch: data.branch,
      email: data.email,
      phone: data.phone,
      assignedLo: data.assignedLo,
      leadCurationRequest: data.leadCurationRequest,
      statedPreferences: data.statedPreferences || { favorites: [], viewedListingIds: [] },
      messages: Array.isArray(data.messages)
        ? data.messages.map((m: any) => ({
            id: m.id || `msg-${Date.now()}`,
            sender: m.sender || 'muse',
            text: sanitizePiiInput(m.text || ''),
            timestamp: m.timestamp || new Date().toISOString(),
            suggestedAction: m.suggestedAction,
            citations: Array.isArray(m.citations) ? m.citations : undefined,
            platterListings: Array.isArray(m.platterListings) ? m.platterListings : undefined,
            isEscalation: Boolean(m.isEscalation)
          }))
        : []
    };

    sessionCache.set(leadId, session);
    return session;
  } catch (err: any) {
    console.warn('[Firebase Admin] Error loading conversation from fthb_conversations:', err.message);
    return null;
  }
}

/**
 * Loads history from Firestore on session start.
 * Falls back to a new session only when none exists in Firestore.
 */
export async function getOrCreateBuyerSession(leadId: string, ipAddress: string): Promise<BuyerSessionState> {
  // 1. Load history from Firestore first (source of truth)
  let session = await loadConversationFromFirestore(leadId);

  // 2. Cache fallback if Firestore is temporarily offline but session was in cache
  if (!session && sessionCache.has(leadId)) {
    session = sessionCache.get(leadId)!;
  }

  // 3. Fallback to a new session only when none exists
  if (!session) {
    session = {
      leadId,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      disclaimerServed: false,
      intakeCompleted: false,
      statedPreferences: {
        favorites: [],
        viewedListingIds: []
      },
      messages: []
    };
  }

  // Ensure disclaimer served once per session
  if (!session.disclaimerServed) {
    session.disclaimerServed = true;
    recordAuditLedger({
      leadId,
      actionType: 'DISCLAIMER_SERVED',
      ipAddress,
      redactedPayload: { disclaimer: MANDATORY_SESSION_DISCLAIMER }
    });

    const disclaimerMsg: ChatMessage = {
      id: `msg-${Date.now()}-disclaimer`,
      sender: 'muse',
      text: `Welcome to FTHB House Finder! I'm Muse, Mike Ford's first-time buyer assistant.\n\n*Important Lending Note: ${MANDATORY_SESSION_DISCLAIMER}*\n\nIf you're currently renting and curious what buying a home might look like with zero or low down payment, I can help you find curated homes in our Pacific Northwest network that likely qualify. Where are you thinking of living?`,
      timestamp: new Date().toISOString(),
      citations: ['NMLS Consumer Access #288455', 'CFPB Reg Z 12 CFR § 1026.24']
    };
    session.messages.push(disclaimerMsg);
  }

  session.lastActiveAt = new Date().toISOString();
  await saveConversationToFirestore(session);
  return session;
}

export async function getBuyerSession(leadId: string): Promise<BuyerSessionState | null> {
  const fromFirestore = await loadConversationFromFirestore(leadId);
  if (fromFirestore) {
    return fromFirestore;
  }
  return sessionCache.get(leadId) || null;
}

export async function updateBuyerFavorites(leadId: string, favorites: string[]): Promise<void> {
  const session = await getBuyerSession(leadId);
  if (session) {
    // 3-favorite cap enforced
    session.statedPreferences.favorites = favorites.slice(0, 3);
    session.lastActiveAt = new Date().toISOString();
    await saveConversationToFirestore(session);
  }
}

/**
 * Handle incoming message from the buyer
 * 3-way capable: triggers FCM push to Mike's iPhone, extracts preferences,
 * grounds with 2nd brain, serves platter if ready, and responds via Gemini API.
 * Every message is PII scrubbed and persisted to fthb_conversations/{leadId}.
 */
export async function handleBuyerMessage(
  leadId: string,
  rawText: string,
  ipAddress: string
): Promise<ChatMessage> {
  const session = await getOrCreateBuyerSession(leadId, ipAddress);
  // Zero-trust PII sanitization + 1,000 char defensive length cap
  const cleanText = sanitizePiiInput(rawText).substring(0, 1000);

  // Record buyer message in session
  const buyerMsg: ChatMessage = {
    id: `msg-${Date.now()}-buyer`,
    sender: 'buyer',
    text: cleanText,
    timestamp: new Date().toISOString()
  };
  session.messages.push(buyerMsg);
  session.lastActiveAt = new Date().toISOString();

  // Detect questions and action items
  const actionCheck = detectBuyerActionItems(cleanText);
  if (actionCheck.isQuestion) {
    recordAuditLedger({
      leadId,
      actionType: 'MUSE_CHAT_QUESTION',
      ipAddress,
      redactedPayload: { questionText: cleanText, category: actionCheck.actionCategory }
    });

    // Fire direct push notification
    await pushToMikeIPhone({
      title: `FTHB Buyer Question (${actionCheck.actionCategory})`,
      body: cleanText,
      leadId,
      category: actionCheck.actionCategory || 'BUYER_QUESTION'
    });
  }

  // Parse intake signals from message text
  extractPreferencesFromText(cleanText, session);

  // Persist session state after buyer message
  await saveConversationToFirestore(session);

  // Check for specific math or complex rate quotes -> trigger escalation rule
  const isComplexMathOrQuote =
    cleanText.includes('exact payment') ||
    cleanText.includes('interest rate quote') ||
    cleanText.includes('my credit score is') ||
    cleanText.includes('dti') ||
    cleanText.includes('debt to income') ||
    cleanText.includes('can i afford');

  // Check for timing and cost of waiting inquiry
  const isTimingQuestion =
    cleanText.toLowerCase().includes('wait') ||
    cleanText.toLowerCase().includes('timing') ||
    cleanText.toLowerCase().includes('keep renting') ||
    cleanText.toLowerCase().includes('rent vs buy') ||
    cleanText.toLowerCase().includes('prices dropping') ||
    cleanText.toLowerCase().includes('cost of waiting');

  let costReport = null;
  let costGrounding = '';
  if (isTimingQuestion) {
    const targetPrice = session.statedPreferences.maxPrice || 450000;
    costReport = calculateCostOfWaiting({ targetPrice });
    costGrounding = formatCostOfWaitingForMuse(costReport, 1);
  }

  // Pull 2nd Brain grounding
  const grounding = queryVantageGrounding(cleanText);

  // Generate Platter if city or preferences known
  let platter: CuratedListing[] = [];
  if (session.statedPreferences.city || session.statedPreferences.maxMonthlyPayment) {
    platter = await queryCuratedListings({
      city: session.statedPreferences.city,
      maxPrice: session.statedPreferences.maxPrice,
      maxMonthlyPayment: session.statedPreferences.maxMonthlyPayment
    });
  } else {
    platter = await queryCuratedListings({});
  }

  // Attempt server-side Gemini API call
  let museReplyText = '';
  let citations: string[] = ['NMLS #288455 Mike Ford Lending Knowledge'];
  let isEscalation = false;

  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (geminiApiKey && geminiApiKey !== 'MY_GEMINI_API_KEY') {
    try {
      const ai = new GoogleGenAI({ apiKey: geminiApiKey });
      const prompt = `You are Muse, the intelligent, warm, encouraging first-time homebuyer assistant for Mike Ford (NMLS #288455).
Mike is a licensed mortgage loan officer specializing in helping renters transition into homeownership with low/no down payment programs, seller credits, and 2-1 buydowns.

GOLDEN TONGUE & COMPLIANCE RULES:
1. Warm, plain-language, confidence-building tone. Celebrate that they are asking smart questions.
2. NEVER guarantee rates or qualification. Use "likely qualifies based on curated guidelines."
3. If timing or cost-of-waiting is asked: quote the EXACT numbers from the deterministic calculator grounding below. Stated appreciation is an economic assumption, not a guarantee.
4. If the buyer asks for exact mortgage payments, custom rate quotes, credit qualification, or specific underwriting math, ALWAYS include the standard escalation: "let's check in with Mike for more details" or "let's ping Mike to answer your question."
5. EDUCATE on offer strategies: mention 2-1 temporary buydowns (seller funded discount reducing rate by 2% year 1, 1% year 2) and seller credits toward closing costs.

GROUNDING KNOWLEDGE & CALCULATOR OUTPUT (CRITICAL - DO NOT INVENT NUMBERS):
${costGrounding || 'Standard FTHB programs: FHA 3.5% down, Conventional 3% down, USDA 0% in eligible rural areas, state DPA grants.'}
${grounding}

BUYER CURRENT PREFERENCES:
City: ${session.statedPreferences.city || 'Not specified'}
Max Monthly Payment: ${session.statedPreferences.maxMonthlyPayment || 'Not specified'}
Income Bracket: ${session.statedPreferences.incomeBracket || 'Not specified'}
Favorites: ${session.statedPreferences.favorites.join(', ') || 'None yet'}

BUYER MESSAGE:
"${cleanText}"

Respond concisely (2-3 paragraphs maximum). If appropriate, reference the curated platter of matching Pacific Northwest homes available below.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      });

      if (response.text) {
        museReplyText = response.text.trim();
        citations.push('Vantage 2nd Brain Knowledge Base', 'Gemini 2.5 Flash');
        if (costReport) citations.push('Deterministic Cost-of-Waiting Calculator');
      }
    } catch (e: unknown) {
      console.warn('[Muse Gemini Fallback Activated]', e);
    }
  }

  // Check for Curation Intake Flow (Prompt B Spec 3)
  const lowerText = cleanText.toLowerCase();
  const isCurationTrigger =
    lowerText === 'yes' ||
    lowerText === 'yep' ||
    lowerText === 'sure' ||
    lowerText.includes('curate') ||
    lowerText.includes('curated list') ||
    lowerText.includes('request a list') ||
    lowerText.includes('curated homes') ||
    lowerText.includes('find homes for me');

  if (isCurationTrigger || (session.statedPreferences.city && (lowerText.includes('curate') || lowerText.includes('list')))) {
    if (!session.statedPreferences.city) {
      museReplyText = `Would you like us to curate a list of low or no down payment qualifying homes?\n\nWhat city or county is your desired purchase area? (e.g. Portland, Beaverton, Hillsboro, Eugene, Springfield, or Vancouver)`;
      citations.push('Mike Ford Curation Workflow (NMLS #288455)');
    } else {
      // City is known -> build structured leadCurationRequest in the exact shape Mike's queue expects
      const priceStr = session.statedPreferences.maxPrice
        ? `$${session.statedPreferences.maxPrice.toLocaleString()}`
        : (session.statedPreferences.maxMonthlyPayment ? `~$${session.statedPreferences.maxMonthlyPayment}/mo` : 'PNW Entry-Level');

      session.leadCurationRequest = {
        status: 'requested',
        city: session.statedPreferences.city,
        priceRange: priceStr,
        maxMonthlyPayment: session.statedPreferences.maxMonthlyPayment,
        source: 'plugin-chat',
        requestedAt: new Date().toISOString()
      };

      museReplyText = `Done — Mike Ford will personally curate homes for ${session.statedPreferences.city} and push them to your app.\n\nAs soon as Mike completes your list in the dashboard, it will appear under **My Curated Homes**!`;
      citations.push('Mike Ford Curation Queue', 'NMLS #288455 Direct Intake');
    }
  }

  // Deterministic Compliance Fallback if Gemini not keyed or rate limited
  if (!museReplyText) {
    const isShowingOrHighIntent =
      actionCheck.actionCategory === 'SHOWING_REQUEST' ||
      lowerText.includes('tour') ||
      lowerText.includes('schedule') ||
      lowerText.includes('see this house') ||
      lowerText.includes('showing') ||
      lowerText.includes('apply') ||
      lowerText.includes('application') ||
      lowerText.includes('credit report');

    const isBuydownOrConcession =
      actionCheck.actionCategory === 'OFFER_STRATEGY_INQUIRY' ||
      lowerText.includes('buydown') ||
      lowerText.includes('2-1') ||
      lowerText.includes('seller credit') ||
      lowerText.includes('concession') ||
      lowerText.includes('closing cost');

    const isLoanProgramOrDpa =
      actionCheck.actionCategory === 'ELIGIBILITY_AND_DPA' ||
      lowerText.includes('fha') ||
      lowerText.includes('conventional') ||
      lowerText.includes('usda') ||
      lowerText.includes('grant') ||
      lowerText.includes('dpa') ||
      lowerText.includes('down payment') ||
      lowerText.includes('qualify');

    if (isShowingOrHighIntent) {
      isEscalation = true;
      museReplyText = `I've flagged your showing and application request directly to Mike Ford (NMLS #288455) and our local partner agent! Mike will coordinate showing access, verify home details, and follow up directly with you.`;
      citations.push('Mike Ford Direct Escalation', 'NMLS #288455 Showing Dispatch');
    } else if (isTimingQuestion && costReport) {
      const oneYr = costReport.intervals[1];
      museReplyText = `You're asking a really smart question! Deciding whether to buy now or wait is one of the most common dilemmas for first-time buyers.\n\nBased on a $${costReport.targetPrice.toLocaleString()} purchase and assuming a standard 3.5% annual appreciation with $${costReport.monthlyRent.toLocaleString()}/mo rent:\n• Waiting 1 year has an estimated total cost of waiting of $${oneYr.totalCostOfWaiting.toLocaleString()}.\n• That includes ~$${oneYr.cumulativeRentPaid.toLocaleString()} paid in non-recoverable rent, $${oneYr.missedPrincipalEquity.toLocaleString()} in missed principal equity paydown, and a projected $${oneYr.priceIncrease.toLocaleString()} increase in property value.\n• If rates drop to ${oneYr.futureMonthlyPI.downRatePercent}%, future monthly P&I would be ~$${oneYr.futureMonthlyPI.downRate.toLocaleString()}/mo.\n\nRemember that future appreciation and rates are economic assumptions, not guarantees. First-time buyers likely qualify for low-down-payment programs that allow stepping into homeownership sooner.\n\nWant Mike Ford (NMLS #288455) to review your personal scenario or give you a quick call?`;
      citations.push('Deterministic Cost-of-Waiting Calculator (MortgageLab Algorithm)');
    } else if (isBuydownOrConcession) {
      museReplyText = `A 2-1 temporary buydown is one of our favorite first-time buyer tools! With a 2-1 buydown, the seller funds a credit at closing to lower your mortgage interest rate by 2% in your first year and 1% in your second year, giving you substantial monthly payment breathing room.\n\nBuyers likely qualify at the standard note rate, and negotiating seller credits toward closing costs can dramatically reduce your upfront cash to close.\n\nWant Mike Ford (NMLS #288455) to review your personal scenario or see if a home qualifies for seller credits?`;
      citations.push('2-1 Buydown Underwriting Guidelines', 'NMLS #288455 Strategy');
    } else if (isLoanProgramOrDpa) {
      museReplyText = `First-time buyers in the Pacific Northwest likely qualify for several low and zero down payment options, including FHA financing with 3.5% down, Conventional first-time buyer programs with 3% down, USDA 0% down in eligible rural boundaries, and local down payment assistance grants.\n\nWant Mike Ford (NMLS #288455) to review your personal scenario or check eligibility for state grant programs?`;
      citations.push('FTHB Purchase Programs', 'CFPB Reg Z Qualified Guidelines');
    } else if (isComplexMathOrQuote) {
      isEscalation = true;
      museReplyText = `That's a great question about the specific numbers. Because mortgage guidelines, local property taxes, insurance escrows, and credit tiers affect your exact bottom line, let's check in with Mike Ford (NMLS #288455) for more details!\n\nMike can run the exact scenario with zero obligation and explore whether a 2-1 temporary buydown or down payment assistance grant fits your household budget.`;
      citations.push('Mike Ford Loan Officer Consultation Rule', 'CFPB Reg Z');
    } else if (!session.statedPreferences.city) {
      museReplyText = `Stopping renting is totally doable, even if you don't have tens of thousands saved! First-time buyers likely qualify for low-down programs like FHA (3.5% down), Conventional (3% down), or USDA (0% down).\n\nWhat Pacific Northwest cities or neighborhoods are you most interested in exploring? (e.g. Portland, Beaverton, Hillsboro, Gresham, Eugene, Springfield, or Vancouver)\n\nWant Mike Ford (NMLS #288455) to review your personal scenario anytime?`;
      citations.push('NMLS #288455 FTHB Guidance');
    } else if (!session.statedPreferences.maxMonthlyPayment) {
      museReplyText = `Awesome! I've marked **${session.statedPreferences.city}** as your preferred focus.\n\nWhat is your comfortable target monthly mortgage payment? For example, if you're currently paying $2,200 in rent, would you prefer to stay around that, or do you have a ceiling like $2,500 to $2,800/mo? Buyers likely qualify for seller credits to ease payments.\n\nWant Mike Ford (NMLS #288455) to review your target monthly budget?`;
      citations.push('NMLS #288455 Payment Planning');
    } else {
      isEscalation = true;
      museReplyText = `I specialize in Pacific Northwest first-time homebuyer financing, low down payment programs, and seller credit strategies! For custom mortgage rate quotes, specific underwriting requirements, or property tour coordination, let's check in with Mike Ford (NMLS #288455) for more details.`;
      citations.push('NMLS #288455 Advisory Standard');
    }
  }

  if (museReplyText.toLowerCase().includes("check in with mike") || museReplyText.toLowerCase().includes("ping mike")) {
    isEscalation = true;
  }

  const replyMsg: ChatMessage = {
    id: `msg-${Date.now()}-muse`,
    sender: 'muse',
    text: sanitizePiiInput(museReplyText),
    timestamp: new Date().toISOString(),
    citations,
    platterListings: platter.slice(0, 3),
    isEscalation,
    suggestedAction: isEscalation ? 'SCHEDULE_MIKE_CALL' : 'BOOK_TOUR'
  };

  session.messages.push(replyMsg);
  session.lastActiveAt = new Date().toISOString();

  // Persist Muse reply to Firestore
  await saveConversationToFirestore(session);
  return replyMsg;
}

/**
 * Handle incoming message from Mike Ford (3-Way Chat capability)
 * Appears seamlessly in the buyer's conversation stream and persists to Firestore fthb_conversations.
 */
export async function handleMikeReply(leadId: string, replyText: string): Promise<ChatMessage> {
  const session = await getOrCreateBuyerSession(leadId, 'internal');
  const cleanText = sanitizePiiInput(replyText);

  const mikeMsg: ChatMessage = {
    id: `msg-${Date.now()}-mike`,
    sender: 'mike',
    text: `[Mike Ford, NMLS #288455]: ${cleanText}`,
    timestamp: new Date().toISOString()
  };

  session.messages.push(mikeMsg);
  session.lastActiveAt = new Date().toISOString();

  // Persist Mike reply to Firestore
  await saveConversationToFirestore(session);
  return mikeMsg;
}

/**
 * Reads Mike Ford's conversation inbox directly from fthb_conversations in Firestore via Admin SDK.
 * Returns all active buyer threads sorted by lastActiveAt descending.
 */
export async function getMikeConversationInbox(): Promise<BuyerSessionState[]> {
  const db = getAdminFirestore();
  if (db) {
    try {
      const snap = await db.collection('fthb_conversations').limit(50).get();
      if (!snap.empty) {
        const conversations: BuyerSessionState[] = [];
        snap.forEach(doc => {
          const data = doc.data();
          conversations.push({
            leadId: doc.id,
            createdAt: data.createdAt || new Date().toISOString(),
            lastActiveAt: data.lastActiveAt || new Date().toISOString(),
            disclaimerServed: Boolean(data.disclaimerServed),
            intakeCompleted: Boolean(data.intakeCompleted),
            branch: data.branch,
            email: data.email,
            phone: data.phone,
            assignedLo: data.assignedLo,
            statedPreferences: data.statedPreferences || { favorites: [], viewedListingIds: [] },
            messages: Array.isArray(data.messages)
              ? data.messages.map((m: any) => ({
                  id: m.id || `msg-${Date.now()}`,
                  sender: m.sender || 'muse',
                  text: sanitizePiiInput(m.text || ''),
                  timestamp: m.timestamp || new Date().toISOString(),
                  suggestedAction: m.suggestedAction,
                  citations: Array.isArray(m.citations) ? m.citations : undefined,
                  platterListings: Array.isArray(m.platterListings) ? m.platterListings : undefined,
                  isEscalation: Boolean(m.isEscalation)
                }))
              : []
          });
        });

        conversations.sort((a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime());
        // Sync cache
        conversations.forEach(c => sessionCache.set(c.leadId, c));
        return conversations;
      }
    } catch (err: any) {
      console.warn('[Firebase Admin] Error loading inbox from fthb_conversations:', err.message);
    }
  }

  // Fallback to cache if Firestore offline
  const cached = Array.from(sessionCache.values());
  cached.sort((a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime());
  return cached;
}

function extractPreferencesFromText(text: string, session: BuyerSessionState) {
  const lower = text.toLowerCase();
  
  // City extraction
  const cities = [
    'portland',
    'gresham',
    'vancouver',
    'beaverton',
    'hillsboro',
    'oregon city',
    'clackamas',
    'tigard',
    'springfield',
    'eugene',
    'salem',
    'bend',
    'corvallis',
    'medford'
  ];
  for (const c of cities) {
    if (lower.includes(c)) {
      session.statedPreferences.city = c.charAt(0).toUpperCase() + c.slice(1);
      session.branch = c.toLowerCase();
      break;
    }
  }

  // Monthly payment extraction: e.g. "$2,400" or "2400"
  const paymentMatch = text.match(/\$?([1-4][,.]?[0-9]{3})\s*(?:\/mo|a month|monthly|pmt|payment)?/i);
  if (paymentMatch && paymentMatch[1]) {
    const parsed = parseInt(paymentMatch[1].replace(/[,.]/g, ''), 10);
    if (parsed >= 1000 && parsed <= 6000) {
      session.statedPreferences.maxMonthlyPayment = parsed;
    }
  }

  // Price extraction: e.g. "400k" or "$425,000"
  const priceMatch = text.match(/\$?([3-9][0-9]{2})k/i) || text.match(/\$?([3-9][0-9]{2}[,.]?[0-9]{3})/);
  if (priceMatch && priceMatch[1]) {
    const rawVal = priceMatch[1].replace(/[,.]/g, '');
    const num = parseInt(rawVal, 10);
    if (num < 1000) {
      session.statedPreferences.maxPrice = num * 1000;
    } else if (num >= 200000 && num <= 1000000) {
      session.statedPreferences.maxPrice = num;
    }
  }

  // Down payment resources
  if (lower.includes('zero') || lower.includes('0%') || lower.includes('no down')) {
    session.statedPreferences.downPaymentResources = '0% Down (VA/USDA/Grant)';
  } else if (lower.includes('3%') || lower.includes('3.5%') || lower.includes('fha')) {
    session.statedPreferences.downPaymentResources = '3% - 3.5% Low Down';
  }
}
