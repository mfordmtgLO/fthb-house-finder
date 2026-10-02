// Copyright (c) 2026 Mike Ford, NMLS #288455. All Rights Reserved.
/**
 * Firebase Admin SDK Client
 * Server-side connection to Firestore collections: curated_listings, vantage_knowledge,
 * pairings, agents, fthb_buyers, fthb_conversations, compliance_audit_ledger, lo_devices.
 */

import { initializeApp, getApps, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

let adminApp: App | null = null;
let firestoreDb: Firestore | null = null;

export function getAdminFirestore(): Firestore | null {
  if (firestoreDb) {
    return firestoreDb;
  }
  try {
    if (!getApps().length) {
      adminApp = initializeApp();
    } else {
      adminApp = getApps()[0];
    }
    firestoreDb = getFirestore(adminApp);
    return firestoreDb;
  } catch (err: any) {
    console.warn('[Firebase Admin] Firestore connection unavailable:', err.message);
    return null;
  }
}
