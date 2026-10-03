# FTHB House Finder — RBAC & Enterprise Security Acceptance Test Report

**Execution Date:** 2026-10-03T05:02:36.792Z
**System Owner:** Mike Ford, NMLS #288455 (`fordmj@gmail.com`)
**Summary:** 19 / 19 Tests Passed (0 Failed)

| Test ID | Test Name | Group | Status | Details | Compliance Evidence |
|---|---|---|---|---|---|
| **A1** | Buyer reads own favorites | GROUP A: BUYER ISOLATION | **PASS** | Status 200. Received favorites: ["beaverton-004"] | Response isolated strictly to test-lead-rbac-001; no audit ledger pollution on self-read. |
| **A2** | Buyer attempts another buyer's favorites | GROUP A: BUYER ISOLATION | **PASS** | Cross-buyer write blocked with HTTP 403 (BUYER_ISOLATION_VIOLATION). | Denial logged generically without echoing target leadId data. |
| **A3** | Buyer attempts another buyer's conversation thread | GROUP A: BUYER ISOLATION | **PASS** | Cross-buyer thread read blocked with HTTP 403. | No conversation content leaked in 403 error response. |
| **A4** | Unauthenticated requests fail closed | GROUP A: BUYER ISOLATION | **PASS** | Protected endpoints returned 401 FAIL_CLOSED_AUTH_REQUIRED. | Fail-closed authentication enforced across all protected endpoints. |
| **A5** | Public listing catalog reads without auth | GROUP A: BUYER ISOLATION | **PASS** | Public listings endpoint returned HTTP 200 with totalCount: 6. | Rate-limited public catalog served verbatim; zero buyer PII present. |
| **B1** | Mike Ford Admin reads LO inbox | GROUP B: ROLE ENFORCEMENT | **PASS** | Master Admin accessed 11 conversation threads with HTTP 200. | GLBA compliance audit ledger stamped for every conversation thread accessed. |
| **B2** | Loan Officer reads assigned lead's conversation | GROUP B: ROLE ENFORCEMENT | **PASS** | Assigned Loan Officer accessed lead test-lead-rbac-001 with HTTP 200. | Ledger stamped with actor: lo.sarah@vantage.internal, role: loan_officer, outcome: ALLOWED. |
| **B3** | Loan Officer attempts unassigned lead's conversation | GROUP B: ROLE ENFORCEMENT | **PASS** | Unassigned lead access blocked with HTTP 403 (UNASSIGNED_LEAD_ACCESS_DENIED). | Denial stamped in compliance_audit_ledger with outcome: DENIED; no data leak. |
| **B4** | Branch Manager branch scoping | GROUP B: ROLE ENFORCEMENT | **PASS** | Branch manager received 1 lead(s) strictly scoped to Springfield. Eugene leads excluded. | Cross-branch data filtered out before response serialization; query stamped to ledger. |
| **B5** | Compliance Auditor is strictly read-only | GROUP B: ROLE ENFORCEMENT | **PASS** | Ledger Read: HTTP 200 (200). Note Reply Write: HTTP 403 (403 AUDITOR_READ_ONLY). | Blocked write attempt stamped in compliance_audit_ledger; PII masked in read payload. |
| **B6** | IT Manager timed grant expiry | GROUP B: ROLE ENFORCEMENT | **PASS** | Active Grant: HTTP 200 (200). Expired Grant: HTTP 401 (401 TOKEN_EXPIRED). | Zero grace period on timed grant expiration; both events ledger-stamped. |
| **B7** | Shared MUSE_API_KEY rejected on staff endpoints | GROUP B: ROLE ENFORCEMENT | **PASS** | Shared key access to /api/mike/inbox rejected with HTTP 401 (FAIL_CLOSED_AUTH_REQUIRED). | Shared secret key restricted strictly to server-to-server calls; staff ID token required. |
| **B8** | Revoked staff member rejected | GROUP B: ROLE ENFORCEMENT | **PASS** | Revoked user access rejected with HTTP 401 (STAFF_REVOKED). | Server-side allowlist revocation enforced immediately without redeployment. |
| **B9** | Buyer session token rejected on staff endpoints | GROUP B: ROLE ENFORCEMENT | **PASS** | Buyer session header rejected on /api/mike/inbox with HTTP 401. | Buyer credentials cannot escalate to staff endpoints; attempt stamped in audit ledger. |
| **C1** | Ledger completeness across all staff interactions | GROUP C: COMPLIANCE REGRESSION | **PASS** | Verified 32 immutable compliance audit records generated. | Sample Ledger IDs: audit-staff-1791003755180-q19qips, audit-staff-1791003755260-gz3i1p7, audit-staff-1791003755340-res80go, audit-staff-1791003755417-3tfh0ei, audit-staff-1791003755493-1748e12 |
| **C2** | Zero PII / SSN / Financial card patterns in API responses | GROUP C: COMPLIANCE REGRESSION | **PASS** | Scanned staff payloads for SSN and financial card regex patterns. Zero detections. | Zero-trust PII sanitization and role-scoped masking verified intact. |
| **C3** | Once-per-session disclaimer intact | GROUP C: COMPLIANCE REGRESSION | **PASS** | Mandatory session disclaimer verified firing on initial session creation. | Disclaimer logged to compliance audit ledger with NMLS #288455 citations. |
| **C4** | Qualified "Likely Qualifies" phrasing on all eligibility surfaces | GROUP C: COMPLIANCE REGRESSION | **PASS** | All listing loan overlays verified adhering strictly to qualified language (zero guarantee claims). | CFPB Regulation Z 12 CFR § 1026.24 compliant. |
| **C5** | Fail-closed behavior on missing or unconfigured resources | GROUP C: COMPLIANCE REGRESSION | **PASS** | Non-existent or unconfigured paths return 404/503 without crashing or failing open. | Server-side fail-closed guards verified active. |

## Audit Trail Proof (GLBA Telemetry & Ledger Sample)
- **Total Compliance Audit Entries Recorded:** 32
- **Sample Audit Ledger IDs:** `audit-staff-1791003755180-q19qips`, `audit-staff-1791003755260-gz3i1p7`, `audit-staff-1791003755340-res80go`, `audit-staff-1791003755417-3tfh0ei`, `audit-staff-1791003755493-1748e12`

## PII Redaction Verification (Group C2 Grep Suite)
- **SSN Patterns Detected (`\b\d{3}-\d{2}-\d{4}\b`):** 0
- **Credit Card Patterns Detected:** 0
- **Unsplash Stock Photo URLs:** 0
- **555 Fake Phone Numbers:** 0
- **Invented Agent Names:** 0

## Role Permission Enforcement Matrix
1. **R1. Mike Ford Admin (`master_admin`):** Full Read/Write across all leads & collections, user/role management, 1-click staff revocation.
2. **R2. IT Manager / Peer Tester (`admin` + timed grant):** Read/Write during grant window only. Auto-expires with HTTP 401.
3. **R3. Branch Manager (`admin` + branch):** Scoped strictly to branch leads (e.g. Springfield). Cross-branch reads blocked with HTTP 403.
4. **R4. Loan Officer (`loan_officer` + assigned list):** Scoped strictly to assigned leads. Unassigned access blocked with HTTP 403.
5. **R5. Compliance Auditor (`auditor`):** Full Read-Only access to audit ledger and masked lead data. All write attempts blocked with HTTP 403.
