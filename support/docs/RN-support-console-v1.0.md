# RN — Support-Staff Console v1.0 ⭐ RELEASE NOTES

**Module:** CR-support-console-v1.0 · **Repo:** `mz-support-portal-v3` · **Version:** v1.0.0
**Date:** 2026-09-19 · **Author:** Docs Agent · **Status:** Pre-deploy (Gate 4 — approvals pending)
**Workflow:** new-module · **Priority:** P2
**Docs:** `RS/TD/API/DB-delta/ADR-004-support-console-v1.0`

> ⭐ Release notes are MANDATORY **before** deploy. This document must be approved (Lead + QA) before the module ships.

---

## Summary

The Support-Staff Console is a **new module** giving Mezzofy support agents a **cross-merchant** ticket console: a queue across all merchants, ticket assignment, replies as `SUPPORT`, 7-state status transitions, and resolve/close. It ships as a standalone service `svc-support` (FastAPI/Strawberry/Mangum, GraphQL, port 8005) that serves both the API and the `web-support` SPA (React Clean-Arch/MVVM), plus a **new svc-iam staff-session type** (`sessionType=STAFF`, `merchantId`-less) to authenticate cross-merchant staff. It reads/writes the **same** `mz-platform-dev` table with byte-compatible item writes, so a SUPPORT reply appears on the merchant `web-tickets` view. The message model's long-dormant `senderType=SUPPORT` now finally has a producer.

## New Features

- **Cross-merchant support console** (`web-support`): Queue (`/support/queue`), My Assigned (`/support/my`), and Ticket Detail (`/support/tickets/:id`) with chat panel (5s polling), assign dialog, and a status-transition menu gated by the 7-state machine.
- **`svc-support` GraphQL API** (`POST /support/api/graphql`): `supportTickets`, `supportTicket`, `myAssignedTickets`, `messages`; `assignTicket`, `updateTicketStatus`, `sendSupportMessage`, `markMessagesAsRead`. Full SDL in `API-support-console-v1.0.md`.
- **Ticket assignment**: assign to an agent/team (sparse attrs); first assign on an OPEN ticket auto-advances to IN_PROGRESS; team defaults to the acting agent.
- **Reply as SUPPORT**: `senderType`/`senderId` forced server-side; stored under the ticket's own merchant.
- **svc-iam staff sessions**: new `create_staff_session()` + `create_staff_user()` + `/iam/api/staff/{login,verify-otp,session,seed,dev/token}` REST routes; a `sessionType` discriminator on the session item.
- **i18n ×3** (EN / zh-CN / zh-TW) under the `support.*` namespace.

## Improvements

- Forked the admin `web-tickets` Clean-Arch skeleton and swapped its mock datasource for a **real GraphQL datasource** + write use-cases — reusing badges, pagination, view-model, DI, and i18n.
- `select_merchant` now stamps `sessionType=MERCHANT` + `email` on merchant sessions going forward (no backfill for legacy sessions — treated as MERCHANT).
- `UserResponse.from_dict` tolerant of missing `merchantId`/`roleId` so staff serialization won't `KeyError`.

## Bug Fixes

- **BUG-1 (LOW, Frontend, fixed at Gate 4):** `support-graphql.datasource.ts` error-code classification checked `'INVALID_TRANSITION'` — corrected to the backend's `'INVALID_STATUS_TRANSITION'`.
- **BUG-2 (LOW, Frontend, fixed at Gate 4):** same file checked `'NOT_FOUND'` — corrected to `'TICKET_NOT_FOUND'`.

> Both were surfaced at Gate 3 as one-line datasource fixes. They are **LOW** severity (view-models branch on `error.message`, so end-user UX was already correct; only `.code` was mislabeled → a dead branch). The corrections are applied in the `web-support` working tree and are **Frontend's to commit** before deploy; Tester left `it.fails` guards that flip green once committed. (Docs agent scope is docs-only and does not commit `src`.)

## Breaking Changes

**None.** The module is **additive**: merchant flows are untouched. A staff token presented to the merchant `svc-tickets` API *correctly* 401s (its guard is unchanged). Legacy merchant sessions with no `sessionType` are treated as `MERCHANT` — no backfill.

## Database Changes

- **No migration. No new table. No new GSI.** All additive on the shared `mz-platform-dev` (ap-southeast-1).
- **New sparse Ticket attrs** (written only on assign): `assigneeId`, `assigneeName`, `assignedTeam`, `assignedAt`.
- **New staff SESSION item** variant (`sessionType=STAFF`, no `merchantId`, `staffTeam`, `SUPPORT_TICKETS` permission) and **staff USER** item (`userType=STAFF`, no MEMBER record, admin-seeded).
- Cross-merchant read reuses **existing GSI2**; **GSI3** (assignee/team/status index) is deferred to an Infra scale-trigger. Details in `DB-support-console-delta-v1.0.md`.

## Security

- **Staff-only RBAC** at the auth boundary — real HTTP statuses: **401** (no/invalid token), **403** (valid merchant token, or staff without the permission).
- **Coarse permission** in MVP (presence of `SUPPORT_TICKETS`; no per-action gating).
- **Cross-merchant power isolated in `svc-support`** — the merchant `svc-tickets` guard is untouched.
- Staff tokens are opaque Bearer, validated via GSI1 `TOKEN#` + `expiresAt`. `X-Agent-Id` dev bypass is `development`-only.

## Performance

- Cross-merchant queue = GSI2 read (newest-first) + **in-memory** filter/pagination. **Acceptable <10K tickets** (`DB §8.2`); above that, add GSI3 (deferred, Infra sign-off required). `total` = full match count; `tickets` = current page.

## Testing Coverage (Gate 3, verified on disk 2026-09-19)

| Suite | Result | Scoped coverage |
|-------|:---:|---|
| svc-support (pytest + moto) | **67 pass / 0 fail** | **91%** on new console modules |
| svc-iam staff (pytest) | **15 pass / 0 fail** | **100%** on the 2 new methods |
| web-support (vitest) | **105 pass / 0 fail** | **96.3% stmt / 86.7% branch** |

All >80% on the code this CR adds. moto in-memory `mz-platform-dev` (real GSI1/GSI2 schema, ≥2 merchants) — **no live AWS touched**.

## Documentation

This set (all in `support/docs/`): `RS-support-console-v1.0.md`, `TD-support-console-v1.0.md`, `API-support-console-v1.0.md`, `DB-support-console-delta-v1.0.md`, `ADR-004-support-service-boundary-v1.0.md`, and this `RN-support-console-v1.0.md`.

## Deployment

**Serving model:** a single `svc-support` process (port **8005**) serves BOTH the GraphQL API (`/support/api/graphql`) AND the built `web-support` SPA from `svc-support/public/` (drop the Vite build there). No separate gateway for MVP; port 5182 is the Vite dev server only. svc-iam staff extension deploys with the `svc-iam` service (`mz-merchant-portal-v3`); svc-support validates staff tokens against the shared `mz-platform-dev` (ap-southeast-1).

**MUST-DO staging checklist (residuals not covered by moto — carried from Gate 3):**
1. **Live `mz-platform-dev` run** — Gate 3 used moto by directive; exercise the real table on staging (seed a staff user via `/iam/api/staff/seed` → `/staff/dev/token`, or `X-Agent-Id`; boot `uvicorn main:app --port 8005`).
2. **Cross-service render** — confirm a SUPPORT reply **visibly appears** on the merchant `web-tickets` view (only the enabling mechanism — byte-compatible item under the ticket's merchant — was verified, not the rendered merchant view).
3. **Staff REST / OTP / SQS HTTP flow** end-to-end (`/iam/api/staff/*`, OTP email, SQS) — Gate 3 tested the AuthService primitives, not the HTTP/TestClient path.

**Pre-deploy blocker:** BUG-1/BUG-2 datasource fixes must be **committed** by Frontend (green `it.fails` guards) before ship.

## Known Issues

- **Pre-existing svc-iam test breakage (NOT this CR):** the svc-iam repo has 2 test-collection ImportErrors (stale merchant GraphQL modules) + 3 pre-existing failures (`password_service` ×2, dual-table), env-driven (bcrypt/pydantic pin vs Python 3.13). Not caused by and does not block this CR — confirm on an EC2-parity interpreter and file separately.
- **MVP limitations (backlog, not blockers):** no server-side sort; `AssignAgentDialog` is "assign to me" + manual id/name/team (no agent-directory query); detail timeline derived from timestamps (no status-history audit trail); `merchantName` resolved-on-read, falls back to `merchantId` when absent (never null); coarse RBAC; staff users admin-seeded (no self-service CRUD).
- **Out of MVP scope:** WebSocket realtime (chat = 5s polling); RS §5 richer status set (ASSIGNED/HOLD/COMPLETED/REOPEN — separate future CR); SLA/priority timers.

## Timeline

| Date | Milestone |
|------|-----------|
| 2026-09-18 | Plan + gap-review; Gate 0 PASS (ports/GSI/auth recon); Gate 1 contract FROZEN; Gate 2 PASS (integration) |
| 2026-09-19 | Gate 3 PASS (tests + coverage); Gate 4 docs + release notes (this document) |
| _pending_ | Lead/QA approval → staging checklist → production deploy |

## Approvals

| Role | Name | Status |
|------|------|--------|
| Lead Agent | — | ⏳ Pending |
| QA / Tester | — | ⏳ Pending |
