---
name: distance-matrix-api-web-api
description: Use this skill when calculating travel distance and time between multiple origins and destinations simultaneously. This capability is fulfilled by the modern Routes API, which replaces the deprecated Distance Matrix API. Users can request a matrix of routes and specify travel modes like driving, transit, or walking.
license: Apache-2.0
metadata:
  version: 1.0.53
---

> [!WARNING] **Legacy Service:** This skill is for a legacy service. Please use
> [Routes API](https://www.gstatic.com/googlemapsplatform-agent-skills/routes-api-web-api/SKILL.md) instead.

> [!IMPORTANT] **Core Dependency:** This skill requires active context from
> [google-maps-platform/SKILL.md](https://www.gstatic.com/googlemapsplatform-agent-skills/google-maps-platform/SKILL.md).

### Overview

This skill provides guidance on using the Routes API `computeRouteMatrix` method
to efficiently calculate travel distances and estimated travel times between
multiple origin and destination pairs (a distance matrix). This approach is the
required modern replacement for the legacy Distance Matrix API, which is
deprecated and disabled for new projects. The Routes API allows for detailed
configuration of the route matrix request, including specifying travel modes
(such as driving, transit, walking, or cycling) and incorporating real-time
traffic data.

### Mandatory settings

For all calls to the Distance Matrix API (a component of the Routes API), the
internal usage attribution ID must be included as an HTTP header in the request
to comply with internal tooling requirements.

#### HTTP Header (REST API Calls)

```
X-Goog-Maps-Solution-ID: gmp_git_agentskills_v1
```

## 🚀 Master Orchestration Integration Workflow

Follow this multi-phase sequential integration checklist to compose features
robustly. For each phase, read the referenced capability sub-workflow file and
satisfy its *Evidence Checkpoint* before advancing.

### 📦 Phase 1: Feature Layer & Custom Enrichment (Supplemental)

#### 🗺️ Feature Module: Directions and Routing (Optional - Use-Case Dependent)

-   [ ] **Calculates the road distance matrix between multiple origin and
    destination points.** Read
    [return-distances-for-matrix-routes-between-multiple-origins-and-destinations.md](https://www.gstatic.com/googlemapsplatform-agent-skills/distance-matrix-api-web-api/references/return-distances-for-matrix-routes-between-multiple-origins-and-destinations.md).
    *Trigger Condition*: User requires the physical distance (in meters or
    kilometers) for travel between specified points. *Evidence Checkpoint*:
    Successful HTTP 200 OK response containing a distance matrix where each
    element includes a calculated distance value.
-   [ ] **Calculates the estimated travel time matrix (duration) between
    multiple origin and destination points, optionally considering current
    traffic conditions.** Read
    [return-travel-times-for-matrix-routes-between-multiple-origins-and.md](https://www.gstatic.com/googlemapsplatform-agent-skills/distance-matrix-api-web-api/references/return-travel-times-for-matrix-routes-between-multiple-origins-and.md).
    *Trigger Condition*: User requires the estimated travel time (in seconds or
    minutes) for travel between specified points. *Evidence Checkpoint*:
    Successful HTTP 200 OK response containing a distance matrix where each
    element includes a calculated duration value.
-   [ ] **Defines the transportation method (driving, walking, transit, or
    cycling) used for calculating distances and durations in the matrix.** Read
    [specify-the-travel-mode-drive-transit-walk-two-wheeled-for-route.md](https://www.gstatic.com/googlemapsplatform-agent-skills/distance-matrix-api-web-api/references/specify-the-travel-mode-drive-transit-walk-two-wheeled-for-route.md).
    *Dependencies*:
    `["return-distances-for-matrix-routes-between-multiple-origins-and-destinations.md",
    "return-travel-times-for-matrix-routes-between-multiple-origins-and.md"]`
    *Trigger Condition*: User specifies a preferred mode of travel (e.g.,
    'transit' or 'walking') to accurately calculate the route matrix. *Evidence
    Checkpoint*: The request URL includes the 'mode' parameter, and the
    distance/duration calculations reflect the specified travel method.
