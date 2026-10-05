# FTHB HomeFinder Platform Foundation

## Purpose

Build the proprietary first-time-homebuyer lead-capture, lead-cultivation, property-engagement, and applicant-conversion platform while preserving the existing FTHB House Finder consumer app and GeoSphere upstream property-intelligence engine.

The **First-Time Homebuyer platform is the native CRM and customer-journey system of record** for this ecosystem. It sits above traditional CRMs and does not require Salesforce or another external CRM to operate.

## Canonical architecture

- **First-Time Homebuyer platform** — native lead/customer CRM, top-of-funnel journey, routing, buyer records, curation, communication, conversion workflow, native dashboard, RBAC, and co-branding.
- **FTHB House Finder** — standalone, deployable consumer micro-app/plugin connected to the FTHB platform.
- **GeoSphere** — upstream property-intelligence/data engine for RentCast pulls, saved-listing folders, scheduled refreshes, geographic/program screening, and property-change events.
- **Vantage AI** — intelligence, orchestration, automation, recommendations, outreach drafting, and "second brain" across the ecosystem.
- **Traditional CRMs (Salesforce, HubSpot, etc.)** — optional downstream export destinations. They are never required to run the native FTHB/Vantage workflow.

## Core flow

Public FTHB website / intake / House Finder / Muse / property notes
-> native FTHB lead + buyer profile + search intent
-> GeoSphere listing candidates
-> native FTHB LO dashboard
-> LO curation
-> buyer House Finder/carousel
-> favorites / Top 3 / notes / questions
-> price-drop and listing-status events
-> Vantage AI recommendations and outreach drafts
-> financing / pre-approval / application intent
-> optional downstream CRM export

## Native FTHB CRM responsibilities

The FTHB dashboard owns the authoritative native records for:

- leads and buyer profiles
- search intent and engagement history
- assigned loan officer
- paired real-estate agent
- FTHB House Finder instance
- curated, viewed, favorited, and engaged properties
- two-way listing-card notes and conversations
- conversion journey state
- notification/activity events
- co-branding and instance configuration
- team/branch/RBAC access
- optional downstream export mappings and export history

External CRMs may receive exported records, but they do not become the source of truth for the native FTHB experience.

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

Events should drive notifications, activity feeds, and Vantage AI recommendations rather than embedding notification logic separately into each feature.

## Buyer-facing experience

The listing card is the shared workspace between buyer and LO/agent.

It can contain property facts, potential financing-program screening, payment estimate, price history, notes, favorites, Top 3 status, commute tools, and contextual Muse actions.

All financing/program language must remain clearly framed as screening/estimates and not underwriting approval.

## LO dashboard

Secure Google-authenticated staff experience should provide:

- native lead inbox and buyer records
- buyer profile and stated search criteria
- conversation/activity history
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
- optional downstream export status

## Co-branding

A loan officer can create an LO + real-estate-agent branded experience using configuration rather than a separate application.

The configuration can control:

- public URL / instance slug
- LO identity
- agent identity
- logos/branding
- service area
- lead routing
- chatbot/Muse context
- financing programs
- contact CTAs
- property cards
- note participants
- pre-approval/application CTAs
- notification behavior
- optional downstream export mapping

## Automation principle

GeoSphere scheduled refreshes remain the source of fresh property data.

The FTHB platform compares synchronized snapshots and emits domain events for material changes. Vantage AI consumes those events for recommendations, orchestration, and draft outreach.

Price drops can produce an estimated payment-savings message.

Status changes can update or suppress a listing.

New listings can become candidate matches for buyers whose saved search criteria and city overlap.

## Experience/Instance contract

Every deployable/co-branded FTHB experience should be represented as configuration against the same codebase, not as a cloned application.

Canonical configuration fields:

- instance_id
- instance_status
- owner_lo_id
- paired_agent_id
- brand configuration
- service area
- GeoSphere source/folder
- lead routing configuration
- Muse/Vantage context
- notification settings
- CTA configuration
- financing/program configuration
- optional downstream export mapping
- created_at / updated_at

Vantage creates or updates this configuration; the FTHB platform remains authoritative for lead/customer records and the runtime consumes the published instance configuration.


## Protected intellectual-property and anti-abuse baseline

Every FTHB deployment and every Vantage-generated FTHB House Finder distribution must preserve the platform's existing protection baseline:

- Mike Ford ownership/copyright attribution and NMLS #288455 where appropriate.
- Authorized instance identity and control-plane heartbeat.
- Administrator-controlled active/suspended/killed states and global kill switch.
- Per-IP API, lead-intake, webhook, and sensitive-operation rate limiting.
- Per-lead daily chat and property-note abuse caps.
- RBAC with master-admin ownership, branch/LO scoping, auditability, and server-side revocation.
- Compliance audit ledger and PII/financial-identifier sanitization.
- Crawler/AI-bot access restrictions through robots policy and server-side controls.
- Stable instance IDs so distributed copies remain attributable to an authorized deployment.
- Export/package attribution, license metadata, domain/instance binding, and protection notices.
- No exported artifact may silently remove, disable, or bypass these controls.

The consumer application and its server-side controls are the reference protection implementation. Vantage Studio exports must inherit the protection contract rather than creating a weaker parallel implementation.

## Safety / deployment principle

Never develop directly on production main.

Current development branch:

- feature/platform-foundation on fthb-house-finder

Current safety baseline:

- safety/baseline-2026-10-05 on fthb-house-finder

The GeoSphere upstream main remains unchanged by this foundation work.

## Existing capabilities already present in FTHB House Finder

The current application already contains important building blocks including buyer sessions, lead intake, curated listings, favorites/Top 3, Muse, property threads/two-way notes, publishing tools, alerts, staff/RBAC utilities, device notification infrastructure, co-branded pairing, and plugin intake.

The new platform should extend and connect these capabilities rather than rebuild them.

## First vertical slice

The first production-quality vertical slice should be:

1. Buyer expresses city/search intent.
2. Lead/search intent is persisted in the native FTHB CRM.
3. GeoSphere saved listings can be synchronized into the LO workspace.
4. LO sees matching candidate properties.
5. LO selects properties and pushes a curated set.
6. Buyer sees the curated carousel.
7. Buyer favorites / notes / asks a question.
8. LO sees the buyer activity in the native dashboard.
9. A synchronized price drop updates the same listing.
10. Buyer and LO receive the resulting event notification.
11. Vantage AI suggests outreach and can draft the message.
12. Lead can progress toward pre-approval/application.
13. Lead may optionally be exported to Salesforce or another CRM.

This vertical slice is the foundation for the larger proprietary ecosystem.
