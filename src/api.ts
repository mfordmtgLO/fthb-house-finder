// Copyright (c) 2026 Mike Ford, NMLS #288455. All Rights Reserved.
/**
 * Frontend API Client
 * Fail-closed authenticated requests using per-buyer leadId session.
 * Robust 15s AbortController timeout on all network requests.
 * Manages local storage session cache, PII sanitization, and API endpoints.
 */

import { CuratedListing, ChatMessage, PropertyThread, PublishingKit, BuyerSessionState, BuyerCurationsResponse, PluginStatusResponse } from './types';

const SESSION_STORAGE_KEY = 'fthb_buyer_lead_id';
export const DEFAULT_API_TIMEOUT_MS = 15000;

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

/**
 * Robust fetch wrapper enforcing a strict 15s timeout via AbortController.
 * Supports caller-provided AbortSignal for immediate dismissal cleanup.
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = DEFAULT_API_TIMEOUT_MS,
  externalSignal?: AbortSignal
): Promise<Response> {
  const controller = new AbortController();
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort(new Error('REQUEST_TIMEOUT'));
  }, timeoutMs);

  const onExternalAbort = () => {
    controller.abort(externalSignal?.reason || new Error('REQUEST_ABORTED'));
  };

  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timer);
      const abortErr = new Error('Request cancelled');
      abortErr.name = 'AbortError';
      throw abortErr;
    }
    externalSignal.addEventListener('abort', onExternalAbort, { once: true });
  }

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return res;
  } catch (err: any) {
    if (timedOut || err?.message === 'REQUEST_TIMEOUT' || (err?.name === 'AbortError' && timedOut)) {
      const timeoutErr = new Error("Couldn't connect to server in time — check your connection and try again.");
      timeoutErr.name = 'TimeoutError';
      throw timeoutErr;
    }
    if (externalSignal?.aborted || err?.message === 'REQUEST_ABORTED') {
      const abortErr = new Error('Request cancelled');
      abortErr.name = 'AbortError';
      throw abortErr;
    }
    throw err;
  } finally {
    clearTimeout(timer);
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }
}

function getAuthHeaders(leadId?: string): HeadersInit {
  const activeLeadId = leadId || getLocalLeadId() || '';
  return {
    'Content-Type': 'application/json',
    'x-session-id': activeLeadId
  };
}

export async function fetchPairingDetails(pairingId: string, signal?: AbortSignal): Promise<any | null> {
  try {
    const res = await fetchWithTimeout(`/api/pairing/${encodeURIComponent(pairingId)}`, {}, DEFAULT_API_TIMEOUT_MS, signal);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function initBuyerSession(signal?: AbortSignal): Promise<BuyerSessionState & { pairing?: any }> {
  const existingLeadId = getLocalLeadId();
  let pairingId: string | undefined = undefined;
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    pairingId = params.get('pair') || undefined;
  }

  const res = await fetchWithTimeout(
    '/api/auth/session',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId: existingLeadId, pairingId })
    },
    DEFAULT_API_TIMEOUT_MS,
    signal
  );

  if (!res.ok) {
    throw new Error(`Failed to initialize session: ${res.statusText}`);
  }

  const data = await res.json();
  setLocalLeadId(data.leadId);
  return data;
}

export async function fetchCuratedListings(filters: {
  city?: string;
  maxPrice?: number;
  maxMonthlyPayment?: number;
  program?: string;
  favorites?: string[];
  leadId?: string;
  signal?: AbortSignal;
}): Promise<CuratedListing[]> {
  const params = new URLSearchParams();
  if (filters.city) params.append('city', filters.city);
  if (filters.maxPrice) params.append('maxPrice', filters.maxPrice.toString());
  if (filters.maxMonthlyPayment) params.append('maxMonthlyPayment', filters.maxMonthlyPayment.toString());
  if (filters.program) params.append('program', filters.program);
  if (filters.favorites && filters.favorites.length > 0) {
    params.append('favorites', filters.favorites.join(','));
  }

  const res = await fetchWithTimeout(
    `/api/listings?${params.toString()}`,
    {
      headers: getAuthHeaders(filters.leadId)
    },
    DEFAULT_API_TIMEOUT_MS,
    filters.signal
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch curated listings: ${res.statusText}`);
  }

  const data = await res.json();
  return data.listings || [];
}

export async function sendMuseChatMessage(leadId: string, message: string, signal?: AbortSignal): Promise<ChatMessage> {
  const res = await fetchWithTimeout(
    '/api/muse/chat',
    {
      method: 'POST',
      headers: getAuthHeaders(leadId),
      body: JSON.stringify({ leadId, message })
    },
    DEFAULT_API_TIMEOUT_MS,
    signal
  );

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const err: any = new Error(errData.error || errData.friendlyMessage || `Failed to send message: ${res.statusText}`);
    err.code = errData.code;
    err.status = res.status;
    err.friendlyMessage = errData.friendlyMessage;
    throw err;
  }

  return res.json();
}

export async function fetchMuseChatHistory(leadId: string, signal?: AbortSignal): Promise<{ messages: ChatMessage[]; statedPreferences: any }> {
  const res = await fetchWithTimeout(
    `/api/muse/history/${leadId}`,
    {
      headers: getAuthHeaders(leadId)
    },
    DEFAULT_API_TIMEOUT_MS,
    signal
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch chat history: ${res.statusText}`);
  }

  return res.json();
}

/**
 * Reads the personal married curated list from GET /api/buyer/curations/:leadId
 */
export async function fetchBuyerCurations(leadId: string, signal?: AbortSignal): Promise<BuyerCurationsResponse> {
  const res = await fetchWithTimeout(
    `/api/buyer/curations/${leadId}`,
    {
      headers: getAuthHeaders(leadId)
    },
    DEFAULT_API_TIMEOUT_MS,
    signal
  );

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error('Access denied to buyer curations.');
    }
    throw new Error(`Failed to fetch buyer curations: ${res.statusText}`);
  }

  return res.json();
}

/**
 * Resolves or links buyer identity by normalized email (passwordless email-link flow)
 */
export async function resolveBuyerIdentity(email: string, currentLeadId?: string, signal?: AbortSignal): Promise<{
  leadId: string;
  isExistingLead: boolean;
  email: string;
  statedPreferences?: any;
  message: string;
}> {
  const res = await fetchWithTimeout(
    '/api/auth/identify',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        currentLeadId: currentLeadId || getLocalLeadId()
      })
    },
    DEFAULT_API_TIMEOUT_MS,
    signal
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Identity resolution failed');
  }

  const data = await res.json();
  if (data.leadId) {
    setLocalLeadId(data.leadId);
  }
  return data;
}

export async function updateFavoritesServer(leadId: string, favorites: string[], signal?: AbortSignal): Promise<string[]> {
  const res = await fetchWithTimeout(
    '/api/buyer/favorites',
    {
      method: 'POST',
      headers: getAuthHeaders(leadId),
      body: JSON.stringify({ leadId, favorites })
    },
    DEFAULT_API_TIMEOUT_MS,
    signal
  );

  if (!res.ok) {
    throw new Error('Failed to update favorites');
  }

  const data = await res.json();
  return data.favorites;
}

export async function fetchPropertyThread(propertyId: string, leadId: string, signal?: AbortSignal): Promise<PropertyThread> {
  const res = await fetchWithTimeout(
    `/api/notes/${propertyId}/${leadId}`,
    {
      headers: getAuthHeaders(leadId)
    },
    DEFAULT_API_TIMEOUT_MS,
    signal
  );

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
  inAppReplyNotify?: boolean;
  tcpaAccepted?: boolean;
  signal?: AbortSignal;
}): Promise<any> {
  const notify = params.inAppReplyNotify ?? params.tcpaAccepted ?? true;
  const res = await fetchWithTimeout(
    '/api/notes',
    {
      method: 'POST',
      headers: getAuthHeaders(params.leadId),
      body: JSON.stringify({
        propertyId: params.propertyId,
        leadId: params.leadId,
        authorName: params.authorName,
        text: params.text,
        inAppReplyNotify: notify
      })
    },
    DEFAULT_API_TIMEOUT_MS,
    params.signal
  );

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const err: any = new Error(errData.error || errData.friendlyMessage || "Couldn't post your note — check your connection and try again.");
    err.code = errData.code;
    err.status = res.status;
    err.friendlyMessage = errData.friendlyMessage;
    throw err;
  }

  return res.json();
}

export async function fetchPublishingKit(listingId?: string, signal?: AbortSignal): Promise<PublishingKit> {
  const url = listingId ? `/api/publishing/kit?listingId=${listingId}` : '/api/publishing/kit';
  const res = await fetchWithTimeout(url, {}, DEFAULT_API_TIMEOUT_MS, signal);
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
  signal?: AbortSignal;
}): Promise<{ success: boolean; message: string }> {
  const res = await fetchWithTimeout(
    '/api/alerts/subscribe',
    {
      method: 'POST',
      headers: getAuthHeaders(params.leadId),
      body: JSON.stringify(params)
    },
    DEFAULT_API_TIMEOUT_MS,
    params.signal
  );

  if (!res.ok) {
    throw new Error('Failed to subscribe to alerts');
  }

  return res.json();
}

export async function submitMikeReply(params: {
  leadId: string;
  propertyId?: string;
  text: string;
  token?: string;
  signal?: AbortSignal;
}): Promise<any> {
  const token = params.token || 'fordmj@gmail.com';
  const res = await fetchWithTimeout(
    '/api/mike/reply',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        leadId: params.leadId,
        propertyId: params.propertyId,
        text: params.text
      })
    },
    DEFAULT_API_TIMEOUT_MS,
    params.signal
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Unauthorized or invalid staff reply submission');
  }

  return res.json();
}

export async function fetchLoDeviceStatus(signal?: AbortSignal): Promise<{
  status: string;
  totalRegisteredDevices: number;
  message: string;
}> {
  const res = await fetchWithTimeout('/api/lo/device-status', {}, DEFAULT_API_TIMEOUT_MS, signal);
  if (!res.ok) {
    throw new Error('Failed to fetch device status');
  }
  return res.json();
}

export async function fetchMikeInbox(token?: string, signal?: AbortSignal): Promise<{
  totalCount: number;
  conversations: any[];
}> {
  const authToken = token || 'fordmj@gmail.com';
  const res = await fetchWithTimeout(
    '/api/mike/inbox',
    {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    },
    DEFAULT_API_TIMEOUT_MS,
    signal
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Unauthorized or failed to fetch LO inbox');
  }

  return res.json();
}

export async function fetchStaffRoster(token?: string, signal?: AbortSignal): Promise<{
  totalCount: number;
  staff: any[];
}> {
  const authToken = token || 'fordmj@gmail.com';
  const res = await fetchWithTimeout(
    '/api/staff/roster',
    {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    },
    DEFAULT_API_TIMEOUT_MS,
    signal
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch staff roster');
  }

  return res.json();
}

export async function upsertStaffRoster(
  entry: {
    email: string;
    role: string;
    branch?: string;
    assignedLeads?: string[];
    expiresAt?: string;
    isRevoked?: boolean;
  },
  token?: string,
  signal?: AbortSignal
): Promise<any> {
  const authToken = token || 'fordmj@gmail.com';
  const res = await fetchWithTimeout(
    '/api/staff/roster',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(entry)
    },
    DEFAULT_API_TIMEOUT_MS,
    signal
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update staff roster');
  }

  return res.json();
}

export async function revokeStaff(email: string, token?: string, signal?: AbortSignal): Promise<any> {
  const authToken = token || 'fordmj@gmail.com';
  const res = await fetchWithTimeout(
    '/api/staff/revoke',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ email })
    },
    DEFAULT_API_TIMEOUT_MS,
    signal
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to revoke staff access');
  }

  return res.json();
}

export async function fetchPluginStatus(signal?: AbortSignal): Promise<PluginStatusResponse> {
  const res = await fetchWithTimeout('/api/plugin/status', {}, DEFAULT_API_TIMEOUT_MS, signal);
  if (!res.ok) {
    throw new Error(`Failed to fetch plugin status: ${res.statusText}`);
  }
  return res.json();
}

export async function submitIntakeLead(leadData: any, signal?: AbortSignal): Promise<any> {
  const res = await fetchWithTimeout(
    '/api/plugin/intake-lead',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(leadData)
    },
    DEFAULT_API_TIMEOUT_MS,
    signal
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to submit intake lead');
  }

  return res.json();
}

