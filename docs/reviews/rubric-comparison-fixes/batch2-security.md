# Security Sentinel — Review Findings

**Agent:** security-sentinel
**Branch:** main (rubric-comparison-fixes)
**Date:** 2026-02-21
**Files reviewed:** 8 (+ 3 supporting files for trust boundary context)

## Executive Summary

This is a CLI-based LLM pipeline (stdin input, Claude API calls, stdout output) with no HTTP endpoints in the changed files. The primary attack surface is **LLM output trust** — the pipeline parses unvalidated JSON from Claude responses and uses LLM-extracted fields (dates, budgets, strings) in code logic without runtime validation. No SQL injection, XSS, or authentication issues in scope. The most consequential risks are around malformed LLM output causing silent logic errors in pricing and date handling.

**Risk level:** Low-Medium overall. No P1 issues. Several P2 input validation gaps.

## Findings

### [P2] No runtime validation of `event_date_iso` from LLM — invalid dates silently corrupt logic
**File:** `src/pipeline/enrich.ts:16`
**Issue:** The LLM returns `event_date_iso` as a free-form string. `enrichClassification` passes it directly to `parseLocalDate()` without validating it matches `YYYY-MM-DD` format. If the LLM returns `"March 22"`, `"2026-13-45"`, or `"next Friday"`, `parseLocalDate` constructs `new Date("next FridayT12:00:00")` which returns `Invalid Date`. The comparison `eventDate < today` evaluates to `false`, so past-date detection silently fails. Similarly in `resolveFormatRouting` (line 77), `getDay()` on an Invalid Date returns `NaN`, making `isWeekend` always `false`.
**Suggestion:** Add a regex guard at the trust boundary:
```typescript
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
if (classification.event_date_iso && !ISO_DATE_RE.test(classification.event_date_iso)) {
  console.warn(`Invalid event_date_iso from LLM: "${classification.event_date_iso}" — treating as null`);
  enriched = { ...enriched, event_date_iso: null };
}
```
Also add an `isNaN` guard in `parseLocalDate`.

---

### [P2] LLM JSON output trusted without schema validation — type assertion `as T` is not runtime checking
**File:** `src/claude.ts:49`
**Issue:** `callClaude<T>` uses `JSON.parse(cleaned) as T` which is a TypeScript compile-time cast, not a runtime check. If Claude returns valid JSON that is structurally wrong (missing fields, wrong types, extra fields), the pipeline proceeds with a malformed object. `classify.ts` checks 4 fields but not the other ~20 fields in Classification. The `GateResult` from verify and `GenerateResponse` from generate receive zero field validation. If `gut_checks` is missing a key, `Object.values(checks).filter(Boolean).length` counts fewer items and the 12/14 threshold becomes wrong. If `flagged_concerns` is returned as a string instead of an array, `.includes()` calls will throw.
**Suggestion:** Add lightweight runtime type checks for critical LLM output fields. At minimum, validate `flagged_concerns` is an array and `gut_checks` has all expected keys.

---

### [P2] Prompt injection via raw lead text — user-controlled input embedded directly into LLM prompts
**File:** `src/pipeline/classify.ts:12`
**Issue:** Raw lead text from stdin is embedded directly into the user message. A malicious lead could contain prompt injection to manipulate classification (e.g., forcing T1 tier for lower pricing). The real-world threat model is low (leads come from booking platforms), but the trust boundary is worth documenting. The existing verify gate provides defense-in-depth.
**Suggestion:** Add a `rawText` length cap (e.g., 5000 chars). Consider logging raw classification alongside lead text for anomaly auditing. For production, validate that pricing-critical fields fall within expected distributions.

---

### [P2] `parseLocalDate` silently produces Invalid Date on any malformed input
**File:** `src/utils/dates.ts:7`
**Issue:** The function constructs `new Date(\`${isoDate}T12:00:00\`)` without validating the input string or checking the result. Any non-date string produces `Invalid Date` that propagates silently. `Invalid Date < validDate` returns `false`, and `Invalid Date.getDay()` returns `NaN`.
**Suggestion:** Add `isNaN(d.getTime())` guard and throw on invalid input.

---

### [P3] Hardcoded phone number in source code
**File:** `src/pipeline/generate.ts:18`
**Issue:** Business phone number `(619) 755-3246` is hardcoded in the `CONTACT_BLOCK` constant. While not a secret (intentionally shared with clients), updating requires a code change and redeployment.
**Suggestion:** Move to an environment variable or config file. Low priority.

---

### [P3] Error message in `claude.ts` leaks raw LLM response on JSON parse failure
**File:** `src/claude.ts:62`
**Issue:** When JSON parsing fails after retry, the error includes the full raw LLM response. If the response contained sensitive data from the system prompt (pricing tables, rate card tiers), it would be exposed in logs. Low risk in CLI context, higher risk in a future server deployment.
**Suggestion:** Truncate the raw response in the error message to first 200 chars.

---

### [P3] No input length limit on stdin raw text
**File:** `src/index.ts:16-20`
**Issue:** The pipeline reads all of stdin with no size limit. An extremely large input could cause memory exhaustion or send an excessively large prompt to the Claude API.
**Suggestion:** Add a size guard (e.g., 10,000 chars max).

---

### [P3] `flagged_concerns` array has no deduplication or length bound
**File:** `src/pipeline/enrich.ts:30-36`
**Issue:** `enrichClassification` appends to `flagged_concerns` via spread without checking for duplicates. If the LLM already returned a concern string, enrichment could duplicate it, potentially causing false gate failures in verify.
**Suggestion:** Deduplicate after enrichment: `enriched = { ...enriched, flagged_concerns: [...new Set(enriched.flagged_concerns)] };`

---

## Items Verified — No Issues Found

- **Secrets in source:** `.env` is in `.gitignore`. `ANTHROPIC_API_KEY` loaded from environment, not hardcoded.
- **SQL injection:** No database queries in changed files.
- **XSS:** No HTML rendering. Output is stdout/stderr only.
- **CSRF/Authentication:** No HTTP server or endpoints.
- **HTTPS enforcement:** CLI tool uses Anthropic SDK (HTTPS by default).
