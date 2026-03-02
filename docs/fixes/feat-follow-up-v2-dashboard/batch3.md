# Batch C — Code Quality and Abstractions Results

**Branch:** feat/follow-up-v2-dashboard
**Date:** 2026-03-02
**Commit:** `c244fc7`

### Prior Phase Risk

> "Least confident about going into the next batch or compound phase? The draft-store race fix (#22) uses `initDb()` directly instead of `updateLead()` because `updateLead` doesn't support conditional WHERE clauses."

This risk is outside Batch C's scope (code quality, not data-integrity). The direct SQL in #22 is correct and tested; the abstraction break is noted for future refactoring (#14 ID-parse boilerplate, #20 updateLead double-read).

---

## Changes Made

### #8 — CSP blocks Google Fonts
**File:** `src/server.ts:42-46`
**What changed:** Added `https://fonts.googleapis.com` to `style-src` and new `font-src 'self' https://fonts.gstatic.com` directive. Dashboard loads Playfair Display from Google Fonts (line 7 of dashboard.html) — was silently blocked in CSP-enforcing browsers.
**Review finding:** P2 — CSP blocks Google Fonts, dashboard broken

---

### #9 — Pipeline error messages forwarded to client
**File:** `src/api.ts:320-322`
**What changed:** SSE error events now send a generic "Pipeline processing failed. Check server logs." instead of the raw `err.message`. Internal error details (API keys, stack traces) are logged server-side via `console.error`.
**Review finding:** P2 — Info leak via SSE error events

---

### #11 — Unsafe cast of req.body in snooze handler
**File:** `src/follow-up-api.ts:75-78`
**What changed:** Added `!req.body || typeof req.body !== "object"` guard before destructuring `req.body as SnoozeRequestBody`. Returns 400 if body is missing/invalid. Same pattern already used in the outcome handler (api.ts:235-238).
**Review finding:** P2 — Destructuring throws on null body

---

### #10 — No input length limits on edit and analyze
**File:** `src/api.ts:186-189` (edit), `src/api.ts:305-308` (analyze)
**What changed:** Added 50K character limit on `full_draft` (edit endpoint) and `text` (analyze endpoint). The global body limit is 100KB (server.ts:34), but per-field limits prevent a single field from consuming excessive LLM tokens.
**Review finding:** P2 — Unbounded token usage on edit/analyze

---

### #17 — apiFetch/apiPost inconsistent auth retry
**File:** `public/dashboard.html:1409-1415` (apiFetch), `public/dashboard.html:1451-1453` (apiPost)
**What changed:** apiFetch now clears `authHeader = null` and always re-prompts on 401 (was only prompting when authHeader was null — subsequent failures silently failed). apiPost now has the `.catch` fallback for non-JSON error responses (apiFetch already had it).
**Review finding:** P2 — Auth retry behavior differs between GET and POST

---

### #25 — Scheduler heartbeat log noisy
**File:** `src/follow-up-scheduler.ts:92` (removed)
**What changed:** Removed `console.log("[scheduler] heartbeat")` which fired every 15 minutes (96 lines/day). The scheduler still logs `[scheduler] N lead(s) due` when there are leads to process, so activity is visible without noise.
**Review finding:** P3 — 96 log lines/day with no information content

---

### #28 — Magic number 3 in dashboard follow-up count
**File:** `public/dashboard.html:1275` (constant), `public/dashboard.html:2347` (usage)
**What changed:** Added `var MAX_FOLLOW_UPS = 3` constant (with SYNC comment pointing to `src/leads.ts`) and replaced hardcoded `/3` with `'/' + MAX_FOLLOW_UPS`. If max follow-ups changes server-side, only one client-side line needs updating.
**Review finding:** P3 — Hardcoded magic number

---

### #36 — retryFailures map entries not bounded
**File:** `src/follow-up-scheduler.ts:10` (constant), `src/follow-up-scheduler.ts:36` (guard)
**What changed:** Added `RETRY_MAP_CAP = 50` and a `retryFailures.clear()` guard at the top of `checkDueFollowUps()`. In practice the map self-cleans (entries deleted on success or max retries), but this prevents unbounded growth if a bug creates orphaned entries.
**Review finding:** P3 — Unbounded Map growth

---

## Considered but Rejected

- **#12 Duplicated baseUrl()** — 2-line function identical in scheduler and webhook. Creating a shared module adds import coupling that's worse than the duplication. Both files have no other shared utility dependency.
- **#34 analyzeKvHTML raw HTML in value** — All call sites already escape string values with `esc()`. Auto-escaping inside the function would double-escape AND break the intentional HTML in gate status span (line 2202). The fragile-but-correct pattern is acceptable.
- **#32 SnoozeRequestBody one-field type** — The type provides documentation value at the `req.body as SnoozeRequestBody` cast site. Inlining saves one line in types.ts but loses the semantic label.

## Deferred to Later Batch

- **#14** Repeated ID-parse + lead-lookup boilerplate — 7 handlers, structural refactor that should be its own PR
- **#15** Terminal-state function consolidation — changes core state machine logic
- **#18** shapeLead imported from peer api.ts — structural file reorganization
- **#20** Double database read in updateLead — changes core DB function behavior
- **#31** `satisfies FollowUpActionResponse` used 12+ times — **FALSE POSITIVE**: annotation is not present in current code

## Three Questions

### 1. Hardest fix in this batch?

#17 (apiFetch/apiPost auth retry). The two functions had subtly different 401 handling that only mattered when a cookie session expired mid-session. Had to trace the auth flow: cookie-based session → 401 → Basic auth fallback → retry. The fix was minimal (2 lines per function) but the behavioral difference was non-obvious.

### 2. What did you consider fixing differently, and why didn't you?

Considered extracting a shared `authFetch(url, opts)` wrapper to unify apiFetch/apiPost completely. Rejected because: (a) the dashboard uses `var`-based JS without modules — a shared wrapper would still need separate GET/POST entry points, (b) the inconsistency was in the retry logic, not the structure, and (c) a full rewrite of the auth-fetch layer belongs in the dashboard-to-module refactor (finding #16, Batch D).

### 3. Did anything in this batch change the scope or approach for the next batch?

No — all changes are additive guards and fixes. Finding #31 was confirmed as a false positive (no `satisfies` annotations exist in follow-up-api.ts). The 5 deferred structural refactors (#14, #15, #18, #20) would benefit from being tackled together in a dedicated refactoring session rather than piecemeal in Batch D.
