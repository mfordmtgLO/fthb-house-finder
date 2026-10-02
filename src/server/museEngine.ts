// Copyright (c) 2026 Mike Ford, NMLS #288455. All Rights Reserved.
/**
 * Muse AI Conversational Engine
 * Renter-to-Buyer intake, 2nd Brain knowledge grounding,
 * persistent memory, 3-way Mike-in-the-loop, and curated platter matching.
 */

import { GoogleGenAI } from '@google/genai';
import { queryVantageGrounding } from './vantageKnowledge.ts';
import { CURATED_LISTINGS, queryCuratedListings, type CuratedListing } from './curatedData.ts';
import { pushToMikeIPhone, sanitizePiiInput, detectBuyerActionItems, recordAuditLedger } from './compliance.ts';

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
  statedPreferences: {
    city?: string;
    maxPrice?: number;
    maxMonthlyPayment?: number;
    incomeBracket?: string;
    timeline?: string;
    downPaymentResources?: string;
    favorites: string[];
    viewedListingIds: string[];
  };
  messages: ChatMessage[];
}

export const MANDATORY_SESSION_DISCLAIMER =
  'Price caps, income qualifiers, census tracts, listing price, status, and program eligibility are not guaranteed; pre-screened for your curated experience; must be confirmed by your licensed loan officer and local real estate agent. Pre-approval must be obtained from your loan officer.';

// In-memory per-buyer memory store (mirrored to Firestore fthb_conversations/{leadId})
const sessionStore = new Map<string, BuyerSessionState>();

export function getOrCreateBuyerSession(leadId: string, ipAddress: string): BuyerSessionState {
  let session = sessionStore.get(leadId);
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
    sessionStore.set(leadId, session);
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

    session.messages.push({
      id: `msg-${Date.now()}-disclaimer`,
      sender: 'muse',
      text: `Welcome to FTHB House Finder! I'm Muse, Mike Ford's first-time buyer assistant.\n\n*Important Lending Note: ${MANDATORY_SESSION_DISCLAIMER}*\n\nIf you're currently renting and curious what buying a home might look like with zero or low down payment, I can help you find curated homes in our Pacific Northwest network that likely qualify. Where are you thinking of living?`,
      timestamp: new Date().toISOString(),
      citations: ['NMLS Consumer Access #288455', 'CFPB Reg Z 12 CFR § 1026.24']
    });
  }

  session.lastActiveAt = new Date().toISOString();
  return session;
}

export function getBuyerSession(leadId: string): BuyerSessionState | null {
  return sessionStore.get(leadId) || null;
}

export function updateBuyerFavorites(leadId: string, favorites: string[]): void {
  const session = sessionStore.get(leadId);
  if (session) {
    // 3-favorite cap enforced
    session.statedPreferences.favorites = favorites.slice(0, 3);
  }
}

/**
 * Handle incoming message from the buyer
 * 3-way capable: triggers FCM push to Mike's iPhone, extracts preferences,
 * grounds with 2nd brain, serves platter if ready, and responds via Gemini API.
 */
export async function handleBuyerMessage(
  leadId: string,
  rawText: string,
  ipAddress: string
): Promise<ChatMessage> {
  const session = getOrCreateBuyerSession(leadId, ipAddress);
  const cleanText = sanitizePiiInput(rawText);

  // Record buyer message in session memory
  const buyerMsg: ChatMessage = {
    id: `msg-${Date.now()}-buyer`,
    sender: 'buyer',
    text: cleanText,
    timestamp: new Date().toISOString()
  };
  session.messages.push(buyerMsg);

  // Detect questions and action items
  const actionCheck = detectBuyerActionItems(cleanText);
  if (actionCheck.isQuestion) {
    recordAuditLedger({
      leadId,
      actionType: 'MUSE_CHAT_QUESTION',
      ipAddress,
      redactedPayload: { questionText: cleanText, category: actionCheck.actionCategory }
    });

    // Fire FCM push directly to Mike Ford's iPhone
    await pushToMikeIPhone({
      title: `FTHB Buyer Question (${actionCheck.actionCategory})`,
      body: cleanText,
      leadId,
      category: actionCheck.actionCategory || 'BUYER_QUESTION'
    });
  }

  // Parse intake signals from message text
  extractPreferencesFromText(cleanText, session);

  // Check for specific math or complex rate quotes -> trigger escalation rule
  const isComplexMathOrQuote =
    cleanText.includes('exact payment') ||
    cleanText.includes('interest rate quote') ||
    cleanText.includes('my credit score is') ||
    cleanText.includes('dti') ||
    cleanText.includes('debt to income') ||
    cleanText.includes('can i afford');

  // Pull 2nd Brain grounding
  const grounding = queryVantageGrounding(cleanText);

  // Generate Platter if city or preferences known
  let platter: CuratedListing[] = [];
  if (session.statedPreferences.city || session.statedPreferences.maxMonthlyPayment) {
    platter = queryCuratedListings({
      city: session.statedPreferences.city,
      maxPrice: session.statedPreferences.maxPrice,
      maxMonthlyPayment: session.statedPreferences.maxMonthlyPayment
    });
  }
  if (platter.length === 0) {
    platter = CURATED_LISTINGS.slice(0, 3);
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

GUARDRAILS & ARCHITECTURE LAWS:
1. Warm, plain-language, encouraging tone. No intimidating jargon.
2. NEVER guarantee rates or qualification. Use "likely qualifies based on curated guidelines."
3. ESCALATION RULE: If the buyer asks for exact mortgage payments, custom rate quotes, credit qualification, or specific underwriting math, ALWAYS include the standard escalation: "let's check in with Mike for more details" or "let's ping Mike to answer your question." Muse never guesses on unverified math.
4. EDUCATE on offer strategies: mention 2-1 temporary buydowns (seller funded discount reducing rate by 2% year 1, 1% year 2) and seller credits toward closing costs.
5. GROUNDING KNOWLEDGE:
${grounding}

BUYER CURRENT PREFERENCES:
City: ${session.statedPreferences.city || 'Not specified'}
Max Monthly Payment: ${session.statedPreferences.maxMonthlyPayment || 'Not specified'}
Income Bracket: ${session.statedPreferences.incomeBracket || 'Not specified'}
Favorites: ${session.statedPreferences.favorites.join(', ') || 'None yet'}

BUYER MESSAGE:
"${cleanText}"

Respond concisely (2-4 paragraphs maximum). If appropriate, reference the curated platter of matching Pacific Northwest homes available below.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      });

      museReplyText = response.text || '';
    } catch (err) {
      console.warn('[Muse Gemini Error, using fallback engine]', err);
    }
  }

  // High-fidelity fallback / escalation generator if API key is not active or for math queries
  if (!museReplyText) {
    if (isComplexMathOrQuote) {
      isEscalation = true;
      museReplyText = `That's a great question about the specific numbers. Because mortgage guidelines, local taxes, insurance escrows, and credit tiers affect your exact bottom line, let's check in with Mike for more details!\n\nMike can run the exact scenario with zero obligation and explore whether a 2-1 temporary buydown or down payment assistance grant fits your household budget. In the meantime, take a look at the curated homes below that match our low-down payment filters.`;
      citations.push('Mike Ford Loan Officer Consultation Rule', 'CFPB Reg Z');
    } else if (!session.statedPreferences.city) {
      museReplyText = `Stopping renting is totally doable, even if you don't have tens of thousands saved. Many first-time buyers use FHA (3.5% down), Conventional HomeReady (3% down), or USDA/VA (0% down).\n\nWhat Pacific Northwest cities or neighborhoods are you most interested in exploring? (e.g. Portland, Gresham, Beaverton, Hillsboro, Oregon City, or Vancouver)`;
    } else if (!session.statedPreferences.maxMonthlyPayment) {
      museReplyText = `Awesome! I've marked **${session.statedPreferences.city}** as your preferred focus.\n\nWhat is your comfortable target monthly mortgage payment? For example, if you're currently paying $2,200 in rent, would you prefer to stay around that, or do you have a ceiling like $2,500 to $2,800/mo?`;
    } else {
      museReplyText = `Here is a curated platter of single-family homes in **${session.statedPreferences.city}** that likely qualify for our low-down and 0% down programs! Notice how homes with 2-1 buydowns can knock hundreds off your monthly payment during the first two years.\n\nHeart up to 3 favorites, and if you want to see any of these in person, let's ping Mike to connect you with our vetted local real estate partner for a private tour.`;
    }
  }

  if (museReplyText.toLowerCase().includes("check in with mike") || museReplyText.toLowerCase().includes("ping mike")) {
    isEscalation = true;
  }

  const replyMsg: ChatMessage = {
    id: `msg-${Date.now()}-muse`,
    sender: 'muse',
    text: museReplyText,
    timestamp: new Date().toISOString(),
    citations,
    platterListings: platter.slice(0, 3),
    isEscalation,
    suggestedAction: isEscalation ? 'SCHEDULE_MIKE_CALL' : 'BOOK_TOUR'
  };

  session.messages.push(replyMsg);
  return replyMsg;
}

/**
 * Handle incoming message from Mike Ford (3-Way Chat capability)
 * Appears seamlessly in the buyer's conversation stream.
 */
export function handleMikeReply(leadId: string, replyText: string): ChatMessage {
  const session = getOrCreateBuyerSession(leadId, 'internal');
  const cleanText = sanitizePiiInput(replyText);

  const mikeMsg: ChatMessage = {
    id: `msg-${Date.now()}-mike`,
    sender: 'mike',
    text: `[Mike Ford, NMLS #288455]: ${cleanText}`,
    timestamp: new Date().toISOString()
  };

  session.messages.push(mikeMsg);
  return mikeMsg;
}

function extractPreferencesFromText(text: string, session: BuyerSessionState) {
  const lower = text.toLowerCase();
  
  // City extraction
  const cities = ['portland', 'gresham', 'vancouver', 'beaverton', 'hillsboro', 'oregon city', 'clackamas', 'tigard'];
  for (const c of cities) {
    if (lower.includes(c)) {
      session.statedPreferences.city = c.charAt(0).toUpperCase() + c.slice(1);
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
