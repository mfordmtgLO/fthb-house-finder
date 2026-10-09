// Copyright (c) 2026 Mike Ford, NMLS #288455. All Rights Reserved.
/**
 * Firebase Admin SDK Client
 * Server-side connection strictly wired to the homebuyer project's Firestore database:
 * Database ID: 'ai-studio-vantageaiworkspa-320759cc-ded2-4188-b4e0-ed887f4ad5bd'
 *
 * ARCHITECTURE LAW:
 * 1. Initialize strictly with credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)).
 * 2. Connect with getFirestore(app, 'ai-studio-vantageaiworkspa-320759cc-ded2-4188-b4e0-ed887f4ad5bd') using named database ID.
 * 3. Fail closed with a clear server log if the env secret is missing — NEVER fall back to default
 *    credentials or the plugin's own project.
 */

import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

const PRODUCTION_DATABASE_ID = 'ai-studio-vantageaiworkspa-320759cc-ded2-4188-b4e0-ed887f4ad5bd';
const STAGING_PROJECT_ID = 'astral-web-439103-g7';
const STAGING_DATABASE_ID = 'fthb-geo-staging';
const APP_NAME = 'homebuyer-project';

let adminApp: App | null = null;
let firestoreDb: Firestore | null = null;

/**
 * Target is explicit and immutable for this process. In staging, credentials
 * MUST belong to the exact staging project and the exact named database.
 * Production behavior remains the legacy named database until a separately
 * approved migration; never infer staging from NODE_ENV.
 */
export function resolveFirestoreTarget(env: NodeJS.ProcessEnv = process.env):
  { projectId: string | null; databaseId: string; target: 'staging' | 'production' } {
  const target = env.GEO_FIRESTORE_TARGET;
  if (target === 'staging') {
    if (env.GEO_FIRESTORE_PROJECT_ID !== STAGING_PROJECT_ID ||
        env.GEO_FIRESTORE_DATABASE_ID !== STAGING_DATABASE_ID) {
      throw new Error('STAGING_FIRESTORE_TARGET_MISMATCH');
    }
    if (env.NODE_ENV === 'production' && env.GEO_ALLOW_STAGING_IN_PRODUCTION !== 'true') {
      throw new Error('STAGING_TARGET_BLOCKED_IN_PRODUCTION_RUNTIME');
    }
    return { projectId: STAGING_PROJECT_ID, databaseId: STAGING_DATABASE_ID, target: 'staging' };
  }
  if (target && target !== 'production') throw new Error('INVALID_FIRESTORE_TARGET');
  // The production project's actual ID is checked against a configured
  // expected ID if supplied; we do not infer it from the named database ID.
  return { projectId: env.GEO_PRODUCTION_PROJECT_ID || null,
    databaseId: PRODUCTION_DATABASE_ID, target: 'production' };
}

export function getAdminFirestore(): Firestore | null {
  if (firestoreDb) return firestoreDb;
  let target: ReturnType<typeof resolveFirestoreTarget>;
  try {
    target = resolveFirestoreTarget();
  } catch (err: any) {
    console.error('[Firebase Admin] Refusing unsafe Firestore target:', err.message);
    return null;
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson || !serviceAccountJson.trim()) {
    console.error('[Firebase Admin] Missing FIREBASE_SERVICE_ACCOUNT_JSON; failing closed.');
    return null;
  }
  let serviceAccount: any;
  try {
    serviceAccount = JSON.parse(serviceAccountJson);
    if (!serviceAccount.project_id || !serviceAccount.private_key || !serviceAccount.client_email) {
      throw new Error('INCOMPLETE_FIREBASE_SERVICE_ACCOUNT');
    }
    if (target.projectId && serviceAccount.project_id !== target.projectId) {
      throw new Error('FIREBASE_CREDENTIAL_PROJECT_MISMATCH');
    }
  } catch (err: any) {
    console.error('[Firebase Admin] Refusing Firebase credentials:', err.message);
    return null;
  }

  try {
    const existingApp = getApps().find(a => a.name === APP_NAME);
    if (existingApp) {
      // Do not reuse an already initialized Firebase app from another target.
      if (existingApp.options.projectId !== serviceAccount.project_id) {
        throw new Error('FIREBASE_APP_PROJECT_MISMATCH');
      }
      adminApp = existingApp;
    } else {
      adminApp = initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id
      }, APP_NAME);
    }
    firestoreDb = getFirestore(adminApp, target.databaseId);
    firestoreDb.settings({ ignoreUndefinedProperties: true });
    console.log(`[Firebase Admin] Connected to ${target.target} Firestore database ${target.databaseId} in project ${serviceAccount.project_id}`);
    return firestoreDb;
  } catch (err: any) {
    console.error('[Firebase Admin] Firestore initialization failed:', err.message);
    return null;
  }
}

/**
 * Resilient Firestore Write Helper
 * Prevents requests from hanging when remote Firestore hits quota limits or experiences gRPC retry loops.
 */
export async function safeFirestoreWrite<T>(promise: Promise<T>, timeoutMs = 2500): Promise<T | null> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      resolve(null);
    }, timeoutMs);
  });
  try {
    const result = await Promise.race([promise, timeout]);
    clearTimeout(timer!);
    return result;
  } catch (err: any) {
    clearTimeout(timer!);
    console.warn('[Firestore Write Safe Warning]', err.message);
    return null;
  }
}

