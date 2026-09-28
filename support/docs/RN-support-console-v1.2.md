# RN — Support-Staff Console v1.2 ⭐ RELEASE NOTES (staff ticket intake)

**Module:** CR-support-ticket-intake (Option C) · **Repo:** `mz-support-portal` · **Version:** v1.2.0
**Date:** 2026-09-28 · **Author:** Docs Agent · **Status:** Pre-deploy (approvals + EC2 integration pending)
**Workflow:** change-request · **Priority:** P1 (gives the console live ticket inflow)
**Builds on:** `RN-support-console-v1.1.md` (the Postgres re-platform, deployed). **Decision:** `ADR-005` addendum.

> ⭐ Approve (Lead + QA) before deploy.

## Summary
Adds **staff ticket intake** to the live console: support agents can log a ticket **on behalf of a merchant** via a **"New ticket"** button on the Queue. This gives the console real ticket inflow without a merchant portal or merchant authentication (Option C). Merchant self-service is deferred (`plans/CR-svc-tickets-postgres-plan.md`).

## New feature
- **`createSupportTicket` mutation** (svc-support) — creates an `OPEN` ticket for a `merchantId`; `userId` = `onBehalfOfUserId` or the acting agent; optional `merchantName` upserts the merchant reference (so the queue shows a name). Reuses the vendored `TicketService.create_ticket` validation (type/priority; subject 3–200; description 10–5000). Staff-JWT gated (non-support → 403).
- **"New ticket" form** (web-support) — button on the Queue → modal (merchantId, merchantName?, type, priority, subject, description) → on success navigates to the new ticket. i18n en/zh-CN/zh-TW.

## No infrastructure change
No DB migration, no new tables, no new auth. Uses the existing `tickets`/`merchants` tables and the deployed staff-JWT gate.

## Deployment (code-only)
`git push` → EC2 `git pull` (mz-support-portal) → rebuild the SPA (`cd support/web-support && npm run build`) → `sudo systemctl restart mezzofy-support`. No `mezzofy-api` change.

## Testing
- Backend: `test_create_ticket_pg.py` (4 integration — service upsert/user-default, GraphQL create+queue, validation error) + RBAC 403 (no DB). Local `pytest → 21 pass / 28 skip`; the 4 integration run on EC2 (`SVC_SUPPORT_TEST_DATABASE_URL`).
- Frontend: `new-ticket-dialog.test.tsx` (4) — `vitest → 109 pass`. No bugs found.

## Known limitations
- **Merchant self-service not included** — staff-created only (Option C). Options A/B/D deferred.
- `merchantId` is free-text (no directory/existence check); `merchantName` upsert mitigates display.
- Attachments accepted by the mutation but the form omits them (S3 storage, ADR-002, not wired).

## Post-deploy
Run the 4 backend integration tests on EC2 + a live smoke: staff clicks "New ticket" → fills → submits → the ticket appears in the queue and opens; a non-staff token → 403.

## Approvals
- [x] Lead (2026-09-28) · [ ] QA — pending. Lead-approved for deploy; QA sign-off after the EC2 integration run + live smoke.
