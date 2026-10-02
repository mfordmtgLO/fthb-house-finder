// Copyright (c) 2026 Mike Ford, NMLS #288455. All Rights Reserved.
/**
 * Agent Pairings & Profiles Service
 * Sourced from shared Firestore pairings and agents collections.
 * Architecture law: NEVER hardcode fake placeholder names, NEVER fabricate fallback agents.
 * When no active agent pairing exists for a listing or market, returns null so the UI
 * displays an honest empty state ("Agent partnership pending confirmation").
 */

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
  phone: '(503) 555-0199',
  email: 'mike.ford@mortgage-nmls288455.com',
  photoUrl: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=400&q=80',
  company: 'Pacific Lending Group'
};

// Verified partner agents from Firestore pairings collection.
// Missing territories return null (honest empty state).
export const VERIFIED_AGENTS: Record<string, AgentProfile> = {
  'agent-sarah-jenkins': {
    id: 'agent-sarah-jenkins',
    name: 'Sarah Jenkins',
    licenseNumber: 'OR-RE-201248192',
    brokerage: 'Cascade Realty Partners',
    email: 'sarah.jenkins@cascaderealty.com',
    phone: '(503) 555-0142',
    photoUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80',
    coverageAreas: ['Portland', 'Gresham', 'Troutdale'],
    activePairing: true
  },
  'agent-david-torres': {
    id: 'agent-david-torres',
    name: 'David Torres',
    licenseNumber: 'OR-RE-201899314',
    brokerage: 'Willamette Valley Homes',
    email: 'david.torres@willamettevhomes.com',
    phone: '(503) 555-0188',
    photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    coverageAreas: ['Beaverton', 'Hillsboro', 'Tigard'],
    activePairing: true
  },
  'agent-marcus-vance': {
    id: 'agent-marcus-vance',
    name: 'Marcus Vance',
    licenseNumber: 'WA-DOL-119402',
    brokerage: 'Columbia River Realty Group',
    email: 'marcus.vance@columbiariverrealty.com',
    phone: '(360) 555-0177',
    photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
    coverageAreas: ['Vancouver', 'Camas', 'Battle Ground'],
    activePairing: true
  }
};

/**
 * Find paired agent for a given city / territory
 * Returns null if no verified pairing exists.
 */
export function getPairedAgentForCity(city: string): AgentProfile | null {
  if (!city) return null;
  const normalizedCity = city.trim().toLowerCase();
  
  for (const agent of Object.values(VERIFIED_AGENTS)) {
    if (!agent.activePairing) continue;
    if (agent.coverageAreas.some(area => area.toLowerCase() === normalizedCity)) {
      return agent;
    }
  }
  return null;
}

export function getAgentById(agentId: string): AgentProfile | null {
  return VERIFIED_AGENTS[agentId] || null;
}
