# Geo property-note routing and TCPA safety gate — development branch

Status: **staged, not production approved**.

## Property notes
- The buyer's stored pairing ID is resolved through Firestore on each thread read.
- No Mike Ford fallback for missing loan-officer records. LO profile may be null.
- Existing cached/legacy threads are rehydrated with the current verified pairing.
- Notes use a fixed Geo reply and **no Gemini-generated buyer-facing prose**.
- Property note TCPA checkbox field is ignored; it is not SMS consent.
- A successful note write awaits Firestore. The in-memory cache is updated after persistence.
- Auto-push-to-Mike was removed from the note path: saved note does not imply a notification was delivered.
- No production outbound notification or assigned-team delivery is claimed.

## TCPA
- New staged module is **not wired to the intake endpoint**.
- Explicit affirmative intake checkbox is required by the API.
- Grant/revocation + audit chain head/event are committed in one Firestore transaction.
- Grant status is read from Firestore; no memory cache can re-enable a revoked consent.
- Missing storage fails closed; outbound SMS function remains dormant.
- The provided draft used in-memory consent, asynchronous best-effort writes, and an in-memory hash chain. Those are intentionally not used as authority.

## Deployment blockers / follow-up
1. Review the intake UI's exact checkbox and disclosure; bind server-verified explicit consent to the transactional API only after legal/compliance signoff.
2. Verify all outbound SMS providers/routes call the consent gate immediately before send; handle STOP independently of marketing opt-in.
3. Check Firestore IAM/security rules, audit retention, chain verification, and multi-instance transaction contention.
4. Align House Finder's property thread collection with the FTHB native CRM's conversation stream.
5. Add a confirmed, role-authorized LO/agent routing and notification workflow. Do not confuse a saved note with a delivered notification.
6. Run TypeScript lint and tests in CI, review UI handling of nullable LO profiles, and exercise Firestore failure/concurrent-write tests.
7. Review the older /api/muse/chat generative path and disable or migrate it before claiming scripted-only behavior systemwide.
8. Existing recordAuditLedger remains in-memory in the repository; do not treat it as a durable regulatory audit log until separately hardened.
