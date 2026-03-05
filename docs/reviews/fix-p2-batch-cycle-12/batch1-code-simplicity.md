# Code Simplicity Reviewer — Review Findings

**Agent:** code-simplicity-reviewer
**Branch:** fix/p2-batch-cycle-12
**Date:** 2026-03-05
**Files reviewed:** 21

## Summary

| Priority | Count |
|----------|-------|
| P1       | 1     |
| P2       | 4     |
| P3       | 4     |

**Complexity score:** Low
**Total potential LOC reduction:** ~52 lines (~3% of source code)

## Findings

### [P1] Triplicated `stmt()` cache pattern across 3 DB modules
**Files:** `src/db/leads.ts:10-24`, `src/db/follow-ups.ts:10-24`, `src/db/queries.ts:10-24`
**Issue:** Exact same 15-line `stmt()` function with `cachedDb` and `stmtCache` copy-pasted across all three DB modules. "Keep in sync" comment is a code smell — infrastructure code with cache invalidation semantics should not be duplicated.
**Suggestion:** Extract into `src/db/stmt.ts` with `createStmtCache()` factory. Each module calls `const stmt = createStmtCache()`. Removes ~30 lines and the sync hazard.

---

### [P2] Duplicated `baseUrl()` helper in two files
**Files:** `src/follow-up-scheduler.ts:13-15`, `src/twilio-webhook.ts:26-28`
**Issue:** Identical function: `(process.env.BASE_URL || "").replace(/\/+$/, "")`. Two files to update if logic changes.
**Suggestion:** Move to `src/utils/base-url.ts`. Saves ~6 lines.

---

### [P2] `TERMINAL_CLEAR` constant only used once
**File:** `src/db/follow-ups.ts:83-87`
**Issue:** Defined as named constant but used only in `approveFollowUp`. `skipFollowUp` and `markClientReplied` inline the same NULL assignments in SQL. Neither consistent nor actually reducing duplication.
**Suggestion:** Either inline at line 112 (removing the constant) or refactor skip/replied to use it. Pick one approach.

---

### [P2] `computeFollowUpDelay` function wraps a simple array lookup
**File:** `src/db/follow-ups.ts:48-50`
**Issue:** Entire function body is `return FOLLOW_UP_DELAYS_MS[followUpCount]`. Function name is longer than the code. Array is already descriptively named.
**Suggestion:** Use `FOLLOW_UP_DELAYS_MS[count]` directly at the two call sites. Remove the function. Saves 4 lines and one level of indirection.

---

### [P2] Double validation in `setLeadOutcome` — API already validates
**File:** `src/db/leads.ts:228-233`
**Issue:** `setLeadOutcome` re-validates `actual_price` (positive, finite) and `lead.status !== "done"`. The only API caller already performs these exact same validations. Defense-in-depth that adds cognitive load without adding safety.
**Suggestion:** If only called from validated endpoints, remove redundant checks. If keeping as safety net, add comment explaining intentional duplication.

---

### [P3] Unused `reasoning` field in `GenerateResponse` interface
**File:** `src/pipeline/generate.ts:7-13`
**Issue:** `reasoning` field is typed in the interface but never accessed or validated downstream. Only `full_draft` and `compressed_draft` are used.
**Suggestion:** Remove the type definition or change to `reasoning?: unknown`. Saves 7 lines.

---

### [P3] `result.ok` exhaustive check is unnecessary
**File:** `src/webhook.ts:102-106`
**Issue:** After checking `reason === "skip"` and `reason === "parse_error"`, the type is fully narrowed. Comment says "shouldn't reach here, but satisfies TypeScript narrowing."
**Suggestion:** This is fine as-is — TypeScript does need the exhaustive check. No action needed.

---

### [P3] `req.body` nullcheck is overly defensive in Express
**Files:** `src/follow-up-api.ts:43-46`, `src/api.ts:166-169`
**Issue:** `if (!req.body || typeof req.body !== "object")` guards POST endpoints that already have `express.json()` middleware. Catches missing Content-Type header edge case.
**Suggestion:** Reasonable — gives clearer error message. No action strictly needed.

---

### [P3] Table rebuild migration runs column-add on fresh databases
**File:** `src/db/migrate.ts:65-87`
**Issue:** Column-migration loop adds columns that already exist in CREATE TABLE for new databases. Harmless due to `existingCols` check but wasted work.
**Suggestion:** No action needed — `existingCols` handles it correctly.

---

## Final Assessment

This codebase is already quite lean. The biggest win is the P1 stmt-cache dedup which removes a maintenance hazard. The other findings are polish. Code follows good patterns: early returns, clear naming, no unnecessary abstractions, no premature generalization. The barrel re-export in `src/db/index.ts` is the right level of abstraction.
