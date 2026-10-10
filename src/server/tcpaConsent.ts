// Copyright (c) 2026 Mike Ford, NMLS #288455. All Rights Reserved.
/**
 * Durable, fail-closed TCPA consent store for Geo / House Finder.
 * NOT wired to an SMS transport. Property-note checkboxes never grant consent.
 *
 * Each mutation and its audit event are written atomically in a Firestore
 * transaction. No in-memory grant cache, silent timeout, or fire-and-forget write.
 * A single transactionally maintained chain head prevents concurrent writers
 * from forking the audit chain.
 *
 * This is an engineering control, not a legal determination of consent validity.
 */
import crypto from 'node:crypto';
import { getAdminFirestore } from './firebaseAdmin.ts';

export const TCPA_CONSENT_VERSION = '2026.2-assigned-lo-intake-v1';
export const TCPA_DISCLOSURE_TEXT =
  'Optional: I agree to receive text messages from my verified assigned loan officer and paired agent about properties and my homebuying journey. Message and data rates may apply. Reply STOP to opt out at any time. Consent is not a condition of purchase.';

export interface TcpaConsentRecord {
  leadId: string;
  phoneE164: string;
  consentTextVersion: string;
  consentedAt: string;
  source: 'intake';
  status: 'GRANTED' | 'REVOKED';
  revokedAt?: string;
  revocationReason?: string;
}

function firestoreOrThrow() {
  const db = getAdminFirestore();
  if (!db) throw new Error('TCPA_STORAGE_UNAVAILABLE');
  return db;
}

export function validateAndFormatE164(raw: string): string | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  // US NANP only. Do not silently accept arbitrary international formats.
  const match = /^(?:\+?1[\s.-]?)?\(?([2-9]\d{2})\)?[\s.-]?([2-9]\d{2})[\s.-]?(\d{4})$/.exec(value);
  return match ? `+1${match[1]}${match[2]}${match[3]}` : null;
}

function requireLeadId(leadId: string) {
  if (typeof leadId !== 'string' || !/^[a-zA-Z0-9_-]{6,120}$/.test(leadId)) {
    throw new Error('INVALID_LEAD_ID');
  }
}

interface ConsentEvent {
  leadId: string;
  eventType: 'TCPA_CONSENT_GRANTED' | 'TCPA_CONSENT_REVOKED';
  timestamp: string;
  source: 'intake' | 'STOP' | 'manual';
  consentTextVersion: string;
  previousHash: string;
  entryHash: string;
  reason?: string;
  ipAddress?: string;
}

/** Only call after verified, affirmative intake checkbox action. */
export async function recordIntakeTcpaConsent(params: {
  leadId: string;
  rawPhone: string;
  explicitlyChecked: boolean;
  ipAddress?: string;
}): Promise<TcpaConsentRecord> {
  requireLeadId(params.leadId);
  if (params.explicitlyChecked !== true) throw new Error('TCPA_EXPLICIT_OPT_IN_REQUIRED');
  const phone = validateAndFormatE164(params.rawPhone);
  if (!phone) throw new Error('TCPA_INVALID_PHONE');
  const db = firestoreOrThrow();
  const now = new Date().toISOString();
  const consentRef = db.collection('tcpa_consents').doc(params.leadId);
  const headRef = db.collection('tcpa_audit_chain').doc('head');
  const eventRef = db.collection('tcpa_consent_events').doc();
  const record: TcpaConsentRecord = {
    leadId: params.leadId, phoneE164: phone,
    consentTextVersion: TCPA_CONSENT_VERSION,
    consentedAt: now, source: 'intake', status: 'GRANTED'
  };
  await db.runTransaction(async tx => {
    // All reads before writes; no cached grant can override revocation.
    const [previous, head] = await Promise.all([tx.get(consentRef), tx.get(headRef)]);
    const existing = previous.exists ? previous.data() as TcpaConsentRecord : null;
    // Require a fresh explicit opt-in event to regrant a revoked consent.
    if (existing?.status === 'GRANTED' && existing.phoneE164 === phone) {
      throw new Error('TCPA_ALREADY_GRANTED');
    }
    const previousHash = (head.data()?.lastHash as string | undefined) || 'GENESIS';
    const payload = { leadId: params.leadId, eventType: 'TCPA_CONSENT_GRANTED' as const,
      timestamp: now, source: 'intake' as const, consentTextVersion: TCPA_CONSENT_VERSION,
      previousHash, ipAddress: params.ipAddress };
    const entryHash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    tx.set(consentRef, record);
    tx.create(eventRef, { ...payload, entryHash } satisfies ConsentEvent);
    tx.set(headRef, { lastHash: entryHash, lastEventId: eventRef.id }, { merge: true });
  });
  return record; // Only after Firestore acknowledges the transaction.
}

/** STOP/revocation must be persisted before the caller reports success. */
export async function revokeTcpaConsent(params: {
  leadId: string; reason?: string; ipAddress?: string;
}): Promise<{ revoked: true }> {
  requireLeadId(params.leadId);
  const db = firestoreOrThrow();
  const now = new Date().toISOString();
  const consentRef = db.collection('tcpa_consents').doc(params.leadId);
  const headRef = db.collection('tcpa_audit_chain').doc('head');
  const eventRef = db.collection('tcpa_consent_events').doc();
  await db.runTransaction(async tx => {
    const [existing, head] = await Promise.all([tx.get(consentRef), tx.get(headRef)]);
    const record = existing.exists ? existing.data() as TcpaConsentRecord : null;
    const previousHash = (head.data()?.lastHash as string | undefined) || 'GENESIS';
    const payload = { leadId: params.leadId, eventType: 'TCPA_CONSENT_REVOKED' as const,
      timestamp: now, source: 'STOP' as const,
      consentTextVersion: record?.consentTextVersion || TCPA_CONSENT_VERSION,
      previousHash, reason: params.reason || 'STOP opt-out', ipAddress: params.ipAddress };
    const entryHash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    // Record a deny marker even if no prior grant exists.
    tx.set(consentRef, {
      leadId: params.leadId, status: 'REVOKED', revokedAt: now,
      revocationReason: payload.reason,
      consentTextVersion: payload.consentTextVersion,
      ...(record?.phoneE164 ? { phoneE164: record.phoneE164 } : {}),
      ...(record?.consentedAt ? { consentedAt: record.consentedAt } : {}),
      source: 'intake'
    }, { merge: true });
    tx.create(eventRef, { ...payload, entryHash } satisfies ConsentEvent);
    tx.set(headRef, { lastHash: entryHash, lastEventId: eventRef.id }, { merge: true });
  });
  return { revoked: true };
}

/** Always check Firestore's current record before an SMS send. */
export async function canTextLead(leadId: string): Promise<boolean> {
  if (typeof leadId !== 'string' || !/^[a-zA-Z0-9_-]{6,120}$/.test(leadId)) return false;
  try {
    const db = firestoreOrThrow();
    const snap = await db.collection('tcpa_consents').doc(leadId).get();
    if (!snap.exists) return false;
    const record = snap.data() as TcpaConsentRecord;
    return record.status === 'GRANTED' &&
      record.source === 'intake' &&
      record.consentTextVersion === TCPA_CONSENT_VERSION &&
      Boolean(record.consentedAt && validateAndFormatE164(record.phoneE164));
  } catch {
    return false;
  }
}

/** Deliberately dormant until separately reviewed SMS integration is built. */
export async function sendSmsToLead(_leadId: string, _text: string): Promise<{ sent: false; reason: string }> {
  return { sent: false, reason: 'SMS_TRANSPORT_NOT_CONFIGURED' };
}
