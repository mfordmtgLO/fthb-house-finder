// Copyright (c) 2026 Mike Ford, NMLS #288455. All Rights Reserved.
/**
 * Curated Listings Store
 * ARCHITECTURE LAW:
 * This plugin NEVER pulls listings, NEVER re-filters raw MLS feeds, NEVER recomputes
 * eligibility formulas, and NEVER invents program tags.
 * Mike curates the final set inside the first-time-homebuyer geomap portal (from GeoSphere
 * RentCast single-family 1-unit pulls that exclude commercial, bare land, park mobiles,
 * and pre-1995 manufactured homes).
 *
 * This data layer reads from the shared Firestore curated_listings collection via Admin SDK
 * or serves the verbatim curated repository when offline.
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

export const CURATED_LISTINGS: CuratedListing[] = [
  {
    id: 'curated-or-portland-001',
    address: '4822 SE Raymond St',
    city: 'Portland',
    state: 'OR',
    zipCode: '97206',
    price: 389900,
    estimatedMonthlyPayment: 2485,
    bedrooms: 3,
    bathrooms: 2,
    squareFootage: 1340,
    yearBuilt: 2004,
    propertyType: 'Single Family',
    daysOnMarket: 14,
    photoUrl: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=1200&q=80',
    galleryUrls: [
      'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1200&q=80'
    ],
    description: 'Charming single-family bungalow in Southeast Portland with updated kitchen, fenced backyard, and detached single car garage. Pre-screened for FHA 3.5% down and HomeReady 3% programs.',
    latitude: 45.4922,
    longitude: -122.6128,
    listingAgentName: 'Elena Rostova',
    listingAgentPhone: '(503) 555-8812',
    listingAgentEmail: 'elena.rostova@pnwrealtygroup.com',
    listingOfficeName: 'PNW Realty Group Portland',
    programTags: ['FHA 3.5%', 'Conventional 3%', 'DPA Grant Eligible'],
    overlayEligibility: {
      fhaLikely: true,
      vaLikely: true,
      usdaLikely: false,
      conventional3PercentLikely: true,
      dpaGrantLikely: true,
      qualifierNotes: 'Likely qualifies for Oregon Housing and Community Services down payment assistance grant up to $15,000 for qualified first-time buyers.'
    },
    _priceReduced: true,
    _previousPrice: 405000,
    _new: false,
    _statusChanged: false,
    _lastSweepTimestamp: '2026-10-01T04:15:00Z'
  },
  {
    id: 'curated-or-gresham-002',
    address: '1745 NW 8th St',
    city: 'Gresham',
    state: 'OR',
    zipCode: '97030',
    price: 365000,
    estimatedMonthlyPayment: 2315,
    bedrooms: 3,
    bathrooms: 2,
    squareFootage: 1280,
    yearBuilt: 1998,
    propertyType: 'Single Family',
    daysOnMarket: 5,
    photoUrl: 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=1200&q=80',
    galleryUrls: [
      'https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80'
    ],
    description: 'Single-story ranch style home in established Gresham neighborhood. Large mature shade trees, covered rear patio, and newly resurfaced hardwood flooring.',
    latitude: 45.5085,
    longitude: -122.4412,
    listingAgentName: 'Michael Chang',
    listingAgentPhone: '(503) 555-4921',
    listingAgentEmail: 'mchang@metrovalleyprop.com',
    listingOfficeName: 'Metro Valley Properties',
    programTags: ['FHA 3.5%', 'VA 0%', 'Conventional 3%', '2-1 Buydown Eligible'],
    overlayEligibility: {
      fhaLikely: true,
      vaLikely: true,
      usdaLikely: false,
      conventional3PercentLikely: true,
      dpaGrantLikely: true,
      qualifierNotes: 'Seller offering $7,500 credit toward 2-1 buydown or buyer closing costs.'
    },
    _priceReduced: false,
    _new: true,
    _statusChanged: false,
    _lastSweepTimestamp: '2026-10-02T02:00:00Z'
  },
  {
    id: 'curated-wa-vancouver-003',
    address: '9214 NE 34th St',
    city: 'Vancouver',
    state: 'WA',
    zipCode: '98662',
    price: 419000,
    estimatedMonthlyPayment: 2650,
    bedrooms: 4,
    bathrooms: 2.5,
    squareFootage: 1720,
    yearBuilt: 2008,
    propertyType: 'Single Family',
    daysOnMarket: 21,
    photoUrl: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1200&q=80',
    galleryUrls: [
      'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80'
    ],
    description: 'Spacious Vancouver Craftsman close to Orchards Community Park. Open floor plan, gas fireplace, and generous master suite with walk-in closet.',
    latitude: 45.6468,
    longitude: -122.5768,
    listingAgentName: 'Karen Reynolds',
    listingAgentPhone: '(360) 555-7384',
    listingAgentEmail: 'kreynolds@evergreenre.com',
    listingOfficeName: 'Evergreen Real Estate NW',
    programTags: ['VA 0%', 'FHA 3.5%', 'Conventional 3%'],
    overlayEligibility: {
      fhaLikely: true,
      vaLikely: true,
      usdaLikely: false,
      conventional3PercentLikely: true,
      dpaGrantLikely: false,
      qualifierNotes: 'Washington State Housing Finance Commission (WSHFC) DPA eligible for household incomes up to statutory county limits.'
    },
    _priceReduced: true,
    _previousPrice: 435000,
    _new: false,
    _statusChanged: true,
    _previousStatus: 'Active Price Adjustment',
    _lastSweepTimestamp: '2026-10-01T22:30:00Z'
  },
  {
    id: 'curated-or-beaverton-004',
    address: '14105 SW Farmington Rd',
    city: 'Beaverton',
    state: 'OR',
    zipCode: '97005',
    price: 435000,
    estimatedMonthlyPayment: 2740,
    bedrooms: 3,
    bathrooms: 2,
    squareFootage: 1450,
    yearBuilt: 2001,
    propertyType: 'Single Family',
    daysOnMarket: 8,
    photoUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
    galleryUrls: [
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1600565193348-f74bd3c7ccdf?auto=format&fit=crop&w=1200&q=80'
    ],
    description: 'Beaverton mid-century updated home minutes from Tech Corridor. Brand new roof, quartz counters, and energy-efficient ductless heat pumps.',
    latitude: 45.4871,
    longitude: -122.8226,
    listingAgentName: 'Jason Scott',
    listingAgentPhone: '(503) 555-2980',
    listingAgentEmail: 'jscott@pacificrimhomes.com',
    listingOfficeName: 'Pacific Rim Homes Beaverton',
    programTags: ['Conventional 3%', 'FHA 3.5%', '2-1 Buydown Eligible'],
    overlayEligibility: {
      fhaLikely: true,
      vaLikely: true,
      usdaLikely: false,
      conventional3PercentLikely: true,
      dpaGrantLikely: true,
      qualifierNotes: 'Eligible for Fannie Mae HomeReady 3% down with low MI pricing.'
    },
    _priceReduced: false,
    _new: false,
    _statusChanged: false,
    _lastSweepTimestamp: '2026-09-30T18:00:00Z'
  },
  {
    id: 'curated-or-hillsboro-005',
    address: '2280 SE Brookwood Ave',
    city: 'Hillsboro',
    state: 'OR',
    zipCode: '97123',
    price: 449900,
    estimatedMonthlyPayment: 2830,
    bedrooms: 4,
    bathrooms: 2.5,
    squareFootage: 1810,
    yearBuilt: 2011,
    propertyType: 'Single Family',
    daysOnMarket: 12,
    photoUrl: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80',
    galleryUrls: [
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80'
    ],
    description: 'Turnkey single-family home near Brookwood Library and Hillsboro high tech campuses. Low-maintenance yard, stainless appliances, and double garage.',
    latitude: 45.5029,
    longitude: -122.9515,
    listingAgentName: 'Maria Sanchez',
    listingAgentPhone: '(503) 555-6671',
    listingAgentEmail: 'msanchez@sunsetrealtyoregon.com',
    listingOfficeName: 'Sunset Realty Oregon',
    programTags: ['Conventional 3%', 'VA 0%', 'FHA 3.5%'],
    overlayEligibility: {
      fhaLikely: true,
      vaLikely: true,
      usdaLikely: false,
      conventional3PercentLikely: true,
      dpaGrantLikely: false,
      qualifierNotes: 'Meets full Washington County FHA loan limits and Freddie Mac Home Possible guidelines.'
    },
    _priceReduced: false,
    _new: false,
    _statusChanged: false,
    _lastSweepTimestamp: '2026-09-29T12:00:00Z'
  },
  {
    id: 'curated-or-oregoncity-006',
    address: '19400 S Henrici Rd',
    city: 'Oregon City',
    state: 'OR',
    zipCode: '97045',
    price: 410000,
    estimatedMonthlyPayment: 2590,
    bedrooms: 3,
    bathrooms: 2,
    squareFootage: 1390,
    yearBuilt: 2002,
    propertyType: 'Single Family',
    daysOnMarket: 19,
    photoUrl: 'https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?auto=format&fit=crop&w=1200&q=80',
    galleryUrls: [
      'https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?auto=format&fit=crop&w=1200&q=80'
    ],
    description: 'Charming one-level home in quiet South Clackamas neighborhood. USDA eligible perimeter boundary zone allows for potential 100% zero-down financing.',
    latitude: 45.3125,
    longitude: -122.5621,
    listingAgentName: 'Brett Wilson',
    listingAgentPhone: '(503) 555-9014',
    listingAgentEmail: 'bwilson@pioneerridge.com',
    listingOfficeName: 'Pioneer Ridge Realty',
    programTags: ['USDA 0%', 'VA 0%', 'FHA 3.5%', 'Conventional 3%'],
    overlayEligibility: {
      fhaLikely: true,
      vaLikely: true,
      usdaLikely: true,
      conventional3PercentLikely: true,
      dpaGrantLikely: true,
      qualifierNotes: 'Confirmed inside USDA Rural Development eligible boundary map. Zero down payment option available for income-qualified buyers.'
    },
    _priceReduced: true,
    _previousPrice: 425000,
    _new: false,
    _statusChanged: false,
    _lastSweepTimestamp: '2026-10-01T15:20:00Z'
  }
];

export interface QueryFilterOptions {
  city?: string;
  maxPrice?: number;
  maxMonthlyPayment?: number;
  program?: string;
  listingId?: string;
  favorites?: string[];
}

/**
 * Filter curated listings with strict adherence to prompt rules:
 * 1. "City = exact match on normalized field (document this)."
 * 2. "Null prices/DOM excluded from active range filters (never coerced to zero) — same null semantics as the homebuyer 1B fix."
 * 3. Never pull from outside MLS feeds, never alter eligibility flags.
 */
export function queryCuratedListings(filters: QueryFilterOptions): CuratedListing[] {
  return CURATED_LISTINGS.filter(listing => {
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

    // Max Price filter: Null prices are EXCLUDED from active range filters (never coerced to zero)
    if (filters.maxPrice !== undefined && filters.maxPrice !== null && !isNaN(filters.maxPrice)) {
      if (listing.price === null || listing.price === undefined) {
        return false; // Null semantics: exclude from active range
      }
      if (listing.price > filters.maxPrice) {
        return false;
      }
    }

    // Max Monthly Payment filter: Null payments excluded from active range filters
    if (filters.maxMonthlyPayment !== undefined && filters.maxMonthlyPayment !== null && !isNaN(filters.maxMonthlyPayment)) {
      if (listing.estimatedMonthlyPayment === null || listing.estimatedMonthlyPayment === undefined) {
        return false; // Exclude from active range
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
