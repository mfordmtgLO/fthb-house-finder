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

const HOMEBUYER_DATABASE_ID = 'ai-studio-vantageaiworkspa-320759cc-ded2-4188-b4e0-ed887f4ad5bd';
const APP_NAME = 'homebuyer-project';

let adminApp: App | null = null;
let firestoreDb: Firestore | null = null;

export function getAdminFirestore(): Firestore | null {
  if (firestoreDb) {
    return firestoreDb;
  }

  // Fail closed if the environment secret is missing
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson || !serviceAccountJson.trim()) {
    console.error(
      '[Firebase Admin] FATAL: FIREBASE_SERVICE_ACCOUNT_JSON environment variable is missing. ' +
      'Failing closed — will NOT fall back to default credentials or plugin project.'
    );
    return null;
  }

  let serviceAccount: any;
  try {
    serviceAccount = JSON.parse(serviceAccountJson);
  } catch (err: any) {
    console.error(
      '[Firebase Admin] FATAL: Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON. Failing closed:',
      err.message
    );
    return null;
  }

  try {
    const existingApps = getApps();
    const existingApp = existingApps.find(a => a.name === APP_NAME);

    if (!existingApp) {
      adminApp = initializeApp({
        credential: cert(serviceAccount)
      }, APP_NAME);
    } else {
      adminApp = existingApp;
    }

    // Connect strictly to the named database in the homebuyer project
    firestoreDb = getFirestore(adminApp, HOMEBUYER_DATABASE_ID);
    console.log(
      `[Firebase Admin] Successfully initialized Firestore connection to homebuyer project (${serviceAccount.project_id}), database ID: ${HOMEBUYER_DATABASE_ID}`
    );
    return firestoreDb;
  } catch (err: any) {
    console.error('[Firebase Admin] Error initializing homebuyer project Firestore:', err.message);
    return null;
  }
}
