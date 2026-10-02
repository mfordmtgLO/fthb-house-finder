// Copyright (c) 2026 Mike Ford, NMLS #288455. All Rights Reserved.
/**
 * Curated Listings Store
 * ARCHITECTURE LAW:
 * Sourced strictly from shared Firestore curated_listings collection via Admin SDK.
 * NEVER hardcode fake listings, NEVER invent agent names, NEVER use fake phone numbers or placeholder photos.
 * When the Firestore collection is empty or unreachable, returns an honest empty state ([]).
 */

import { getAdminFirestore } from './firebaseAdmin.ts';

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

  // Verbatim RentCast listing agent contact details
  listingAgentName: string;
  listingAgentPhone: string;
  listingAgentEmail: string;
  listingOfficeName: string;

  // Verbatim program tags & loan overlays curated upstream
  programTags: string[];
  overlayEligibility: {
    fhaLikely: boolean;
    vaLikely: boolean;
    usdaLikely: boolean;
    conventional3PercentLikely: boolean;
    dpaGrantLikely: boolean;
    qualifierNotes: string;
  };

  // Upstream GeoSphere sweep outcome flags
  _priceReduced?: boolean;
  _previousPrice?: number;
  _new?: boolean;
  _statusChanged?: boolean;
  _previousStatus?: string;
  _lastSweepTimestamp?: string;
}

export interface QueryFilterOptions {
  city?: string;
  maxPrice?: number;
  maxMonthlyPayment?: number;
  program?: string;
  listingId?: string;
  favorites?: string[];
}

/**
 * Reads the shared Firestore curated_listings collection verbatim via Admin SDK.
 * If Firestore is empty, unreachable, or unconfigured, returns an honest empty array ([]).
 * NEVER fallback to fake listings or placeholder agent data.
 */
export async function getCuratedListingsFromFirestore(): Promise<CuratedListing[]> {
  const db = getAdminFirestore();
  if (!db) {
    return []; // Honest empty state when Firestore is unreachable
  }

  try {
    const snapshot = await db.collection('curated_listings').get();
    if (snapshot.empty) {
      return []; // Honest empty state
    }

    const listings: CuratedListing[] = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      listings.push({
        id: doc.id,
        address: data.address || '',
        city: data.city || '',
        state: data.state || '',
        zipCode: data.zipCode || '',
        price: typeof data.price === 'number' ? data.price : null,
        estimatedMonthlyPayment: typeof data.estimatedMonthlyPayment === 'number' ? data.estimatedMonthlyPayment : null,
        bedrooms: Number(data.bedrooms) || 0,
        bathrooms: Number(data.bathrooms) || 0,
        squareFootage: Number(data.squareFootage) || 0,
        yearBuilt: Number(data.yearBuilt) || 0,
        propertyType: 'Single Family',
        daysOnMarket: typeof data.daysOnMarket === 'number' ? data.daysOnMarket : null,
        photoUrl: data.photoUrl || '',
        galleryUrls: Array.isArray(data.galleryUrls) ? data.galleryUrls : (data.photoUrl ? [data.photoUrl] : []),
        description: data.description || '',
        latitude: Number(data.latitude) || 0,
        longitude: Number(data.longitude) || 0,
        listingAgentName: data.listingAgentName || '',
        listingAgentPhone: data.listingAgentPhone || '',
        listingAgentEmail: data.listingAgentEmail || '',
        listingOfficeName: data.listingOfficeName || '',
        programTags: Array.isArray(data.programTags) ? data.programTags : [],
        overlayEligibility: data.overlayEligibility || {
          fhaLikely: false,
          vaLikely: false,
          usdaLikely: false,
          conventional3PercentLikely: false,
          dpaGrantLikely: false,
          qualifierNotes: ''
        },
        _priceReduced: Boolean(data._priceReduced),
        _previousPrice: typeof data._previousPrice === 'number' ? data._previousPrice : undefined,
        _new: Boolean(data._new),
        _statusChanged: Boolean(data._statusChanged),
        _previousStatus: data._previousStatus,
        _lastSweepTimestamp: data._lastSweepTimestamp
      });
    });

    return listings;
  } catch (err: any) {
    console.warn('[Firebase Admin] Reading curated_listings collection, returning honest empty state:', err.message);
    return []; // Honest empty state
  }
}

/**
 * Filter curated listings with strict adherence to prompt rules:
 * 1. City exact match on normalized field.
 * 2. Null prices/DOM excluded from active range filters (never coerced to zero).
 */
export async function queryCuratedListings(filters: QueryFilterOptions): Promise<CuratedListing[]> {
  const allListings = await getCuratedListingsFromFirestore();

  return allListings.filter(listing => {
    // Exact listingId match
    if (filters.listingId && listing.id !== filters.listingId) {
      return false;
    }

    // Favorites list filter
    if (filters.favorites && filters.favorites.length > 0) {
      if (!filters.favorites.includes(listing.id)) {
        return false;
      }
    }

    // City exact match on normalized string (lowercase, trimmed)
    if (filters.city && filters.city.trim()) {
      const normalizedQueryCity = filters.city.trim().toLowerCase();
      const normalizedListingCity = listing.city.trim().toLowerCase();
      if (normalizedListingCity !== normalizedQueryCity) {
        return false;
      }
    }

    // Max Price filter: Null prices are EXCLUDED from active range filters
    if (filters.maxPrice !== undefined && filters.maxPrice !== null && !isNaN(filters.maxPrice)) {
      if (listing.price === null || listing.price === undefined) {
        return false;
      }
      if (listing.price > filters.maxPrice) {
        return false;
      }
    }

    // Max Monthly Payment filter: Null payments excluded from active range filters
    if (filters.maxMonthlyPayment !== undefined && filters.maxMonthlyPayment !== null && !isNaN(filters.maxMonthlyPayment)) {
      if (listing.estimatedMonthlyPayment === null || listing.estimatedMonthlyPayment === undefined) {
        return false;
      }
      if (listing.estimatedMonthlyPayment > filters.maxMonthlyPayment) {
        return false;
      }
    }

    // Program tag filter
    if (filters.program && filters.program.trim()) {
      const progQuery = filters.program.trim().toLowerCase();
      const hasProgram = listing.programTags.some(tag => tag.toLowerCase().includes(progQuery));
      if (!hasProgram) {
        return false;
      }
    }

    return true;
  });
}
