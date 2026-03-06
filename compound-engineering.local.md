# Review Context — Gig Lead Responder

## Risk Chain

**Brainstorm risk:** "The follow-up count bug (setLeadOutcome doesn't freeze follow-ups) must be fixed as a prerequisite before follow-up effectiveness analytics are meaningful."

**Plan mitigation:** Step 0 of the plan fixes the bug before any analytics work. Fix goes in api.ts to avoid circular dependency.

**Work risk (from Feed-Forward):** "Line budget tightness (2,694/2,800) may have compressed rendering logic too much. Monthly Trends WHERE clause deviation needs review scrutiny."

**Review resolution (Cycle 14):** 7 findings (0 P1, 4 P2, 3 P3) from 7 agents. All P1+P2 fixed.

**Cycle 15 review:** 4 findings (0 P1, 3 P2, 1 P3 bundle) from 7 agents. All P2s fixed (058-060). P3 bundle deferred.

**Compound resolution (Cycle 15):** Solution doc written. Four defensive patterns documented (write-time normalization, loop guards, hoist-above-loop, CSS extraction). Risk: pre-existing test failures remain uninvestigated.

## Files to Scrutinize

| File | What changed | Risk area |
|------|-------------|-----------|
| `src/db/leads.ts` | event_type normalization moved INTO insertLead() | All write paths must go through this function |
| `src/webhook.ts` | event_type normalization REMOVED (delegates to insertLead) | Verify no other normalization remains |
| `src/db/queries.ts` | LOWER(TRIM()) kept in Query 6 with legacy comment | Legacy defense -- remove when all data is clean |
| `public/dashboard.html` | getBarValue hoisted above loop, fillMonthlyGaps loop guard | 1,596 lines after CSS extraction (was 2,680) |
| `public/dashboard.css` | NEW -- 1,086 lines extracted from dashboard.html | Browser caching enabled, CSP unsafe-inline removal possible |

## Remaining Gaps (carried forward)

- Pre-existing test failures (11 fails in budget-gap.test.ts, email-parser.test.ts) -- unknown root cause
- Analytics transaction error handling (8 queries, what if one throws?)
- LLM pipeline behavior never reviewed (prompt injection resilience)
- Accessibility never reviewed
- `npm audit` never run
- Pre-existing P1s: XSS unescaped LLM values (023), no input size guard (024), prompt injection chain (025)

## Plan Reference

`docs/plans/2026-03-05-feat-lead-analytics-dashboard-plan.md`
