# Code Simplicity Reviewer — Review Findings

**Agent:** code-simplicity-reviewer
**Branch:** fix/batch-d-quick-wins
**Date:** 2026-02-25
**Files reviewed:** 2 (`src/server.ts`, `src/api.ts`)

## Findings

### [P1] Helmet middleware is registered after express.static — headers won't apply to static files
**File:** `src/server.ts:22-30`
**Issue:** Helmet is placed on lines 22-30, but `express.static` is on line 21. Express middleware runs top-to-bottom. When a browser requests `/dashboard.html`, `express.static` matches the file and sends the response before Helmet runs. None of Helmet's security headers (CSP, X-Content-Type-Options, X-Frame-Options, etc.) are applied to the HTML files that actually need them. The Helmet middleware only applies to routes registered after it: webhook, API, healthcheck, and redirect routes — JSON endpoints that don't benefit much from CSP. Without this fix, the Helmet configuration is dead complexity.
**Suggestion:** Move `app.use(helmet(...))` above `express.static`. One-line reorder that makes the existing code actually work.

---

### [P3] Helmet config is already minimal — no simplification needed (informational)
**File:** `src/server.ts:22-30`
**Issue:** None. Verified that Helmet v8.1.0's defaults cover the project's needs. The only override (`scriptSrc` adding `'unsafe-inline'`) is the minimum viable configuration. No over-engineering here.

---

### [P3] Error sanitization in api.ts is clean and minimal (informational)
**File:** `src/api.ts:143-144` and `src/api.ts:297-298`
**Issue:** None. Both changes follow the same pattern: `console.error` the real error, return a static string. No unnecessary abstraction (no shared helper, no error code enums). Two instances are similar but not worth extracting — that would be premature abstraction for two call sites with different log prefixes and response messages.

---

## Summary

- **Total potential LOC reduction:** 0 (nothing to remove)
- **Complexity score:** Low
- **YAGNI violations:** None
- **Recommended action:** Fix the P1 middleware ordering bug. The rest is already minimal.

| Severity | Count | Summary |
|----------|-------|---------|
| P1 | 1 | Helmet after static middleware — dead complexity |
| P3 | 2 | Informational — config and error handling are already minimal |
