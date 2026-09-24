# DB — Support Console Data Model v2.0 (PostgreSQL)

**Module:** CR-support-postgres-repivot · **Database:** `mezzofy_ai` (PostgreSQL on the EC2), `public` schema
**Status:** Implemented (Gate 1 frozen 2026-09-23) · **Date:** 2026-09-24 · **Author:** Docs Agent
**Supersedes:** `DB-support-console-delta-v1.0.md` (the DynamoDB single-table delta). **Cross-ref:** `ADR-005`.
**Schema source of truth:** `mz-ai-assistant/server/scripts/migrate_tickets.sql` (+ dev seed `seed_tickets_dev.sql`).

---

## 1. Summary

The console re-platformed from the DynamoDB single table to **three relational tables** in the existing `mezzofy_ai` database: `tickets`, `messages`, `merchants`. Created via `CREATE TABLE IF NOT EXISTS` in `server/scripts/migrate_tickets.sql` (idempotent, prod-safe; **no alembic** — matches the mz-ai convention). **Greenfield — no data migration** (the DynamoDB store never held data).

## 2. Tables

### 2.1 `tickets`
| Column | Type | Notes |
|--------|------|-------|
| `ticket_id` | `CHAR(26)` PK | ULID (time-sortable; preserves the old GSI2 ordering) |
| `merchant_id` | `VARCHAR(64)` NOT NULL | no FK (resolve-on-read; a ticket may reference an unseeded merchant) |
| `user_id` | `VARCHAR(64)` NOT NULL | merchant-side creator |
| `type` | `VARCHAR(16)` NOT NULL | CHECK: TECHNICAL/BILLING/ACCOUNT/FEATURE/GENERAL/OTHER |
| `status` | `VARCHAR(16)` NOT NULL default `OPEN` | CHECK: 7-state (see §3) |
| `priority` | `VARCHAR(8)` NOT NULL | CHECK: LOW/MEDIUM/HIGH/URGENT |
| `subject` | `VARCHAR(200)` NOT NULL | |
| `description` | `VARCHAR(5000)` NOT NULL | |
| `attachments` | `JSONB` NOT NULL default `[]` | embedded list `{id,fileName,fileSize,fileType,url,uploadedAt}` |
| `assignee_id` / `assignee_name` / `assigned_team` / `assigned_at` | nullable | **sparse** — set only on assign |
| `created_at` / `updated_at` | `TIMESTAMPTZ` NOT NULL default `NOW()` | repo stamps `updated_at` on every update |
| `closed_at` | `TIMESTAMPTZ` nullable | set only on CLOSED / CANCELLED |

Indexes: `(created_at DESC)`, `(merchant_id, created_at DESC)`, `(status)`, `(assignee_id)` — serve the cross-merchant queue + filters.

### 2.2 `messages`
`message_id CHAR(26)` PK (ULID) · `ticket_id CHAR(26)` **FK → tickets ON DELETE CASCADE** · `merchant_id VARCHAR(64)` · `sender_id VARCHAR(64)` · `sender_type VARCHAR(8)` CHECK USER/SUPPORT/SYSTEM · `content VARCHAR(2000)` · `attachments JSONB` · `is_read BOOLEAN default FALSE` · `created_at TIMESTAMPTZ`. Index: `(ticket_id, created_at)`.

### 2.3 `merchants` (reference)
`merchant_id VARCHAR(64)` PK · `name VARCHAR(255)` · `created_at TIMESTAMPTZ`. Replaces the DynamoDB `MERCHANT#` item for **`merchantName` resolve-on-read** (service falls back to `merchant_id` when absent). Seeded for MVP (`seed_tickets_dev.sql`); a live merchant-directory feed is a follow-on.

## 3. Status state machine (unchanged, service-enforced)
`OPEN → IN_PROGRESS|CANCELLED` · `IN_PROGRESS → PENDING_USER|PENDING_MERCHANT|RESOLVED|CANCELLED` · `PENDING_* → IN_PROGRESS|RESOLVED|CANCELLED` · `RESOLVED → CLOSED|IN_PROGRESS(reopen)` · `CLOSED`/`CANCELLED` terminal. The CHECK constraint only guards the value set; transitions are enforced in the **service layer** (`STATUS_TRANSITIONS`).

## 4. Mapping from the old DynamoDB model
| DynamoDB (v1.0) | Postgres (v2.0) |
|---|---|
| `TICKET#{id}` item (PK=SK) | `tickets` row |
| `MESSAGE#{id}` under `PK=TICKET#{id}` | `messages` row (FK `ticket_id`) |
| `MERCHANT#{id}` item | `merchants` row |
| GSI2 `ENTITY#TICKET` newest-first + in-memory refine | `WHERE … ORDER BY created_at DESC LIMIT/OFFSET` |
| Sparse assignment attrs | nullable columns |
| Attachments embedded (Map list) | `JSONB` column (same shape) |
| ISO8601 strings | `TIMESTAMPTZ` (repo renders back to ISO strings for the API contract) |
| GSI1 `TOKEN#` session lookup | **gone** — auth is a mz-ai JWT decode (no session row); see ADR-005 |

## 5. Auth storage — none here
Staff sessions are **not** stored by the console (Option B). Auth = a mz-ai-assistant JWT validated statelessly; identity comes from the token claims (`user_id`, `name`, `department`, `role`). Staff are `mezzofy_ai.users` rows (role `support_agent`/`support_manager`) owned by the mz-ai-assistant server — not by this schema.

## 6. Migration & operations
- **Data migration: none** (greenfield). `psql -d mezzofy_ai -f server/scripts/migrate_tickets.sql` (idempotent). Dev/staging seed: `seed_tickets_dev.sql` (dedicated DBs only).
- Grants: `SELECT/INSERT/UPDATE/DELETE` on the three tables to the `mezzofy_ai` app user.
- Deferred (post-MVP): a normalized `attachments` child table; a live `merchants` feed; server-side sort; scale indexes.
