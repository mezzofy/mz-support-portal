# Test Report — web-support (CR-support-console-v1.0, Gate 3)

**Agent:** Tester (frontend) · **Date:** 2026-09-19
**Target:** `mz-support-portal-v3/support/web-support` (React + TS + Vite, Clean-Arch/MVVM, Zustand, InversifyJS)
**Runner:** Vitest 1.6.1 · jsdom · @testing-library/react 14 · @vitest/coverage-v8
**Constraint honoured:** test files + vitest config only. **No production `src/` file was modified.** Two source defects were found; failing tests document them (see BUGS) — they were **not** fixed.

---

## How to run
```bash
cd mz-support-portal-v3/support/web-support
npm i -D vitest@^1.6.0 @vitest/coverage-v8@^1.6.0 jsdom@^24.1.0 \
         @testing-library/react@^14.3.1 @testing-library/user-event@^14.5.2 \
         @testing-library/jest-dom@^6.4.6   # (already installed)
npx vitest run --coverage
```
Config added: `vitest.config.ts`, `tests/setup.ts`. Raw console output: `tests/results/web-support-vitest-raw.txt`. Coverage JSON/HTML: `tests/results/coverage/`.

---

## Result: PASS

```
 Test Files  10 passed (10)
      Tests  105 passed (105)
```

| Test file | Tests | Focus |
|-----------|:-----:|-------|
| `tests/unit/status-transitions.test.ts` | 12 | STATUS_TRANSITIONS = frozen 7-state map; terminals; reopen; auto-advance target |
| `tests/unit/mappers.test.ts` | 10 | raw→entity: ticket (assignee*, merchantName fallback, enum coercion, attachments), message (no merchantId, SYSTEM fallback) |
| `tests/unit/datasource.test.ts` | 17 | GraphQL doc/vars per op; Bearer + X-Agent-Id headers; 401/403/500/network; `extensions.code` surfacing; **2 bug docs** |
| `tests/unit/ticket-list-viewmodel.test.ts` | 15 | queue/my-assigned store: filters, pagination, error paths, assignee/unassigned emission, queue-vs-myAssigned wiring |
| `tests/unit/ticket-detail-viewmodel.test.ts` | 17 | load/assign/changeStatus/sendReply (optimistic) /markRead semantics/reset |
| `tests/unit/use-debounce.test.ts` | 3 | debounce delay + timer reset (fake timers) |
| `tests/unit/i18n.test.ts` | 5 | en/zh-CN/zh-TW key parity; referenced component keys; no empty values |
| `tests/components/status-transition-menu.test.tsx` | 10 | offers ONLY allowed targets per source status; terminals disabled; onSelect; reopen hint; disabled |
| `tests/components/assign-agent-dialog.test.tsx` | 8 | me/other modes; calls assignTicket input; disabled-until-id; pending; error; close |
| `tests/components/support-chat-panel.test.tsx` | 9 | SUPPORT-right/USER-left; labels; empty; send+clear; fail keeps draft; disabled; error |

The 2 datasource entries marked `it.fails` are **passing** (they assert the current behaviour is wrong and fail-as-expected). If the source is fixed they will flip to failing and the `.fails` marker must be removed.

---

## Coverage (scoped to the tested modules, `all: true`)

```
File               | % Stmts | % Branch | % Funcs | % Lines
-------------------|---------|----------|---------|--------
All (scoped)       |  96.31  |  86.69   |  92.15  |  96.31
 data/datasources  |  97.81  |  87.17   |   100   |  97.81
 data/mappers      |   100   |   100    |   100   |   100
 domain/entities   |   100   |   100    |   100   |   100   (support-ticket, message)
 support/components |  94.45  |  83.75   |    75   |  94.45  (StatusTransitionMenu, AssignAgentDialog, SupportChatPanel)
 support/hooks      |   100   |   100    |   100   |   100   (useDebounce)
 support/viewmodels |  95.18  |  86.56   |   100   |  95.18  (createTicketList, queue, myAssigned, detail)
```

**Scoped statements/lines 96.31%, branches 86.69% — above the >80% target on every tested module.**

- Uncovered residue is defensive/edge branches: `AssignAgentDialog` lines 38–51 (the `if (!agent) return` early-out and the "other" no-id early-out — the mutually-exclusive guards), `SupportChatPanel` lines ~121–137/155–157 (attachment `<li>` rendering + 5s poll interval callback, not exercised on purpose), detail VM 134–136/158–159 (loadMessages non-silent error branch + markRead catch).

### Honesty note — overall repo coverage
These percentages are **scoped** to the Gate-3 target modules (per the coverage `include` in `vitest.config.ts`). They are **not** whole-app coverage. Deliberately **untested** (out of this task's scope, so not counted): pages (`QueuePage`, `MyAssignedPage`, `SupportTicketDetailPage`), layout/shell components (`DashboardShell/Header/Sidebar`, `SupportTicketTable`, `SupportFilters`, badges, `Pagination`), `useLayoutViewModel`, `AuthGuard`/`useAuth` login flow, DI bindings, routes, repositories, and the thin use-case pass-throughs (covered transitively via the viewmodel tests). A full-app coverage run would report a much lower global number.

---

## BUGS

Two real defects in **`src/data/datasources/support-graphql.datasource.ts`** — the GraphQL error-code branches use strings that the frozen backend contract does **not** emit, so the branches are dead code. Both are documented by `it.fails(...)` tests in `tests/unit/datasource.test.ts`.

### BUG-1 (Low) — `INVALID_STATUS_TRANSITION` is not classified as a validation error
- **File:** `support-graphql.datasource.ts:244`
- **Code:** `if (code === 'INVALID_TRANSITION' || code === 'VALIDATION_ERROR') { throw AppError.validation(...) }`
- **Contract (handoff §Behaviour notes / §68):** an illegal transition returns `extensions.code = "INVALID_STATUS_TRANSITION"`. `VALIDATION_ERROR` is also a documented code.
- **Repro:** GraphQL response `errors:[{extensions:{code:'INVALID_STATUS_TRANSITION'}}]` from `updateTicketStatus`.
- **Expected:** mapped to a validation-class `ErrorCode` (`VALIDATION_ERROR` / `INVALID_TRANSITION`).
- **Actual:** falls through to `AppError.graphql(...)` → `ErrorCode.GRAPHQL_ERROR`. The literal `'INVALID_TRANSITION'` never matches the backend's `'INVALID_STATUS_TRANSITION'`, so that branch is unreachable.
- **User impact:** low — the UI renders `error.message` regardless, and the raw code is still surfaced in `error.details.code`. But any code branching on `ErrorCode` (e.g. to style/handle a transition conflict differently) will misclassify it. Latent correctness bug + dead branch.
- **Suggested fix (Backend/Frontend owner, not applied):** compare against `'INVALID_STATUS_TRANSITION'` (keep `'INVALID_TRANSITION'` as an alias if desired), and add `ErrorCode.INVALID_TRANSITION` mapping.

### BUG-2 (Low) — `TICKET_NOT_FOUND` is not classified as NOT_FOUND
- **File:** `support-graphql.datasource.ts:241`
- **Code:** `if (code === 'NOT_FOUND') { throw new AppError(ErrorCode.NOT_FOUND, ...) }`
- **Contract (handoff §68):** not-found errors carry `extensions.code = "TICKET_NOT_FOUND"`.
- **Repro:** `supportTicket` response `errors:[{extensions:{code:'TICKET_NOT_FOUND'}}]`.
- **Expected:** `ErrorCode.NOT_FOUND`.
- **Actual:** `ErrorCode.GRAPHQL_ERROR` (the `'NOT_FOUND'` literal never matches `'TICKET_NOT_FOUND'`). Confirmed by an ACTUAL-behaviour test that asserts `GRAPHQL_ERROR` + `details.code === 'TICKET_NOT_FOUND'`.
- **User impact:** low (message still shown; code preserved in details), but a missing ticket cannot be distinguished by `ErrorCode` for a dedicated "ticket not found" UI.
- **Suggested fix (not applied):** compare against `'TICKET_NOT_FOUND'` (or `code.endsWith('NOT_FOUND')`).

> Both are **latent / low severity** because the current viewmodels branch on `error.message`, not `error.code`. They do not block Gate 3 functionally, but the datasource's error-classification is not contract-accurate. Flagging to Lead/Backend for a one-line fix each.

---

## Non-blocking notes
- **`act(...)` warnings** appear in the two component suites (StatusTransitionMenu, SupportChatPanel). They are console warnings from post-interaction effects (`SupportChatPanel` auto-scroll + `onMarkRead` on `messageCount`, and menu open/close state), **not** failures — all assertions pass. jsdom lacks `Element.scrollTo`; a no-op is stubbed in `tests/setup.ts`.
- **DI approach:** viewmodel tests bind fake use-cases into the real InversifyJS container against the store's `TYPES` symbol, exercising the real `resolve()` path (no module mocking). Datasource tests mock `useAuth` accessors (`vi.hoisted`) and `global.fetch`.
- **i18n parity is clean:** all three locales share an identical `support.*` key tree with no empty values; every key the shipped components reference resolves.

---

## Could not run / gaps
- Nothing failed to run. The suite is green end-to-end.
- **Not covered (out of scope, listed above):** pages, shell/table/filter/badge components, auth/login flow, routes, repositories. If Gate 3 requires page-level or repository coverage too, that is a follow-up — say the word and I'll extend.
