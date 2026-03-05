# Kieran TypeScript Reviewer — Review Findings

**Agent:** kieran-typescript-reviewer
**Branch:** fix/p2-batch-cycle-12
**Date:** 2026-03-05
**Files reviewed:** 20

## Summary

| Priority | Count |
|----------|-------|
| P1       | 2     |
| P2       | 5     |
| P3       | 6     |

## Findings

### [P1] Unsafe `as any` for Promise detection in `runTransaction`
**File:** `src/db/leads.ts:207`
**Issue:** The line `typeof (result as any).then === "function"` uses `as any` to duck-type a Promise check. This bypasses type safety on the return value. The `NotPromise<T>` conditional type on line 189 also uses `any` in `T extends Promise<any>`.
**Suggestion:** Tighten the cast: `typeof (result as Record<string, unknown>).then === "function"`. The `Promise<any>` in the conditional type is an accepted TypeScript pattern and should stay.

---

### [P1] Triplicated `stmt()` cache pattern across db modules
**File:** `src/db/leads.ts:10-24`, `src/db/follow-ups.ts:10-24`, `src/db/queries.ts:10-24`
**Issue:** The exact same 13-line `stmt()` function (with its own `cachedDb` and `stmtCache`) is copy-pasted across three files. The comment "keep in sync" is a maintenance hazard — if someone changes one and forgets the others, prepared statements may leak or cache incorrectly. This is infrastructure code with cache invalidation semantics.
**Suggestion:** Extract to a shared `src/db/stmt-cache.ts` with a `createStmtCache()` factory. Each module calls `const stmt = createStmtCache()`.

---

### [P2] `shapeLead` returns `null` for undefined input but callers assume non-null
**File:** `src/utils/shape-lead.ts:12`
**Issue:** Function signature is `shapeLead(lead: LeadRecord | undefined): LeadApiResponse | null`. In `api.ts:27`, used as `leads.map(shapeLead)` where leads is `LeadRecord[]` — the undefined case never happens. In `api.ts:96`, result could be null if guard is reordered.
**Suggestion:** Add overloads to return tighter type when input is definite `LeadRecord`.

---

### [P2] `req.params.id as string` type assertion repeated across 5 handlers
**File:** `src/api.ts:51`, `src/api.ts:102`, `src/api.ts:149`, `src/follow-up-api.ts:21`, `src/follow-up-api.ts:40`
**Issue:** `parseInt(req.params.id as string, 10)` repeated in every route handler that takes an `:id` param. Duplicated parse-and-validate pattern.
**Suggestion:** Extract a `parseIdParam(req)` helper.

---

### [P2] `process.exit(1)` in `getCookieSecret()` can crash request handlers
**File:** `src/auth.ts:15`
**Issue:** `getCookieSecret()` is lazily called on the first authenticated request. If `COOKIE_SECRET` is missing in production, `process.exit(1)` kills the process mid-request. Violates existing solution doc: "No `process.exit()` in request handlers."
**Suggestion:** Move COOKIE_SECRET validation to startup in `server.ts` alongside other env var checks.

---

### [P2] Unsafe cast of JSON.parse results in `twilio-webhook.ts`
**File:** `src/twilio-webhook.ts:143-146`
**Issue:** `JSON.parse(lead.classification_json)` directly cast to `Classification` and `PricingResult` with no validation. Corrupt stored JSON would silently produce mismatched objects at runtime.
**Suggestion:** Add guard checks for critical fields before passing to `runEditPipeline`, matching the defensive pattern in `classify.ts`'s `validateClassification`.

---

### [P2] `webhook.ts` line 85 — `body["Message-Id"]` type narrowing is fragile
**File:** `src/webhook.ts:85`
**Issue:** `as string` casts on `body["Message-Id"]` assume the body fields are strings. If Mailgun sends a non-string value, the cast silently passes through.
**Suggestion:** Use `typeof` guards instead of `as string` casts.

---

### [P3] `TERMINAL_CLEAR` constant is declared but only used inline
**File:** `src/db/follow-ups.ts:83-87`
**Issue:** Only used in `approveFollowUp`. `skipFollowUp` and `markClientReplied` inline the same NULL assignments in raw SQL. Inconsistent usage.
**Suggestion:** Either use consistently or remove.

---

### [P3] Import organization inconsistency
**File:** Multiple files
**Issue:** Some files use separate import statements for types and values from the same module instead of combined imports.
**Suggestion:** Combine where possible: `import { VALUE, type Type } from "./module.js"`.

---

### [P3] `dashboardHtml` loaded synchronously at module top-level
**File:** `src/server.ts:70`
**Issue:** `readFileSync` at top level caches forever. Intentional for production, stale in dev.
**Suggestion:** No action needed — noting for awareness.

---

### [P3] `follow-up-scheduler.ts` retry map uses `Map<number, number>` without persistence
**File:** `src/follow-up-scheduler.ts:9`
**Issue:** In-memory retry map resets on every deploy/restart. RETRY_MAP_CAP clears entire map.
**Suggestion:** Acceptable trade-off at current scale. No action needed now.

---

### [P3] Magic number `50_000` repeated for text length limits
**File:** `src/api.ts:113`, `src/api.ts:233`, `src/run-pipeline.ts:70`
**Issue:** Max text length `50_000` appears in three places.
**Suggestion:** Extract to a constant: `export const MAX_LEAD_TEXT_LENGTH = 50_000`.

---

### [P3] `dashboard.html` SYNC comments reference `src/leads.ts` which no longer exists
**File:** `public/dashboard.html:1273`
**Issue:** Comment says `// SYNC: must match MAX_FOLLOW_UPS in src/leads.ts`. File moved to `src/db/follow-ups.ts`.
**Suggestion:** Update to `// SYNC: must match MAX_FOLLOW_UPS in src/db/follow-ups.ts`.
