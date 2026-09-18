# web-support — Mezzofy Support-Staff Console

Agent-facing console for Mezzofy support staff to work tickets **across all
merchants**: browse the queue, filter, assign, reply as `SUPPORT`, and move
tickets through the status state machine. Part of **CR-support-console-v1.0**.

- **Stack:** React + TypeScript + Vite · Clean Architecture + MVVM · Zustand
  ViewModels · InversifyJS DI (`toDynamicValue`) · Tailwind CSS · i18next (en /
  zh-CN / zh-TW).
- **Dev server:** port **5182**, route `/support`.
- **Production:** `vite build` emits into `../svc-support/public`; `svc-support`
  (port **8005**) serves this SPA alongside the GraphQL API at
  `/support/api/graphql` (mirrors the merchant `svc-tickets` serving model).

## Backend contract (FROZEN — Gate 1)

Built against the frozen `svc-support` GraphQL SDL
(`handoffs/backend-to-lead-support-staff-auth-design.md` §4). Operations used:
`supportTickets`, `supportTicket`, `myAssignedTickets`, `messages`,
`assignTicket`, `updateTicketStatus`, `sendSupportMessage`,
`markMessagesAsRead`. Status enum = implemented 7-state; the
`StatusTransitionMenu` mirrors the `STATUS_TRANSITIONS` state machine.

## Auth

Staff opaque **Bearer** token (from the IAM staff email+OTP flow →
`/iam/api/staff/session`, `sessionType: "STAFF"`). The GraphQL datasource also
sends the dev header **`X-Agent-Id`**, which `svc-support` honours only when
`ENVIRONMENT=development`.

## Getting started

```bash
npm install
cp .env.example .env.local   # VITE_MOCK_AUTH=true for local dev (X-Agent-Id bypass)
npm run dev                  # http://localhost:5182/support
npm run build                # typecheck + build into ../svc-support/public
```

## Layout (Clean Architecture)

```
src/
  domain/        entities · repository interfaces · usecases
  data/          support-graphql.datasource · mappers · repository impls
  presentation/features/support/  pages · components · viewmodels · hooks
  core/          di (container + bindings) · errors · types
  i18n/          en / zh-CN / zh-TW
```

## Notes / assumptions (for Gate 2)

- The frozen SDL exposes **no sort argument**; `svc-support` returns
  newest-first (GSI2), so the console offers no server-side column sorting.
- The SDL has **no agent-directory query**, so `AssignAgentDialog` defaults to
  "assign to me" (signed-in agent) with an optional manual agent id/name/team
  entry.
- The SDL returns **no explicit status-history array**; the detail timeline is
  derived from the ticket's own timestamps (created / assigned / updated /
  closed).
