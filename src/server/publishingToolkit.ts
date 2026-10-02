// Copyright (c) 2026 Mike Ford, NMLS #288455. All Rights Reserved.
/**
 * Mike Ford's Distribution & Publishing Toolkit
 * Pre-formatted distribution copy for Mike's iPhone group text (Reach app),
 * Facebook organic posts, Facebook Ad campaign assets, and mass email.
 * NO automated SMS vendor or Twilio code permitted.
 */

import type { CuratedListing } from './curatedData.ts';

export interface ShareKitResult {
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

export function generatePublishingKit(listing?: CuratedListing, appUrl: string = 'https://ais-dev-uebnbxjndw5lknmaslqsdj-427099073161.us-east5.run.app'): ShareKitResult {
  const targetUrl = listing ? `${appUrl}?listing=${listing.id}` : appUrl;
  const priceFormatted = listing?.price ? `$${listing.price.toLocaleString()}` : 'Affordable Pricing';
  const paymentFormatted = listing?.estimatedMonthlyPayment ? `~$${listing.estimatedMonthlyPayment.toLocaleString()}/mo` : 'low monthly payment';
  const bedsBaths = listing ? `${listing.bedrooms} bed / ${listing.bathrooms} bath` : 'single-family home';
  const city = listing ? listing.city : 'Pacific Northwest';
  const address = listing ? listing.address : 'Curated FTHB Home';
  const tags = listing ? listing.programTags.join(', ') : 'FHA 3.5%, VA 0%, Down Payment Assistance';

  return {
    listingId: listing?.id,
    shareUrl: targetUrl,
    audienceVariants: {
      agentVersion: {
        headline: `Agent Partner Co-Marketing: Curated FTHB Inventory in ${city}`,
        body: `Hey partner! Mike Ford here (NMLS #288455). I just added ${address} (${priceFormatted}, ${bedsBaths}) to our curated First-Time Homebuyer portal. It likely qualifies for ${tags}. If you have buyers stuck on the fence thinking they need 20% down, share this direct link. Let's get them pre-approved and get them into your weekend showings! Link: ${targetUrl}`,
        reachSmsFormat: `[Agent Partner Alert] Hey! Mike Ford here. Just screened ${address} in ${city} for our zero/low-down FTHB platter (${priceFormatted}, ${paymentFormatted}). Check out the curated link & let's set up weekend tours: ${targetUrl}`
      },
      fenceSitterBuyerVersion: {
        headline: `Stop Renting: How to Own in ${city} with 0% to 3.5% Down`,
        body: `Are you tired of rising rent in ${city}? Check out this single-family home at ${address} listed at ${priceFormatted}. With our curated loan programs (FHA 3.5%, HomeReady 3%, or VA/USDA zero-down), your estimated payment is ${paymentFormatted}. We can even negotiate a seller-paid 2-1 buydown to drop your payment hundreds lower for the first 2 years! See full details: ${targetUrl} — Mike Ford (NMLS #288455)`,
        reachSmsFormat: `Hey! Thought of you when I saw this home in ${city} (${address} - ${priceFormatted}). You don't need 20% down—it likely qualifies for low/zero down with an estimated ${paymentFormatted}. Tap the link to view the numbers: ${targetUrl}`
      },
      pastClientReferralVersion: {
        headline: `Know a Friend or Family Member Renting in ${city}?`,
        body: `Hey friend! Mike Ford here. Many folks think buying a home right now is out of reach without $50k in the bank. We just launched our FTHB House Finder to show exactly which homes likely qualify for zero-down grants and 2-1 seller buydowns. If you know anyone renting who wants honest numbers from a local loan officer, feel free to send them this link: ${targetUrl}`,
        reachSmsFormat: `Hey! Mike Ford here. I built a private tool for renters curious how to buy with low/zero down. Know anyone looking in ${city}? Pass this along: ${targetUrl}`
      }
    },
    facebookFormats: {
      organicPost: `🏡 Renting in ${city}? Think you need 20% down to buy a single-family home? Think again.\n\nTake a look at ${address} (${priceFormatted} | ${bedsBaths}).\n✅ Pre-screened for FHA 3.5% and 0% Down Programs\n✅ Eligible for 2-1 Temporary Seller Buydown\n✅ Estimated monthly payment around ${paymentFormatted}\n\nExplore our curated House Finder and see all qualifying homes:\n👉 ${targetUrl}\n\nMike Ford | Senior Loan Officer | NMLS #288455\n(Price & program eligibility pre-screened; subject to formal underwrite & pre-approval).`,
      adHeadline: `${city} Homes: Stop Renting with 0% - 3.5% Down`,
      adPrimaryText: `Still paying someone else's mortgage? Browse curated single-family homes in ${city} starting at ${priceFormatted} that likely qualify for down-payment grants and 2-1 buydowns. Pre-approved directly with Mike Ford (NMLS #288455).`,
      adDescription: `Curated FTHB Homes. No 20% down required. View payments & book private tours.`,
      imageSpecs: {
        square: '1080x1080px (1:1 Aspect Ratio) — Clean hero exterior photo with co-branded lower third banner',
        vertical: '1080x1920px (9:16 Aspect Ratio) — Instagram/Facebook Story & Reel format with swipe-up prompt',
        aspectRatios: ['1:1', '9:16']
      }
    },
    massEmail: {
      subjectLines: [
        `How to buy a home in ${city} with low/zero down (curated preview)`,
        `Stop renting in ${city}: New curated listings just screened`,
        `Pre-screened home alert: ${address} (${priceFormatted})`
      ],
      agentEmailBody: `Good morning,\n\nI just screened several new single-family properties in ${city} for our First-Time Homebuyer portal, including ${address} (${priceFormatted}, ${bedsBaths}).\n\nThis home pre-qualifies for:\n- ${tags}\n- Potential 2-1 temporary rate buydown funded by seller credits\n\nTake a look at the interactive map and listing card here:\n${targetUrl}\n\nLet me know if any of your buyer leads would like to view this home, and I'll issue a rapid pre-approval letter for your offer.\n\nBest regards,\nMike Ford, NMLS #288455`,
      buyerEmailBody: `Hi there,\n\nIf you're currently renting and wondering what it takes to buy a home in ${city}, take a look at this curated home:\n\n${address}, ${city}\nPrice: ${priceFormatted}\nEstimated monthly payment: ${paymentFormatted}\n\nMany first-time buyers are surprised to learn that down payments can be as low as 3% (or even 0% down with VA or USDA programs). Plus, with seller concessions, we can often negotiate a 2-1 buydown to give you a significantly discounted payment during your first two years.\n\nExplore this home and see your potential options here:\n${targetUrl}\n\nWarmly,\nMike Ford\nSenior Loan Officer | NMLS #288455`
    }
  };
}
