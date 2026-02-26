# Performance Oracle — Review Findings

**Agent:** performance-oracle
**Branch:** fix/batch-d-quick-wins
**Date:** 2026-02-25
**Files reviewed:** 2 (`src/server.ts`, `src/api.ts`)

## Summary

The three commits are security-focused (Helmet + error sanitization). The changes introduce **no measurable performance impact**. Helmet is synchronous header-setting (<0.05ms/request). Error sanitization replaces string interpolation with static strings — identical or negligibly faster. All findings below are pre-existing patterns observed while reviewing the changed files.

## Findings

### [P3] Helmet middleware ordering: will run on static assets after reorder fix
**File:** `src/server.ts:22-30`
**Issue:** Once Helmet is moved above `express.static` (to fix the correctness bug), it will execute on every static asset request. Helmet v8 is extremely lightweight — ~11 synchronous header assignments, <0.05ms per request. At this application's scale (single-user dashboard), zero measurable impact.
**Suggestion:** No action needed. This is informational — confirming the correctness fix has no performance cost.

---

### [P3] `shapeLead()` called per-row on unbounded list endpoint with JSON parsing
**File:** `src/api.ts:89-98`
**Issue:** `GET /api/leads` does `SELECT * FROM leads` with no LIMIT, then maps every row through `shapeLead()` which performs 3x `JSON.parse()` per row. At current scale (tens to low hundreds of leads), this is fine (~5-10ms at 1,000 rows). This application will almost certainly never reach 10,000+ leads.
**Suggestion:** Watch item for future scaling. Add pagination (`LIMIT/OFFSET`) if lead count grows past a few hundred. No action needed now.

---

### [P3] SSE analyze endpoint has no timeout or abort handling
**File:** `src/api.ts:279-302`
**Issue:** `POST /api/analyze` opens an SSE stream and awaits `runPipeline()` with no timeout. If the Claude API hangs, the connection stays open indefinitely. Multiple retries from the dashboard could accumulate open connections. Not a regression from this branch — pre-existing pattern.
**Suggestion:** Consider adding a request-level timeout (~120s) and `req.on('close')` listener to detect client disconnects. Low priority given single-user usage.

---

## Changes-Specific Verdict

All three commits introduce **zero performance regression**:

1. **Helmet**: Synchronous header-setting, <0.05ms overhead, no memory allocation beyond initial closure
2. **SMS error sanitization**: Static string replaces interpolated string — equivalent performance, error path only
3. **Analyze error sanitization**: Same pattern — `console.error` + static string, error path only

No P1 or P2 performance issues found.
