# ADR-004 — Support-Console Service Boundary & Staff Auth v1.0

**Module:** CR-support-console-v1.0 · **Status:** ACCEPTED (2026-09-18, implemented; Gate 3 PASS 2026-09-19)
**Date:** 2026-09-19 · **Author:** Docs Agent · **Deciders:** Lead Agent + stakeholder (human, 2026-09-18)
**Cross-ref:** merchant ticketing `ADR-001` (realtime), `ADR-003` (search); `TD-support-console-v1.0.md`
**Supersedes/relates:** builds on the ticketing ADR series (this is ADR-004 in the platform sequence)

---

## Context

The support console must read/write tickets **across all merchants** and mint an actor identity for support staff. Two things stood in the way:

1. **The merchant `svc-tickets` API is hard-scoped to one `merchantId`** from the session token — every layer self-filters, and the auth guard 401s any token "missing merchant context." It cannot serve a cross-merchant actor.
2. **svc-iam had NO internal staff role** (Gate 0 finding, R-1): every session is merchant-bound; "Staff" existed only as a per-merchant employee role. The earlier assumption that staff roles existed was **FALSE**.

We needed to decide (a) **where the cross-merchant logic lives** and (b) **how support staff authenticate**.

## Decision

**(A) A NEW standalone `svc-support` service** — not an extension of the merchant `svc-tickets`. It reads/writes the **same** `mz-platform-dev` table with the **identical** `TICKET#` / `MESSAGE#` item layout, **vendoring** the small shared ticket domain from `svc-tickets` **unchanged**, so writes stay byte-compatible with the merchant view. It does **not** call the merchant GraphQL API (that API mandates `merchantId` + self-filters). Hosted in a **new standalone repo** `mz-support-portal`, kept off the merchant/admin gateways.

**(B) A NEW svc-iam staff-session type** — a `sessionType` **discriminator** on the session item, with a **`merchantId`-less** staff session (`sessionType=STAFF`, `staffTeam`, `SUPPORT_TICKETS` permission), minted by a new `create_staff_session()` path — rather than reusing/bending merchant auth. svc-support owns its own auth boundary (`resolve_agent_context`), gating on `sessionType==STAFF` + the `SUPPORT_TICKETS` permission.

## Options considered

| Option | Description | Verdict |
|--------|-------------|---------|
| **1. Extend `svc-tickets`** to be cross-merchant | Add a staff mode to the merchant Lambda | ❌ Rejected — puts cross-merchant power in the merchant Lambda; risks the merchant 401 guard; couples two audiences |
| **2. Call the merchant GraphQL API** from a thin console | Reuse the existing API | ❌ Rejected — that API mandates `merchantId` and self-filters; can't read cross-merchant |
| **3. NEW `svc-support`, vendored domain** | Standalone service on the shared table | ✅ **Chosen (A)** — isolates cross-tenant power; byte-compatible writes; merchant guard untouched |
| **4a. Reuse merchant auth** (merchant-bound session) | Give staff a merchant session | ❌ Rejected — no cross-merchant identity; svc-tickets 401s without `merchantId` |
| **4b. Discriminator = absence of `merchantId`** | Infer staff by missing field | ❌ Rejected — implicit/fragile; legacy sessions ambiguous |
| **4c. NEW `sessionType=STAFF` discriminator** | Explicit staff session type | ✅ **Chosen (B)** — explicit branch; legacy = MERCHANT by default; no backfill |

## Consequences

**Positive**
- **svc-tickets merchant guard is UNTOUCHED** — a staff token presented to the merchant API *correctly* 401s; blast radius of the svc-iam change is small (svc-iam only *gains* a mint path).
- **Cross-tenant power is isolated** in `svc-support`, away from the merchant Lambda.
- **Byte-compatible writes** — a SUPPORT reply lands under the ticket's own merchant and shows on merchant `web-tickets`.
- **Explicit `sessionType`** branch; existing merchant sessions (no `sessionType`) treated as `MERCHANT` with **no backfill**; `select_merchant` now stamps `sessionType=MERCHANT` going forward.
- Additive data model — no migration, no new table/GSI.

**Negative / accepted tradeoffs**
- **Vendored duplication** of the small shared ticket domain (`core/database.py`, `constants.py`, message repo, ticket/message services) — accepted per the "new module" choice (Risk R-3). Divergence risk if svc-tickets' domain changes; mitigated by vendoring **unchanged**.
- **Coarse RBAC** in MVP (presence of `SUPPORT_TICKETS`, no per-action gating).
- **Staff users admin-seeded** in MVP (no self-service CRUD yet).
- The merchant `auth_controller` REST router isn't mounted in this repo's `svc-iam/main.py`; a **separate** `staff_controller` was added (`/iam/api/staff/*`) — a pre-existing merchant-REST gap surfaced but left as-is.

## Related decisions (settled at Gate 1)

- **D1** — permission vocab reuses `VIEW/ADD/EDIT/APPROVE` on `SUPPORT_TICKETS` (not new `ASSIGN/REPLY/RESOLVE`).
- **D2** — staff reuse the existing email+OTP login flow (`/iam/api/staff/*`).
- **D3** — staff users admin-seeded for MVP (full CRUD deferred).
- **D4** — single `staffTeam` per agent (multi-team deferred).
- **R-5** — the implemented 7-state enum, not RS §5's richer set.
