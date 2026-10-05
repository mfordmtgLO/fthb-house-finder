# FTHB HomeFinder Platform Foundation

## Purpose

Build the lead-capture, lead-cultivation, property-curation, and applicant-conversion platform above Salesforce while preserving the existing FTHB House Finder consumer app and GeoSphere upstream property/eligibility engine.

## Protected architecture

GeoSphere remains the upstream source for RentCast listing pulls, saved-listing folders, scheduled refreshes, and financing/geographic screening.

FTHB House Finder remains the consumer-facing property discovery and engagement application.

The new LO platform becomes the secure relationship/curation layer between GeoSphere and the buyer experience.

Salesforce remains the downstream CRM/system of record.

## Core flow

Public website / FTHB intake / Muse / property notes
-> buyer profile and search intent
-> GeoSphere listing candidates
-> LO dashboard
-> LO curation
-> buyer carousel
-> favorites / Top 3 / notes / questions
-> price-drop and listing-status events
-> payment-savings notifications
-> financing / pre-approval intent
-> Salesforce

## Stable property identity

Every synced property must retain a stable GeoSphere/RentCast source listing identifier. Synchronization must update an existing property rather than create a duplicate.

## Listing lifecycle

DISCOVERED -> MATCHED -> CURATED -> PUSHED -> VIEWED -> FAVORITED -> ENGAGED -> CONVERSION_INTENT

A listing may also transition through price and status events without losing buyer-specific curation history.

## Event model

Important events include:

- LISTING_PRICE_DROP
- LISTING_STATUS_CHANGE
- NEW_MATCHING_LISTING
- PAYMENT_ESTIMATE_CHANGE
- BUYER_FAVORITED
- BUYER_UNFAVORITED
- BUYER_NOTE_CREATED
- LO_NOTE_CREATED
- BUYER_PROPERTY_QUESTION
- BUYER_FINANCING_QUESTION
- PREAPPROVAL_REQUESTED
- APPLICATION_REQUESTED

Events should drive notifications and AI recommendations rather than embedding notification logic separately into each feature.

## Buyer-facing experience

The listing card is the shared workspace between buyer and LO.

It can contain property facts, potential financing-program screening, payment estimate, price history, notes, favorites, Top 3 status, commute tools, and contextual Muse actions.

All financing/program language must remain clearly framed as screening/estimates and not underwriting approval.

## LO dashboard

Secure Google-authenticated staff experience should provide:

- lead inbox
- buyer profile and stated search criteria
- conversation history
- property activity
- GeoSphere saved-listing sync/import
- listing curation
- buyer push
- two-way property notes
- price-drop monitoring
- new matching-property discovery
- notification state
- co-brand configuration
- conversion/pre-approval activity
- Salesforce handoff status

## Co-branding

A loan officer can create an LO + real-estate-agent branded experience using configuration rather than a separate application.

The configuration can control:

- public URL
- LO identity
- agent identity
- logos/branding
- chatbot context
- Muse context
- contact CTAs
- property cards
- note participants
- pre-approval/application CTAs

## Automation principle

GeoSphere scheduled refreshes remain the source of fresh property data.

The new platform should compare synchronized snapshots and emit domain events for material changes.

Price drops can produce an estimated payment-savings message.

Status changes can update or suppress a listing.

New listings can become candidate matches for buyers whose saved search criteria and city overlap.

## Safety / deployment principle

Never develop directly on production main.

Current safety branches:

- safety/baseline-2026-10-05 on fthb-house-finder
- safety/baseline-2026-10-05 on geosphere-map-oregon-ai-studio

Current development branch:

- feature/platform-foundation on fthb-house-finder

GeoSphere main remains unchanged by this foundation work.

## Existing capabilities already present in FTHB House Finder

The current application already contains important building blocks including buyer sessions, lead intake, curated listings, favorites/Top 3, Muse, property threads/two-way notes, publishing tools, alerts, staff/RBAC utilities, device notification infrastructure, co-branded pairing, and plugin intake.

The new platform should extend and connect these capabilities rather than rebuild them.

## First vertical slice

The first production-quality vertical slice should be:

1. Buyer expresses city/search intent.
2. Lead/search intent is persisted.
3. GeoSphere saved listings can be synchronized into the LO workspace.
4. LO sees matching candidate properties.
5. LO selects properties and pushes a curated set.
6. Buyer sees the curated carousel.
7. Buyer favorites / notes / asks a question.
8. LO sees the buyer activity.
9. A synchronized price drop updates the same listing.
10. Buyer and LO receive the resulting event notification.

Once this loop is stable, add Questie, MapQuest commute intelligence, deeper Muse recommendations, co-brand creator, and Salesforce conversion handoff.
