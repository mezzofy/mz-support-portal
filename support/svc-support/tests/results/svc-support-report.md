# Test Report — svc-support (CR-support-console-v1.0, Gate 3)

**Agent:** Tester (backend) · **Date:** 2026-09-19 · **Repo:** `mz-support-portal-v3/support/svc-support`
**Environment:** Windows 11, Python 3.13.14, isolated venv, **moto 5.0.0** in-memory `mz-platform-dev` (no live AWS).

## Result

| | |
|---|---|
| **Tests** | **67 passed, 0 failed** |
| **Overall coverage (whole `src/`)** | **81%** |
| **Scoped coverage (new/extended support-console modules)** | **91%** |
| Command | `pytest tests --cov=src --cov-report=term-missing` |

Overall 81% is dragged down by `main.py` (0% — the ASGI/uvicorn bootstrap, not unit-testable here)
and the vendored-unchanged `ticket_service.py`/`message_service.py` code paths (create/update ticket,
scan fallback) that the console never calls. Every **new** console module is ≥76%, most 97–100%.

### Coverage of the modules this CR actually added / changed

| Module | Cover | Note |
|--------|:-----:|------|
| `services/support_ticket_service.py` (NEW orchestration) | 97% | cross-merchant list, assign, status, reply, markRead, merchantName |
| `controllers/graphql/resolvers/support_resolvers.py` (NEW) | 88% | misses = `except SupportError` re-raise lines already proven on other fields |
| `controllers/graphql/errors.py` (error→extensions map) | 100% | |
| `controllers/graphql/types/*` + `inputs/*` (NEW SDL) | 100% | |
| `auth/dependencies.py` (RBAC) | 97% | |
| `controllers/graphql/context.py` (401/403 HTTP boundary) | 97% | |
| `auth/token_service.py` (opaque token → SESSION) | 91% | misses = DynamoDB error branch |
| `repositories/ticket_repository.py` (extended: `list_all_cross_merchant`, `assign`) | 76% | new methods fully hit; misses = vendored `list_all`/`create`/scan-fallback/`delete` |
| `repositories/merchant_repository.py` (NEW, resolve-on-read) | 78% | misses = the `except`/empty-id guards |
| **Scoped TOTAL (the table above)** | **91%** | > 80% target ✓ |

## What was verified (maps to the Gate-3 checklist)

- **Cross-merchant list** — `supportTickets` returns tickets from >1 merchantId (merchant filter proven
  dropped); `merchantId / status / type / priority / assigneeId / unassigned / search` each narrow;
  invalid enum → `VALIDATION_ERROR`.
- **Pagination** — `total` = full match count, `tickets` = the page slice; pages disjoint and complete.
- **Assign** — writes `assigneeId/assigneeName/assignedTeam/assignedAt`; `assignedTeam` defaults to the
  acting agent's team when omitted; **first assign on an OPEN ticket auto-advances to IN_PROGRESS**;
  assign on a non-OPEN ticket keeps its status; invalid team → `VALIDATION_ERROR`; missing ticket →
  `TICKET_NOT_FOUND`.
- **Status machine** — 9 legal edges accepted, 7 illegal edges rejected with
  `INVALID_STATUS_TRANSITION` (incl. CLOSED/CANCELLED terminal); closing stamps `closedAt`.
- **Support reply** — `sendSupportMessage` forces `senderType=SUPPORT` + `senderId=<acting agent>` and
  stores the message under the **ticket's own merchantId**; attachments pass through; missing ticket →
  `TICKET_NOT_FOUND`.
- **Read receipts** — `markMessagesAsRead(ticketId, agentId)` marks only the *other* side's (USER)
  messages read, never the agent's own.
- **RBAC (`resolve_agent_context`)** — no/malformed/invalid token → 401; expired token → 401;
  valid MERCHANT session → 403; STAFF session lacking `SUPPORT_TICKETS` → 403; valid STAFF → SupportContext;
  `X-Agent-Id` dev bypass works only when `ENVIRONMENT=development` (ignored in production).
- **HTTP boundary** — `get_context()` surfaces those as real HTTP 401/403 (not GraphQL `errors`).
- **merchantName resolve-on-read (R-7)** — resolved from the `MERCHANT#` item; falls back to the raw
  `merchantId` (never null) when the merchant record/name is absent.
- **GraphQL error contract** — errors carry `extensions.code` + `extensions.status_code`.

## Test files
- `tests/conftest.py` — moto `mz-platform-dev` (PK/SK + GSI1 + GSI2, PAY_PER_REQUEST) + `Seeder`.
- `tests/test_support_ticket_service.py` — 37 service-layer tests.
- `tests/test_auth_rbac.py` — 13 RBAC / dev-bypass / HTTP-mapping tests.
- `tests/test_graphql_resolvers.py` — 17 schema-execution tests (frozen SDL + error codes).

## BUGS

**None found.** All observed behaviour matches the frozen Gate-1 contract and the backend→frontend handoff.

### Minor observations (not bugs — behaviour is correct)
1. `services/ticket_service.py:195` uses the string literal `'CLOSED'` instead of the
   `TICKET_STATUS_CLOSED` constant it uses everywhere else (`if new_status in (TICKET_STATUS_CANCELLED, 'CLOSED')`).
   Value is identical, `closedAt` is stamped correctly (verified); purely a consistency nit in vendored code.

## Not covered here (and why)
- **Live AWS / real `mz-platform-dev`** — by directive, used moto in-memory. moto reproduces the GSI2
  key schema and `ScanIndexForward` ordering, but does not exercise real DynamoDB throughput/consistency.
- **Cross-service end-to-end visibility on the merchant `web-tickets` view** — that a SUPPORT reply
  actually *renders* for the merchant lives in svc-tickets + web-tickets, outside this repo. Verified only
  the mechanism that enables it: the reply is stored under the ticket's own merchantId with
  `senderType=SUPPORT` in the byte-compatible item shape.
- **`main.py` ASGI wiring / static SPA serving** — needs a running server (integration), not unit scope.
