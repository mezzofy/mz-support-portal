# API — Support-Staff Console (`svc-support` GraphQL) v1.0

**Module:** CR-support-console-v1.0 · **Service:** `svc-support` · **Repo:** `mz-support-portal-v3`
**Status:** Implemented (Gate 3 PASS 2026-09-19) · **Contract:** FROZEN at Gate 1 (2026-09-18), built exactly as frozen
**Date:** 2026-09-19 · **Author:** Docs Agent
**Source of truth:** `handoffs/backend-to-frontend.md` (implemented SDL) · `handoffs/backend-to-lead-support-staff-auth-design.md` (frozen §4)
**Cross-ref:** merchant ticketing `API-tickets-v2.0.md` (this API is the agent-facing sibling; the item layout is byte-compatible)

---

## 1. Overview

`svc-support` exposes a **cross-merchant, staff-only** GraphQL surface over the **same** `mz-platform-dev` DynamoDB table and the **identical** `TICKET#` / `MESSAGE#` item layout used by the merchant `svc-tickets`. Writes are byte-compatible, so a SUPPORT reply made here is stored under the ticket's own merchant and surfaces on the merchant `web-tickets` view.

Unlike the merchant `tickets(merchantId!, …)` API, this surface **drops** the `merchantId` requirement from the auth boundary and reads across all merchants via the existing GSI2 index plus in-memory refine.

## 2. Endpoint & serving

| Property | Value |
|----------|-------|
| GraphQL endpoint | `POST http://localhost:8005/support/api/graphql` |
| Health | `GET http://localhost:8005/support/health` |
| SPA | `svc-support` serves the built `web-support` from `svc-support/public/` at `/support` |
| Port | **8005** (svc-support serves BOTH API + SPA; no separate gateway for MVP) |
| Vite dev server | 5182 (dev only) |
| Region | ap-southeast-1 (`mz-platform-dev`) |
| Runtime | FastAPI + Strawberry + Mangum (Lambda-ready) |
| Run locally | `cd support/svc-support/src && uvicorn main:app --port 8005 --reload` |

## 3. Authentication & RBAC

Every GraphQL call must send **one** of:

| Mode | Header | When |
|------|--------|------|
| **Prod** | `Authorization: Bearer <staff access_token>` | A STAFF session token minted by svc-iam |
| **Dev bypass** | `X-Agent-Id: <agentId>` (+ optional `X-Agent-Email`, `X-Agent-Team`) | Only when `ENVIRONMENT=development`; no token needed |

### Auth boundary (real HTTP statuses, not GraphQL `errors`)

Enforced in the context boundary (`auth/dependencies.py` → `resolve_agent_context`) **before** any resolver runs:

| Condition | Result |
|-----------|--------|
| No token / invalid / expired token | **HTTP 401** |
| Valid **merchant** (or dev-merchant) token — `sessionType != STAFF` | **HTTP 403** ("Not a support-staff session") |
| Valid STAFF token **without** a `SUPPORT_TICKETS` permission | **HTTP 403** |
| Valid STAFF token **with** `SUPPORT_TICKETS` | Resolvers run; `SupportContext{ agentId, agentName, team, permissions }` injected |

The whole console is staff-only. Token validation is a GSI1 `TOKEN#{token}` lookup + `expiresAt` check (vendored `token_service` pattern), requiring `sessionType == "STAFF"`. RBAC is **coarse** in MVP: presence of the `SUPPORT_TICKETS` resource permission — no per-action gating.

### Getting a staff token (svc-iam, `http://localhost:8000`)

- **Full flow:** `POST /iam/api/staff/login {email,password}` → `POST /iam/api/staff/verify-otp {login_session_id,otp}` (returns `user_type`) → `POST /iam/api/staff/session {login_session_id}` → `{access_token, refresh_token, user}`.
- **Dev shortcut (no OTP):** `POST /iam/api/staff/dev/token` mints a real STAFF session and returns `access_token`. Seed a user first with `POST /iam/api/staff/seed {email,password,first_name,staff_team}`.
- For pure FE work, skip tokens and use the `X-Agent-Id` dev header directly against svc-support.

See `DB-support-console-delta-v1.0.md` §3 for the STAFF session item shape.

## 4. GraphQL SDL (as implemented — matches frozen contract exactly)

```graphql
type Query {
  supportTickets(page: Int! = 1, limit: Int! = 20, filters: SupportTicketFiltersInput): PaginatedSupportTickets!
  supportTicket(ticketId: String!): SupportTicket!
  myAssignedTickets(page: Int! = 1, limit: Int! = 20, filters: SupportTicketFiltersInput): PaginatedSupportTickets!
  messages(ticketId: String!): [Message!]!
}

type Mutation {
  assignTicket(input: AssignTicketInput!): SupportTicket!            # auto-advances OPEN -> IN_PROGRESS
  updateTicketStatus(ticketId: String!, status: String!): SupportTicket!
  sendSupportMessage(input: SendSupportMessageInput!): Message!      # senderType forced SUPPORT; senderId = your agent id
  markMessagesAsRead(ticketId: String!, userId: String!): MessageResponse!
}

type SupportTicket {
  ticketId: String!  merchantId: String!  merchantName: String  userId: String!
  type: String!  status: String!  priority: String!  subject: String!  description: String!
  attachments: [Attachment!]!  assigneeId: String  assigneeName: String  assignedTeam: String  assignedAt: String
  createdAt: String!  updatedAt: String!  closedAt: String
}
type PaginatedSupportTickets { tickets: [SupportTicket!]!  total: Int!  page: Int!  limit: Int! }
type Message {  # NOTE: no merchantId on the support Message projection (matches frozen SDL)
  messageId: String!  ticketId: String!  senderId: String!  senderType: String!  content: String!
  attachments: [Attachment!]!  isRead: Boolean!  createdAt: String!
}
type Attachment { id: String!  fileName: String!  fileSize: Int!  fileType: String!  url: String!  uploadedAt: String! }
type MessageResponse { message: String! }

input SupportTicketFiltersInput { merchantId: String  status: String  type: String  priority: String  assigneeId: String  unassigned: Boolean  search: String }
input AssignTicketInput { ticketId: String!  assigneeId: String!  assigneeName: String  assignedTeam: String }
input SendSupportMessageInput { ticketId: String!  content: String!  attachments: [AttachmentInput!] }
input AttachmentInput { id: String!  fileName: String!  fileSize: Int!  fileType: String!  url: String!  uploadedAt: String! }
```

`SupportTicket` = the merchant `Ticket` model plus the support projection fields `merchantName`, `assigneeId`, `assigneeName`, `assignedTeam`, `assignedAt`.

> The support `Message` projection intentionally carries **no** `merchantId` (matches the frozen SDL). Attachment shape is vendored verbatim from `svc-tickets` — an exact match on both sides.

## 5. Status enum & transition map (7-state, frozen R-5)

Console follows the **implemented** 7-state enum, **not** RS §5's richer set (ASSIGNED/HOLD/COMPLETED/REOPEN — a separate future CR). It reuses the same `STATUS_TRANSITIONS` map as `svc-tickets`:

```
OPEN            -> { IN_PROGRESS, CANCELLED }
IN_PROGRESS     -> { PENDING_USER, PENDING_MERCHANT, RESOLVED, CANCELLED }
PENDING_USER    -> { IN_PROGRESS, RESOLVED, CANCELLED }
PENDING_MERCHANT-> { IN_PROGRESS, RESOLVED, CANCELLED }
RESOLVED        -> { CLOSED, IN_PROGRESS (reopen) }
CLOSED          -> {}   # terminal
CANCELLED       -> {}   # terminal
```

The frontend gates the `StatusTransitionMenu` by this same map. An illegal transition returns a GraphQL error with `extensions.code = INVALID_STATUS_TRANSITION`.

## 6. Error model

Errors are returned as GraphQL `errors[]` with typed `extensions` (except the auth boundary, which returns real HTTP 401/403 — see §3):

| `extensions.code` | Meaning | `extensions.status_code` |
|-------------------|---------|:---:|
| `TICKET_NOT_FOUND` | Ticket id does not resolve | 404 |
| `INVALID_STATUS_TRANSITION` | Requested status not reachable from current per §5 map | 400/409 |
| `VALIDATION_ERROR` | Input failed validation | 400 |

> Frontend error-code classification was aligned to these exact codes at Gate 4 (previously drifted to `NOT_FOUND` / `INVALID_TRANSITION` — the 2 LOW datasource fixes; see `RN-support-console-v1.0.md` §Bug Fixes).

## 7. Per-operation behavior notes

### Queries

- **`supportTickets(page, limit, filters)`** — the cross-merchant queue. Reads all merchants' tickets (GSI2, newest-first) then refines in memory by `merchantId`, `status`, `type`, `priority`, `assigneeId`, `unassigned`, `search`. Pagination is **in-memory** over the full cross-merchant read: `total` = full match count, `tickets` = current page. (Caveat: in-memory filter is fine for <10K tickets — see TD §6.)
- **`supportTicket(ticketId)`** — single ticket read; `TICKET_NOT_FOUND` if absent. Item shape identical to merchant read.
- **`myAssignedTickets(page, limit, filters)`** — equals `supportTickets` **pinned** to `assigneeId = you` (from your token / `X-Agent-Id`). Any `assigneeId` / `unassigned` supplied in `filters` is **ignored**; all other filters still apply.
- **`messages(ticketId)`** — full message thread for a ticket, ascending by `createdAt`.

### Mutations

- **`assignTicket(input)`** — writes the 4 sparse assignment attrs (`assigneeId`, `assigneeName`, `assignedTeam`, `assignedAt`). If `assignedTeam` is omitted it **defaults to the acting agent's team**. First assign on an `OPEN` ticket **auto-advances** it to `IN_PROGRESS`; the returned `SupportTicket` reflects that.
- **`updateTicketStatus(ticketId, status)`** — reuses the vendored `STATUS_TRANSITIONS`; illegal transition → `INVALID_STATUS_TRANSITION`. Moving to `CLOSED` stamps `closedAt`.
- **`sendSupportMessage(input)`** — the caller sends only `ticketId` + `content` (+ optional `attachments`). `senderType = SUPPORT` and `senderId = ctx.agentId` are **forced server-side**. Stored under the ticket's own merchant, so it appears on the merchant `web-tickets` view.
- **`markMessagesAsRead(ticketId, userId)`** — pass your own agent id as `userId` when opening a thread; it marks the **other** side's (merchant/USER) messages read (one-sided).

## 8. Known limitations (MVP)

- **No server-side sort** in the SDL — queue relies on backend newest-first (GSI2). *(Backlog: add `sort`.)*
- **No agent-directory query** — `AssignAgentDialog` is "assign to me" + manual agent id/name/team. *(Backlog: an agents-list query, ties to svc-iam staff-user CRUD.)*
- **No status-history array** — detail timeline is derived from ticket timestamps. *(Backlog: status-change audit trail.)*
- **`merchantName`** is resolved-on-read from the `MERCHANT#` item's `name`; if absent it **falls back to the raw `merchantId`** (never null). *(Backlog: denormalize/index.)*
