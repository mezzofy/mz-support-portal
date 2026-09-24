# TD — Support-Staff Console (Technical Design) v1.0

**Module:** CR-support-console-v1.0 · **Repo:** `mz-support-portal` (NEW standalone)
**Status:** Implemented (Gate 3 PASS 2026-09-19) · **Date:** 2026-09-19 · **Author:** Docs Agent
**Companion:** `API-support-console-v1.0.md` · `DB-support-console-delta-v1.0.md` · `ADR-004-support-service-boundary-v1.0.md`
**Cross-ref:** merchant ticketing `TD-tickets-v2.0.md`, `ADR-001..003` (this module reuses those patterns unchanged)

> ⚠️ **Data layer + auth re-platformed by [ADR-005](ADR-005-support-postgres-repivot-v1.0.md) (Option B).** The **standalone `svc-support` design + CSR layering + GraphQL surface below still stand.** What changed: the **repository layer** is now **synchronous psycopg2 on `mezzofy_ai` PostgreSQL** (not boto3/DynamoDB; cross-merchant queue = SQL `WHERE … ORDER BY created_at DESC LIMIT/OFFSET`, not GSI2 + in-memory), and **auth reuses the mz-ai-assistant JWT** (not svc-iam opaque tokens). Schema: `DB-support-console-postgres-v2.0.md`.

---

## 1. Goal

Give Mezzofy support staff an agent-facing console to work tickets **across all merchants**: a cross-merchant queue, assign to an agent/team, reply as `SUPPORT`, move status through the 7-state machine, and resolve/close. Built as a **new module**, not an extension of the merchant `svc-tickets`.

## 2. Component overview

```
mz-support-portal/
└── support/
    ├── svc-support/            # NEW FastAPI + Strawberry + Mangum service (port 8005)
    │   ├── src/                #   route /support, GraphQL /support/api/graphql, health /support/health
    │   └── public/            #   built web-support SPA served statically (Frontend-owned, gitignored)
    └── web-support/            # NEW React + Clean-Arch/MVVM SPA (Vite dev 5182, route /support)
```

Two units, one repo:

| Unit | Stack | Pattern | Serves |
|------|-------|---------|--------|
| `svc-support` | Python FastAPI + Strawberry GraphQL + Mangum | CSR (Controller-Service-Repository), vendored ticket domain | GraphQL API **and** the SPA from `public/` |
| `web-support` | React + TypeScript + Vite | Clean Architecture + MVVM (Zustand) | Built into `svc-support/public/` |

## 3. Serving model (DECIDED 2026-09-18)

Mirrors `svc-tickets`: a **single process** (`svc-support`, port **8005**) serves **both** the GraphQL API at `/support/api/graphql` **and** the built `web-support` SPA from `public/` at `/support`. **No separate gateway for MVP.** Port **5182** is the Vite dev server only. The module is an internal cross-merchant staff tool and is deliberately kept **off** the merchant/admin gateways. See `ADR-004`.

## 4. Backend — `svc-support` (CSR)

Standalone FastAPI service that reads/writes the **same** `mz-platform-dev` table with the **identical** `TICKET#` / `MESSAGE#` item layout as `svc-tickets`, so writes stay byte-compatible with the merchant view. It **vendors** the small shared domain from `svc-tickets` **unchanged** rather than calling the merchant GraphQL API (that API mandates `merchantId` and self-filters). ~35 files, ~1970 py LOC.

### 4.1 Layering

```
controllers/graphql/**   (Controller → GraphQL types/inputs/resolvers + context)
services/**              (Service → business logic: ticket_service, message_service)
repositories/**          (Repository → DynamoDB access: ticket_repository, message_repository, merchant_repository)
auth/**                  (staff auth boundary)
core/**                  (config, database, errors, utils/constants)
```

### 4.2 Vendored unchanged from `svc-tickets`

`core/database.py`, `core/utils/constants.py` (extended, not rewritten), `repositories/message_repository.py`, `services/ticket_service.py`, `services/message_service.py`. This keeps item writes byte-compatible. Tradeoff: minor duplication (Risk R-3, accepted per the "new module" decision).

### 4.3 New / changed for the console

- **`auth/dependencies.py`** — `resolve_agent_context()` (the function the design called `get_current_agent`): validates the Bearer token via GSI1 `TOKEN#{token}` + `expiresAt`, requires `sessionType == STAFF` **and** a `SUPPORT_TICKETS` permission (else 403), and builds `SupportContext{ agentId=userId, agentName=email, team=staffTeam, permissions }`. `X-Agent-Id` dev bypass when `ENVIRONMENT=development`. Auth is enforced in the GraphQL `context.py` boundary — 401/403 are **real HTTP statuses**, not GraphQL errors.
- **`repositories/ticket_repository.py`** — `list_all_cross_merchant()` (GSI2 query, newest-first, **minus** the merchant filter) + `assign()` writing the 4 sparse attrs via the existing dynamic `update()`.
- **`repositories/merchant_repository.py`** — resolves `merchantName` on read from the `MERCHANT#` item's `name` (falls back to `merchantId` when absent — never null).
- **`controllers/graphql/**`** — `SupportTicket` / `Message` types + inputs + resolvers implementing the frozen SDL exactly.

### 4.4 Cross-merchant read strategy

`supportTickets` / `myAssignedTickets` query **existing GSI2** (`ENTITY#TICKET`, newest-first), then refine **in memory** by status / type / priority / assignee / unassigned / search. Pagination is in-memory over the full match set. **No new GSI** — GSI3 (an assignee/team/status index) is **deferred** to an Infra scale-trigger (R-2). See DB-delta §2 and §6 below.

## 5. Frontend — `web-support` (Clean-Arch / MVVM)

Forked from the admin `web-tickets` Clean-Arch skeleton (`TicketStatusBadge`, `TicketPriorityBadge`, `Pagination`, `useTicketListViewModel`, entity enums, `toDynamicValue()` DI, i18n). That entity already carries `merchantName` and its mock datasource already searched by it — it was already a cross-merchant read model. **The only structural change was replacing the mock datasource with a real GraphQL datasource and adding write use-cases.** ~68 files.

```
domain/{entities,repositories,usecases}
data/{datasources,mappers,repositories}      # support-graphql.datasource.ts = real GraphQL client
presentation/features/support/{pages,components,viewmodels,hooks}
core/di                                        # toDynamicValue() DI
i18n/                                          # support.* namespace in en / zh-CN / zh-TW
```

- **Pages:** `QueuePage` `/support/queue` · `MyAssignedPage` `/support/my` · `SupportTicketDetailPage` `/support/tickets/:id` (info + status history + `SupportChatPanel` polling; `AssignAgentDialog`; `StatusTransitionMenu` gated by `STATUS_TRANSITIONS[current]`).
- **Chat:** MVP = 5s polling (ADR-001), not WebSocket (R-6).
- **i18n:** namespaced `support.*` across EN / zh-CN / zh-TW (×3 parity verified at Gate 3).
- **Datasource auth:** sends `Authorization: Bearer` or `X-Agent-Id`; surfaces backend error codes.

## 6. Performance & scale

- **In-memory cross-merchant filter** is acceptable **<10K tickets** (DB §8.2). Above that, the queue read cost grows with total ticket count.
- **Scale trigger (deferred, R-2):** add **GSI3** (`AGENT#{assigneeId}` / `TEAM#` / `UNASSIGNED` → `{status}#{createdAt}`) to serve "my assigned" / "unassigned" / team queues directly, replacing the in-memory refine. Requires Infra sign-off on the shared `mz-platform-dev`.

## 7. Security

- **Staff-only RBAC** at the auth boundary: 401 (no/invalid token), 403 (merchant token or staff-without-perm). Cross-merchant power is **isolated in `svc-support`** — the merchant `svc-tickets` 401 guard is untouched (a staff token presented to the merchant API correctly 401s).
- **Coarse permission** (`SUPPORT_TICKETS` presence) in MVP; no per-action gating.
- Staff tokens are opaque Bearer, validated via GSI1 `TOKEN#` + `expiresAt`.

## 8. Testing (Gate 3, verified on disk)

| Suite | Result | Scoped coverage |
|-------|:---:|---|
| svc-support (pytest + moto) | 67 pass / 0 fail | 91% on new console modules |
| svc-iam staff (pytest) | 15 pass / 0 fail | 100% on the 2 new methods |
| web-support (vitest) | 105 pass / 0 fail | 96.3% stmt / 86.7% branch |

moto in-memory `mz-platform-dev` (real GSI1/GSI2 schema, ≥2 merchants); no live AWS touched. Live data-path is a staging residual (see RN §Deployment).

## 9. Deviations & MVP limitations

- **merchantName** resolved-on-read; falls back to `merchantId` when the `MERCHANT#` record has no name (never null). TODO: denormalize/index.
- **svc-iam REST:** the merchant `auth_controller` REST router was not mounted in this repo's `svc-iam/src/main.py`; a **separate** `staff_controller` was added and only that mounted (`/iam/api/staff/*`), leaving merchant auth untouched. Any merchant-REST login need is a pre-existing gap, not this CR.
- No server-side sort, no agent-directory query, no status-history array (all backlog — see API §8).
