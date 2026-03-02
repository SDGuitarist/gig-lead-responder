# Review Context — Rate Limiting

## Risk Chain

**Brainstorm risk:** In-memory store resets on Railway deploys — rate limits effectively reset each time.

**Plan mitigation:** Accepted. Single-user threat model — catches sustained runaway, not one-off spikes. Even with resets every 15min, runaway script gets at most 5 requests per restart (99.4% reduction).

**Work risk (from Three Questions):** The `response.ok` check in dashboard uses `throw new Error()` inside `.then()` to trigger `.catch()` — indirect control flow.

**Review resolution:** Throw-in-then is correct, no race condition. Two cleanup improvements: `.finally()` for button re-enable (todo 003), remove content-type sniffing dead code (todo 004). NEW finding: Ctrl+Enter bypasses in-flight guard (todo 001, P1).

## Files to Scrutinize

| File | What changed | Risk area |
|------|-------------|-----------|
| `src/rate-limit.ts` | New file — exports `analyzeLimiter` and `approveLimiter` | Handler type signature (todo 002) |
| `src/server.ts` | `app.set("trust proxy", 1)` | Correct for Railway, fragile if infra changes |
| `src/api.ts` | Per-route limiter middleware on analyze + approve | Middleware ordering verified correct |
| `public/dashboard.html` | `response.ok` check in `runAnalyze()` | Ctrl+Enter re-entry (todo 001), .finally() (003), dead code (004) |

## Plan Reference

`docs/plans/2026-02-26-feat-api-rate-limiting-plan.md`

---

# Review Context — Follow-Up Pipeline

## Risk Chain

**Brainstorm risk:** Email reply detection edge cases — reply-to-reply chains, forwarded messages, and out-of-office auto-responses from GigSalad/The Bash. No real email samples yet.

**Plan mitigation:** Feed-forward risk flagged. Parser deferred until real samples collected. Phase 5 (email reply detection) explicitly depends on sample collection.

**Work risk (from Institutional Learnings):** 5 risk areas identified before implementation:
1. Scheduler + dashboard race on concurrent state transitions
2. Follow-up verify gate threshold calibration (too strict = manual fallback, too loose = spam)
3. Email reply detection edge cases (no real samples yet)
4. Snoozed leads becoming invisible if scheduler doesn't explicitly un-snooze
5. Follow-ups bypass existing rate limiting (background schedule, not HTTP endpoint)

## Cumulative Risk Table

| Risk | Source | Status | Resolution |
|------|--------|--------|------------|
| In-memory rate limit resets on deploy | Rate Limiting brainstorm | Accepted | Single-user model, catches sustained runaway |
| Ctrl+Enter bypasses in-flight guard | Rate Limiting review (P1) | Fixed | Guard inside function pattern applied |
| Scheduler + dashboard concurrent claims | Follow-Up Pipeline learnings | Open | Atomic claim pattern (`claimFollowUpForSending()`) planned |
| Verify gate threshold calibration | Follow-Up Pipeline learnings | Open | Start at `TOTAL - 2`, adjust from production metrics |
| Email reply detection edge cases | Follow-Up Pipeline brainstorm | Open | Blocked on real email samples from GigSalad/The Bash |
| Snoozed leads invisible forever | Follow-Up Pipeline learnings | Open | Scheduler must query `snoozed_until <= now` explicitly |
| Follow-ups bypass rate limiting | Follow-Up Pipeline learnings | Open | Consider per-lead limit (max 3 per 7 days) |

## Files to Scrutinize

| File | What changed | Risk area |
|------|-------------|-----------|
| `src/rate-limit.ts` | New file — exports `analyzeLimiter` and `approveLimiter` | Handler type signature (todo 002) |
| `src/server.ts` | `app.set("trust proxy", 1)` | Correct for Railway, fragile if infra changes |
| `src/api.ts` | Per-route limiter middleware on analyze + approve | Middleware ordering verified correct |
| `public/dashboard.html` | `response.ok` check in `runAnalyze()` | Ctrl+Enter re-entry (todo 001), .finally() (003), dead code (004) |

## Plan References

- `docs/plans/2026-02-26-feat-api-rate-limiting-plan.md`
- `INSTITUTIONAL-LEARNINGS.md` — Follow-Up Pipeline section (learnings 1-9, risk areas 1-5)
