# Gig Lead Responder — Session Handoff

**Last updated:** 2026-03-02
**Current phase:** Fix-batched (Batches A + B + C complete)
**Branch:** `feat/follow-up-v2-dashboard`
**Next session:** Fix-batched Batch D (deferred findings), or skip to Compound phase

### Prior Phase Risk

> "Least confident about going into the next batch or compound phase? The draft-store race fix (#22) uses `initDb()` directly instead of `updateLead()` because `updateLead` doesn't support conditional WHERE clauses."

Batch C addressed code quality: CSP, input limits, error leak, auth retry consistency. The direct SQL concern from Batch B remains — acceptable for single-process deployment, flagged for future refactor.

### Fix-Batched — Batch C (2026-03-02)

**What was done:**

Batch C (1 commit, 8 fixes):
- Added Google Fonts to CSP (fonts.googleapis.com + fonts.gstatic.com)
- Pipeline SSE errors now show generic message, details logged server-side
- Snooze handler guards against null/non-object req.body
- Input length limits (50K chars) on edit draft and analyze text
- apiFetch now re-prompts on 401 like apiPost; apiPost gets error catch fallback
- Scheduler heartbeat log removed (still logs when processing leads)
- Magic number `/3` replaced with `MAX_FOLLOW_UPS` constant in dashboard
- retryFailures map capped at 50 entries

8 findings deferred:
- #12 duplicated baseUrl() — coupling worse than duplication
- #14 ID-parse boilerplate — 7 handlers, structural refactor
- #15 terminal-state consolidation — core state machine
- #18 shapeLead coupling — structural file move
- #20 updateLead double read — core DB path
- #31 satisfies annotation — false positive (not in code)
- #32 SnoozeRequestBody — type adds documentation value
- #34 analyzeKvHTML — callers already escape

**Commits:**
1. `be86d17` — fix: batch A — remove dead code, fix comments, rename _req
2. `a20a710` — fix: add COOKIE_SECRET to .env.example
3. `cc1fc2b` — fix: recreate status/event_date indexes after table rebuild
4. `415949b` — fix: add csrfGuard to all POST routes in api.ts
5. `7313dbd` — fix: revert scheduler to pending on failure
6. `419b654` — fix: fold sms_sent_at into completeApproval transaction
7. `52d2cf0` — fix: replace non-null assertions on shapeLead
8. `1fecaca` — fix: guard scheduler draft store against race condition
9. `d90199f` — fix: add production guard to Twilio validation bypass
10. `c244fc7` — fix: batch C — code quality (CSP, input limits, error leak, auth retry)

## Three Questions

1. **Hardest fix in this batch?** #17 (apiFetch/apiPost auth retry). Subtle behavioral difference: apiFetch only prompted on first 401, apiPost always re-prompted. Required tracing the cookie→Basic auth fallback flow.

2. **What did you consider fixing differently, and why didn't you?** Considered extracting a shared `authFetch()` wrapper to unify GET/POST. Rejected — the dashboard's var-based JS makes module extraction premature. The auth layer belongs in the dashboard-to-module refactor (finding #16).

3. **Least confident about going into the next batch or compound phase?** The 5 deferred structural refactors (#14, #15, #18, #20 and the dashboard monolith #16) are all related — they'd benefit from a dedicated refactoring session. Batch D's deferred findings (rate limiting, pagination, session revocation) are product decisions, not code fixes.

### Prompt for Next Session

```
Read docs/HANDOFF.md. Run /fix-batched batch4 (Batch D — deferred, 8 findings needing product decisions). Or skip to /workflows:compound if Batch D is deprioritized. Relevant files: docs/fixes/feat-follow-up-v2-dashboard/plan.md
```
