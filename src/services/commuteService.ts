// Copyright (c) 2026 Mike Ford, NMLS #288455. All Rights Reserved.
/**
 * Google Maps Distance Matrix & Routes Commute Service
 * Calculates driving commute time and distance between listing properties
 * and the buyer's primary workplace using the Google Maps Distance Matrix API.
 */
import { getLocalLeadId } from '../api';

declare global {
  interface Window {
    google?: any;
    __gmp_maps_loading__?: Promise<void>;
  }
}

export interface CommuteResult {
  durationText: string;
  durationMinutes: number;
  distanceText: string;
  destinationAddress: string;
  source?: 'google_maps_distance_matrix' | 'google_maps_routes_api';
}

const STORAGE_WORKPLACE_KEY = 'fthb_buyer_primary_workplace_v1';
const COMMUTE_CACHE_PREFIX = 'fthb_commute_cache_v3_';

export const DEFAULT_WORKPLACE = 'Downtown Portland, OR';

export function getStoredWorkplace(): string {
  if (typeof window === 'undefined') return DEFAULT_WORKPLACE;
  try {
    return localStorage.getItem(STORAGE_WORKPLACE_KEY) || DEFAULT_WORKPLACE;
  } catch {
    return DEFAULT_WORKPLACE;
  }
}

export function setStoredWorkplace(workplace: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_WORKPLACE_KEY, workplace.trim());
  } catch {
    // ignore
  }
}

// In-memory cache to store real verified Google Maps route results
const memoryCache = new Map<string, CommuteResult>();

/**
 * Loads the Google Maps JavaScript API with the routes library
 */
export function loadGoogleMapsScript(apiKey: string): Promise<void> {
  if (typeof window === 'undefined' || !apiKey) return Promise.resolve();
  if (window.google?.maps?.DistanceMatrixService) return Promise.resolve();

  if (window.__gmp_maps_loading__) {
    return window.__gmp_maps_loading__;
  }

  window.__gmp_maps_loading__ = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', (e) => reject(e));
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=routes`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = (err) => reject(err);
    document.head.appendChild(script);
  });

  return window.__gmp_maps_loading__;
}

/**
 * Computes commute time for a listing address/coordinates using Google Maps Distance Matrix API.
 * Returns null if real Google route calculation is unavailable (never fabricates times).
 */
export async function calculateListingCommute(
  listing: { address: string; city: string; state: string; latitude: number; longitude: number; id: string },
  workplaceAddress: string,
  apiKey: string
): Promise<CommuteResult | null> {
  if (!workplaceAddress || !workplaceAddress.trim()) {
    return null;
  }

  const cacheKey = `${listing.id}_${workplaceAddress.trim().toLowerCase()}`;

  // 1. Check in-memory verified cache
  if (memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey)!;
  }

  // 2. Check sessionStorage verified cache
  try {
    const cachedJson = sessionStorage.getItem(COMMUTE_CACHE_PREFIX + cacheKey);
    if (cachedJson) {
      const parsed = JSON.parse(cachedJson);
      if (parsed && typeof parsed.durationMinutes === 'number' && parsed.durationMinutes > 0) {
        memoryCache.set(cacheKey, parsed);
        return parsed;
      }
    }
  } catch {}

  // 3. Try Backend Proxy endpoint (/api/commute/matrix) gated by active buyer session
  try {
    const leadId = getLocalLeadId();
    const response = await fetch('/api/commute/matrix', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-id': leadId || ''
      },
      body: JSON.stringify({
        origins: [{
          id: listing.id,
          address: `${listing.address}, ${listing.city}, ${listing.state}`,
          latitude: listing.latitude,
          longitude: listing.longitude
        }],
        destination: workplaceAddress.trim()
      })
    });

    if (response.ok) {
      const data = await response.json();
      const match = data.results?.[0];
      if (match && typeof match.durationMinutes === 'number' && match.durationMinutes > 0) {
        const result: CommuteResult = {
          durationText: match.durationText || `${match.durationMinutes} mins`,
          durationMinutes: match.durationMinutes,
          distanceText: match.distanceText || '',
          destinationAddress: match.destinationAddress || workplaceAddress,
          source: 'google_maps_distance_matrix'
        };

        memoryCache.set(cacheKey, result);
        try {
          sessionStorage.setItem(COMMUTE_CACHE_PREFIX + cacheKey, JSON.stringify(result));
        } catch {}
        return result;
      }
    }
  } catch (err) {
    // Backend proxy call failed or network issue
  }

  // 4. Try Client-side Google Maps Distance Matrix Service if browser API key is provided
  if (apiKey && apiKey.trim()) {
    try {
      await loadGoogleMapsScript(apiKey.trim());

      if (window.google?.maps?.DistanceMatrixService) {
        const service = new window.google.maps.DistanceMatrixService();

        const origin = listing.latitude && listing.longitude
          ? new window.google.maps.LatLng(listing.latitude, listing.longitude)
          : `${listing.address}, ${listing.city}, ${listing.state}`;

        const res: any = await new Promise((resolve, reject) => {
          service.getDistanceMatrix(
            {
              origins: [origin],
              destinations: [workplaceAddress.trim()],
              travelMode: window.google.maps.TravelMode.DRIVING,
              unitSystem: window.google.maps.UnitSystem.IMPERIAL
            },
            (matrixRes: any, status: any) => {
              if (status === 'OK' && matrixRes?.rows?.[0]?.elements?.[0]?.status === 'OK') {
                resolve(matrixRes);
              } else {
                reject(new Error(`Distance Matrix returned status: ${status}`));
              }
            }
          );
        });

        const element = res.rows[0].elements[0];
        if (element && element.status === 'OK' && element.duration?.value) {
          const durationMins = Math.round(element.duration.value / 60);
          const result: CommuteResult = {
            durationText: element.duration.text || `${durationMins} mins`,
            durationMinutes: durationMins,
            distanceText: element.distance?.text || '',
            destinationAddress: res.destinationAddresses?.[0] || workplaceAddress,
            source: 'google_maps_distance_matrix'
          };

          memoryCache.set(cacheKey, result);
          try {
            sessionStorage.setItem(COMMUTE_CACHE_PREFIX + cacheKey, JSON.stringify(result));
          } catch {}

          return result;
        }
      }
    } catch {
      // Client-side Distance Matrix call failed
    }
  }

  // Real Google route calculation unavailable. Do NOT cache failures as results.
  return null;
}
