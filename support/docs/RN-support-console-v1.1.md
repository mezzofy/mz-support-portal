# RN — Support-Staff Console v1.1 ⭐ RELEASE NOTES (Postgres re-platform)

**Module:** CR-support-postgres-repivot · **Repo:** `mz-support-portal` (+ `mz-ai-assistant/server/scripts`) · **Version:** v1.1.0
**Date:** 2026-09-24 · **Author:** Docs Agent · **Status:** Pre-deploy (approvals + EC2 integration pending)
**Workflow:** change-request (re-platform) · **Priority:** P1 (unblocks go-live)
**Docs:** `ADR-005`, `DB-support-console-postgres-v2.0`, and the v1.0 set (superseded where noted)
**Supersedes:** `RN-support-console-v1.0.md` — v1.0 targeted a DynamoDB store that **never existed in the account**, so it never deployed. v1.1 is the shippable state.

> ⭐ Release notes are MANDATORY **before** deploy. Approve (Lead + QA) before shipping.

---

## Summary

The Support-Staff Console has been **re-platformed from DynamoDB to the EC2 `mezzofy_ai` PostgreSQL**, and its **auth consolidated onto the mz-ai-assistant JWT** (Option B, ADR-005). Functionally the console is unchanged — a cross-merchant queue, assignment, replies as `SUPPORT`, the 7-state machine — but it now runs entirely on the platform's real datastore and auth, with **no DynamoDB and no svc-iam** in the running path. The GraphQL API surface (SDL) is unchanged.

## What changed vs v1.0

- **Datastore:** DynamoDB single-table → relational `tickets`/`messages`/`merchants` in `mezzofy_ai` (schema `server/scripts/migrate_tickets.sql`; see `DB-support-console-postgres-v2.0.md`). Clean greenfield — **no data migration**.
- **Repositories:** boto3 → synchronous psycopg2 (services + resolvers untouched); cross-merchant filter/paginate pushed into SQL.
- **Auth:** svc-iam opaque token (`sessionType=STAFF`) → **mz-ai-assistant JWT**. `svc-support` validates it locally (HS256, shared `JWT_SECRET`) and gates on `role ∈ {support_agent, support_manager}` (or admin `*`); device tokens rejected. Staff are `mezzofy_ai.users` with those roles.
- **web-support login:** external svc-iam redirect → **in-app 2-step login** (email+password → OTP) against mz-ai `/auth/login` + `/auth/verify-otp`; JWT stored and sent as Bearer. Rest of the SPA unchanged.
- **svc-iam staff-session extension** (branch `eric-product-design`) is **SUPERSEDED / parked** — not deployed.

## Deployment (net-new service; NOT a code-only pull)

**Prereqs on EC2:**
1. **Schema:** `cd mz-ai-assistant/server && psql -d mezzofy_ai -f scripts/migrate_tickets.sql` (idempotent). Optional dev/staging demo data: `seed_tickets_dev.sql` (dedicated DB only).
2. **Build the SPA:** `cd mz-support-portal/support/web-support && npm ci && npm run build` → emits to `../svc-support/public/`.
3. **svc-support env** (`svc-support/.env`, gitignored — see `.env.example`): `ENVIRONMENT=production`, `DATABASE_URL=<the mezzofy_ai URL>`, `JWT_SECRET=<SAME value as the mz-ai-assistant server>`, `JWT_ALGORITHM=HS256`, `PORT=8005`.
4. **web-support env:** `VITE_AUTH_API_URL=<mz-ai-assistant base>`, `VITE_SUPPORT_API_URL=<svc-support>/support/api/graphql`, `VITE_MOCK_AUTH=false`.
5. **Deps:** `pip install -r requirements.txt` (now psycopg2-binary + python-jose; **no boto3**).
6. **Service:** systemd `mezzofy-support` (uvicorn `main:app --port 8005`); separate from `mezzofy-api`/`mezzofy-celery`.
7. **mz-ai CORS:** allow the console origin on `/auth/*` (or same-origin proxy) — see `issues/frontend.md`.

**Smoke:** `/support/health` 200; a seeded `support_agent` logs in (email+password+OTP) → console loads → cross-merchant list + one assign + one SUPPORT reply; a non-support token → 403; no token → 401.

## AWS cleanup (DynamoDB path dead)
Remove/deactivate the dedicated `svc-support` IAM user + inline DynamoDB policy + access key + EC2 `[svc-support]` profile + systemd `aws.conf` (unless S3 attachments keep an AWS need). `ec2-website-deploy` untouched.

## Testing & coverage
- **svc-support (pytest):** 20 auth/HTTP-RBAC tests pass everywhere; 24 integration tests (repo/service/GraphQL vs real Postgres) **auto-skip locally and MUST run on EC2** for the >80% coverage gate + real-SQL validation (`SVC_SUPPORT_TEST_DATABASE_URL` → a dedicated `mezzofy_ai_test`). See `svc-support/tests/results/svc-support-postgres-report.md`.
- **web-support (vitest):** 105 pass; strict `tsc` + vite build clean.

## Known issues / residuals (pre-deploy)
1. **EC2 integration run pending** — the 24 integration tests must run green on `mezzofy_ai_test` at Gate 2/3.
2. **mz-ai CORS + a seeded `support_agent` user** required for live login (`issues/frontend.md`, Backend/Infra).
3. **Real mz-ai JWT interop** — verified with a test signer; confirm a token minted by the live mz-ai server validates.
4. **Merchant `svc-tickets` on Postgres is deferred** — merchant-side ticket creation into these tables is a follow-on CR; MVP uses seeded tickets.
5. **Sync psycopg2** in an async service — fine for the internal console; async/threadpool is a future option.

## Rollback
`svc-support` is a NEW isolated service → stop/withdraw `mezzofy-support`; no merchant impact. Schema is additive (new tables); drop them if abandoning. No data migration to undo.

## Approvals
- [ ] Lead · [ ] QA · [ ] Product — pending. Deploy only after approval + the EC2 integration run.
