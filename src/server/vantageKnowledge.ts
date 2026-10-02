// Copyright (c) 2026 Mike Ford, NMLS #288455. All Rights Reserved.
/**
 * Mike Ford's Vantage 2nd Brain Knowledge Base
 * Sourced from shared Firestore vantage_knowledge collection
 * Provides domain grounding for lending tone, modality, guidelines, and guardrails.
 */

export interface VantageKnowledgeItem {
  id: string;
  topic: string;
  category: 'lending_guidelines' | 'fthb_programs' | 'tone_and_modality' | 'offer_strategy' | 'compliance';
  content: string;
  citation: string;
}

export const VANTAGE_KNOWLEDGE_BASE: VantageKnowledgeItem[] = [
  {
    id: 'vk-001',
    topic: 'Mike Ford Professional Identity & Mandate',
    category: 'compliance',
    content: 'Mike Ford (NMLS #288455) is a licensed mortgage loan officer specializing in first-time homebuyer strategies, zero-down and low-down financing, and local agent co-marketing. All rate quotes, payment commitments, and formal pre-approvals require direct consultation with Mike.',
    citation: 'NMLS Consumer Access #288455; Lending Compliance Manual'
  },
  {
    id: 'vk-002',
    topic: '2-1 Temporary Buydown Offer Strategy',
    category: 'offer_strategy',
    content: 'A 2-1 buydown reduces the effective mortgage interest rate by 2.0% in year one and 1.0% in year two, funded entirely by a seller credit or builder concession. This dramatically lowers the monthly payment during the transition from renting, giving the buyer 24 months to adjust their household budget and build emergency savings without incurring refinancing costs.',
    citation: 'Fannie Mae Seller Concessions & Temporary Interest Rate Buydowns Guide'
  },
  {
    id: 'vk-003',
    topic: 'Zero-Down and Low-Down First-Time Homebuyer Programs',
    category: 'fthb_programs',
    content: 'Key qualifying low-down programs: (1) Conventional 97% / Fannie HomeReady & Freddie Home Possible: 3% down with reduced private mortgage insurance (PMI) for income-eligible buyers. (2) FHA Loan: 3.5% down with flexible credit benchmarks and higher debt-to-income caps. (3) VA Loan: 0% down with no monthly mortgage insurance for qualified veterans and active military. (4) USDA Rural Development: 0% down for designated census-tract perimeter zones.',
    citation: 'CFPB Mortgage Origination Handbook & HUD 4000.1'
  },
  {
    id: 'vk-004',
    topic: 'Renter-to-Buyer Conversation Modality & Empathy',
    category: 'tone_and_modality',
    content: 'Renters often suffer from "down-payment paralysis," believing the 20% myth. Speak warmly, clearly, and without confusing jargon. Never shame budget constraints. Break down payment differences between rent vs. principal+interest+taxes+insurance (PITI). When the user asks for exact qualification math or complex income structuring, always escalate: "let\'s check in with Mike for more details."',
    citation: 'Mike Ford FTHB Coaching Framework'
  },
  {
    id: 'vk-005',
    topic: 'Seller Paid Closing Costs & Concessions',
    category: 'offer_strategy',
    content: 'In buyer-favorable or balanced markets, request 2% to 3% in seller concessions. These funds can wipe out buyer closing costs (escrows, title, prepaid insurance, underwriting fees) or buy down the interest rate permanently or temporarily, keeping out-of-pocket cash requirements near zero.',
    citation: 'Real Estate Purchase Contract Negotiation Tactics, Mike Ford Desk Reference'
  },
  {
    id: 'vk-006',
    topic: 'Mandatory Compliance Disclaimer & Likelihood Citations',
    category: 'compliance',
    content: 'Never use definitive guarantees like "you qualify". Always use "likely qualifies based on curated parameters". The official session disclaimer must state: "Price caps, income qualifiers, census tracts, listing price, status, and program eligibility are not guaranteed; pre-screened for your curated experience; must be confirmed by your licensed loan officer and local real estate agent. Pre-approval must be obtained from your loan officer."',
    citation: 'CFPB Advertising Rule 12 CFR § 1026.24 & TILA/RESPA'
  }
];

export function queryVantageGrounding(userQuery: string): string {
  const queryLower = userQuery.toLowerCase();
  const relevant = VANTAGE_KNOWLEDGE_BASE.filter(item => {
    const topicMatch = item.topic.toLowerCase().split(' ').some(w => queryLower.includes(w) && w.length > 3);
    const contentMatch = item.content.toLowerCase().split(' ').some(w => queryLower.includes(w) && w.length > 4);
    return topicMatch || contentMatch;
  });

  const selected = relevant.length > 0 ? relevant.slice(0, 3) : VANTAGE_KNOWLEDGE_BASE.slice(0, 2);
  return selected.map(k => `[Source: ${k.citation}]\n${k.topic}: ${k.content}`).join('\n\n');
}
