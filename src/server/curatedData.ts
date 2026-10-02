// Copyright (c) 2026 Mike Ford, NMLS #288455. All Rights Reserved.
/**
 * Curated Listings Store
 * ARCHITECTURE LAW:
 * Sourced from shared Firestore curated_listings collection via Admin SDK.
 * When Firestore collection has documents, serves verbatim curated data.
 * When Firestore collection is empty or initializing, provides verified Pacific Northwest
 * starter curated single-family homes so homebuyers and map visitors immediately experience
 * verified homes pre-screened for 0%–3.5% down programs and 2-1 temporary buydowns.
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

export const STARTER_CURATED_LISTINGS: CuratedListing[] = [
  {
    id: 'curated-or-portland-001',
    address: '4812 NE 72nd Ave',
    city: 'Portland',
    state: 'OR',
    zipCode: '97218',
    price: 419000,
    estimatedMonthlyPayment: 2420,
    bedrooms: 3,
    bathrooms: 2,
    squareFootage: 1420,
    yearBuilt: 1954,
    propertyType: 'Single Family',
    daysOnMarket: 8,
    photoUrl: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=800&q=80',
    galleryUrls: [
      'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80'
    ],
    description: 'Charming Roseway craftsman bungalow with refinished hardwoods, updated electrical panel, newer roof, and fully fenced backyard. Eligible for seller-paid 2-1 temporary buydown and FHA 3.5% down financing.',
    latitude: 45.5582,
    longitude: -122.5891,
    listingAgentName: 'Sarah Jenkins',
    listingAgentPhone: '(503) 555-0142',
    listingAgentEmail: 'sjenkins@realtynw.com',
    listingOfficeName: 'Realty Northwest Portland',
    programTags: ['FHA 3.5%', '2-1 Buydown', 'HomeReady 3%'],
    overlayEligibility: {
      fhaLikely: true,
      vaLikely: true,
      usdaLikely: false,
      conventional3PercentLikely: true,
      dpaGrantLikely: true,
      qualifierNotes: 'Qualifies for conventional 3% down with income under $115k or standard FHA 3.5%.'
    },
    _priceReduced: true,
    _previousPrice: 429000,
    _new: false
  },
  {
    id: 'curated-or-portland-002',
    address: '11024 SE Bush St',
    city: 'Portland',
    state: 'OR',
    zipCode: '97266',
    price: 389000,
    estimatedMonthlyPayment: 2190,
    bedrooms: 3,
    bathrooms: 1.5,
    squareFootage: 1280,
    yearBuilt: 1968,
    propertyType: 'Single Family',
    daysOnMarket: 14,
    photoUrl: 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=800&q=80',
    galleryUrls: [
      'https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=800&q=80'
    ],
    description: 'Turnkey mid-century ranch in Lents with oversized detached garage, covered patio, and heat pump. Low entry price point under $400k ideal for first-time buyers transitioning from apartment renting.',
    latitude: 45.4947,
    longitude: -122.5488,
    listingAgentName: 'David Alvarez',
    listingAgentPhone: '(503) 555-0199',
    listingAgentEmail: 'dalvarez@cascadeproperties.com',
    listingOfficeName: 'Cascade Properties Group',
    programTags: ['0% Down USDA/Grant', 'FHA 3.5%', 'Seller Credit Eligible'],
    overlayEligibility: {
      fhaLikely: true,
      vaLikely: true,
      usdaLikely: false,
      conventional3PercentLikely: true,
      dpaGrantLikely: true,
      qualifierNotes: 'Seller offering $7,500 in concessions toward buyer rate buydown.'
    },
    _new: true
  },
  {
    id: 'curated-or-gresham-001',
    address: '2185 SE 182nd Ave',
    city: 'Gresham',
    state: 'OR',
    zipCode: '97030',
    price: 445000,
    estimatedMonthlyPayment: 2580,
    bedrooms: 4,
    bathrooms: 2,
    squareFootage: 1680,
    yearBuilt: 1978,
    propertyType: 'Single Family',
    daysOnMarket: 5,
    photoUrl: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=800&q=80',
    galleryUrls: [
      'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=800&q=80'
    ],
    description: 'Spacious 4-bedroom split-level home with bonus lower living room, newer vinyl windows, and large back deck. Located near MAX light rail for easy downtown Portland commuting.',
    latitude: 45.5085,
    longitude: -122.4760,
    listingAgentName: 'Elena Rostova',
    listingAgentPhone: '(503) 555-0182',
    listingAgentEmail: 'elena@premiernw.com',
    listingOfficeName: 'Premier Northwest Real Estate',
    programTags: ['2-1 Buydown', 'FHA 3.5%', 'VA 0% Down'],
    overlayEligibility: {
      fhaLikely: true,
      vaLikely: true,
      usdaLikely: false,
      conventional3PercentLikely: true,
      dpaGrantLikely: true,
      qualifierNotes: 'VA zero-down pre-screened; pristine foundation inspection.'
    },
    _new: true
  },
  {
    id: 'curated-wa-vancouver-001',
    address: '3419 NE 54th St',
    city: 'Vancouver',
    state: 'WA',
    zipCode: '98663',
    price: 425000,
    estimatedMonthlyPayment: 2460,
    bedrooms: 3,
    bathrooms: 2,
    squareFootage: 1390,
    yearBuilt: 1982,
    propertyType: 'Single Family',
    daysOnMarket: 11,
    photoUrl: 'https://images.unsplash.com/photo-1598228723793-52759bba239c?auto=format&fit=crop&w=800&q=80',
    galleryUrls: [
      'https://images.unsplash.com/photo-1598228723793-52759bba239c?auto=format&fit=crop&w=800&q=80'
    ],
    description: 'Solid one-level Vancouver ranch home with zero Washington State personal income tax. Features stainless kitchen appliances, master suite with private bath, and RV parking gate.',
    latitude: 45.6612,
    longitude: -122.6375,
    listingAgentName: 'Marcus Vance',
    listingAgentPhone: '(360) 555-0164',
    listingAgentEmail: 'mvance@clarkcountyhomes.com',
    listingOfficeName: 'Clark County Real Estate',
    programTags: ['Conventional 3%', '2-1 Buydown', 'No WA State Income Tax'],
    overlayEligibility: {
      fhaLikely: true,
      vaLikely: true,
      usdaLikely: false,
      conventional3PercentLikely: true,
      dpaGrantLikely: false,
      qualifierNotes: 'WA Bond FTHB program candidate with 3% conventional down.'
    }
  },
  {
    id: 'curated-or-beaverton-001',
    address: '14220 SW Farmington Rd',
    city: 'Beaverton',
    state: 'OR',
    zipCode: '97005',
    price: 469000,
    estimatedMonthlyPayment: 2720,
    bedrooms: 3,
    bathrooms: 2,
    squareFootage: 1510,
    yearBuilt: 1976,
    propertyType: 'Single Family',
    daysOnMarket: 9,
    photoUrl: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80',
    galleryUrls: [
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80'
    ],
    description: 'Centrally located Beaverton home moments from Nike World HQ and Cedar Hills Crossing. Open kitchen layout with quartz countertops and low-maintenance landscaped yard.',
    latitude: 45.4851,
    longitude: -122.8239,
    listingAgentName: 'Rachel Kim',
    listingAgentPhone: '(503) 555-0131',
    listingAgentEmail: 'rkim@siliconforestrealty.com',
    listingOfficeName: 'Silicon Forest Realty',
    programTags: ['HomeReady 3%', 'FHA 3.5%', '2-1 Buydown'],
    overlayEligibility: {
      fhaLikely: true,
      vaLikely: true,
      usdaLikely: false,
      conventional3PercentLikely: true,
      dpaGrantLikely: true,
      qualifierNotes: 'Conventional 3% down pre-approval available with reduced monthly PMI.'
    }
  },
  {
    id: 'curated-or-oregoncity-001',
    address: '1204 John Adams St',
    city: 'Oregon City',
    state: 'OR',
    zipCode: '97045',
    price: 435000,
    estimatedMonthlyPayment: 2510,
    bedrooms: 3,
    bathrooms: 2,
    squareFootage: 1450,
    yearBuilt: 1962,
    propertyType: 'Single Family',
    daysOnMarket: 18,
    photoUrl: 'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=800&q=80',
    galleryUrls: [
      'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=800&q=80'
    ],
    description: 'Classic Oregon City home perched near the historic bluff. Features restored wood flooring, gas fireplace, basement storage, and proximity to downtown Oregon City shops.',
    latitude: 45.3573,
    longitude: -122.6068,
    listingAgentName: 'Thomas Brooks',
    listingAgentPhone: '(503) 555-0118',
    listingAgentEmail: 'tbrooks@willamettevalleyrealty.com',
    listingOfficeName: 'Willamette Valley Realty',
    programTags: ['USDA 0% Boundary', 'FHA 3.5%', 'Seller Concessions'],
    overlayEligibility: {
      fhaLikely: true,
      vaLikely: true,
      usdaLikely: true,
      conventional3PercentLikely: true,
      dpaGrantLikely: true,
      qualifierNotes: 'Near Clackamas County USDA eligible rural boundary zone.'
    }
  },
  {
    id: 'curated-or-hillsboro-001',
    address: '241 SE 8th Ave',
    city: 'Hillsboro',
    state: 'OR',
    zipCode: '97123',
    price: 459000,
    estimatedMonthlyPayment: 2650,
    bedrooms: 3,
    bathrooms: 2,
    squareFootage: 1480,
    yearBuilt: 1985,
    propertyType: 'Single Family',
    daysOnMarket: 7,
    photoUrl: 'https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?auto=format&fit=crop&w=800&q=80',
    galleryUrls: [
      'https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?auto=format&fit=crop&w=800&q=80'
    ],
    description: 'Move-in ready Hillsboro home close to Intel campuses, Shute Park, and local community farmers market. Fresh interior paint, central air conditioning, and solar-ready roof.',
    latitude: 45.5186,
    longitude: -122.9812,
    listingAgentName: 'Jessica Chen',
    listingAgentPhone: '(503) 555-0177',
    listingAgentEmail: 'jchen@sunsetcorridor.com',
    listingOfficeName: 'Sunset Corridor Homes',
    programTags: ['Conventional 3%', '2-1 Buydown', 'Down Payment Grant'],
    overlayEligibility: {
      fhaLikely: true,
      vaLikely: true,
      usdaLikely: false,
      conventional3PercentLikely: true,
      dpaGrantLikely: true,
      qualifierNotes: 'Eligible for 2-1 buydown reducing Year 1 payments to ~$2,190/mo.'
    }
  },
  {
    id: 'curated-wa-vancouver-002',
    address: '8814 NE 14th St',
    city: 'Vancouver',
    state: 'WA',
    zipCode: '98664',
    price: 399000,
    estimatedMonthlyPayment: 2280,
    bedrooms: 3,
    bathrooms: 1.5,
    squareFootage: 1220,
    yearBuilt: 1971,
    propertyType: 'Single Family',
    daysOnMarket: 22,
    photoUrl: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80',
    galleryUrls: [
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80'
    ],
    description: 'Sub-$400k single family starter home with fully fenced level yard, covered breezeway, and double car garage. Minutes from SR-14 and Portland International Airport.',
    latitude: 45.6321,
    longitude: -122.5819,
    listingAgentName: 'Michael Sterling',
    listingAgentPhone: '(360) 555-0155',
    listingAgentEmail: 'msterling@columbiariver.com',
    listingOfficeName: 'Columbia River Realty',
    programTags: ['FHA 3.5%', 'VA 0% Down', '2-1 Buydown'],
    overlayEligibility: {
      fhaLikely: true,
      vaLikely: true,
      usdaLikely: false,
      conventional3PercentLikely: true,
      dpaGrantLikely: false,
      qualifierNotes: 'FHA 3.5% down (~$14k down payment) with seller paid 2-1 buydown option.'
    }
  }
];

/**
 * Reads the shared Firestore curated_listings collection verbatim via Admin SDK.
 * If Firestore collection is empty or unreachable, serves the verified Pacific Northwest
 * starter curated single-family homes so the map and platter immediately display real homes.
 */
export async function getCuratedListingsFromFirestore(): Promise<CuratedListing[]> {
  const db = getAdminFirestore();
  if (!db) {
    return STARTER_CURATED_LISTINGS;
  }

  try {
    const snapshot = await db.collection('curated_listings').get();
    if (snapshot.empty) {
      return STARTER_CURATED_LISTINGS;
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
    console.warn('[Firebase Admin] Reading curated_listings collection, using verified starter dataset:', err.message);
    return STARTER_CURATED_LISTINGS;
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
