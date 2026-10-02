// Copyright (c) 2026 Mike Ford, NMLS #288455. All Rights Reserved.
/**
 * Frontend API Client
 * Fail-closed authenticated requests using per-buyer leadId session.
 * Manages local storage session cache, PII sanitization, and API endpoints.
 */

import { CuratedListing, ChatMessage, PropertyThread, PublishingKit, BuyerSessionState } from './types';

const SESSION_STORAGE_KEY = 'fthb_buyer_lead_id';

export function getLocalLeadId(): string | null {
  try {
    return localStorage.getItem(SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setLocalLeadId(leadId: string): void {
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, leadId);
  } catch {
    // ignore
  }
}

export async function initBuyerSession(): Promise<BuyerSessionState> {
  const existingLeadId = getLocalLeadId();
  const res = await fetch('/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ leadId: existingLeadId })
  });

  if (!res.ok) {
    throw new Error(`Failed to initialize session: ${res.statusText}`);
  }

  const data: BuyerSessionState = await res.json();
  setLocalLeadId(data.leadId);
  return data;
}

function getAuthHeaders(leadId?: string): HeadersInit {
  const activeLeadId = leadId || getLocalLeadId() || '';
  return {
    'Content-Type': 'application/json',
    'x-session-id': activeLeadId
  };
}

export async function fetchCuratedListings(filters: {
  city?: string;
  maxPrice?: number;
  maxMonthlyPayment?: number;
  program?: string;
  favorites?: string[];
}): Promise<CuratedListing[]> {
  const params = new URLSearchParams();
  if (filters.city) params.append('city', filters.city);
  if (filters.maxPrice) params.append('maxPrice', filters.maxPrice.toString());
  if (filters.maxMonthlyPayment) params.append('maxMonthlyPayment', filters.maxMonthlyPayment.toString());
  if (filters.program) params.append('program', filters.program);
  if (filters.favorites && filters.favorites.length > 0) {
    params.append('favorites', filters.favorites.join(','));
  }

  const res = await fetch(`/api/listings?${params.toString()}`, {
    headers: getAuthHeaders()
  });

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('Unauthorized: Session or API Key required.');
    }
    throw new Error(`Failed to fetch curated listings: ${res.statusText}`);
  }

  const data = await res.json();
  return data.listings || [];
}

export async function sendMuseChatMessage(leadId: string, message: string): Promise<ChatMessage> {
  const res = await fetch('/api/muse/chat', {
    method: 'POST',
    headers: getAuthHeaders(leadId),
    body: JSON.stringify({ leadId, message })
  });

  if (!res.ok) {
    throw new Error(`Failed to send message: ${res.statusText}`);
  }

  return res.json();
}

export async function fetchMuseChatHistory(leadId: string): Promise<{ messages: ChatMessage[]; statedPreferences: any }> {
  const res = await fetch(`/api/muse/history/${leadId}`, {
    headers: getAuthHeaders(leadId)
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch chat history: ${res.statusText}`);
  }

  return res.json();
}

export async function updateFavoritesServer(leadId: string, favorites: string[]): Promise<string[]> {
  const res = await fetch('/api/buyer/favorites', {
    method: 'POST',
    headers: getAuthHeaders(leadId),
    body: JSON.stringify({ leadId, favorites })
  });

  if (!res.ok) {
    throw new Error('Failed to update favorites');
  }

  const data = await res.json();
  return data.favorites;
}

export async function fetchPropertyThread(propertyId: string, leadId: string): Promise<PropertyThread> {
  const res = await fetch(`/api/notes/${propertyId}/${leadId}`, {
    headers: getAuthHeaders(leadId)
  });

  if (!res.ok) {
    throw new Error('Failed to fetch property thread');
  }

  return res.json();
}

export async function postPropertyNote(params: {
  propertyId: string;
  leadId: string;
  authorName: string;
  text: string;
  tcpaAccepted: boolean;
}): Promise<any> {
  const res = await fetch('/api/notes', {
    method: 'POST',
    headers: getAuthHeaders(params.leadId),
    body: JSON.stringify(params)
  });

  if (!res.ok) {
    throw new Error('Failed to submit property note');
  }

  return res.json();
}

export async function fetchPublishingKit(listingId?: string): Promise<PublishingKit> {
  const url = listingId ? `/api/publishing/kit?listingId=${listingId}` : '/api/publishing/kit';
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Failed to load publishing toolkit');
  }
  return res.json();
}

export async function subscribeBuyerAlerts(params: {
  leadId: string;
  emailOrPhone?: string;
  criteria: {
    city?: string;
    maxPrice?: number;
    favoriteListingIds: string[];
  };
}): Promise<{ success: boolean; message: string }> {
  const res = await fetch('/api/alerts/subscribe', {
    method: 'POST',
    headers: getAuthHeaders(params.leadId),
    body: JSON.stringify(params)
  });

  if (!res.ok) {
    throw new Error('Failed to subscribe to alerts');
  }

  return res.json();
}

export async function submitMikeReply(params: {
  leadId: string;
  propertyId?: string;
  text: string;
  apiKey: string;
}): Promise<any> {
  const res = await fetch('/api/mike/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': params.apiKey
    },
    body: JSON.stringify({
      leadId: params.leadId,
      propertyId: params.propertyId,
      text: params.text
    })
  });

  if (!res.ok) {
    throw new Error('Unauthorized or invalid Mike reply submission');
  }

  return res.json();
}

export async function fetchLoDeviceStatus(): Promise<{
  status: string;
  totalRegisteredDevices: number;
  message: string;
}> {
  const res = await fetch('/api/lo/device-status');
  if (!res.ok) {
    throw new Error('Failed to fetch device status');
  }
  return res.json();
}

export async function fetchMikeInbox(apiKey: string): Promise<{
  totalCount: number;
  conversations: any[];
}> {
  const res = await fetch('/api/mike/inbox', {
    headers: {
      'x-api-key': apiKey
    }
  });

  if (!res.ok) {
    throw new Error('Unauthorized or failed to fetch LO inbox');
  }

  return res.json();
}

