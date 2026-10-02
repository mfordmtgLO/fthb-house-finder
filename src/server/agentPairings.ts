// Copyright (c) 2026 Mike Ford, NMLS #288455. All Rights Reserved.
/**
 * Agent Pairings & Profiles Service
 * Dynamic lookup from shared Firestore pairings and agents collections via Admin SDK.
 * ARCHITECTURE LAW: NEVER hardcode fake placeholder names, NEVER fabricate fallback agents.
 * When no active agent pairing exists in Firestore for a market, returns null so the UI
 * renders an honest empty state ("Agent partnership pending confirmation").
 */

import { getAdminFirestore } from './firebaseAdmin.ts';

export interface AgentProfile {
  id: string;
  name: string;
  licenseNumber: string;
  brokerage: string;
  email: string;
  phone: string;
  photoUrl: string;
  coverageAreas: string[];
  activePairing: boolean;
}

export interface LoanOfficerProfile {
  name: string;
  title: string;
  nmlsId: string;
  phone: string;
  email: string;
  photoUrl: string;
  company: string;
}

export const MIKE_FORD_LO_PROFILE: LoanOfficerProfile = {
  name: 'Mike Ford',
  title: 'Senior Mortgage Loan Officer',
  nmlsId: '288455',
  phone: '',
  email: 'fordmj@gmail.com', // Mike Ford's verified contact email
  photoUrl: '',
  company: 'Pacific Lending Group'
};

/**
 * Loads verified agent pairing for a given market from Firestore via Admin SDK.
 * Returns null if no verified pairing exists or if Firestore is unreachable (honest empty state).
 */
export async function getPairedAgentForCity(city: string): Promise<AgentProfile | null> {
  if (!city || typeof city !== 'string') return null;
  const db = getAdminFirestore();
  if (!db) {
    return null; // Honest empty state when Firestore is unreachable
  }

  try {
    const normalizedCity = city.trim();

    // Query active pairing for this city in Firestore
    const pairingsSnap = await db.collection('pairings')
      .where('city', '==', normalizedCity)
      .where('active', '==', true)
      .limit(1)
      .get();

    if (pairingsSnap.empty) {
      return null; // Honest empty state: no partner assigned yet
    }

    const pairingDoc = pairingsSnap.docs[0].data();
    const agentId = pairingDoc.agentId;
    if (!agentId) return null;

    const agentDoc = await db.collection('agents').doc(agentId).get();
    if (!agentDoc.exists) return null;

    const agentData = agentDoc.data();
    if (!agentData) return null;

    return {
      id: agentDoc.id,
      name: agentData.name || '',
      licenseNumber: agentData.licenseNumber || '',
      brokerage: agentData.brokerage || '',
      email: agentData.email || '',
      phone: agentData.phone || '',
      photoUrl: agentData.photoUrl || '',
      coverageAreas: Array.isArray(agentData.coverageAreas) ? agentData.coverageAreas : [city],
      activePairing: true
    };
  } catch (err: any) {
    console.warn('[Firebase Admin] Error querying agent pairing for city:', city, err.message);
    return null; // Honest empty state
  }
}

/**
 * Loads verified agent profile by agent ID from Firestore via Admin SDK.
 */
export async function getAgentById(agentId: string): Promise<AgentProfile | null> {
  if (!agentId) return null;
  const db = getAdminFirestore();
  if (!db) return null;

  try {
    const agentDoc = await db.collection('agents').doc(agentId).get();
    if (!agentDoc.exists) return null;

    const agentData = agentDoc.data();
    if (!agentData) return null;

    return {
      id: agentDoc.id,
      name: agentData.name || '',
      licenseNumber: agentData.licenseNumber || '',
      brokerage: agentData.brokerage || '',
      email: agentData.email || '',
      phone: agentData.phone || '',
      photoUrl: agentData.photoUrl || '',
      coverageAreas: Array.isArray(agentData.coverageAreas) ? agentData.coverageAreas : [],
      activePairing: Boolean(agentData.active)
    };
  } catch (err: any) {
    console.warn('[Firebase Admin] Error querying agent by ID:', agentId, err.message);
    return null;
  }
}
