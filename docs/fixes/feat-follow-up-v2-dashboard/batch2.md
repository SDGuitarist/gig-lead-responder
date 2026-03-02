# Batch B — Data Integrity and Hot Path

**Date:** 2026-03-02
**Commits:** `a20a710`, `cc1fc2b`, `415949b`, `7313dbd`, `419b654`, `52d2cf0`, `1fecaca`, `d90199f`
**Findings fixed:** 8 of 8 (6 P1, 2 P2)

### Prior Phase Risk

> "What might this review have missed? Accessibility, timezone handling, SMS content validation, logging consistency, browser compatibility."

These are outside Batch B's scope (security/data-integrity focus). Timezone handling is relevant to snooze dates but the existing validation (future check, 90-day cap) is sufficient for now.

---

## Fixes Applied

| # | Finding | Priority | Commit | Fix |
|---|---------|----------|--------|-----|
| 1 | COOKIE_SECRET missing from .env.example | P1 | `a20a710` | Added with generation instructions |
| 2 | Table rebuild drops indexes, never recreated | P1 | `cc1fc2b` | Added idx_leads_status + idx_leads_event_date to post-migration block |
| 3 | CSRF guard missing on 4 api.ts POST routes | P1 | `415949b` | Added `csrfGuard` middleware to /approve, /edit, /outcome, /analyze |
| 4 | Scheduler stuck in "sent" on failure | P1 | `7313dbd` | Added `else` branch reverting to `pending` when failures < max retries |
| 5 | Non-atomic approve-then-send flow | P1 | `419b654` | Folded `sms_sent_at` into `completeApproval` transaction |
| 6 | Non-null assertion on `shapeLead()` | P1 | `52d2cf0` | Replaced 4x `!` with explicit null guard + 500 response |
| 22 | Scheduler draft-store race with user actions | P2 | `1fecaca` | Added `WHERE follow_up_status='sent'` guard on draft UPDATE |
| 23 | Twilio validation bypass not production-guarded | P2 | `d90199f` | Added NODE_ENV/RAILWAY_ENVIRONMENT check inside function |

## Three Questions

1. **Hardest fix in this batch?** Finding #5 (non-atomic approve). Had to decide between wrapping everything in one transaction vs. making `completeApproval` accept an optional `smsSentAt` param. Chose the latter because `completeApproval` is also called from `twilio-webhook.ts` (where SMS was already sent externally) — adding the param keeps backward compat via the optional argument.

2. **What did you consider fixing differently, and why didn't you?** For finding #4 (scheduler stuck), considered persisting retry count in the DB (as review suggested) instead of the in-memory Map. Decided against it because (a) adding a column is a schema change better done in a separate migration, and (b) the revert-to-pending fix is the critical path — retry persistence is a nice-to-have for process restarts. The in-memory Map is acceptable for a single-process deployment.

3. **Least confident about going into the next batch or compound phase?** The draft-store race fix (#22) uses `initDb()` directly instead of going through `updateLead()`. This is because `updateLead` doesn't support conditional WHERE clauses. The direct SQL is correct but breaks the abstraction — if `updateLead` ever adds audit logging, this path would skip it.
