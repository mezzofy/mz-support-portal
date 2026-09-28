# Test Report — CR-support-ticket-intake (Option C, createSupportTicket) — Task 3

**Date:** 2026-09-28 · **Agent:** Tester. Covers the staff ticket-intake mutation (svc-support) + the "New ticket" form (web-support).

## Backend (svc-support/tests)
- `test_create_ticket_pg.py` (NEW, integration ×4): service `create_ticket` upserts the merchant + returns OPEN; merchantName falls back to id when omitted + userId defaults to the agent; GraphQL `createSupportTicket` returns the ticket and it appears in the queue; validation error (subject < 3) surfaces as a GraphQL error.
- `test_auth_rbac.py` (+1, no DB): `createSupportTicket` with a non-support role → **403** (gated before the resolver).

Local run: `python -m pytest tests/ -q` → **21 passed, 28 skipped**. The 4 create-integration tests auto-skip (no local Postgres) and **run on EC2** with `SVC_SUPPORT_TEST_DATABASE_URL` (Gate 3 coverage). The 403 deny is verified locally.

## Frontend (web-support/tests)
- `components/new-ticket-dialog.test.tsx` (NEW ×4): hidden when closed; submit gated until merchantId + subject(≥3) + description(≥10) are valid; submit emits the trimmed payload with `type=GENERAL`/`priority=MEDIUM` defaults; cancel fires `onClose`.

Local run: `npx vitest run` → **11 files, 109 passed** (was 105; +4). Build stays clean (tsc strict + vite).

## Verdict
No bugs found. Backend create path verified at the RBAC boundary locally + covered by integration on EC2; FE dialog behaviour fully verified locally. Remaining for the CR: run the 4 backend integration tests on EC2 (Gate 3) + the live smoke after deploy.
