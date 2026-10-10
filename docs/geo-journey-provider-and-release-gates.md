# Geo Journey Player — integration and provider review

Status: development preview only. Do not merge into `main` or enable public launch without approval.

## Implemented

- Journey planner for up to four favorited curated homes, or a home-to-clicked-map-point commute.
- Server-side `POST /api/journey/route` route proxy (2–5 Oregon-area coordinates).
- OSRM-compatible routing URL configured by `JOURNEY_ROUTING_BASE_URL` (HTTPS; no browser-exposed token). Optional `JOURNEY_ROUTING_API_KEY` is sent as a bearer token.
- No implicit demo-server fallback in production. `JOURNEY_ALLOW_DEMO_ROUTING=true` allows the OSRM public demo only for non-production development or Vercel preview (`VERCEL_ENV=preview`). Use sparingly, per OSRM policy.
- Play, pause, restart, 0.5×/1×/2× preview speed, seek slider and route-follow camera. The 75-second route preview is illustrative and **not** a real travel-time estimate or navigation.
- Live Three.js Geo lab embedded in a same-origin iframe. Journey states sent by validated `postMessage`: thinking, point, saturday, drive, arrive, idle. His facial expressions, motions and head-pin glow change with the state. **The lab character/car animation is procedural and not geographically synchronized to the real route.** This is not a production GLB rig.
- Street and Earth controls open Google viewers externally at the route cursor; they do not embed licensed panoramas or create continuous first-person footage.

## Before testing routes in Vercel preview

Configure a production-grade routing endpoint as `JOURNEY_ROUTING_BASE_URL` with any needed `JOURNEY_ROUTING_API_KEY`. For limited **preview-only** testing, an authorized project administrator may explicitly set `JOURNEY_ALLOW_DEMO_ROUTING=true` in the preview environment and redeploy. Without either setting, route planning intentionally returns HTTP 503.

Provider URLs must be HTTPS and controlled by server configuration. Keep credentials server-side. Check provider terms, commercial usage, CORS/proxy, rate limits, availability, billing, quotas, and privacy before release.

## Street imagery provider assessment

| Candidate | Benefits | Constraints / decision |
| --- | --- | --- |
| Google Maps JavaScript Dynamic Street View | Widely covered interactive panoramas | API key, billing, quota, attribution and terms. No assumption of smooth continuous real driving video. Requires explicit approval. |
| Google Street View Tiles | Potential custom panorama viewer | Session/token and per-tile billing, attribution, caching restrictions, rendering implementation. Requires licensing review. |
| Mapillary | Crowdsourced geotagged street imagery and sequences | Uneven coverage, API token, attribution and CC-BY-SA obligations; review commercial terms and individual imagery licenses before embedding. |

No imagery provider has been selected or configured. **Do not scrape Google Street View, cache prohibited imagery, or synthesize simulated neighborhood footage presented as real imagery.**

## Future acceptance gates

1. CI typecheck and tests pass; verify map, journey and iframe in deployed browser.
2. Verify Geo loads and responds to all journey states, including seek, pause and arrival.
3. Validate route geometry and the server's authentication, quotas, abuse controls and privacy policy.
4. Replace lab procedural character with approved high-resolution 3D rig; connect actual route progress to Geo's position/orientation.
5. Choose and license street imagery provider; implement graceful coverage gaps and honest imagery labels.
6. Verify mobile responsive controls, reduced-motion setting, pause on tab hidden, and keyboard accessibility.
7. Add provider-specific production billing caps, rate limiting, server monitoring and error handling.
8. Revisit route planning order, waypoint timing and verified open-house schedules before advertising optimized tours.

Source references: Google Maps Platform pricing and Map Tiles policies, Mapillary licensing guidance, and OSRM demo usage policy.
