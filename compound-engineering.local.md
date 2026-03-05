# Review Context — Gig Lead Responder

## Risk Chain

**Brainstorm risk:** "Least confident about mobile UX design for the dashboard — needs wireframes or component breakdown in the plan phase."

**Plan mitigation:** Defined component layouts per breakpoint, tap target sizes (44px min), scrollable tab nav for 5-tab overflow. Simplified to cards-only layout.

**Work risk (from Feed-Forward):** SQLite table rebuild migration for CHECK constraint — only destructive DB operation. Merge to main with 5 divergent deploy-fix commits.

**Review resolution (Cycle 10):** 26 unique findings (2 P1, 6 P2, ~18 P3) from 7 agents. Top findings: production guard missing RAILWAY_ENVIRONMENT (P1), analyze endpoint missing CSRF header (P1). All 8 todos fixed.

**Fix resolution:** 8 fixed (2 P1, 6 P2), ~18 deferred (P3). Four patterns documented: solution-doc-violation escalation, defense-in-depth for integrations, copy-paste drift extraction, double-cast as type-model signal.

## Files to Scrutinize

| File | What changed | Risk area |
|------|-------------|-----------|
| `src/server.ts` | Security headers (HSTS, Referrer-Policy, Permissions-Policy), startup guard expanded | Merge conflict resolution — verify healthcheck ordering preserved |
| `src/auth.ts` | RAILWAY_ENVIRONMENT added to startup guard, creds check moved to startup | Fail-fast at startup instead of per-request exit |
| `src/follow-up-api.ts` | Extracted `handleAction()` helper, removed 63 lines duplication | Snooze body validation still runs before shared path |
| `src/follow-up-scheduler.ts` | Extracted `storeFollowUpDraft()` to leads.ts | Now uses leads.ts abstraction instead of raw SQL |
| `src/leads.ts` | New `storeFollowUpDraft()` function with WHERE guard | 700+ lines — structural split still pending |
| `src/twilio-webhook.ts` | Inline production guard added to Mailgun webhook | Defense-in-depth — startup check is primary |
| `public/dashboard.html` | X-Requested-With header added to analyze fetch | 2,474 lines — approaching extraction threshold |

## Review Blind Spots (Not Covered by Current Agent Roster)

- LLM prompt/response pipeline (generate.ts, verify.ts, enrich.ts) — prompt injection, output validation, token budget
- Dashboard client-side JS (2,474 lines) — DOM-based XSS, state management bugs
- Consider adding prompt-security and frontend-XSS agents for next review cycle

## Plan Reference

`docs/plans/2026-03-01-feat-follow-up-pipeline-v2-dashboard-plan.md`
