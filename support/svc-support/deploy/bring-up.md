# svc-support EC2 Bring-up — Option B (Postgres + mz-ai JWT)

**CR:** CR-support-postgres-repivot · **Owner:** Infra + human (live steps are human-run) · **Target:** the mz-ai-assistant EC2 (`ubuntu@3.1.255.48`, ap-southeast-1) that already runs PostgreSQL `mezzofy_ai` + Redis.
**Companion:** `ADR-005`, `RN-support-console-v1.1.md`. **Runbook style:** run top-to-bottom; commands assume `~/mz-support-portal` checkout.

> ⚠️ Live steps (sudo systemd, running the migration, DELETING the IAM user/keys) are **human-run** — not executed by an agent. This file is the exact, ordered procedure.

---

## 0. Prereqs (already true on this box)
- PostgreSQL `mezzofy_ai` running; the mz-ai-assistant `DATABASE_URL` + `JWT_SECRET` are in `~/mz-ai-assistant/server/config/.env`.
- Redis running (used by mz-ai auth for the refresh blacklist; svc-support does NOT need Redis for access-token validation).
- Node + Python 3.11+ available (same as the mz-ai services).

## 1. Get the code
```bash
cd ~ && git clone <mz-support-portal remote> mz-support-portal   # first time (private repo → PAT/deploy key)
# or: cd ~/mz-support-portal && git pull
```

## 2. Postgres schema (into the EXISTING mezzofy_ai)
```bash
cd ~/mz-ai-assistant/server
psql -d mezzofy_ai -f scripts/migrate_tickets.sql          # idempotent, prod-safe (schema only)
# (staging/demo ONLY — never prod:) psql -d mezzofy_ai -f scripts/seed_tickets_dev.sql
```
Verify: `psql -d mezzofy_ai -c "\dt tickets|messages|merchants"` shows the three tables.

## 3. Build the SPA  (env is baked at build time — set VITE_AUTH_API_URL FIRST)
```bash
cd ~/mz-support-portal/support/web-support
cat > .env <<'EOF'
VITE_SUPPORT_API_URL=https://<support-host>/support/api/graphql
VITE_AUTH_API_URL=https://<mz-ai-host>       # mz-ai-assistant base; /auth/login is appended
VITE_MOCK_AUTH=false
EOF
npm ci && npm run build          # emits to ../svc-support/public/
```
⚠️ **CORS:** the browser POSTs `${VITE_AUTH_API_URL}/auth/login` cross-origin. The mz-ai-assistant server MUST allow the support console origin on `/auth/*` (or front both behind one origin). This is a mz-ai-assistant server change (Backend scope) — see `issues/frontend.md`. Confirm before the login smoke.

## 4. Backend venv + env
```bash
cd ~/mz-support-portal/support/svc-support
python3 -m venv venv && venv/bin/pip install -r requirements.txt     # psycopg2-binary + python-jose; NO boto3
cat > .env <<EOF
ENVIRONMENT=production
DATABASE_URL=$(grep -m1 '^DATABASE_URL=' ~/mz-ai-assistant/server/config/.env | cut -d= -f2-)
JWT_SECRET=$(grep -m1 '^JWT_SECRET=' ~/mz-ai-assistant/server/config/.env | cut -d= -f2-)
JWT_ALGORITHM=HS256
PORT=8005
EOF
chmod 600 .env
```
> `JWT_SECRET` MUST be byte-identical to the mz-ai-assistant server's, or svc-support will 401 every real token. `DATABASE_URL` is the same `mezzofy_ai` URL (the `postgresql+asyncpg://` form is fine — svc-support normalizes it for psycopg2).

## 5. systemd service
```bash
sudo cp ~/mz-support-portal/support/svc-support/deploy/mezzofy-support.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now mezzofy-support
systemctl is-active mezzofy-support
```
Stray-process trap (from the prior bring-up): if `is-active` shows `activating` with `MainPID` 0, a leftover manual uvicorn holds :8005 →
`sudo systemctl stop mezzofy-support && sudo pkill -f 'svc-support/venv/bin/uvicorn' && sudo ss -ltnp | grep :8005` (must be empty) `&& sudo systemctl start mezzofy-support`.

## 6. Smoke
```bash
curl -s localhost:8005/support/health            # 200, no DB
# no token -> 401, non-support token -> 403 (auth denies before DB):
curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:8005/support/api/graphql -H 'Content-Type: application/json' -d '{"query":"{__typename}"}'   # 401
```
Full login smoke (needs §3 CORS + a seeded support_agent user): a `support_agent` logs in (email+password+OTP via the mz-ai `/auth/*`) → console loads → cross-merchant list + one assign + one SUPPORT reply.

## 7. AWS cleanup — the DynamoDB path is DEAD (human, AWS console/CLI)
The console no longer uses DynamoDB or any AWS creds. Remove/deactivate (unless S3 attachments per ADR-002 keep an AWS need — then repurpose the policy DynamoDB→S3):
- IAM user **`svc-support`**: delete its **inline DynamoDB policy**, **deactivate + delete the access key**, then delete the user.
- On EC2: remove the `[svc-support]` profile from `~/.aws/credentials` + `~/.aws/config`, and delete any systemd `aws.conf` drop-in (`/etc/systemd/system/mezzofy-support.service.d/aws.conf`) from the DynamoDB attempt.
- `ec2-website-deploy` was NEVER modified for this — nothing to undo there.

## 8. Integration tests (Gate 2/3 — dedicated test DB, NEVER prod)
```bash
sudo -u postgres createdb mezzofy_ai_test
psql -d mezzofy_ai_test -f ~/mz-ai-assistant/server/scripts/migrate_tickets.sql
cd ~/mz-support-portal/support/svc-support && venv/bin/pip install -r requirements-dev.txt
export SVC_SUPPORT_TEST_DATABASE_URL="postgresql://<user>:<pw>@localhost:5432/mezzofy_ai_test"
venv/bin/python -m pytest tests/ -q          # runs all 44 (20 unit + 24 integration); expect the >80% coverage gate met
```

## 9. Rollback
`sudo systemctl disable --now mezzofy-support`. Schema is additive (drop `tickets`/`messages`/`merchants` if abandoning). No data migration to undo. No merchant impact (isolated service).
