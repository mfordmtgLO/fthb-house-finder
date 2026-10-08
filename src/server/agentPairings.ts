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

export interface PairingDetails {
  id: string;
  lo: LoanOfficerProfile;
  agent: AgentProfile;
  campaignTag?: string;
  ownerLoId?: string;
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
 * Resolves a co-branded pairing by ID or customSlug from dashboard Firestore (singleton or pairings collection).
 * Returns null if unresolvable (honest empty state).
 */
export async function getPairingDetails(pairingId: string): Promise<PairingDetails | null> {
  if (!pairingId || typeof pairingId !== 'string') return null;
  const db = getAdminFirestore();
  if (!db) return null;

  try {
    let pairingData: any = null;

    // 1. Check guides_state/singleton pairings array
    try {
      const singletonDoc = await db.collection('guides_state').doc('singleton').get();
      if (singletonDoc.exists) {
        const data = singletonDoc.data();
        if (data && Array.isArray(data.pairings)) {
          const found = data.pairings.find((p: any) => p.id === pairingId || p.customSlug === pairingId);
          if (found) {
            pairingData = found;
          }
        }
      }
    } catch {}

    // 2. If not found in singleton, check pairings collection
    if (!pairingData) {
      const pairingDoc = await db.collection('pairings').doc(pairingId).get();
      if (pairingDoc.exists) {
        pairingData = pairingDoc.data();
        pairingData.id = pairingDoc.id;
      } else {
        const slugSnap = await db.collection('pairings').where('customSlug', '==', pairingId).limit(1).get();
        if (!slugSnap.empty) {
          pairingData = slugSnap.docs[0].data();
          pairingData.id = slugSnap.docs[0].id;
        }
      }
    }

    if (!pairingData) return null;

    const agentId = pairingData.agentId;
    const loId = pairingData.loId;
    if (!agentId) return null;

    const agent = await getAgentById(agentId);
    if (!agent) return null;

    let lo: LoanOfficerProfile = MIKE_FORD_LO_PROFILE;
    if (loId) {
      try {
        const loDoc = await db.collection('loanOfficers').doc(loId).get();
        if (loDoc.exists) {
          const loData = loDoc.data();
          if (loData) {
            lo = {
              name: loData.name || MIKE_FORD_LO_PROFILE.name,
              title: loData.title || MIKE_FORD_LO_PROFILE.title,
              nmlsId: loData.nmlsId || MIKE_FORD_LO_PROFILE.nmlsId,
              phone: loData.phone || MIKE_FORD_LO_PROFILE.phone,
              email: loData.email || MIKE_FORD_LO_PROFILE.email,
              photoUrl: loData.photoUrl || MIKE_FORD_LO_PROFILE.photoUrl,
              company: loData.company || MIKE_FORD_LO_PROFILE.company
            };
          }
        }
      } catch {}
    }

    const rawOwnerLoId =
      pairingData.assignedLoId ||
      pairingData.loId ||
      pairingData.ownerLoId ||
      pairingData.assignedLoEmail ||
      pairingData.loEmail ||
      (typeof pairingData.lo === 'string' ? pairingData.lo : pairingData.lo?.id || pairingData.lo?.email);

    const resolvedOwnerLoId = (rawOwnerLoId && typeof rawOwnerLoId === 'string' && rawOwnerLoId.trim().length > 0)
      ? rawOwnerLoId.trim()
      : undefined;

    return {
      id: pairingData.id || pairingId,
      lo,
      agent,
      campaignTag: pairingData.campaignTag || pairingData.title || '',
      ...(resolvedOwnerLoId ? { ownerLoId: resolvedOwnerLoId } : {})
    };
  } catch (err: any) {
    console.warn('[Firebase Admin] Error resolving pairing details:', pairingId, err.message);
    return null;
  }
}

/**
 * Resolves the assigned LO ID (ownerLoId) from a pairing ID.
 * Returns undefined if unresolvable or if no pairing exists (never invents or defaults).
 */
export async function getPairingOwnerLoId(pairingId?: string | null): Promise<string | undefined> {
  if (!pairingId || typeof pairingId !== 'string') return undefined;
  const pairing = await getPairingDetails(pairingId);
  return pairing?.ownerLoId;
}

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
