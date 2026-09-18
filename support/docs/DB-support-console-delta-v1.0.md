# DB — Support-Staff Console Data-Model Delta v1.0

**Module:** CR-support-console-v1.0 · **Table:** `mz-platform-dev` (shared, ap-southeast-1)
**Status:** Implemented (Gate 3 PASS 2026-09-19) · **Date:** 2026-09-19 · **Author:** Docs Agent
**Cross-ref:** merchant ticketing `DB-tickets-schema-v2.0.md` (base Ticket/Message/Session/User schema — this doc is the DELTA only)

---

## 1. Summary — what changed on the shared table

**No new table. No new GSI. No migration.** The console rides on the existing `mz-platform-dev` schema. The delta is:

1. **Sparse assignment attributes** added to existing `TICKET#` items (written only when a ticket is assigned).
2. **Staff SESSION item** shape (a `sessionType=STAFF`, `merchantId`-less variant of the existing session item), minted by svc-iam.
3. **Staff USER item** (a `userType=STAFF` user with no MEMBER record), admin-seeded.

All three are **additive and non-breaking**: existing merchant tickets, sessions, and users are untouched, and legacy sessions with no `sessionType` are treated as `MERCHANT`.

## 2. Cross-merchant read — GSI reuse (no new index)

The cross-merchant queue reuses the **existing GSI2** (`ENTITY#TICKET`, newest-first) and drops the merchant filter (`TicketRepository.list_all_cross_merchant()`), then refines in memory (status / type / priority / assignee / unassigned / search). This is fine **<10K tickets** (`DB §8.2`). Only **GSI1** (`TOKEN#` auth lookup) and **GSI2** exist and are used.

**GSI3 is DEFERRED** (R-2) as a future scale option — see §5.

## 3. New sparse Ticket attributes (delta on `TICKET#` items)

Added to the existing Ticket item; **sparse** = present only after assignment, written via the repository's existing dynamic `update()`:

| Attribute | Type | Written by | Notes |
|-----------|------|-----------|-------|
| `assigneeId` | String | `assignTicket` | Agent id (= staff `userId`) |
| `assigneeName` | String | `assignTicket` | Optional display name |
| `assignedTeam` | String | `assignTicket` | Defaults to the acting agent's team when omitted |
| `assignedAt` | String (ISO) | `assignTicket` | Set on (re)assign |

Byte-compatibility is preserved: these are additional attributes on the same item the merchant view reads, so a merchant read simply ignores them. First assign on an `OPEN` ticket also updates `status` → `IN_PROGRESS` (auto-advance). `merchantName` is **not** stored on the ticket — it is resolved on read from the `MERCHANT#` item's `name` (R-7), falling back to `merchantId`.

## 4. Staff auth items (minted by svc-iam)

### 4.1 Staff SESSION item (`sessionType=STAFF`)

Minted by `svc-iam` `create_staff_session()`, read by svc-support via GSI1 `TOKEN#{token}`:

```
{
  sessionId:   "sess-{ULID}",
  userId:      "user-{ULID}",        # the agent id -> SupportContext.agentId -> Message.senderId
  sessionType: "STAFF",              # NEW discriminator (merchant sessions = "MERCHANT"; absent == MERCHANT for legacy)
  email:       "agent@mezzofy.com",  # now set at mint
  staffTeam:   "SUPPORT",            # enum SUPPORT | SALES | FINANCE
  roleId:      "srole-support",      # platform staff role (NOT a per-merchant role)
  permissions: [ { resource: "SUPPORT_TICKETS", actions: ["VIEW","ADD","EDIT","APPROVE"] } ],
  accessToken, refreshToken, isTrustedDevice, ipAddress, userAgent, createdAt, expiresAt
  # merchantId: OMITTED  (staff are cross-merchant; session_repository already writes merchant-agnostically)
}
```

- **Discriminator = `sessionType`** (not "absence of merchantId"). Existing live merchant sessions have no `sessionType` → treated as `"MERCHANT"` (no backfill). `select_merchant` now also stamps `sessionType:"MERCHANT"` + `email` going forward.
- **Permission mapping (D1, decided):** reuse existing action vocab — `VIEW`(queue/read), `ADD`(reply), `EDIT`(assign + status transition), `APPROVE`(resolve/close). MVP gate is **coarse** (presence of `SUPPORT_TICKETS`); per-action enforcement deferred.
- `session_repository.create()` needed **no change** — it was already merchant-agnostic.

### 4.2 Staff USER item (`userType=STAFF`)

Written by `create_staff_user()` (separate from `UserService`, which mandates `merchant_id` + writes a MEMBER record):

- `userType = STAFF`, `staffTeam` set, **NO `merchantId`**, **NO MEMBER record**.
- **Admin-seeded** in MVP (a small seed script/endpoint, `POST /iam/api/staff/seed`); full staff self-service (change-password, CRUD) deferred (D3).

### 4.3 Staff ROLE / permissions

Platform-level (the per-merchant `RoleRepository` can't serve a cross-merchant actor). MVP = a fixed staff permission set (constant / one platform `STAFF_ROLE#` record) = the §4.1 permissions.

## 5. Deferred: GSI3 (future scale option, R-2)

Not created in this CR. When the in-memory cross-merchant filter outgrows ~10K tickets, add:

```
GSI3:  PK = AGENT#{assigneeId} | TEAM#{team} | UNASSIGNED
       SK = {status}#{createdAt}
```

to serve "my assigned" / "unassigned" / team-scoped queues directly, replacing the in-memory refine. Requires **Infra sign-off** on the shared `mz-platform-dev` table (adding a GSI is a shared-table change).

## 6. Migration & operations

- **Migration: none.** All changes are additive (sparse attrs on write; new item variants). Nothing to backfill.
- No `alembic` — DynamoDB is schemaless per item; new attributes appear on write.
- Existing merchant reads/writes are unaffected (byte-compatible items).
- **Verified with moto** (in-memory `mz-platform-dev`, real PK/SK + GSI1 + GSI2, ≥2 merchants) at Gate 3. Live `mz-platform-dev` run is a staging residual.
