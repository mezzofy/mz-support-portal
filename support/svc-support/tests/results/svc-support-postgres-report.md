# svc-support Test Report — CR-support-postgres-repivot (Task 5)

**Date:** 2026-09-24 · **Agent:** Tester · **Supersedes:** `svc-support-report.md` (the moto/DynamoDB suite).

The suite was re-platformed from moto/DynamoDB to **PostgreSQL + mz-ai JWT auth** (Option B).

## Composition (2 tiers)
| Tier | File | Tests | Needs DB? |
|------|------|:---:|---|
| Auth RBAC (unit) | `test_auth_rbac.py` | 20 | No — runs everywhere |
| Repositories (integration) | `test_repositories_pg.py` | 12 | Yes |
| Support service (integration) | `test_support_service_pg.py` | 9 | Yes |
| GraphQL end-to-end (integration) | `test_graphql_pg.py` | 4 | Yes |

Integration auto-skips unless **`SVC_SUPPORT_TEST_DATABASE_URL`** points at a DEDICATED test DB (the `pg` fixture TRUNCATEs tickets/messages/merchants — it never falls back to `DATABASE_URL`, so a real/prod DB is never truncated).

## Local run (no Postgres here — matches project norm)
```
python -m pytest tests/ -q          → 20 passed, 24 skipped
```
- **20/20 auth + HTTP-boundary tests pass** (real JWTs): valid support_agent/manager/admin→context;
  non-support role→403; device token→403; missing/malformed/garbage/expired/non-access→401; dev X-Agent-Id bypass;
  and HTTP 401/403/200 at the GraphQL boundary (auth resolves before any DB call).
- **24 integration tests collect cleanly and auto-skip** (imports verified: repos, services, resolvers, ulid).
- Coverage (local): the auth path + config/constants/errors are 100% (19 files fully covered); TOTAL 52%
  because the DB-touching modules (repositories/services/resolvers) run only under the integration tier.

## MUST run on EC2 at Gate 2/3 (the >80% coverage gate + real-SQL verification)
Local has no Postgres/docker; per project norm integration runs on EC2 with the real DB:
```
export SVC_SUPPORT_TEST_DATABASE_URL="postgresql://mezzofy_ai:***@localhost:5432/mezzofy_ai_test"
cd support/svc-support && python -m pytest tests/ -q            # runs all 44
```
Use a DEDICATED `mezzofy_ai_test` DB (the fixture truncates). The integration tier is what
validates the real psycopg2 SQL (JSONB, ILIKE, ANY(), RETURNING, FK cascade, CHECK enums) and
raises the measured coverage over 80% — mirrors the mz-ai rule that driver-level bugs only surface
against a live DB.

## Behaviour covered by the integration tier (frozen contract)
Repo: create/get round-trip (JSONB attachments, ISO tz), cross-merchant list + merchant/status/type/
priority/assignee/unassigned/search filters + pagination + total, update (updated_at + full row) &
TicketNotFoundError, assign sparse attrs, delete FK-cascade, message create/list-chronological/
mark-read (other-side-only). Service: merchantName resolve + fallback, assign auto-advance OPEN→IN_PROGRESS,
status state-machine (legal + illegal→INVALID_STATUS_TRANSITION + closedAt on CLOSED), send_support_message
forces senderType=SUPPORT/senderId=agent under the ticket's merchant. GraphQL: supportTickets query,
assignTicket + sendSupportMessage + updateTicketStatus(illegal→error) via HTTP → resolver → service → PG.

## Residuals (belong to deploy/staging, not unit tests)
1. Live cross-service render (SUPPORT reply visible on merchant web-tickets) — svc-tickets deferred.
2. Real mz-ai JWT interop (a token minted by the live mz-ai server, not the test signer) — Gate 2 smoke.
3. mz-ai CORS + a seeded support_agent user — see `issues/frontend.md` (Backend/Infra).
