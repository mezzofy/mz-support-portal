# ADR-005 — Support Ticketing Data + Auth Re-platform: DynamoDB → EC2 Postgres (Option B)

**Module:** CR-support-postgres-repivot · **Status:** ACCEPTED (2026-09-23, human) — implemented (Gates 1–? in progress)
**Date:** 2026-09-24 · **Author:** Docs Agent · **Deciders:** Lead Agent + stakeholder (human, 2026-09-23)
**Cross-ref:** `ADR-004-support-service-boundary-v1.0.md` (partially superseded — see below),
`DB-support-console-postgres-v2.0.md`, `RN-support-console-v1.1.md`, Lead `CR-support-postgres-repivot-plan.md` + `-review-gate1.md`
**Supersedes (in part):** ADR-004's **datastore** (DynamoDB) and **staff-auth mechanism** (opaque `sessionType=STAFF` token). ADR-004's **service-boundary** decision (a standalone `svc-support`) still stands.

---

## Context — the finding

CR-support-console-v1.0 was built, tested (moto), documented, and stood up on EC2. The first **live** GraphQL query returned `ResourceNotFoundException`: the DynamoDB single-table **`mz-platform-dev` does not exist** in account `075872741045` / `ap-southeast-1`. That account's 39 DynamoDB tables are **per-brand coupon** tables (`ccbcampaign_*`, `hyatt_prod`) — a different design. The entire ticketing stack (`svc-iam`, `svc-tickets`, `svc-support`) was coded against a DynamoDB store **that was never provisioned**. The real Mezzofy datastore for this system is **PostgreSQL on the EC2** (`mezzofy_ai` + Redis + Celery), which also already has a full auth stack (a `users` table with `support_agent`/`support_manager` roles, JWT, Redis sessions).

## Decision

**Option B — re-platform the ticketing/support DATA LAYER from DynamoDB to the EC2 `mezzofy_ai` PostgreSQL, and CONSOLIDATE auth onto the mz-ai-assistant JWT.** (Option A — provision an empty DynamoDB `mz-platform-dev` — was rejected: it keeps a second datastore the platform doesn't otherwise use.)

Frozen sub-decisions (Gate 1, 2026-09-23):
- **D1 (store):** reuse `mezzofy_ai` (`public` schema); tables created via `CREATE TABLE IF NOT EXISTS` in `server/scripts/migrate_tickets.sql` (no alembic — matches the project convention).
- **D2 (auth):** **drop `svc-iam` for the console.** Staff = `mezzofy_ai` `users` with role `support_agent`/`support_manager`. `svc-support` validates the mz-ai access token (HS256, shared `JWT_SECRET`) and gates on the `role` claim. Replaces the DynamoDB opaque-token `sessionType=STAFF` + `SUPPORT_TICKETS` gate.
- **D3 (scope):** DEFER the merchant `svc-tickets` re-platform (it is greenfield — never deployed, no data); stand the console up first against Postgres + seeded tickets.

## Options considered

| Option | Description | Verdict |
|--------|-------------|---------|
| **A. Provision DynamoDB** `mz-platform-dev` and keep the stack on DynamoDB | Create the missing single table (+GSI1/GSI2) | ❌ Rejected — adds a datastore the platform doesn't otherwise run; auth + data would diverge from `mezzofy_ai` |
| **B. Re-platform to `mezzofy_ai` Postgres + reuse mz-ai auth** | Rewrite the repository layer to psycopg2/Postgres; validate mz-ai JWTs | ✅ **Chosen** — one datastore, one auth system; the CSR repositories are the clean swap point |
| Staff-auth: port svc-iam's session model to Postgres | Re-implement the opaque-token staff-session subset on PG | ❌ Rejected (D2) — `mezzofy_ai` already has users + JWT + `support_*` roles; reuse is smaller and consolidates auth |

## What changed (vs ADR-004 / v1.0)

- **Datastore:** DynamoDB single-table (`TICKET#`/`MESSAGE#`/`MERCHANT#`, GSI1/GSI2) → relational `tickets` / `messages` / `merchants` in `mezzofy_ai` (see `DB-support-console-postgres-v2.0.md`).
- **Repositories:** boto3 → **synchronous psycopg2** (kept sync so the vendored ticket/message **services and GraphQL resolvers are UNCHANGED**). Cross-merchant "fetch-all + in-memory refine" → SQL `WHERE … ORDER BY created_at DESC LIMIT/OFFSET`.
- **Auth:** svc-iam opaque token + `sessionType=STAFF`/`SUPPORT_TICKETS` (GSI1 `TOKEN#` lookup) → **mz-ai JWT** (`token_service` decodes locally with the shared secret; `get_current_agent` gates on `role ∈ {support_agent, support_manager}` or `*`). Device-bound tokens rejected. Dev `X-Agent-Id` bypass retained (dev only).
- **web-support login:** the external svc-iam redirect → an **in-app 2-step login** against mz-ai `/auth/login` + `/auth/verify-otp` (JWT stored in the same slot; the GraphQL data layer + SDL are unchanged).
- **svc-iam staff-session extension** (branch `eric-product-design`, commits `337c703c`+`0541c0ea`) is **SUPERSEDED / parked** — not part of Option B.

## Preserved (kept the value already built)

- The **GraphQL SDL + auth contract shape** (the Gate-1 frozen surface): `web-support` and all resolvers/services are untouched (D2 changes only login/token acquisition + the repo internals).
- ADR-004's **standalone `svc-support` service boundary** (a separate service, not an extension of merchant `svc-tickets`).
- The 7-state machine, sender types, sparse assignment model, `merchantName` resolve-on-read.

## Consequences

**Positive** — one datastore + one auth system; no DynamoDB/IAM/GSI dependency in the running path; the CSR repository layer proved to be a clean, contained swap point; clean greenfield build (no data migration).

**Negative / accepted** — synchronous psycopg2 in an otherwise async FastAPI service (acceptable for an internal, low-QPS console; a threadpool/async repo layer is a future option); a small `merchants` reference table replaces the DynamoDB `MERCHANT#` item and is seeded (not yet fed by a live merchant directory); cross-service `svc-tickets` on Postgres is deferred, so merchant-side ticket creation into the same tables is a follow-on CR.

## AWS cleanup (the DynamoDB path is dead)

The dedicated `svc-support` IAM user + inline DynamoDB policy + access key + EC2 `[svc-support]` profile + systemd `aws.conf` drop-in were all for DynamoDB → remove/deactivate unless S3 attachments (ADR-002) keep an AWS need. `ec2-website-deploy` was never modified.
