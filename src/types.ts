// Copyright (c) 2026 Mike Ford, NMLS #288455. All Rights Reserved.
/**
 * Shared Type Definitions for FTHB House Finder
 * Architecture note: Standard interfaces and const object unions only. NO enums.
 */

export interface CuratedListing {
  id: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  price: number | null;
  estimatedMonthlyPayment: number | null;
  bedrooms: number;
  bathrooms: number;
  squareFootage: number;
  yearBuilt: number;
  propertyType: 'Single Family';
  daysOnMarket: number | null;
  photoUrl: string;
  galleryUrls: string[];
  description: string;
  latitude: number;
  longitude: number;
  listingAgentName: string;
  listingAgentPhone: string;
  listingAgentEmail: string;
  listingOfficeName: string;
  programTags: string[];
  overlayEligibility: {
    fhaLikely: boolean;
    vaLikely: boolean;
    usdaLikely: boolean;
    conventional3PercentLikely: boolean;
    dpaGrantLikely: boolean;
    qualifierNotes: string;
  };
  _priceReduced?: boolean;
  _previousPrice?: number;
  _new?: boolean;
  _statusChanged?: boolean;
  _previousStatus?: string;
  _lastSweepTimestamp?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'muse' | 'buyer' | 'mike';
  text: string;
  timestamp: string;
  suggestedAction?: 'SCHEDULE_MIKE_CALL' | 'BOOK_TOUR' | 'EXPLAIN_BUYDOWN' | 'VIEW_PLATTER';
  citations?: string[];
  platterListings?: CuratedListing[];
  isEscalation?: boolean;
}

export interface BuyerSessionState {
  leadId: string;
  disclaimerServed: boolean;
  disclaimerText: string;
  statedPreferences: {
    city?: string;
    maxPrice?: number;
    maxMonthlyPayment?: number;
    incomeBracket?: string;
    timeline?: string;
    downPaymentResources?: string;
    favorites: string[];
  };
  messagesCount: number;
  pluginStatus?: 'active' | 'suspended' | 'killed';
  killAll?: boolean;
  operational?: boolean;
}

export interface PluginStatusResponse {
  success: boolean;
  instanceId: string;
  appVersion: string;
  status: 'active' | 'suspended' | 'killed';
  killAll: boolean;
  operational: boolean;
  reason?: string;
}

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
  email: 'fordmj@gmail.com',
  photoUrl: '',
  company: 'Pacific Lending Group'
};

export interface PropertyNoteMessage {
  id: string;
  sender: 'buyer' | 'lo' | 'agent' | 'muse';
  authorName: string;
  text: string;
  timestamp: string;
  isQuestion: boolean;
  actionCategory?: string | null;
  tier?: 1 | 2;
  isAi?: boolean;
  citations?: string[];
}

export interface PropertyThread {
  threadId: string;
  propertyId: string;
  leadId: string;
  propertyAddress: string;
  createdAt: string;
  updatedAt: string;
  messages: PropertyNoteMessage[];
  loProfile: LoanOfficerProfile;
  agentProfile: AgentProfile | null;
}

export interface PublishingKit {
  listingId?: string;
  shareUrl: string;
  audienceVariants: {
    agentVersion: {
      headline: string;
      body: string;
      reachSmsFormat: string;
    };
    fenceSitterBuyerVersion: {
      headline: string;
      body: string;
      reachSmsFormat: string;
    };
    pastClientReferralVersion: {
      headline: string;
      body: string;
      reachSmsFormat: string;
    };
  };
  facebookFormats: {
    organicPost: string;
    adHeadline: string;
    adPrimaryText: string;
    adDescription: string;
    imageSpecs: {
      square: string;
      vertical: string;
      aspectRatios: string[];
    };
  };
  massEmail: {
    subjectLines: string[];
    agentEmailBody: string;
    buyerEmailBody: string;
  };
}

export interface BuyerCurationsResponse {
  leadId: string;
  hasCurations: boolean;
  status: 'ready' | 'none' | 'requested' | 'pushed' | string;
  curatedBy?: string;
  pushedAt?: string | null;
  buyerNote?: string | null;
  listings: CuratedListing[];
  message?: string;
}

export interface LeadCurationRequest {
  status: 'requested' | 'pushed';
  city: string;
  priceRange?: string;
  maxMonthlyPayment?: number;
  source: string;
  requestedAt: string;
}

