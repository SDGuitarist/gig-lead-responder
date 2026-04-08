# Code Simplicity Reviewer — Review Findings

**Agent:** code-simplicity-reviewer
**Branch:** main (full codebase audit)
**Date:** 2026-04-07
**Files reviewed:** 63

## Findings

### [P1] `src/data/venues.ts` — Entire file is dead code
**File:** `src/data/venues.ts:1-83`
**Issue:** `findVenue()`, `VENUE_MAP`, `STEALTH_PREMIUM_ZIPS`, and `VenueEntry` are never imported by any source file. Zero consumers. Venue lookup is done via PF-Intel API (`venue-lookup.ts`), not this static map.
**Suggestion:** Delete the file entirely. Leftover from before PF-Intel integration.

---

### [P1] `SCOPES` constant never used at runtime
**File:** `src/automation/gmail-watcher.ts:12-15`
**Issue:** Defined but never referenced. Auth happens via stored tokens. Scopes only needed in `scripts/gmail-auth.ts`.
**Suggestion:** Delete lines 12-15.

---

### [P2] `src/automation/main.ts` largely duplicates `poller.ts`
**File:** `src/automation/main.ts:1-176`
**Issue:** 176-line standalone CLI entry point duplicates the core polling logic from `poller.ts` (139 lines). Core polling loops are nearly identical.
**Suggestion:** Delete if standalone mode is no longer used in production, or refactor to call `startGmailPoller()` from `poller.ts`. ~100 LOC saved.

---

### [P2] Triplicated `stmt()` cache pattern
**File:** `src/db/leads.ts:10-24`, `src/db/follow-ups.ts:9-24`, `src/db/queries.ts:31-46`
**Issue:** Same 15-line function copy-pasted in 3 DB files with "keep in sync" comments. Flagged in Cycle 12 at 8/9 agent consensus, fix not merged.
**Suggestion:** Extract to `src/db/stmt-cache.ts`. ~30 LOC removed.

---

### [P2] Two separate Twilio SMS senders
**File:** `src/sms.ts` vs `src/automation/senders/twilio-sms.ts`
**Issue:** Both send SMS to Alex via different interfaces. Server version uses env vars directly; automation version takes config object and creates new client per call.
**Suggestion:** Consolidate into one module. ~30 LOC saved.

---

### [P2] `baseUrl()` helper duplicated
**File:** `src/twilio-webhook.ts:26-28`, `src/follow-up-scheduler.ts:14`
**Issue:** Same function, same implementation, two files.
**Suggestion:** Extract to shared utility. ~5 LOC saved.

---

### [P2] `dedup.ts` reads/writes entire JSON file on every check
**File:** `src/automation/dedup.ts:6-23`
**Issue:** Full disk I/O per poll cycle. Concurrent calls could lose data (read-modify-write race). DB-based `processed_emails` table already exists for webhook path.
**Suggestion:** Cache set in memory or reuse SQLite table.

---

### [P2] Three-layer async detection in `runTransaction` — Layer 2 is YAGNI
**File:** `src/db/leads.ts:193-222`
**Issue:** Layer 2 (`isAsyncFunction` check) provides marginal safety over Layer 1 (TypeScript types) and Layer 3 (runtime catch). TypeScript already prevents async callbacks.
**Suggestion:** Remove Layer 2 (`isAsyncFunction` check). ~5 LOC saved.

---

### [P2] `plan-gate.ts` lives in `src/` alongside production code
**File:** `src/plan-gate.ts:1-327`
**Issue:** CLI tool for validating plan documents. Not part of application runtime. Muddies the boundary between prod code and dev tooling.
**Suggestion:** Move to `scripts/` or `tools/` directory.

---

### [P3] Commented-out guardrail code confirmed removable
**File:** `src/automation/router.ts:70-74`
**Issue:** Comment says "Rates were verified 2026-03-29 — this guardrail can now be removed."
**Suggestion:** Delete the commented-out code.

---

### [P3] `constants.ts` has only 2 constants
**File:** `src/constants.ts:1-4`
**Issue:** `PF_INTEL_TIMEOUT_MS` and `VENUE_CONTEXT_HEADER` used in only 2 files. Borderline whether a dedicated file is needed.
**Suggestion:** Could inline, but file is small enough that this is taste.

---

### [P3] `cli-error.ts` — Separate file for 1 function
**File:** `src/utils/cli-error.ts:1-27`
**Issue:** Single exported function `logCliPipelineError` used only by `src/index.ts`. Injectable logger parameter suggests test-friendliness but function is simple enough to inline.
**Suggestion:** Inline into `src/index.ts`. ~20 LOC file overhead saved.

---

### [P3] "No venue intelligence" placeholder wastes LLM tokens
**File:** `src/pipeline/context.ts:67-69`
**Issue:** Injects "No venue intelligence available" into LLM context. The LLM doesn't need to be told about absence of data.
**Suggestion:** Remove the placeholder section.

---

### [P3] `close()` on YelpPortalClient is a no-op
**File:** `src/automation/portals/yelp-client.ts:360-362`
**Issue:** Method does nothing, but callers await it. Comment confirms "nothing to clean up."
**Suggestion:** Keep for API consistency, just noting.

---

### [P3] `readonly` on every field in `AutomationConfig`
**File:** `src/automation/config.ts:7-8`
**Issue:** Object created once, never mutated. `readonly` adds noise without preventing actual mutation risk.
**Suggestion:** No action needed, just noise.

---

## Summary

**Total potential LOC reduction:** ~225 lines (~5% of ~4,500 non-prompt source lines)

**Complexity score:** Low-to-Medium. Main debt is leftover artifacts (venues.ts, standalone main.ts) and a known-but-unmerged refactor (triplicated stmt cache).
