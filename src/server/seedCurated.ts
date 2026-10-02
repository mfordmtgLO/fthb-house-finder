// Copyright (c) 2026 Mike Ford, NMLS #288455. All Rights Reserved.
import { getAdminFirestore } from './firebaseAdmin.ts';

const SEED_LISTINGS = [
  {
    id: 'portland-001',
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
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80'
    ],
    description: 'Charming single-family home in vibrant Southeast Portland. Features updated kitchen, hardwood floors, and fenced backyard. Likely qualifies for Oregon Housing and Community Services down payment assistance grant up to $15,000.',
    latitude: 45.4851,
    longitude: -122.6182,
    listingAgentName: 'Sarah Jenkins',
    listingAgentPhone: '(503) 555-1249',
    listingAgentEmail: 'sjenkins@premierepropertyoregon.com',
    listingOfficeName: 'Premiere Property Group',
    programTags: ['FHA 3.5%', 'Conventional 3%', 'DPA Grant Eligible'],
    overlayEligibility: {
      fhaLikely: true,
      vaLikely: false,
      usdaLikely: false,
      conventional3PercentLikely: true,
      dpaGrantLikely: true,
      qualifierNotes: 'Likely qualifies for Oregon Housing and Community Services down payment assistance grant up to $15,000 for qualified first-time buyers.'
    },
    _priceReduced: true,
    _previousPrice: 405000,
    _new: false,
    _statusChanged: false
  },
  {
    id: 'gresham-002',
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
      'https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=1200&q=80'
    ],
    description: 'Wonderful single-level home in Gresham with vaulted ceilings and private patio. Seller offering $7,500 credit toward 2-1 buydown or buyer closing costs.',
    latitude: 45.5051,
    longitude: -122.4282,
    listingAgentName: 'Michael Chang',
    listingAgentPhone: '(503) 555-3821',
    listingAgentEmail: 'mchang@Cascadesothebysrealty.com',
    listingOfficeName: "Cascade Sotheby's International Realty",
    programTags: ['FHA 3.5%', 'VA 0%', 'Conventional 3%', '2-1 Buydown Eligible'],
    overlayEligibility: {
      fhaLikely: true,
      vaLikely: true,
      usdaLikely: false,
      conventional3PercentLikely: true,
      dpaGrantLikely: false,
      qualifierNotes: 'Seller offering $7,500 credit toward 2-1 buydown or buyer closing costs.'
    },
    _priceReduced: false,
    _new: true,
    _statusChanged: false
  },
  {
    id: 'vancouver-003',
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
    photoUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
    galleryUrls: [
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80'
    ],
    description: 'Spacious 4-bedroom home in Vancouver WA. Close to parks and schools. Washington State Housing Finance Commission (WSHFC) DPA eligible for household incomes up to statutory county limits.',
    latitude: 45.6451,
    longitude: -122.5382,
    listingAgentName: 'Karen Reynolds',
    listingAgentPhone: '(360) 555-7384',
    listingAgentEmail: 'kreynolds@windermere.com',
    listingOfficeName: 'Windermere Northwest Living',
    programTags: ['VA 0%', 'FHA 3.5%', 'Conventional 3%'],
    overlayEligibility: {
      fhaLikely: true,
      vaLikely: true,
      usdaLikely: false,
      conventional3PercentLikely: true,
      dpaGrantLikely: true,
      qualifierNotes: 'Washington State Housing Finance Commission (WSHFC) DPA eligible for household incomes up to statutory county limits.'
    },
    _priceReduced: false,
    _new: false,
    _statusChanged: true,
    _previousStatus: 'Active'
  },
  {
    id: 'beaverton-004',
    address: '14220 SW Allen Blvd',
    city: 'Beaverton',
    state: 'OR',
    zipCode: '97005',
    price: 445000,
    estimatedMonthlyPayment: 2810,
    bedrooms: 3,
    bathrooms: 2,
    squareFootage: 1510,
    yearBuilt: 1989,
    propertyType: 'Single Family',
    daysOnMarket: 9,
    photoUrl: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1200&q=80',
    galleryUrls: [
      'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1200&q=80'
    ],
    description: 'Well-maintained Beaverton home near Nike campus and public transit. Highly favorable for conventional 3% down programs with low mortgage insurance rates.',
    latitude: 45.4951,
    longitude: -122.8182,
    listingAgentName: 'David Miller',
    listingAgentPhone: '(503) 555-9012',
    listingAgentEmail: 'dmiller@remaxproperty.com',
    listingOfficeName: 'RE/MAX Equity Group',
    programTags: ['Conventional 3%', 'FHA 3.5%', '2-1 Buydown Eligible'],
    overlayEligibility: {
      fhaLikely: true,
      vaLikely: false,
      usdaLikely: false,
      conventional3PercentLikely: true,
      dpaGrantLikely: false,
      qualifierNotes: 'Highly favorable for conventional 3% down programs with low mortgage insurance rates.'
    }
  },
  {
    id: 'hillsboro-005',
    address: '6810 SE 52nd Pl',
    city: 'Hillsboro',
    state: 'OR',
    zipCode: '97123',
    price: 425000,
    estimatedMonthlyPayment: 2680,
    bedrooms: 3,
    bathrooms: 2,
    squareFootage: 1450,
    yearBuilt: 2001,
    propertyType: 'Single Family',
    daysOnMarket: 3,
    photoUrl: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80',
    galleryUrls: [
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80'
    ],
    description: 'Modern Hillsboro craftsman with open-concept kitchen and energy-efficient solar panels. Eligible for 0% down VA loans or 3.5% FHA financing.',
    latitude: 45.5251,
    longitude: -122.9282,
    listingAgentName: 'Amanda Soto',
    listingAgentPhone: '(503) 555-4829',
    listingAgentEmail: 'asoto@johnlscott.com',
    listingOfficeName: 'John L. Scott Real Estate',
    programTags: ['VA 0%', 'FHA 3.5%', 'Conventional 3%'],
    overlayEligibility: {
      fhaLikely: true,
      vaLikely: true,
      usdaLikely: false,
      conventional3PercentLikely: true,
      dpaGrantLikely: true,
      qualifierNotes: 'Eligible for 0% down VA loans or 3.5% FHA financing.'
    }
  },
  {
    id: 'oregon-city-006',
    address: '1250 Molalla Ave',
    city: 'Oregon City',
    state: 'OR',
    zipCode: '97045',
    price: 399500,
    estimatedMonthlyPayment: 2540,
    bedrooms: 3,
    bathrooms: 2,
    squareFootage: 1390,
    yearBuilt: 1995,
    propertyType: 'Single Family',
    daysOnMarket: 12,
    photoUrl: 'https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&w=1200&q=80',
    galleryUrls: [
      'https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&w=1200&q=80'
    ],
    description: 'Historic charm meets modern updates in Oregon City. Terrific views and close to downtown shops. FHA 3.5% down friendly with low property tax basis.',
    latitude: 45.3551,
    longitude: -122.6082,
    listingAgentName: 'Robert Taylor',
    listingAgentPhone: '(503) 555-6733',
    listingAgentEmail: 'rtaylor@kw.com',
    listingOfficeName: 'Keller Williams PDX Central',
    programTags: ['FHA 3.5%', 'Conventional 3%', 'DPA Grant Eligible'],
    overlayEligibility: {
      fhaLikely: true,
      vaLikely: false,
      usdaLikely: false,
      conventional3PercentLikely: true,
      dpaGrantLikely: true,
      qualifierNotes: 'FHA 3.5% down friendly with low property tax basis.'
    }
  }
];

async function seed() {
  const db = getAdminFirestore();
  if (!db) {
    console.error('Failed to get Firestore DB handle for seeding.');
    process.exit(1);
  }

  console.log('Seeding curated listings into homebuyer Firestore database...');
  for (const item of SEED_LISTINGS) {
    await db.collection('curated_listings').doc(item.id).set(item, { merge: true });
    console.log(`Seeded listing: ${item.id} - ${item.address}`);
  }
  console.log('Seeding complete!');
  process.exit(0);
}

seed().catch(err => {
  console.error('Seeding error:', err);
  process.exit(1);
});
