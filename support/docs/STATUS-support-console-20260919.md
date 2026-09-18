# STATUS — Support-Staff Console (`mz-support-portal`)

**Project:** CR-support-console-v1.0 · **Owner:** Lead Agent · **Last updated:** 2026-09-19
**Phase:** ✅ **Build-complete (all 5 quality gates PASS) — awaiting staging + production deploy (human + Infra gated)**

> Internal, cross-merchant support-staff console. Support agents view all merchants' tickets, assign, reply as `SUPPORT`, move status through the 7-state machine, and resolve/close. New standalone `svc-support` + `web-support`, backed by the existing ticketing data (`mz-platform-dev`) + a non-breaking svc-iam staff-session extension.

---

## Quality Gate Status
| Gate | Scope | Verdict | Evidence |
|:----:|-------|:------:|----------|
| 0 | Prereq — ports/GSI/auth recon | ✅ PASS | ports 8005/5182+`/support` free; GSI3 deferred; R-1 auth conflict caught → extend svc-iam |
| 1 | Contract freeze | ✅ FROZEN | staff `sessionType` claim + GraphQL SDL |
| 2 | Integration / auth | ✅ PASS | SDL/field/RBAC alignment verified (static + offline RBAC) |
| 3 | Tests & coverage | ✅ PASS | svc-support 67/91% · svc-iam staff 15/100%-new · web-support 105/96% (moto) |
| 4 | Docs + Release Notes ⭐ | ✅ PASS | 6 docs + RN; Lead approved |

Reviews: `mz-ai-assistant\.claude\coordination\plans\CR-support-console-v1.0-review-gate{0..4}.md`.

## Recently Completed (this build cycle, 2026-09-18 → 09-19)
- ✅ Plan + blueprint gap-review → `.claude\coordination\plans\CR-support-console-v1.0-plan.md` / `-review.md`
- ✅ **svc-support** (FastAPI/Strawberry/Mangum, :8005, serves API + SPA) — cross-merchant queue (GSI2 + in-memory), assign, forced-SUPPORT reply, 7-state machine, RBAC. Commit `f1f1043`.
- ✅ **web-support** (React/TS/Vite, Clean-Arch/MVVM) — Queue / MyAssigned / Detail (chat, assign, status), i18n ×3, WCAG. Commits `1e7bc4f` + fix `00e5d1c`.
- ✅ **svc-iam staff-session extension** (additive; merchant flows untouched) — `create_staff_session`/`create_staff_user`, `/iam/api/staff/*`, `sessionType` discriminator. Commit `337c703c` (branch `eric-product-design`).
- ✅ **Tests** — commits `d15ccb6` (svc-support) · `0541c0ea` (svc-iam) · `638a6e2` (web-support). moto, no live AWS.
- ✅ **Docs + RN** — `API/TD/DB-delta/RS/ADR-004/RN` commits `8e652e3` + `7300995`.

## In Progress
- None — the plan/build/test/docs cycle is closed.

## Next Phase — Deploy (human + Infra; see DC)
Checklist: `mz-ai-assistant\.claude\coordination\handoffs\lead-to-infra-support-console-deploy.md`.
1. Product/QA sign-off on the RN Approvals table.
2. Merge svc-iam `eric-product-design` → deploy branch; redeploy svc-iam.
3. Provision svc-support (env `ENVIRONMENT=production` ⚠️ disables `X-Agent-Id`; IAM DynamoDB GSI1/GSI2; TLS/CORS; no new GSI). Build web-support → `svc-support/public/`.
4. **Staging MUST-DOs** (Gate-3 residuals, moto ≠ live): live `mz-platform-dev` run; cross-merchant list >1 merchant; assign + status; **SUPPORT reply renders on merchant `web-tickets`**; staff REST/OTP/SQS HTTP flow; live RBAC 403/401.
5. Prod cutover + smoke; rollback plan documented (svc-support isolated; svc-iam ext additive; no migration).

## Blockers
- **None for build.** Deploy is gated on: product/QA sign-off · svc-iam branch merge · staging MUST-DOs · Infra provisioning. All tracked in the DC handoff.

## Known Issues / Backlog
- **NOT this CR:** pre-existing svc-iam test breakage (2 stale-import collection errors + 3 env-driven failures) → `.claude\coordination\issues\tester.md` (confirm on EC2-parity Python).
- **MVP backlog (non-blocking):** server-side sort · agent-directory query for assignment (ties to staff-user CRUD) · status-history audit trail · GSI3 at scale · WebSocket realtime (chat = 5s polling) · RS §5 richer status set · SLA timers.
- **Deviation:** `merchantName` resolve-on-read, falls back to `merchantId` when absent (never null).

## Key References
- Release notes ⭐: `support\docs\RN-support-console-v1.0.md`
- Contract: `support\docs\API-support-console-v1.0.md` · Design: `TD-...` / `ADR-004-...` · Data: `DB-support-console-delta-v1.0.md`
- Coordination (in `mz-ai-assistant`): plan, gate reviews 0–4, handoffs (`backend-to-frontend`, `lead-to-infra-...-deploy`), `memory.md`.
