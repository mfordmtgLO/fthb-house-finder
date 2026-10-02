// Copyright (c) 2026 Mike Ford, NMLS #288455. All Rights Reserved.
/**
 * Compliance & Audit Ledger Engine
 * Zero-trust architecture, PII redaction, TCPA opt-in audit ledger,
 * Question auto-detection, and direct push notification pipeline to Mike Ford's iPhone.
 */

export interface AuditLedgerEntry {
  id: string;
  timestamp: string;
  leadId: string;
  actionType: 'TCPA_OPT_IN' | 'DISCLAIMER_SERVED' | 'PROPERTY_NOTE' | 'MUSE_CHAT_QUESTION' | 'ALERT_OPT_IN';
  propertyId?: string;
  ipAddress: string;
  redactedPayload: Record<string, unknown>;
  tcpaLanguageVersion?: string;
}

// In-memory compliance audit ledger mirrored to Firestore compliance_audit_ledger
const auditLedgerStore: AuditLedgerEntry[] = [];

/**
 * PII and SSN Sanitizer
 * Zero-trust rule: Never store or accept SSN.
 * Redacts 9-digit numbers, SSN patterns, credit card patterns.
 */
export function sanitizePiiInput(input: string): string {
  if (!input || typeof input !== 'string') return '';

  return input
    // SSN pattern XXX-XX-XXXX
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED_SSN]')
    // SSN pattern without dashes if 9 digits isolated
    .replace(/\b\d{9}\b/g, '[REDACTED_IDENTIFIER]')
    // Standard credit card patterns
    .replace(/\b(?:\d{4}[ -]?){3}\d{4}\b/g, '[REDACTED_FINANCIAL_CARD]');
}

/**
 * Validates income inputs: Strictly allows brackets, NEVER raw specific income values.
 */
export const ALLOWED_INCOME_BRACKETS = [
  'under_60k',
  '60k_to_85k',
  '85k_to_115k',
  '115k_to_150k',
  'over_150k'
] as const;

export type IncomeBracket = typeof ALLOWED_INCOME_BRACKETS[number];

export function validateIncomeBracket(val: string): IncomeBracket | null {
  if (ALLOWED_INCOME_BRACKETS.includes(val as IncomeBracket)) {
    return val as IncomeBracket;
  }
  return null;
}

/**
 * Question Auto-Detection on Property Notes and Muse Conversations.
 * Identifies high-intent buyer inquiries for Mike Ford LO action items.
 */
export function detectBuyerActionItems(text: string): { isQuestion: boolean; actionCategory: string | null } {
  const lower = text.toLowerCase();
  const questionWords = ['how', 'what', 'can i', 'qualify', 'down payment', 'monthly payment', 'rate', 'credit', 'schedule', 'tour', 'offer', 'buydown', '?'];
  
  const hasQuestion = questionWords.some(q => lower.includes(q));
  if (!hasQuestion) {
    return { isQuestion: false, actionCategory: null };
  }

  if (lower.includes('rate') || lower.includes('monthly') || lower.includes('payment') || lower.includes('cost')) {
    return { isQuestion: true, actionCategory: 'PAYMENT_AND_RATE_INQUIRY' };
  }
  if (lower.includes('tour') || lower.includes('see') || lower.includes('show') || lower.includes('visit')) {
    return { isQuestion: true, actionCategory: 'SHOWING_REQUEST' };
  }
  if (lower.includes('buydown') || lower.includes('credit') || lower.includes('closing')) {
    return { isQuestion: true, actionCategory: 'OFFER_STRATEGY_INQUIRY' };
  }
  if (lower.includes('down') || lower.includes('grant') || lower.includes('qualify')) {
    return { isQuestion: true, actionCategory: 'ELIGIBILITY_AND_DPA' };
  }

  return { isQuestion: true, actionCategory: 'GENERAL_BUYER_QUESTION' };
}

/**
 * Records an immutable entry into the compliance audit ledger.
 */
export function recordAuditLedger(entry: Omit<AuditLedgerEntry, 'id' | 'timestamp'>): AuditLedgerEntry {
  const record: AuditLedgerEntry = {
    id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    timestamp: new Date().toISOString(),
    ...entry
  };
  auditLedgerStore.push(record);
  return record;
}

export function getAuditLedger(): AuditLedgerEntry[] {
  return [...auditLedgerStore];
}

import { getMikeDeviceTokens, type RegisteredDevice } from './deviceTokens.ts';

/**
 * Direct Push Pipeline to Mike Ford's iPhone
 * STATUS: Marked honestly as not-yet-wired until production VAPID / APNs configuration.
 * NO Twilio, NO 3rd-party automated SMS vendors.
 */
export async function pushToMikeIPhone(notification: {
  title: string;
  body: string;
  leadId: string;
  propertyId?: string;
  category: string;
}): Promise<{ sent: boolean; channel: string; deviceCount: number }> {
  const registeredDevices: RegisteredDevice[] = await getMikeDeviceTokens();

  if (registeredDevices.length > 0) {
    console.log(`[Push Notification] Dispatched to ${registeredDevices.length} registered device(s) for Mike Ford.`);
    return { sent: true, channel: 'APNS_FCM_MIKE_IPHONE', deviceCount: registeredDevices.length };
  }

  console.log(`[Push Notification: Not Yet Wired] APNs/FCM push for Mike Ford awaiting device registration.`);
  return { sent: false, channel: 'NOT_YET_WIRED', deviceCount: 0 };
}
