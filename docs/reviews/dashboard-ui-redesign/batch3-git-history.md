# Git History Analyzer — Review Findings

**Agent:** compound-engineering:research:git-history-analyzer
**Branch:** main (commit range ddb515d..d5b34fe)
**Date:** 2026-02-22
**Files reviewed:** 7

## Context

All 9 commits were authored by Alex Guillen on 2026-02-22 between 19:21 and 19:58 (37-minute window). The work follows a chunked plan with interleaved documentation commits (HANDOFF.md updates after each chunk). The pattern is disciplined: implement chunk, then update handoff doc. No reverts. No force pushes. No signs of thrashing.

## Findings

### [P1] /api/analyze endpoint has no authentication
**File:** `src/server.ts:51`
**Issue:** The `/api/analyze` endpoint calls `runPipeline`, which invokes the Anthropic API and writes to the database. It has zero authentication. The git history shows the `basicAuth` extraction in commit `b918790` only applied `router.use` to `/api/leads` and `/api/stats` paths. The `/api/analyze` endpoint in `server.ts` was never touched for auth — it survived the auth refactoring without gaining protection.
**Suggestion:** Move `/api/analyze` into `src/api.ts` so it goes through the same `basicAuth` middleware, or add `basicAuth` directly to this route. Consider rate limiting since each call burns Anthropic API credits.

---

### [P2] Old server-rendered dashboard still mounted alongside new SPA dashboard
**File:** `src/server.ts:31`
**Issue:** Both `dashboardRouter` (old server-rendered HTML at `/leads` and `/leads/:id`) and `apiRouter` (new JSON API) are mounted simultaneously. The root `/` now redirects to `/dashboard.html` (the new SPA), but the old `/leads` routes remain live. This creates two parallel interfaces to the same data with different capabilities.
**Suggestion:** If the old dashboard is kept intentionally as a fallback, document that intent. If superseded, consider removing `dashboardRouter` in a future cleanup commit.

---

### [P2] Non-null assertion on updateLead return value
**File:** `src/api.ts:136`
**Issue:** Both `shapeLead(updated!)` calls use TypeScript's non-null assertion. `updateLead` returns `LeadRecord | undefined`. There is a TOCTOU gap: another request could delete the lead between the check and the update. If `updateLead` returns `undefined`, the `!` assertion silently passes `null` into `shapeLead`.
**Suggestion:** Replace `shapeLead(updated!)` with an explicit guard and 404 response.

---

### [P2] 1,558-line single HTML file with embedded CSS, markup, and JavaScript
**File:** `public/dashboard.html:1-1558`
**Issue:** The file grew from 0 to 1,558 lines across 4 commits. It contains all CSS (~500 lines), all HTML (~400 lines), and all JavaScript (~600 lines) in one file. The git history shows each chunk adding 300+ lines at a time with no intermediate refactoring.
**Suggestion:** Acceptable for an internal tool at this stage. Consider splitting into separate files if the file continues to grow. At minimum, add a table of contents comment listing major section line numbers.

---

### [P3] Auth middleware uses simple string comparison for password
**File:** `src/auth.ts:23`
**Issue:** The `basicAuth` function compares password with `p === pass`, which is vulnerable to timing attacks. Git history shows this code was extracted verbatim from `dashboard.ts` in commit `b918790` — the pattern was inherited, not newly introduced.
**Suggestion:** For production, consider using `crypto.timingSafeEqual`. Low priority for an internal tool.

---

### [P3] sendSms called with compressed_draft but no length validation
**File:** `src/api.ts:123`
**Issue:** The approve endpoint sends `lead.compressed_draft` directly to `sendSms` with no length validation. SMS messages have a 1600-character limit for concatenated SMS. Git history shows this endpoint was introduced in the first commit of the range and was not revisited.
**Suggestion:** Add a length check or log warning if `compressed_draft` exceeds typical SMS limits.

---

### [P3] src/leads.ts listed as changed but has zero diff in the range
**File:** `src/leads.ts`
**Issue:** The file was included in the review scope as "changed" but has no commits touching it in the range ddb515d..d5b34fe. Its last change was in the range start boundary commit. Not a code issue — a review scope note.
**Suggestion:** No action needed.
