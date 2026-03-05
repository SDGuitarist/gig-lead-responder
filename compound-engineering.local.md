# Review Context — Gig Lead Responder

## Risk Chain

**Brainstorm risk:** "Least confident about mobile UX design for the dashboard — needs wireframes or component breakdown in the plan phase."

**Plan mitigation:** Defined component layouts per breakpoint, tap target sizes (44px min), scrollable tab nav for 5-tab overflow. Simplified to cards-only layout (no separate desktop table). Cut filters, date picker, daily digest (~250 LOC saved).

**Work risk (from Feed-Forward):** SQLite table rebuild migration for CHECK constraint — only destructive DB operation in the plan. Must back up DB file and test on a copy first.

**Review resolution:** 38 unique findings (6 P1, 17 P2, 15 P3) from 9 agents across 3 batches. All 6 P1 resolved. Top findings: CSRF missing on api.ts POST routes (4 agents), non-atomic approve flow, scheduler stuck in "sent" on failure.

**Fix resolution:** 21 fixed, 12 deferred, 5 rejected/false-positive. Three patterns documented: guard-at-boundary (new doc), atomic state transitions (extended existing doc), structural cluster (deferred to refactoring PR).

## Files to Scrutinize

| File | What changed | Risk area |
|------|-------------|-----------|
| `src/api.ts` | CSRF guard added to 4 POST routes, input length limits, error sanitization | New middleware ordering — verify csrfGuard runs before handler |
| `src/follow-up-api.ts` | Null guards on shapeLead (4 sites), body validation on snooze | Direct SQL for draft-store bypasses `updateLead()` abstraction |
| `src/follow-up-scheduler.ts` | Revert-to-pending on failure, WHERE guard on draft store, retry map cap | In-memory retry map doesn't survive restarts |
| `src/leads.ts` | Index recreation after migration, sms_sent_at folded into transaction | 700+ lines spanning 4 responsibilities — structural refactor pending |
| `src/server.ts` | CSP font-src directive for Google Fonts | `unsafe-inline` needed for inline scripts/styles |
| `src/twilio-webhook.ts` | Production guard on validation bypass | Defense-in-depth — startup check in server.ts is primary guard |
| `public/dashboard.html` | Auth retry consistency, magic number constant | 2,474 lines — approaching 3,000 threshold for split |

## Plan Reference

`docs/plans/2026-03-01-feat-follow-up-pipeline-v2-dashboard-plan.md`

---

## Deploy Debugging Context (2026-03-04)

**Root cause:** `/health` route registered after `apiRouter` which applies `sessionAuth` to all requests. Railway healthcheck probe got 401.

**Red herrings tried first:** IPv6 binding (`::` instead of default), healthcheck timeout increase (120→300), Hobby plan upgrade. None were the issue.

**Compounding error:** Cherry-picking `server.ts` from feature branch to main brought incompatible imports (`cookie-parser`, `follow-up-api`), causing cascading deploy crashes.

**Key diagnostic:** Removing the healthcheck entirely → deploy succeeded → curl returned 401 on `/health`. The HTTP status code was immediately diagnostic.

**Solution doc:** `docs/solutions/architecture/railway-healthcheck-auth-middleware-ordering.md`
