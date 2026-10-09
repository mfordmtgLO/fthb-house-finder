// Copyright (c) 2026 Mike Ford, NMLS #288455. All Rights Reserved.
/**
 * Geo/Muse scripted command contract (v1).
 *
 * No model call, dynamic AI answer, mortgage estimate, note delivery, or SMS
 * occurs in this module. It only returns a validated command proposal and an
 * approved response template. UI/server adapters must authorize and execute.
 */
export type GeoIntent =
  | 'OPEN_TOP_THREE'
  | 'OPEN_PROPERTY_MAP'
  | 'DRAFT_PROPERTY_NOTE'
  | 'REQUEST_LO_CALL'
  | 'REQUEST_AGENT_TOUR'
  | 'MORTGAGE_HANDOFF'
  | 'UNKNOWN';

export type GeoCue = 'welcome' | 'point' | 'thinking' | 'attentive';
export type GeoAction =
  | { type: 'OPEN_FAVORITES'; listingIds: string[] }
  | { type: 'FOCUS_LISTING'; listingId: string }
  | { type: 'PREPARE_NOTE'; listingId: string; recipientRole: 'lo'; draft: string }
  | { type: 'PREPARE_CONTACT_REQUEST'; recipientRole: 'lo' | 'agent'; listingId?: string }
  | { type: 'NONE' };

export interface GeoListingRef {
  id: string;
  address: string;
}

export interface GeoCommandContext {
  /** Trusted, authenticated server-side plugin instance identity. */
  instanceId: string;
  leadId: string;
  /** Trusted pairing lookup, never extracted from buyer text. */
  assignedLoanOfficer?: { id: string; firstName: string };
  assignedAgent?: { id: string; firstName: string };
  /** Only listings the authenticated buyer is authorized to access. */
  visibleListings: GeoListingRef[];
  favoriteListingIds: string[];
  selectedListingId?: string;
}

export interface GeoCommandResult {
  intent: GeoIntent;
  responseId: string;
  spokenText: string;
  geoCue: GeoCue;
  action: GeoAction;
  /** Any external contact or mutation requires a separate confirmation. */
  requiresConfirmation: boolean;
}

const MAX_INPUT = 500;
const TOP_THREE = /\b(?:top\s*(?:three|3)|(?:my\s+)?(?:favorite|favourite|saved)\s+(?:homes|houses|listings))\b/i;
const MAP = /\b(?:show|find|open|locate|take me to|pull up|zoom to)\b.*\b(?:map|listing|home|house|property)\b|\b(?:map)\b.*\b(?:show|open|find)\b/i;
const NOTE = /\b(?:send|write|leave|draft|add|post)\b.*\b(?:note|message|question)\b/i;
const CALL = /\b(?:call me|give me a call|phone me|contact me|reach out to me|request a call)\b/i;
const TOUR = /\b(?:schedule|book|request|arrange)\b.*\b(?:tour|showing|visit|walkthrough)\b/i;
const FINANCE = /\b(?:mortgage|interest rate|rates|buydown|2[ -]?1|down payment|dpa|grant|qualif(?:y|ication)|preapprov|pre-approv|loan|monthly payment|closing cost|fha|usda|conventional|credit score|afford|underwriting)\b/i;
const CONTACT = /\b(?:loan officer|lender|mike|agent|realtor|broker)\b/i;
const CONFIRM = /\b(?:yes|sure|ok|okay|send it|do it|confirm)\b/i;

function safeFirstName(name: string | undefined): string {
  const first = (name || '').trim().split(/\s+/)[0] || '';
  return /^[\p{L}][\p{L}'-]{0,39}$/u.test(first) ? first : 'your loan officer';
}

function cleanInput(raw: string): string {
  return typeof raw === 'string'
    ? raw.normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, MAX_INPUT)
    : '';
}

function result(intent: GeoIntent, responseId: string, spokenText: string, geoCue: GeoCue, action: GeoAction = { type: 'NONE' }, requiresConfirmation = false): GeoCommandResult {
  return { intent, responseId, spokenText, geoCue, action, requiresConfirmation };
}

function findListing(text: string, context: GeoCommandContext): GeoListingRef | null {
  const normalized = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const haystack = normalized(text);
  const candidates = context.visibleListings.filter(l => {
    const address = normalized(l.address);
    // Avoid matching trivial substrings and never fabricate a listing ID.
    return address.length >= 8 && haystack.includes(address);
  });
  if (candidates.length === 1) return candidates[0];
  if (candidates.length > 1) return null;
  // "this house" is permitted only when the UI supplies a selected listing.
  if (/\b(?:this|that|selected|current)\s+(?:house|home|listing|property)\b/i.test(text)) {
    return context.visibleListings.find(l => l.id === context.selectedListingId) || null;
  }
  return null;
}

/**
 * Pure command proposal. Caller MUST authenticate instanceId + leadId, obtain
 * server-authoritative pairing and listings, enforce RBAC/kill switches, and
 * revalidate the returned action before execution.
 *
 * Never treat "yes" alone as authorization: confirmation is a separate
 * server-side state machine bound to an action ID, property, and recipient.
 */
export function matchGeoCommand(raw: string, context: GeoCommandContext): GeoCommandResult {
  const text = cleanInput(raw);
  const lo = safeFirstName(context.assignedLoanOfficer?.firstName);
  const agent = safeFirstName(context.assignedAgent?.firstName);
  if (!text) return result('UNKNOWN', 'GEO_PLEASE_REPEAT', 'I missed that. You can ask me to show your favorites, open a home on the map, or contact your homebuying team.', 'thinking');
  if (CONFIRM.test(text) && /^(?:yes|sure|ok|okay|send it|do it|confirm)[.! ]*$/i.test(text)) {
    return result('UNKNOWN', 'GEO_CONFIRM_CONTEXT_REQUIRED', 'Please use the confirmation button on your pending request.', 'attentive');
  }

  // Explicit note request takes precedence over finance keywords in note text.
  if (NOTE.test(text)) {
    const listing = findListing(text, context);
    if (!listing) return result('DRAFT_PROPERTY_NOTE', 'GEO_SELECT_HOME_FOR_NOTE', 'Please open the property card you want to send a note about.', 'point');
    if (!context.assignedLoanOfficer?.id) return result('DRAFT_PROPERTY_NOTE', 'GEO_TEAM_UNAVAILABLE', 'I can help you reach your homebuying team once a loan officer is assigned.', 'attentive');
    // Buyer-authored content is NOT invented, rewritten, or transmitted here.
    // The property card collects the actual message and displays confirmation.
    return result('DRAFT_PROPERTY_NOTE', 'GEO_NOTE_DRAFT', `I'll open a note for ${lo} on that property. Please review your message before sending.`, 'attentive', { type: 'PREPARE_NOTE', listingId: listing.id, recipientRole: 'lo', draft: '' }, true);
  }

  if (TOP_THREE.test(text)) {
    const visible = new Set(context.visibleListings.map(l => l.id));
    const ids = context.favoriteListingIds.filter(id => visible.has(id)).slice(0, 3);
    if (!ids.length) return result('OPEN_TOP_THREE', 'GEO_NO_FAVORITES', 'You have no saved favorites yet. Tap the heart on a home to add one.', 'welcome');
    return result('OPEN_TOP_THREE', 'GEO_SHOW_FAVORITES', 'Here are your favorite homes!', 'point', { type: 'OPEN_FAVORITES', listingIds: ids });
  }

  if (MAP.test(text)) {
    const listing = findListing(text, context);
    if (!listing) return result('OPEN_PROPERTY_MAP', 'GEO_SELECT_HOME_FOR_MAP', 'Which home would you like to see? Open its property card or use its full address.', 'thinking');
    return result('OPEN_PROPERTY_MAP', 'GEO_SHOW_ON_MAP', 'Here it is on the map. Let\'s explore!', 'point', { type: 'FOCUS_LISTING', listingId: listing.id });
  }

  if (TOUR.test(text)) {
    if (!context.assignedAgent?.id) return result('REQUEST_AGENT_TOUR', 'GEO_TEAM_UNAVAILABLE', 'I can help you contact your homebuying team once an agent is assigned.', 'attentive');
    return result('REQUEST_AGENT_TOUR', 'GEO_AGENT_TOUR', `${agent} can help with a showing. Would you like to prepare a request?`, 'attentive', { type: 'PREPARE_CONTACT_REQUEST', recipientRole: 'agent', listingId: context.selectedListingId }, true);
  }

  if (CALL.test(text) || (CONTACT.test(text) && /\b(?:reach|contact|talk|speak|ask)\b/i.test(text))) {
    if (!context.assignedLoanOfficer?.id) return result('REQUEST_LO_CALL', 'GEO_TEAM_UNAVAILABLE', 'I can help you contact your homebuying team once a loan officer is assigned.', 'attentive');
    return result('REQUEST_LO_CALL', 'GEO_LO_CALL', `I can prepare a callback request for ${lo}. Would you like to review it?`, 'attentive', { type: 'PREPARE_CONTACT_REQUEST', recipientRole: 'lo', listingId: context.selectedListingId }, true);
  }

  if (FINANCE.test(text)) {
    if (!context.assignedLoanOfficer?.id) return result('MORTGAGE_HANDOFF', 'GEO_FINANCE_TEAM', 'That's a good question for your licensed loan officer. Would you like to contact your homebuying team?', 'attentive');
    return result('MORTGAGE_HANDOFF', 'GEO_FINANCE_HANDOFF', `That's a great question for ${lo}. Would you like me to prepare a request for a call?`, 'attentive', { type: 'PREPARE_CONTACT_REQUEST', recipientRole: 'lo', listingId: context.selectedListingId }, true);
  }

  return result('UNKNOWN', 'GEO_SAFE_FALLBACK', `I can help with favorites, maps, and property notes. For anything else, ${lo} can help. Would you like to request a call?`, 'welcome');
}
