# RS — Support-Staff Console (Requirements & Scope) v1.0

**Module:** CR-support-console-v1.0 · **Workflow:** new-module · **Priority:** P2
**Status:** Delivered (Gate 3 PASS 2026-09-19; Gate 4 Docs) · **Date:** 2026-09-19 · **Author:** Docs Agent
**Traces to:** `CR-support-console-v1.0-review.md` (blueprint gap analysis) · `CR-support-console-v1.0-plan.md`
**Cross-ref:** merchant `RS-tickets-v1.0.md` (the merchant-side requirements this console complements)

---

## 1. Problem

Mezzofy's Tickets module is **merchant-only**: merchants raise/track tickets and chat, backed by `svc-tickets` + `web-tickets`. There is **no agent-facing console** for support staff to work those tickets across merchants. The message model already defines `senderType=SUPPORT`, but there is **no producer** for it. This module builds that console.

## 2. Scope (in)

A **new module** (`svc-support` + `web-support`, standalone repo `mz-support-portal-v3`) that lets an authenticated **support-staff** agent:

| # | Capability | Notes |
|---|-----------|-------|
| R1 | **Cross-merchant queue** — see tickets across all merchants | GSI2 + in-memory filter (merchantId / status / type / priority / assignee / unassigned / search) |
| R2 | **Assign** a ticket to an agent / team | Sparse attrs; first assign on OPEN auto-advances to IN_PROGRESS; team defaults to acting agent |
| R3 | **Reply as SUPPORT** | `senderType=SUPPORT`, `senderId=agent`; stored under the ticket's merchant → visible on merchant `web-tickets` |
| R4 | **Status transitions** through the 7-state machine | Reuses `STATUS_TRANSITIONS`; illegal → `INVALID_STATUS_TRANSITION` |
| R5 | **Resolve / close** | RESOLVED → CLOSED; `closedAt` stamped |
| R6 | **"My assigned" view** | `myAssignedTickets` pinned to the acting agent |
| R7 | **Staff-only RBAC** | 401 (no/invalid token), 403 (merchant token or staff-without-perm) |
| R8 | **i18n ×3** | EN / zh-CN / zh-TW, `support.*` namespace |
| R9 | **Accessibility & quality** | WCAG 2.1 AA, TypeScript strict, >80% coverage |

Each capability traces to a gap in the companion gap-review:

| Gap (review) | Requirement |
|--------------|-------------|
| Cross-merchant ticket listing (MISSING) | R1 |
| Support-staff identity / role (MISSING) | R7 + staff sessions (svc-iam ext) |
| Ticket → agent assignment (MISSING) | R2, R6 |
| Support-scoped GraphQL surface | R1–R6 (`svc-support` resolvers) |
| `senderType=SUPPORT` had no producer | R3 |

## 3. Scope (out — explicit)

- **RS §5 richer status set** (ASSIGNED / HOLD / COMPLETED / REOPEN) — console follows the **implemented 7-state enum** (OPEN / IN_PROGRESS / PENDING_USER / PENDING_MERCHANT / RESOLVED / CLOSED / CANCELLED). A move to the richer set is a **separate future CR** touching the merchant side (R-5).
- **WebSocket realtime** — MVP chat is 5s polling (ADR-001, R-6).
- **SLA / priority timers** — priority is stored, SLA not built (out of MVP).
- **Full staff self-service / user CRUD** — staff users are admin-seeded in MVP (D3).
- **Agent-directory picker, server-side sort, status-history audit trail** — backlog (see API §8).
- **New GSI3 / merchantName denormalization** — deferred to Infra scale-trigger (R-2, R-7).
- **Extending merchant `svc-tickets`** — explicitly rejected in favor of a new service (see ADR-004).

## 4. Actors

- **Support-staff agent** — authenticated via a `sessionType=STAFF` svc-iam session with a `SUPPORT_TICKETS` permission; cross-merchant, `merchantId`-less.
- (Unchanged) **Merchant** — sees SUPPORT replies land in their existing `web-tickets` thread.

## 5. Non-functional

- **Performance:** in-memory cross-merchant filter acceptable <10K tickets; GSI3 is the scale path.
- **Security:** staff-only; cross-merchant power isolated in `svc-support`; merchant `svc-tickets` guard untouched.
- **Additive data model:** no migration, no new table/GSI.
- **Serving:** `svc-support` (port 8005) serves both the GraphQL API and the SPA; internal tool, off the merchant/admin gateways.

## 6. Acceptance criteria (from plan)

- [x] `supportTickets` returns tickets across >1 merchantId; RBAC-deny for non-staff (403).
- [x] assign + SUPPORT-reply + status transition round-trip (verified via moto + code alignment; **live cross-service render on merchant `web-tickets` is a staging residual**).
- [x] i18n EN/zh-CN/zh-TW; WCAG 2.1 AA; TS strict; >80% coverage.
- [x] All output docs generated (this set).
- [ ] Release notes approved before deploy (Gate 4 — Lead/QA approval pending).
