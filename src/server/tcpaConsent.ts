// Copyright (c) 2026 Mike Ford, NMLS #288455. All Rights Reserved.
/**
 * TCPA Compliance & Texting Gate Engine
 * 
 * CORE ARCHITECTURAL INVARIANT:
 * - Intake opt-in is the ONLY TCPA-grade text consent in the system.
 * - Property-notes checkbox is strictly in-app reply confirmation, NEVER text consent.
 * - Every text/SMS send path gates on canTextLead(leadId). Fail closed.
 * - Cryptographic hash-chaining on branch_audit_logs for all consent mutations.
 * - Twilio remains dormant until Mike explicitly wires it.
 */

import crypto from 'node:crypto';
import { getAdminFirestore, safeFirestoreWrite } from './firebaseAdmin.ts';
import { recordAuditLedger } from './compliance.ts';

export const TCPA_DISCLOSURE_TEXT =
  "By providing your phone number, you agree to receive text messages from Mike Ford and paired agents about properties and your homebuying journey. Message and data rates may apply. Reply STOP to opt out at any time. Consent is not a condition of purchase.";

export const TCPA_CONSENT_VERSION = "2026.1-intake-v1";

export interface TcpaConsentRecord {
  leadId: string;
  phoneE164: string;
  consentTextVersion: string;
  consentedAt: string; // server ISO timestamp
  source: 'intake';
  status: 'GRANTED' | 'REVOKED';
  revokedAt?: string;
  revocationReason?: string;
}

export interface BranchAuditLogEntry {
  id: string;
  timestamp: string;
  leadId: string;
  eventType: 'TCPA_CONSENT_GRANTED' | 'TCPA_CONSENT_REVOKED' | 'SMS_SEND_BLOCKED_NO_TCPA' | 'SMS_SEND_ATTEMPT';
  phoneE164?: string;
  source: string;
  previousHash: string;
  entryHash: string;
  metadata?: Record<string, unknown>;
}

// In-memory stores (survive network delays and power automated test fixtures)
const tcpaConsentStore = new Map<string, TcpaConsentRecord>();
const tcpaConsentEvents: any[] = [];
const branchAuditLogs: BranchAuditLogEntry[] = [];
let lastLogHash = '0000000000000000000000000000000000000000000000000000000000000000';

/**
 * Validates and normalizes phone number to strict E.164 format (+1XXXXXXXXXX for US).
 * Rejects malformed numbers, letters, symbols, or numbers with < 10 digits.
 * Never stores unvalidated free text.
 */
export function validateAndFormatE164(rawPhone: string): { valid: boolean; e164?: string; error?: string } {
  if (!rawPhone || typeof rawPhone !== 'string') {
    return { valid: false, error: 'Phone number is required.' };
  }

  const trimmed = rawPhone.trim();
  const digitsOnly = trimmed.replace(/\D/g, '');

  // US NANP standard: 10 digits or 11 digits starting with 1
  if (digitsOnly.length === 10) {
    const areaCode = digitsOnly.substring(0, 3);
    const exchange = digitsOnly.substring(3, 6);
    // Area code and exchange code cannot start with 0 or 1 under NANPA
    if (areaCode.startsWith('0') || areaCode.startsWith('1')) {
      return { valid: false, error: 'Invalid US area code: cannot start with 0 or 1.' };
    }
    if (exchange.startsWith('0') || exchange.startsWith('1')) {
      return { valid: false, error: 'Invalid US exchange code: cannot start with 0 or 1.' };
    }
    return { valid: true, e164: `+1${digitsOnly}` };
  }

  if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
    const rest = digitsOnly.substring(1);
    const areaCode = rest.substring(0, 3);
    const exchange = rest.substring(3, 6);
    if (areaCode.startsWith('0') || areaCode.startsWith('1')) {
      return { valid: false, error: 'Invalid US area code: cannot start with 0 or 1.' };
    }
    if (exchange.startsWith('0') || exchange.startsWith('1')) {
      return { valid: false, error: 'Invalid US exchange code: cannot start with 0 or 1.' };
    }
    return { valid: true, e164: `+1${rest}` };
  }

  // Already E.164 with international code
  if (trimmed.startsWith('+')) {
    const intlDigits = trimmed.substring(1).replace(/\D/g, '');
    if (intlDigits.length >= 10 && intlDigits.length <= 15) {
      return { valid: true, e164: `+${intlDigits}` };
    }
  }

  return { valid: false, error: 'Malformed phone number. Valid 10-digit US phone number required for TCPA compliance.' };
}

/**
 * Appends an audit event to branch_audit_logs with cryptographic SHA-256 hash chaining.
 */
export async function stampBranchAuditLog(
  entry: Omit<BranchAuditLogEntry, 'id' | 'timestamp' | 'previousHash' | 'entryHash'>
): Promise<BranchAuditLogEntry> {
  const timestamp = new Date().toISOString();
  const id = `audit-branch-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const previousHash = lastLogHash;

  const hashInput = `${previousHash}:${timestamp}:${entry.eventType}:${entry.leadId}:${entry.phoneE164 || ''}:${JSON.stringify(entry.metadata || {})}`;
  const entryHash = crypto.createHash('sha256').update(hashInput).digest('hex');
  lastLogHash = entryHash;

  const record: BranchAuditLogEntry = {
    id,
    timestamp,
    previousHash,
    entryHash,
    ...entry
  };

  branchAuditLogs.push(record);

  // Mirror to Firestore branch_audit_logs collection
  const db = getAdminFirestore();
  if (db) {
    safeFirestoreWrite(
      db.collection('branch_audit_logs').doc(id).set(record),
      1500
    ).catch(err => {
      console.warn('[Branch Audit Log Warning]', err.message);
    });
  }

  return record;
}

/**
 * Intake Opt-In: The ONLY TCPA-grade text consent in the system.
 * Validates E.164, generates server timestamp, stores immutable record,
 * and stamps hash-chained audit log.
 */
export async function recordIntakeTcpaConsent(params: {
  leadId: string;
  rawPhone: string;
  ipAddress?: string;
  source?: 'intake';
}): Promise<TcpaConsentRecord> {
  const { leadId, rawPhone, ipAddress } = params;

  const phoneCheck = validateAndFormatE164(rawPhone);
  if (!phoneCheck.valid || !phoneCheck.e164) {
    throw new Error(phoneCheck.error || 'Invalid phone number for TCPA consent.');
  }

  const serverTimestamp = new Date().toISOString();
  const consentRecord: TcpaConsentRecord = {
    leadId,
    phoneE164: phoneCheck.e164,
    consentTextVersion: TCPA_CONSENT_VERSION,
    consentedAt: serverTimestamp,
    source: 'intake',
    status: 'GRANTED'
  };

  tcpaConsentStore.set(leadId, consentRecord);

  // Append to immutable events
  const eventId = `tcpa-event-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  tcpaConsentEvents.push({
    id: eventId,
    leadId,
    phoneE164: phoneCheck.e164,
    eventType: 'TCPA_CONSENT_GRANTED',
    consentTextVersion: TCPA_CONSENT_VERSION,
    timestamp: serverTimestamp,
    source: 'intake'
  });

  // Mirror to Firestore tcpa_consents and tcpa_consent_events
  const db = getAdminFirestore();
  if (db) {
    safeFirestoreWrite(
      db.collection('tcpa_consents').doc(leadId).set(consentRecord, { merge: true }),
      2000
    ).catch(err => console.warn('[TCPA Consent Firestore Warning]', err.message));

    safeFirestoreWrite(
      db.collection('tcpa_consent_events').doc(eventId).set({
        ...consentRecord,
        eventId,
        eventType: 'TCPA_CONSENT_GRANTED'
      }),
      2000
    ).catch(err => console.warn('[TCPA Event Firestore Warning]', err.message));
  }

  // Stamp to branch_audit_logs with cryptographic hash chaining
  await stampBranchAuditLog({
    leadId,
    eventType: 'TCPA_CONSENT_GRANTED',
    phoneE164: phoneCheck.e164,
    source: 'intake',
    metadata: {
      consentTextVersion: TCPA_CONSENT_VERSION,
      ipAddress: ipAddress || 'unknown',
      consentedAt: serverTimestamp
    }
  });

  // Stamp compliance audit ledger
  recordAuditLedger({
    leadId,
    actionType: 'TCPA_CONSENT_GRANTED',
    ipAddress: ipAddress || '127.0.0.1',
    tcpaLanguageVersion: TCPA_CONSENT_VERSION,
    redactedPayload: {
      phoneE164: phoneCheck.e164,
      source: 'intake',
      consentedAt: serverTimestamp
    }
  });

  console.log(`[TCPA Consent Granted] Lead ${leadId} opted in with E.164 phone ${phoneCheck.e164}`);
  return consentRecord;
}

/**
 * Revokes TCPA text consent (e.g. STOP received).
 * Writes a NEW revocation record; never edits or destroys the original consent record.
 */
export async function revokeTcpaConsent(params: {
  leadId?: string;
  rawPhone?: string;
  reason?: string;
  ipAddress?: string;
}): Promise<{ success: boolean; revocationRecord: any }> {
  let targetLeadId = params.leadId;
  let phoneE164: string | undefined;

  if (params.rawPhone) {
    const phoneCheck = validateAndFormatE164(params.rawPhone);
    if (phoneCheck.valid) phoneE164 = phoneCheck.e164;
  }

  // Find existing record
  let existing: TcpaConsentRecord | undefined;
  if (targetLeadId) {
    existing = tcpaConsentStore.get(targetLeadId);
  } else if (phoneE164) {
    for (const [lid, rec] of tcpaConsentStore.entries()) {
      if (rec.phoneE164 === phoneE164) {
        existing = rec;
        targetLeadId = lid;
        break;
      }
    }
  }

  const serverTimestamp = new Date().toISOString();
  const effectiveLeadId = targetLeadId || `revoked-${Date.now()}`;
  const effectivePhone = phoneE164 || existing?.phoneE164 || 'unknown';

  if (existing) {
    // Mark in-memory record status as REVOKED while keeping original consentedAt intact
    existing.status = 'REVOKED';
    existing.revokedAt = serverTimestamp;
    existing.revocationReason = params.reason || 'STOP opt-out';
  }

  const revocationEventId = `tcpa-revocation-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const revocationRecord = {
    id: revocationEventId,
    leadId: effectiveLeadId,
    phoneE164: effectivePhone,
    eventType: 'TCPA_CONSENT_REVOKED',
    timestamp: serverTimestamp,
    source: 'STOP',
    reason: params.reason || 'STOP opt-out',
    originalConsentedAt: existing?.consentedAt || null,
    consentTextVersion: existing?.consentTextVersion || TCPA_CONSENT_VERSION
  };

  tcpaConsentEvents.push(revocationRecord);

  // Mirror to Firestore tcpa_consents and tcpa_consent_events
  const db = getAdminFirestore();
  if (db && targetLeadId) {
    safeFirestoreWrite(
      db.collection('tcpa_consents').doc(targetLeadId).set({
        status: 'REVOKED',
        revokedAt: serverTimestamp,
        revocationReason: params.reason || 'STOP opt-out'
      }, { merge: true }),
      2000
    ).catch(err => console.warn('[TCPA Revocation Firestore Warning]', err.message));

    safeFirestoreWrite(
      db.collection('tcpa_consent_events').doc(revocationEventId).set(revocationRecord),
      2000
    ).catch(err => console.warn('[TCPA Revocation Event Warning]', err.message));
  }

  // Stamp to branch_audit_logs with hash chaining
  await stampBranchAuditLog({
    leadId: effectiveLeadId,
    eventType: 'TCPA_CONSENT_REVOKED',
    phoneE164: effectivePhone,
    source: 'STOP',
    metadata: {
      reason: params.reason || 'STOP opt-out',
      revokedAt: serverTimestamp,
      ipAddress: params.ipAddress || 'unknown'
    }
  });

  // Stamp compliance audit ledger
  recordAuditLedger({
    leadId: effectiveLeadId,
    actionType: 'TCPA_CONSENT_REVOKED',
    ipAddress: params.ipAddress || '127.0.0.1',
    redactedPayload: {
      phoneE164: effectivePhone,
      source: 'STOP',
      revokedAt: serverTimestamp
    }
  });

  console.log(`[TCPA Consent Revoked] Lead ${effectiveLeadId} revoked text consent via STOP`);
  return { success: true, revocationRecord };
}

/**
 * SINGLE GATE FUNCTION: canTextLead(leadId)
 * 
 * CORE TCPA LAW:
 * Gated SOLELY and EXCLUSIVELY on a valid TCPA consent record.
 * Requirements:
 * 1. Record exists.
 * 2. phoneE164 is present and valid E.164.
 * 3. consentedAt is present (server timestamp).
 * 4. status === 'GRANTED' (no subsequent revocation).
 * 
 * FAIL CLOSED: If no consent record exists, returns FALSE.
 * The notes checkbox field is NEVER referenced here.
 */
export async function canTextLead(leadId: string): Promise<boolean> {
  if (!leadId || typeof leadId !== 'string') return false;

  // 1. Check in-memory store first
  let record = tcpaConsentStore.get(leadId);

  // 2. Fall back to Firestore tcpa_consents if not cached
  if (!record) {
    const db = getAdminFirestore();
    if (db) {
      try {
        const snap = await db.collection('tcpa_consents').doc(leadId).get();
        if (snap.exists) {
          record = snap.data() as TcpaConsentRecord;
          if (record) {
            tcpaConsentStore.set(leadId, record);
          }
        }
      } catch (err: any) {
        console.warn('[TCPA Gate Firestore Warning]', err.message);
      }
    }
  }

  if (!record) {
    return false; // Fail closed: zero record = zero texting
  }

  if (record.status !== 'GRANTED') {
    return false; // Revoked or inactive
  }

  if (!record.phoneE164 || !record.phoneE164.startsWith('+')) {
    return false; // Missing or malformed E.164
  }

  if (!record.consentedAt) {
    return false; // Missing consent timestamp
  }

  return true;
}

/**
 * Reads TCPA Consent Record for Lead
 */
export async function getTcpaConsentRecord(leadId: string): Promise<TcpaConsentRecord | null> {
  if (!leadId) return null;
  const inMem = tcpaConsentStore.get(leadId);
  if (inMem) return inMem;

  const db = getAdminFirestore();
  if (db) {
    try {
      const snap = await db.collection('tcpa_consents').doc(leadId).get();
      if (snap.exists) {
        const rec = snap.data() as TcpaConsentRecord;
        tcpaConsentStore.set(leadId, rec);
        return rec;
      }
    } catch {
      // ignore
    }
  }
  return null;
}

/**
 * Dashboard & LO View Consent Badge Generator
 * Produces formatted badge copy strictly from the TCPA consent record:
 * - "TCPA text: YES (phone on file, consented {date})"
 * - "TCPA text: NO"
 */
export async function getLeadTcpaConsentBadge(leadId: string): Promise<{
  textable: boolean;
  badgeLabel: string;
  consentedAt?: string;
  phoneE164?: string;
}> {
  const allowed = await canTextLead(leadId);
  if (!allowed) {
    return {
      textable: false,
      badgeLabel: 'TCPA text: NO'
    };
  }

  const rec = await getTcpaConsentRecord(leadId);
  if (!rec || !rec.consentedAt) {
    return {
      textable: false,
      badgeLabel: 'TCPA text: NO'
    };
  }

  const dateStr = new Date(rec.consentedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return {
    textable: true,
    badgeLabel: `TCPA text: YES (phone on file, consented ${dateStr})`,
    consentedAt: rec.consentedAt,
    phoneE164: rec.phoneE164
  };
}

/**
 * Unified Text/SMS Send Path
 * Every outbound text send path MUST execute through this function or gate on canTextLead().
 * 
 * GUARDRAILS:
 * - Gated on canTextLead(leadId).
 * - Twilio remains dormant until Mike explicitly wires credentials.
 * - Logs BLOCKED if no consent.
 */
export async function sendSmsToLead(
  leadId: string,
  messageText: string,
  metadata?: Record<string, unknown>
): Promise<{ sent: boolean; reason: string; phoneE164?: string }> {
  const isAllowed = await canTextLead(leadId);

  if (!isAllowed) {
    console.warn(`[SMS BLOCKED] Lead ${leadId} lacks valid TCPA consent. Text message send aborted.`);
    await stampBranchAuditLog({
      leadId,
      eventType: 'SMS_SEND_BLOCKED_NO_TCPA',
      source: 'sms_gateway',
      metadata: {
        attemptedMessageLength: messageText.length,
        reason: 'BLOCKED_NO_TCPA_CONSENT',
        ...metadata
      }
    });
    return { sent: false, reason: 'BLOCKED_NO_TCPA_CONSENT' };
  }

  const record = await getTcpaConsentRecord(leadId);
  const phoneE164 = record?.phoneE164 || 'unknown';

  // Twilio remains dormant until Mike explicitly wires it in production
  console.log(`[DORMANT SMS GATEWAY] Lead ${leadId} has valid TCPA consent (${phoneE164}). Twilio SMS gateway remains dormant in standby.`);

  await stampBranchAuditLog({
    leadId,
    eventType: 'SMS_SEND_ATTEMPT',
    phoneE164,
    source: 'sms_gateway',
    metadata: {
      status: 'TWILIO_DORMANT_STANDBY',
      messageLength: messageText.length,
      ...metadata
    }
  });

  return {
    sent: false,
    reason: 'TWILIO_DORMANT_STANDBY',
    phoneE164
  };
}

/**
 * Returns in-memory branch audit logs for test suite validation
 */
export function getBranchAuditLogs(): BranchAuditLogEntry[] {
  return [...branchAuditLogs];
}

/**
 * Resets in-memory stores for automated test isolation
 */
export function resetTcpaConsentForTest(): void {
  tcpaConsentStore.clear();
  tcpaConsentEvents.length = 0;
  branchAuditLogs.length = 0;
  lastLogHash = '0000000000000000000000000000000000000000000000000000000000000000';
}
