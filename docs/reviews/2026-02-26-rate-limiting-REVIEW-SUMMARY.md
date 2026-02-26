---
title: "Review: per-route rate limiting (cb7e3f3)"
date: 2026-02-26
commit: cb7e3f3
plan: docs/plans/2026-02-26-feat-api-rate-limiting-plan.md
---

# Review Summary — Per-Route Rate Limiting

**Commit:** `cb7e3f3` — feat: add per-route rate limiting to cost-sensitive API endpoints
**Branch:** `main`
**Files changed:** 6 (81 lines added, 2 removed)

## Findings Summary

- **Total Findings:** 11
- **P1 CRITICAL:** 1 — BLOCKS MERGE
- **P2 IMPORTANT:** 4 — Should fix
- **P3 NICE-TO-HAVE:** 6 — Enhancements (3 pre-existing)

## P1 — Critical (Blocks Merge)

| # | Finding | File | Source |
|---|---------|------|--------|
| 001 | **Ctrl+Enter keyboard shortcut bypasses in-flight guard** — two concurrent SSE streams fight over same DOM nodes | `dashboard.html:2091` | julik-frontend-races-reviewer |

## P2 — Important (Should Fix)

| # | Finding | File | Source |
|---|---------|------|--------|
| 002 | **Handler type signature mismatch + factory YAGNI** — replace `createLimitHandler` factory with shared handler, fix type to match express-rate-limit v8 | `rate-limit.ts:9-14` | kieran-typescript-reviewer + code-simplicity-reviewer |
| 003 | **Use `.finally()` not `.then()` after `.catch()`** — button cleanup should use `.finally()` for clarity and edge-case safety | `dashboard.html:2083` | kieran-typescript-reviewer |
| 004 | **Remove content-type sniffing dead code** — custom handler always returns JSON; text fallback branch can never execute | `dashboard.html:2030-2040` | code-simplicity-reviewer |
| 005 | **Rename shadowed `text` variable** — inner callback `text` shadows outer user input `text`. Auto-resolved by 004. | `dashboard.html:2037` | julik-frontend-races-reviewer + architecture-strategist |

## P3 — Nice-to-Have

| # | Finding | File | Source | Note |
|---|---------|------|--------|------|
| 006 | Add `retry_after_seconds` to 429 JSON body | `rate-limit.ts` | agent-native-reviewer | Enhancement |
| 007 | `/api/leads/:id/edit` has no rate limiter or edit-round cap | `api.ts:164` | security-sentinel | Out of scope |
| 008 | SMS failure path may leak Twilio internals | `api.ts:141-146` | security-sentinel | Pre-existing |
| 009 | `apiFetch` doesn't parse JSON error body on non-ok | `dashboard.html:1231` | security-sentinel + agent-native | Pre-existing |
| 010 | Document `trust proxy: 1` Railway assumption | `server.ts:28` | security-sentinel | Documentation |
| 011 | Hide empty stage rows after 429 | `dashboard.html` | julik-frontend-races-reviewer | Cosmetic |

## Risk Area Resolution

**Flagged risk from work phase:** "The `response.ok` check uses `throw new Error()` inside `.then()` to trigger `.catch()`. Indirect control flow."

**Resolution:** The throw-in-then pattern is **correct and safe** — no race condition. Two agents confirmed it works as expected. However, the cleanup `.then()` after `.catch()` should become `.finally()` (todo 003), and the content-type sniffing is YAGNI dead code (todo 004).

## What's Done Well

All 8 agents noted these positive patterns:
- **Middleware ordering correct** — `basicAuth` fires before rate limiters; unauthenticated requests never touch rate counters
- **`trust proxy: 1`** — correct for Railway's single-proxy architecture
- **Module isolation** — `rate-limit.ts` follows the `auth.ts` pattern exactly
- **Per-route application** — only cost-sensitive routes are rate-limited
- **JSON 429 responses** — machine-parseable with standard `RateLimit-*` headers
- **XSS-safe error rendering** — `.textContent` throughout, not `.innerHTML`
- **No technical debt** — deferred items explicitly documented in plan

## Review Agents Used

| Agent | Result |
|-------|--------|
| kieran-typescript-reviewer | 2 findings (handler types, .finally) |
| security-sentinel | 2 medium + 2 low findings |
| performance-oracle | Clean pass — no performance regressions |
| architecture-strategist | Clean pass + 1 observation (text shadow) |
| code-simplicity-reviewer | 2 findings (factory YAGNI, dead code) |
| agent-native-reviewer | Clean pass + 1 optional enhancement |
| learnings-researcher | 3 relevant past solutions, all confirm decisions |
| julik-frontend-races-reviewer | 1 high + 1 medium + 2 low findings |

## Three Questions

1. **Hardest judgment call in this review?** Whether the content-type sniffing (todo 004) deserves P2 or P3. The plan explicitly designed it as defensive ("belt-and-suspenders for misconfigured handler"), and the simplicity reviewer called it dead code. Went P2 because it adds 7 lines of code that can never execute — dead code actively misleads future readers.

2. **What did you consider flagging but chose not to, and why?** The `req.ip` possibly being `undefined` in the `console.warn` template literal (TypeScript reviewer noted it). `req.ip` is `undefined` only if there's no `X-Forwarded-For` AND no socket address — effectively impossible on Railway. Logging `undefined` in a diagnostic line is acceptable, not worth a todo.

3. **What might this review have missed?** The interaction between rate limiting and the SSE abort/close behavior. If the user navigates away mid-stream, does the SSE connection close cleanly? None of the 8 agents tested this scenario. Also, no agent tested what happens when `express-rate-limit` v8's MemoryStore cleanup timer fires during a long-running SSE stream on the same route.
