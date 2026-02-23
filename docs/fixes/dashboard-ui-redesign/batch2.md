# Batch 2 — Data Integrity and Hot Path Results

**Branch:** main
**Date:** 2026-02-22
**Commit:** 1f8197f

### Prior Phase Risk

> "Batch B touches `src/auth.ts` (env var guard, timing-safe compare, colon parsing) and the approve handler race condition. The auth changes will affect local development — currently auth is skipped when env vars are unset. After the fix, devs will need `DASHBOARD_USER` and `DASHBOARD_PASS` set even locally (or we choose a `NODE_ENV` check). That workflow change should be clearly communicated."

Addressed with a `NODE_ENV === "production" || RAILWAY_ENVIRONMENT` check. In production, missing auth vars = fatal exit. In development, auth is still skipped (with a console warning). No local workflow change needed.

## Changes Made

### #1 — Unauthenticated `/api/analyze` endpoint
**File:** `src/server.ts` (30 lines removed), `src/api.ts:6,76-77,170-193` (route added), `public/dashboard.html:1492-1493` (auth header added)
**What changed:** Moved the `/api/analyze` route and `sendSSE` helper from `server.ts` into `api.ts`, where it's automatically covered by the router-level `basicAuth` middleware. Updated the dashboard's `runAnalyze()` to include the `Authorization` header, matching the pattern used by `apiPost()`.
**Review finding:** P1 — Anyone who discovers the URL can trigger `runPipeline()`, burning paid Anthropic API credits. Client-side fetch also lacked the auth header.

---

### #2 — Approve endpoint race condition (double SMS)
**File:** `src/types.ts:177` (`"sending"` added), `src/leads.ts:189-198` (new `claimLeadForSending`), `src/api.ts:113-119` (atomic claim), `public/dashboard.html:907,1134-1135` (sending status display)
**What changed:** Added a `"sending"` transitional status to `LeadStatus`. New `claimLeadForSending()` function does an atomic `UPDATE...WHERE status IN ('received','sent')` — if two requests arrive simultaneously, only one gets `changes > 0`. On SMS failure, status reverts to the previous value. Dashboard displays "Sending" badge and disables approve during this state.
**Review finding:** P1 — Two concurrent approve requests both pass the status check and both send SMS. The frontend button disable is not a server-side guarantee.

---

### #3 — Auth bypass when env vars unset
**File:** `src/auth.ts:22-29`
**What changed:** Added a production guard: if `NODE_ENV === "production"` or `RAILWAY_ENVIRONMENT` is set, missing `DASHBOARD_USER`/`DASHBOARD_PASS` triggers `process.exit(1)` with a fatal error message. In development, auth is still skipped but now logs a warning.
**Review finding:** P1 — If Railway deployment loses env vars, everything including approve/send-SMS becomes publicly accessible.

---

### #4 — Non-null assertion on `updateLead` return
**File:** `src/api.ts:132-135,161-164`
**What changed:** Replaced `shapeLead(updated!)` with explicit null checks returning 500 errors. Both the approve and edit handlers now guard against the (unlikely) case where `updateLead` returns undefined.
**Review finding:** P1 — The `!` assertion passes `undefined` into `shapeLead()`, which throws an unhandled TypeError.

---

### #7 — Auth applied piecemeal
**File:** `src/api.ts:9`
**What changed:** Replaced two per-path `router.use("/api/leads", basicAuth)` and `router.use("/api/stats", basicAuth)` calls with a single `router.use(basicAuth)`. All routes in the API router are now protected by default — new routes don't need to remember to add auth.
**Review finding:** P2 — Per-path auth directly caused P1 #1 (the analyze endpoint was missed).

---

### #8 — Timing-unsafe password comparison
**File:** `src/auth.ts:5-12`
**What changed:** Added a `safeCompare()` helper using `crypto.timingSafeEqual`. Handles different-length strings by comparing against self (constant time) then returning false. Replaced the `===` comparison on both username and password.
**Review finding:** P2 — String `===` short-circuits on first mismatch, leaking timing information.

---

### #9 — Basic Auth parser breaks on colons
**File:** `src/auth.ts:41-49`
**What changed:** Replaced `decoded.split(":")` with `indexOf(":")` + `slice()`. Per RFC 7617, only the first colon separates username from password — the password may contain colons. Also added a guard for the case where no colon is found at all.
**Review finding:** P2 — A password like `my:secret:pass` gets truncated to `"secret"`.

---

### #15 — Edit doesn't update `compressed_draft`
**File:** `src/api.ts:156`
**What changed:** When `full_draft` is edited, `compressed_draft` is set to `null`. The approve handler already blocks sending without a compressed draft (`"Lead has no draft to send"`). Dashboard's `canApprove` check now also requires `l.compressed_draft` to be truthy, preventing the approve button from appearing on leads with stale SMS drafts.
**Review finding:** P2 — Editing full_draft leaves compressed_draft stale; approve sends the old pre-edit version via SMS.

---

## Considered but Rejected

- **Re-running compression on edit** — Would require calling the pipeline from the edit handler, adding complexity and Anthropic API cost to every edit. Nulling the field and requiring re-analyze is simpler and gives the user explicit control.
- **Database-level `sending` status constraint** — The existing `CHECK` constraint on status (proposed in finding #23, Batch C) would need to include `sending`. Since #23 is deferred to Batch C, we didn't add a CHECK here — the TypeScript type is the current enforcement layer.
- **Logging the auth warning only once** — The `console.warn` in dev mode fires on every request. Considered a static flag but it adds complexity for a dev-only message. Left as-is.

## Deferred to Later Batch

- Nothing deferred. All 8 Batch B findings completed.

## Three Questions

### 1. Hardest fix in this batch?

The approve race condition (#2). Had to decide between modifying the generic `updateLead` function (adding a WHERE clause parameter) vs. a dedicated `claimLeadForSending` function. Chose the dedicated function because: (a) it's a single-purpose atomic operation that doesn't fit the generic update pattern, (b) the `WHERE status IN (...)` guard is specific to the approve flow, and (c) it keeps `updateLead` simple for all other callers. The rollback-on-SMS-failure path also required thought — reverting to `lead.status` (the status read before claiming) is correct even if it was "sent" from a previous webhook flow.

### 2. What did you consider fixing differently, and why didn't you?

Considered making the auth prod guard throw instead of `process.exit(1)` — this would let tests and health checks still work. But `process.exit(1)` matches the existing pattern for `ANTHROPIC_API_KEY` (server.ts:11-13), and a server without auth shouldn't be serving any requests in production, including health checks. Railway will see the exit and show a deploy failure, which is the right signal.

### 3. Did anything in this batch change the scope or approach for the next batch?

Yes, two things for Batch C:
1. **Finding #17 (move /api/analyze to api.ts)** is now done as part of #1. Batch C can skip it entirely.
2. **Finding #23 (CHECK constraint on status)** now needs to include `'sending'` in the allowed values if it's implemented.
