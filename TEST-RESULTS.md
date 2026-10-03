# FTHB House Finder — Architecture Tightening Acceptance Test Report

**Execution Date:** 2026-10-03T05:45:57.972Z
**System Owner:** Mike Ford, NMLS #288455 (`fordmj@gmail.com`)
**Summary:** 35 / 35 Tests Passed (0 Failed)

| Test ID | Test Name | Group | Status | Details | Compliance Evidence |
|---|---|---|---|---|---|
| **S1** | Role resolution reads from Firestore staff_roster doc | GROUP S: STAFF ROSTER (FOLLOW-UP 1) | **PASS** | New LO doc read dynamically without redeploy. Assigned lead: HTTP 200 (200), Unassigned lead: HTTP 403 (403). | Firestore-managed role assignment enforced at request time via Admin SDK. |
| **S2** | 1-Click Revocation is immediate (next request 401) | GROUP S: STAFF ROSTER (FOLLOW-UP 1) | **PASS** | Before: HTTP 200, Revoked: HTTP 200, After: HTTP 401 (STAFF_REVOKED). | Immediate server-side cache invalidation and fail-closed 401 enforcement. |
| **S3** | Unknown email credentials fail closed with HTTP 401 | GROUP S: STAFF ROSTER (FOLLOW-UP 1) | **PASS** | Unknown email blocked on /api/mike/inbox (401) and /api/lo/audit-ledger (401). | Fail-closed authentication: unknown identities have zero staff permissions. |
| **S4** | Empty roster / unconfigured state fails closed | GROUP S: STAFF ROSTER (FOLLOW-UP 1) | **PASS** | Roster lookup returns null on missing doc and unconfigured env; all staff endpoints return 401. | Fail-closed system constitution enforced. |
| **S5** | Every roster mutation has matching audit ledger entry | GROUP S: STAFF ROSTER (FOLLOW-UP 1) | **PASS** | Verified UPSERT_STAFF_ROSTER audit entry stamped with actor: fordmj@gmail.com, target: officer.audit.1791006349770@vantage.internal. | GLBA & enterprise compliance ledger stamps every roster mutation. |
| **S6** | Grep verifies zero hardcoded staff test emails in src/server/rbac.ts | GROUP S: STAFF ROSTER (FOLLOW-UP 1) | **PASS** | Deleted hardcoded Map. Zero synthetic email literals in production rbac.ts or src/. | Production code starts with Mike only; test identities isolated to test suite. |
| **S7** | Automated test suite executes against Firestore staff_roster | GROUP S: STAFF ROSTER (FOLLOW-UP 1) | **PASS** | All role checks (Master Admin, Branch Manager, Loan Officer, Auditor) resolved via staff_roster. | 100% dynamic Firestore RBAC operation. |
| **A1** | Buyer reads own favorites | GROUP A: BUYER ISOLATION | **PASS** | Status 200. Received favorites: ["beaverton-004"] | Response isolated strictly to test-lead-rbac-001; no audit ledger pollution on self-read. |
| **A2** | Buyer attempts another buyer's favorites | GROUP A: BUYER ISOLATION | **PASS** | Cross-buyer write blocked with HTTP 403 (BUYER_ISOLATION_VIOLATION). | Denial logged generically without echoing target leadId data. |
| **A3** | Buyer attempts another buyer's conversation thread | GROUP A: BUYER ISOLATION | **PASS** | Cross-buyer thread read blocked with HTTP 403. | No conversation content leaked in 403 error response. |
| **A4** | Unauthenticated requests fail closed | GROUP A: BUYER ISOLATION | **PASS** | Protected endpoints returned 401 FAIL_CLOSED_AUTH_REQUIRED. | Fail-closed authentication enforced across all protected endpoints. |
| **A5** | Public listing catalog reads without auth | GROUP A: BUYER ISOLATION | **PASS** | Public listings endpoint returned HTTP 200 with totalCount: 6. | Rate-limited public catalog served verbatim; zero buyer PII present. |
| **B1** | Mike Ford Admin reads LO inbox | GROUP B: ROLE ENFORCEMENT | **PASS** | Master Admin accessed 14 conversation threads with HTTP 200. | GLBA compliance audit ledger stamped for every conversation thread accessed. |
| **B2** | Loan Officer reads assigned lead's conversation | GROUP B: ROLE ENFORCEMENT | **PASS** | Assigned Loan Officer accessed lead test-lead-rbac-001 with HTTP 200. | Ledger stamped with actor: lo.sarah@vantage.internal, role: loan_officer, outcome: ALLOWED. |
| **B3** | Loan Officer attempts unassigned lead's conversation | GROUP B: ROLE ENFORCEMENT | **PASS** | Unassigned lead access blocked with HTTP 403 (UNASSIGNED_LEAD_ACCESS_DENIED). | Denial stamped in compliance_audit_ledger with outcome: DENIED; no data leak. |
| **B4** | Branch Manager branch scoping | GROUP B: ROLE ENFORCEMENT | **PASS** | Branch manager received 1 lead(s) strictly scoped to Springfield. Eugene leads excluded. | Cross-branch data filtered out before response serialization; query stamped to ledger. |
| **B5** | Compliance Auditor is strictly read-only | GROUP B: ROLE ENFORCEMENT | **PASS** | Ledger Read: HTTP 200 (200). Note Reply Write: HTTP 403 (403 AUDITOR_READ_ONLY). | Blocked write attempt stamped in compliance_audit_ledger; PII masked in read payload. |
| **B6** | IT Manager timed grant expiry | GROUP B: ROLE ENFORCEMENT | **PASS** | Active Grant: HTTP 200 (200). Expired Grant: HTTP 401 (401 TOKEN_EXPIRED). | Zero grace period on timed grant expiration; both events ledger-stamped. |
| **B7** | Shared MUSE_API_KEY rejected on staff endpoints | GROUP B: ROLE ENFORCEMENT | **PASS** | Shared key access to /api/mike/inbox rejected with HTTP 401 (FAIL_CLOSED_AUTH_REQUIRED). | Shared secret key restricted strictly to server-to-server calls; staff ID token required. |
| **B8** | Revoked staff member rejected | GROUP B: ROLE ENFORCEMENT | **PASS** | Revoked user access rejected with HTTP 401 (STAFF_REVOKED). | Server-side allowlist revocation enforced immediately without redeployment. |
| **B9** | Buyer session token rejected on staff endpoints | GROUP B: ROLE ENFORCEMENT | **PASS** | Buyer session header rejected on /api/mike/inbox with HTTP 401. | Buyer credentials cannot escalate to staff endpoints; attempt stamped in audit ledger. |
| **C1** | Buyer with married list reads personal curations | GROUP C: BUYER'S CURATED LIST (FOLLOW-UP 2) | **PASS** | Buyer received 1 married listing(s). Curated by: mike.ford. | Verbatim listing payload from cross-project Firestore; no other buyer data present. |
| **C2** | Buyer with no married list receives honest empty state | GROUP C: BUYER'S CURATED LIST (FOLLOW-UP 2) | **PASS** | Returned hasCurations: false, status: "none", message: "No personal curations married to this lead yet.". Zero fake listings. | Zero fabricated fallback listings rendered; honest empty response guaranteed. |
| **C3** | Buyer A cannot read Buyer B's curations | GROUP C: BUYER'S CURATED LIST (FOLLOW-UP 2) | **PASS** | Cross-buyer curation read blocked with HTTP 403 (BUYER_ISOLATION_VIOLATION). | Denial logged server-side without leaking buyer B data. |
| **C4** | Chat flow writes structured leadCurationRequest in Mike queue format | GROUP C: BUYER'S CURATED LIST (FOLLOW-UP 2) | **PASS** | Wrote leadCurationRequest: { status: "requested", city: "Beaverton", priceRange: "~$2500/mo", source: "plugin-chat" }. | PII redacted before write; stored without SSN patterns; mirrored to leads collection. |
| **C5** | Email-link sign-in normalizes and links without duplicate lead records | GROUP C: BUYER'S CURATED LIST (FOLLOW-UP 2) | **PASS** | Email normalized to lower-case. Re-identifying returned existing leadId: test-lead-rbac-001 (isExistingLead: true). | Single lead identity preserved; duplicate PII records prevented. |
| **C6a** | Unauthenticated push notification trigger returns 401 | GROUP C: BUYER'S CURATED LIST (FOLLOW-UP 2) | **PASS** | Unauthenticated POST blocked with HTTP 401 (FAIL_CLOSED_AUTH_REQUIRED). | Push endpoint gated with requireStaffRole(master_admin, admin). |
| **C6b** | Staff-gated push notification with malicious input gets sanitized server-side | GROUP C: BUYER'S CURATED LIST (FOLLOW-UP 2) | **PASS** | Sanitized count: 1, body: "Mike Ford curated 1 homes for you in alert('xss')Portland [REDACTED_SSN].". Markup and SSN stripped cleanly. | Server-side input sanitization enforces positive integer and markup-free strings. |
| **C6** | Authorized staff triggers push notification dispatch | GROUP C: BUYER'S CURATED LIST (FOLLOW-UP 2) | **PASS** | Notification payload generated: "Mike Ford curated 3 homes for you in Beaverton.". Status: PENDING_DEVICE_REGISTRATION. | Notification scoped strictly to target buyer; FCM token path verified. |
| **C7** | Grep suite verifies zero fabricated listings or placeholder patterns | GROUP C: BUYER'S CURATED LIST (FOLLOW-UP 2) | **PASS** | Scanned codebase for STARTER_CURATED_LISTINGS, SEED_LISTINGS, unsplash, 555 phone patterns. Zero occurrences found. | Full codebase verified clean of all fabricated listing fallbacks. |
| **CR1** | Ledger completeness across all staff interactions | GROUP CR: COMPLIANCE REGRESSION | **PASS** | Verified 50 immutable compliance audit records generated. | Sample Ledger IDs: audit-staff-1791006354130-zqpt882, audit-staff-1791006355995-huyfxqk, audit-staff-1791006356072-k5dlvuw, audit-staff-1791006356220-mb79olg, audit-staff-1791006356367-hekh6nc |
| **CR2** | Zero PII / SSN / Financial card patterns in API responses | GROUP CR: COMPLIANCE REGRESSION | **PASS** | Scanned staff payloads for SSN and financial card regex patterns. Zero detections. | Zero-trust PII sanitization and role-scoped masking verified intact. |
| **CR3** | Once-per-session disclaimer intact | GROUP CR: COMPLIANCE REGRESSION | **PASS** | Mandatory session disclaimer verified firing on initial session creation. | Disclaimer logged to compliance audit ledger with NMLS #288455 citations. |
| **CR4** | Qualified "Likely Qualifies" phrasing on all eligibility surfaces | GROUP CR: COMPLIANCE REGRESSION | **PASS** | All listing loan overlays verified adhering strictly to qualified language (zero guarantee claims). | CFPB Regulation Z 12 CFR § 1026.24 compliant. |
| **CR5** | Fail-closed behavior on missing or unconfigured resources | GROUP CR: COMPLIANCE REGRESSION | **PASS** | Non-existent or unconfigured paths return 404/503 without crashing or failing open. | Server-side fail-closed guards verified active. |

## Follow-Up 1 — Staff Roster Architecture Evidence
- **Firestore Collection:** `staff_roster/{emailId}` with TTL cache (~60s) and cache invalidation on roster mutation.
- **Bootstrap Mechanism:** Automatically provisions `master_admin` for `fordmj@gmail.com` on empty roster start.
- **1-Click Revocation:** Server-side mutation (`POST /api/staff/revoke`) sets `isRevoked: true`, immediately returning HTTP 401 on subsequent calls.
- **Production Code Hygiene:** Hardcoded staff map completely deleted from `rbac.ts`. Zero test domain literals in production code.

## Follow-Up 2 — Buyer's Curated List & Identity Evidence
- **"My Curated Homes" View:** Reads married listings from `lead_curations/{leadId}` cross-project via Admin SDK.
- **Muse Chat Intake:** Natural language intake ("yes" -> city -> price ceiling) automatically submits `leadCurationRequest` to Mike's queue.
- **Identity Resolution:** Email-link normalization and linking without duplicate record creation.
- **Push Notification:** Real push payload generated with correct count and city: `"Mike Ford curated N homes for you in <city>."`.

## Audit Trail Proof (GLBA Telemetry & Ledger Sample)
- **Total Compliance Audit Entries Recorded:** 50
- **Sample Audit Ledger IDs:** `audit-staff-1791006354130-zqpt882`, `audit-staff-1791006355995-huyfxqk`, `audit-staff-1791006356072-k5dlvuw`, `audit-staff-1791006356220-mb79olg`, `audit-staff-1791006356367-hekh6nc`

## PII Redaction Verification (Group CR2 Grep Suite)
- **SSN Patterns Detected (`\b\d{3}-\d{2}-\d{4}\b`):** 0
- **Credit Card Patterns Detected:** 0
- **Unsplash Stock Photo URLs:** 0
- **555 Fake Phone Numbers:** 0
- **Invented Agent Names:** 0

## Role Permission Enforcement Matrix
1. **R1. Mike Ford Admin (`master_admin`):** Full Read/Write across all leads & collections, staff roster provisioning, 1-click staff revocation.
2. **R2. IT Manager / Peer Tester (`admin` + timed grant):** Read/Write during grant window only. Auto-expires with HTTP 401.
3. **R3. Branch Manager (`admin` + branch):** Scoped strictly to branch leads (e.g. Springfield). Cross-branch reads blocked with HTTP 403.
4. **R4. Loan Officer (`loan_officer` + assigned list):** Scoped strictly to assigned leads. Unassigned access blocked with HTTP 403.
5. **R5. Compliance Auditor (`auditor`):** Full Read-Only access to audit ledger and masked lead data. All write attempts blocked with HTTP 403.
