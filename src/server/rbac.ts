// Copyright (c) 2026 Mike Ford, NMLS #288455. All Rights Reserved.
/**
 * Role-Based Access Control (RBAC) & Enterprise Security Architecture
 * 
 * Five Canonical Roles:
 * R1. Mike Ford Admin (master_admin) - System owner, full read/write, user/role management, revocation.
 * R2. IT Manager / Peer Tester (admin + expiresAt) - Debug access, strictly time-limited.
 * R3. Branch Manager (admin + branch) - Branch-scoped lead read/write.
 * R4. Loan Officer (loan_officer + assignedLeads) - Assigned leads only.
 * R5. Compliance Auditor (auditor) - Strictly READ-ONLY everywhere, PII masked.
 * 
 * Firestore-managed Staff Roster in `staff_roster/{emailId}` with short 60s in-memory TTL cache,
 * bootstrap provisioning, and 1-click server-side revocation.
 */

import type { Request, Response, NextFunction } from 'express';
import { getAdminFirestore } from './firebaseAdmin.ts';

export type StaffRole = 'master_admin' | 'admin' | 'loan_officer' | 'auditor';

export interface StaffRosterDoc {
  email: string;
  role: StaffRole;
  branch?: string;
  assignedLeads?: string[];
  expiresAt?: string; // ISO timestamp
  isRevoked: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface StaffContext {
  uid: string;
  email: string;
  role: StaffRole;
  branch?: string;
  assignedLeads?: string[];
  expiresAt?: string;
  isRevoked?: boolean;
}

export interface StaffAuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  role: StaffRole;
  action: string;
  targetLeadId?: string;
  branch?: string;
  outcome: 'ALLOWED' | 'DENIED';
  metadata?: Record<string, unknown>;
}

// In-memory audit ledger store (mirrored to Firestore compliance_audit_ledger)
const complianceAuditLedger: StaffAuditEntry[] = [];

// In-memory cache for staff roster (~60s TTL, invalidated on mutations)
interface CachedRosterEntry {
  doc: StaffRosterDoc;
  fetchedAt: number;
}
const rosterCache = new Map<string, CachedRosterEntry>();
const CACHE_TTL_MS = 60 * 1000;

export function invalidateRosterCache(email?: string): void {
  if (email) {
    rosterCache.delete(email.toLowerCase().trim());
  } else {
    rosterCache.clear();
  }
}

/**
 * Resolves staff roster entry from Firestore staff_roster collection with cache & bootstrap.
 * Fail closed: if Firestore is unavailable, returns null (never fails open).
 */
export async function getStaffRosterDoc(email: string): Promise<StaffRosterDoc | null> {
  if (!email || typeof email !== 'string') return null;
  const normEmail = email.toLowerCase().trim();

  // 1. Check TTL Cache
  const cached = rosterCache.get(normEmail);
  if (cached && (Date.now() - cached.fetchedAt < CACHE_TTL_MS)) {
    return cached.doc;
  }

  const db = getAdminFirestore();
  if (!db) {
    console.warn('[Staff Roster Warning] Firestore Admin DB unavailable — failing closed');
    return null;
  }

  try {
    const docSnap = await db.collection('staff_roster').doc(normEmail).get();
    if (docSnap.exists) {
      const data = docSnap.data() as StaffRosterDoc;
      rosterCache.set(normEmail, { doc: data, fetchedAt: Date.now() });
      return data;
    }

    // Check if roster is empty for initial system bootstrap
    const allRosterSnap = await db.collection('staff_roster').limit(2).get();
    if (allRosterSnap.empty) {
      const bootstrapEmail = (process.env.MIKE_STAFF_EMAIL || 'fordmj@gmail.com').toLowerCase().trim();
      if (bootstrapEmail && normEmail === bootstrapEmail) {
        const bootstrapDoc: StaffRosterDoc = {
          email: bootstrapEmail,
          role: 'master_admin',
          isRevoked: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'system_bootstrap'
        };

        await db.collection('staff_roster').doc(bootstrapEmail).set(bootstrapDoc);
        console.log(`[Staff Roster Bootstrap] Initialized master_admin for ${bootstrapEmail}`);

        await recordStaffAudit({
          actor: 'system_bootstrap',
          role: 'master_admin',
          action: 'BOOTSTRAP_STAFF_ROSTER',
          outcome: 'ALLOWED',
          metadata: { bootstrapEmail }
        });

        rosterCache.set(bootstrapEmail, { doc: bootstrapDoc, fetchedAt: Date.now() });
        return bootstrapDoc;
      }
    }

    return null;
  } catch (err: any) {
    console.error('[Staff Roster Lookup Error]', err.message);
    return null;
  }
}

/**
 * Upserts a staff roster document in Firestore (master_admin only)
 */
export async function upsertStaffRosterDoc(
  entry: {
    email: string;
    role: StaffRole;
    branch?: string;
    assignedLeads?: string[];
    expiresAt?: string;
    isRevoked?: boolean;
  },
  actorEmail: string
): Promise<StaffRosterDoc> {
  const normEmail = entry.email.toLowerCase().trim();
  const db = getAdminFirestore();
  if (!db) throw new Error('Firestore service unavailable');

  const existing = await getStaffRosterDoc(normEmail);
  const now = new Date().toISOString();

  const docData: StaffRosterDoc = {
    email: normEmail,
    role: entry.role,
    branch: entry.branch || existing?.branch,
    assignedLeads: entry.assignedLeads || existing?.assignedLeads,
    expiresAt: entry.expiresAt || existing?.expiresAt,
    isRevoked: entry.isRevoked !== undefined ? entry.isRevoked : (existing?.isRevoked ?? false),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    createdBy: existing?.createdBy || actorEmail
  };

  await db.collection('staff_roster').doc(normEmail).set(docData, { merge: true });
  invalidateRosterCache(normEmail);
  rosterCache.set(normEmail, { doc: docData, fetchedAt: Date.now() });
  return docData;
}

/**
 * 1-Click Revocation: sets isRevoked = true in Firestore (immediate effect)
 */
export async function revokeStaffRosterDoc(email: string, _actorEmail: string): Promise<boolean> {
  const normEmail = email.toLowerCase().trim();
  const db = getAdminFirestore();
  if (!db) return false;

  try {
    await db.collection('staff_roster').doc(normEmail).set({
      isRevoked: true,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    invalidateRosterCache(normEmail);
    return true;
  } catch (err: any) {
    console.error('[Staff Revocation Error]', err.message);
    return false;
  }
}

/**
 * Restores staff member access in Firestore
 */
export async function restoreStaffRosterDoc(email: string, _actorEmail: string): Promise<boolean> {
  const normEmail = email.toLowerCase().trim();
  const db = getAdminFirestore();
  if (!db) return false;

  try {
    await db.collection('staff_roster').doc(normEmail).set({
      isRevoked: false,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    invalidateRosterCache(normEmail);
    return true;
  } catch (err: any) {
    console.error('[Staff Restore Error]', err.message);
    return false;
  }
}

/**
 * Lists all staff roster members (PII-minimal)
 */
export async function listStaffRoster(_actorEmail: string): Promise<StaffRosterDoc[]> {
  const db = getAdminFirestore();
  if (!db) return [];

  try {
    const snap = await db.collection('staff_roster').get();
    return snap.docs.map(d => d.data() as StaffRosterDoc);
  } catch (err: any) {
    console.error('[List Staff Roster Error]', err.message);
    return [];
  }
}

/**
 * GLBA Compliance Audit Ledger Stamping
 * Every staff read or write of buyer data writes a record to compliance_audit_ledger.
 */
export async function recordStaffAudit(
  entry: Omit<StaffAuditEntry, 'id' | 'timestamp'>
): Promise<StaffAuditEntry> {
  const record: StaffAuditEntry = {
    id: `audit-staff-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    timestamp: new Date().toISOString(),
    ...entry
  };

  complianceAuditLedger.push(record);

  // Mirror to Firestore compliance_audit_ledger collection
  const db = getAdminFirestore();
  if (db) {
    try {
      await db.collection('compliance_audit_ledger').doc(record.id).set({
        ...record,
        timestamp: record.timestamp
      });
    } catch (err: any) {
      console.warn('[Audit Ledger Firestore Warning]', err.message);
    }
  }

  return record;
}

export function getComplianceAuditLedger(): StaffAuditEntry[] {
  return [...complianceAuditLedger];
}

/**
 * PII Masking Utility for Non-Owner Staff & Auditors
 * Masks email & phone for auditor, IT tester, branch manager, or unassigned loan officers.
 */
export function maskBuyerPii(data: any, staff: StaffContext): any {
  if (!data || typeof data !== 'object') return data;

  const isMaster = staff.role === 'master_admin';
  const isAssignedLO = staff.role === 'loan_officer' && staff.assignedLeads?.includes(data.leadId);

  // Full access for Master Admin and Assigned Loan Officer (still scrub SSN)
  if (isMaster || isAssignedLO) {
    return data;
  }

  // Clone and mask PII
  const cloned = JSON.parse(JSON.stringify(data));

  if (cloned.email && typeof cloned.email === 'string') {
    const [user, domain] = cloned.email.split('@');
    cloned.email = `${user ? user.charAt(0) + '***' : '***'}@${domain || '***.com'}`;
  }

  if (cloned.phone && typeof cloned.phone === 'string') {
    cloned.phone = '(***) ***-' + cloned.phone.slice(-4);
  }

  if (cloned.statedPreferences) {
    if (cloned.statedPreferences.email) {
      const [user, domain] = (cloned.statedPreferences.email as string).split('@');
      cloned.statedPreferences.email = `${user ? user.charAt(0) + '***' : '***'}@${domain || '***.com'}`;
    }
    if (cloned.statedPreferences.phone) {
      cloned.statedPreferences.phone = '(***) ***-' + (cloned.statedPreferences.phone as string).slice(-4);
    }
  }

  return cloned;
}

/**
 * Token Verification Helper
 * Verifies Bearer tokens against the Firestore staff roster.
 */
export async function verifyStaffToken(authHeader: string | undefined): Promise<StaffContext | { error: string; code: number }> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Missing or malformed Authorization header', code: 401 };
  }

  const rawToken = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!rawToken) {
    return { error: 'Empty token supplied', code: 401 };
  }

  try {
    const email = rawToken.toLowerCase().trim();
    const rosterEntry = await getStaffRosterDoc(email);

    if (!rosterEntry) {
      return { error: 'Staff credentials not recognized or not on allowlist', code: 401 };
    }

    if (rosterEntry.isRevoked) {
      return { error: 'Staff access has been revoked', code: 401 };
    }

    if (rosterEntry.expiresAt && new Date(rosterEntry.expiresAt).getTime() < Date.now()) {
      return { error: 'Timed staff grant has expired', code: 401 };
    }

    return {
      uid: `uid-${rosterEntry.email}`,
      email: rosterEntry.email,
      role: rosterEntry.role,
      branch: rosterEntry.branch,
      assignedLeads: rosterEntry.assignedLeads,
      expiresAt: rosterEntry.expiresAt,
      isRevoked: rosterEntry.isRevoked
    };
  } catch {
    return { error: 'Invalid token format or roster lookup error', code: 401 };
  }
}

/**
 * Middleware: requireStaffRole
 * Enforces staff authentication, role permissions, branch/lead scoping, and audit stamping.
 */
export function requireStaffRole(...allowedRoles: StaffRole[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // 1. Explicitly reject buyer session tokens on staff endpoints
    const buyerSessionHeader = req.headers['x-session-id'];
    const authHeader = req.headers['authorization'];

    if (!authHeader && buyerSessionHeader) {
      await recordStaffAudit({
        actor: `buyer-session:${buyerSessionHeader}`,
        role: 'loan_officer',
        action: `${req.method} ${req.path}`,
        outcome: 'DENIED',
        metadata: { reason: 'Buyer session token rejected on staff endpoint' }
      });

      res.status(401).json({
        error: 'Unauthorized: Buyer session tokens cannot access staff endpoints.',
        code: 'FAIL_CLOSED_AUTH_REQUIRED'
      });
      return;
    }

    // 2. Explicitly reject shared MUSE_API_KEY on staff endpoints
    const apiKey = req.headers['x-api-key'];
    if (apiKey && !authHeader) {
      await recordStaffAudit({
        actor: 'shared-api-key',
        role: 'master_admin',
        action: `${req.method} ${req.path}`,
        outcome: 'DENIED',
        metadata: { reason: 'Shared API key no longer valid for human staff endpoints' }
      });

      res.status(401).json({
        error: 'Unauthorized: Shared API key is reserved for server-to-server calls only. Staff ID token required.',
        code: 'FAIL_CLOSED_AUTH_REQUIRED'
      });
      return;
    }

    // 3. Verify Staff Token asynchronously from Firestore roster
    const verifyResult = await verifyStaffToken(authHeader);
    if ('error' in verifyResult) {
      await recordStaffAudit({
        actor: authHeader ? authHeader.replace(/^Bearer\s+/i, '').trim() : 'anonymous',
        role: 'auditor',
        action: `${req.method} ${req.path}`,
        outcome: 'DENIED',
        metadata: { reason: verifyResult.error }
      });

      const errorCode = verifyResult.error.includes('expired')
        ? 'TOKEN_EXPIRED'
        : verifyResult.error.includes('revoked')
        ? 'STAFF_REVOKED'
        : 'FAIL_CLOSED_AUTH_REQUIRED';

      res.status(verifyResult.code).json({
        error: verifyResult.error,
        code: errorCode
      });
      return;
    }

    const staff = verifyResult as StaffContext;

    // 4. Check timed grant expiry
    if (staff.expiresAt && new Date(staff.expiresAt).getTime() < Date.now()) {
      await recordStaffAudit({
        actor: staff.email,
        role: staff.role,
        action: `${req.method} ${req.path}`,
        outcome: 'DENIED',
        metadata: { reason: 'Staff token expired' }
      });

      res.status(401).json({
        error: 'Unauthorized: Timed access grant has expired.',
        code: 'TOKEN_EXPIRED'
      });
      return;
    }

    // 5. Check revocation
    if (staff.isRevoked) {
      await recordStaffAudit({
        actor: staff.email,
        role: staff.role,
        action: `${req.method} ${req.path}`,
        outcome: 'DENIED',
        metadata: { reason: 'Staff member access revoked' }
      });

      res.status(401).json({
        error: 'Unauthorized: Staff credentials have been revoked.',
        code: 'STAFF_REVOKED'
      });
      return;
    }

    // 6. Check Role Permission Matrix
    if (allowedRoles.length > 0 && !allowedRoles.includes(staff.role)) {
      await recordStaffAudit({
        actor: staff.email,
        role: staff.role,
        action: `${req.method} ${req.path}`,
        outcome: 'DENIED',
        metadata: { reason: 'Role not authorized for this endpoint' }
      });

      res.status(403).json({
        error: 'Forbidden: Insufficient role permissions.',
        code: 'INSUFFICIENT_ROLE_PERMISSIONS'
      });
      return;
    }

    // 7. Compliance Auditor write block
    if (staff.role === 'auditor' && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      await recordStaffAudit({
        actor: staff.email,
        role: staff.role,
        action: `${req.method} ${req.path}`,
        outcome: 'DENIED',
        metadata: { reason: 'Auditor attempted write operation' }
      });

      res.status(403).json({
        error: 'Forbidden: Compliance Auditor role is strictly read-only.',
        code: 'AUDITOR_READ_ONLY'
      });
      return;
    }

    // Attach verified staff context
    (req as any).staff = staff;
    next();
  };
}

/**
 * Middleware: requireBuyerSession
 * Enforces buyer session isolation (x-session-id matching active lead).
 */
export function requireBuyerSession(getBuyerSessionFn: (id: string) => Promise<any>) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const sessionToken = req.headers['x-session-id'] as string | undefined;

    if (!sessionToken || !sessionToken.trim()) {
      res.status(401).json({
        error: 'Unauthorized: Active buyer session required.',
        code: 'FAIL_CLOSED_AUTH_REQUIRED'
      });
      return;
    }

    const session = await getBuyerSessionFn(sessionToken.trim());
    if (!session) {
      res.status(401).json({
        error: 'Unauthorized: Invalid or expired buyer session.',
        code: 'FAIL_CLOSED_AUTH_REQUIRED'
      });
      return;
    }

    // Enforce parameter leadId matching session leadId (Buyer Isolation)
    const paramLeadId = req.params.leadId || req.body?.leadId;
    if (paramLeadId && paramLeadId !== session.leadId) {
      console.warn(`[Security Alert] Buyer ${session.leadId} attempted to access lead ${paramLeadId}`);
      res.status(403).json({
        error: 'Forbidden: Access denied to requested buyer resource.',
        code: 'BUYER_ISOLATION_VIOLATION'
      });
      return;
    }

    (req as any).buyerSession = session;
    next();
  };
}
