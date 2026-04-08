# Kieran TypeScript Reviewer — Review Findings

**Agent:** kieran-typescript-reviewer
**Branch:** main (full codebase audit)
**Date:** 2026-04-07
**Files reviewed:** 63

## Findings

### [P1] `any` usage in error handler with no type guard
**File:** `src/utils/error-handler.ts:19-28`
**Issue:** The error handler accesses `(err as any).status` and `(err as any).expose` three times each. Textbook `any` violation.
**Suggestion:** Define an `HttpError` type guard with `instanceof Error && typeof status === "number"` narrowing.

---

### [P1] Unsafe `as` casts on JSON.parse output in twilio-webhook.ts
**File:** `src/twilio-webhook.ts:143-146`
**Issue:** `JSON.parse(lead.classification_json)` cast directly to `Classification` with no runtime validation. Corrupt/stale DB data causes unhandled crash.
**Suggestion:** Add runtime validation or reuse existing validators from classify.ts/verify.ts.

---

### [P1] `validate` parameter in `callClaude` is optional — callers get unvalidated `as T`
**File:** `src/claude.ts:73`
**Issue:** When `validate` is omitted, parsed JSON is cast to `T` with zero runtime checks. Currently all callers pass validators, but nothing enforces this.
**Suggestion:** Make `validate` required. No legitimate use case for skipping validation on LLM output.

---

### [P1] `process.exit(1)` in auth.ts `getCookieSecret` bypasses Express error handling
**File:** `src/auth.ts:16`
**Issue:** Called lazily on first request. Kills process without graceful shutdown. Was flagged in Cycle 12 as needing fix.
**Suggestion:** Throw an Error. Let Express error handler deal with it, or check at startup in server.ts.

---

### [P2] Triplicated `stmt()` cache pattern across 3 files
**File:** `src/db/leads.ts:10-24`, `src/db/follow-ups.ts:9-24`, `src/db/queries.ts:31-46`
**Issue:** Exact same function duplicated three times with "keep in sync" comments. Flagged in Cycle 12 at 8/9 agent consensus but fix not merged.
**Suggestion:** Extract to `src/db/stmt-cache.ts`.

---

### [P2] `as string` type assertions on `req.params.id`
**File:** `src/api.ts:52,103`, `src/follow-up-api.ts:21,40`
**Issue:** Express params are `string | undefined` but cast with `as string`. Unnecessary — `parseInt(undefined, 10)` returns `NaN` which is already handled.
**Suggestion:** Remove the `as string` casts.

---

### [P2] `validation.platform!` non-null assertion in orchestrator.ts
**File:** `src/automation/orchestrator.ts:43`
**Issue:** `ValidationResult` is not a discriminated union, so `!` suppresses type error silently.
**Suggestion:** Make `ValidationResult` a proper discriminated union.

---

### [P2] `void err` pattern swallows error context
**File:** `src/api.ts:85,252`
**Issue:** Actual error discarded with `void err`, generic message logged. Loses all diagnostic info in production.
**Suggestion:** Log the error: `console.error("SMS delivery failed:", err instanceof Error ? err.message : err)`.

---

### [P2] `shapeLead` returns `null` for undefined input but callers use `leads.map(shapeLead)` unfiltered
**File:** `src/utils/shape-lead.ts:12`
**Issue:** Return type is `LeadApiResponse | null` but no call site filters nulls. The null path is dead code but type signature lies to callers.
**Suggestion:** Split signatures or add `.filter(Boolean)` at call sites.

---

### [P2] `as` casts on `safeJsonParse` results in shape-lead.ts
**File:** `src/utils/shape-lead.ts:47-59`
**Issue:** Multiple `as string`, `as number`, `as string[]` casts on properties from `Record<string, unknown>`. No runtime validation.
**Suggestion:** Add `typeof` checks before casting or use lightweight schema validator.

---

### [P2] `ReadonlySet<string>` cast workaround in api.ts
**File:** `src/api.ts:176,191`
**Issue:** `!(VALID_OUTCOMES as ReadonlySet<string>).has(outcome)` — workaround for TS limitation.
**Suggestion:** Use a type guard function: `function isValidOutcome(s: string): s is LeadOutcome`.

---

### [P2] `listLeadsFiltered` has no result limit
**File:** `src/db/queries.ts:79`
**Issue:** Query has no LIMIT clause. Memory says Cycle 12 added pagination but code shows no LIMIT. Fix was apparently reverted or never applied.
**Suggestion:** Add `LIMIT 200` to prevent unbounded result sets.

---

### [P2] `runPipeline` mutates `rawText` parameter
**File:** `src/run-pipeline.ts:71-74`
**Issue:** Parameter reassignment (`rawText = rawText.slice(...)`) — code smell.
**Suggestion:** Use `const truncated = rawText.slice(...)` and use downstream.

---

### [P2] `dedup.ts` reads/writes entire JSON file on every check
**File:** `src/automation/dedup.ts:6-23`
**Issue:** Full file read, parse, Set creation on every call. Concurrent calls could lose data (read-modify-write race).
**Suggestion:** Keep Set in memory, load once at startup. Or use existing SQLite `processed_emails` table.

---

### [P2] Duplicate SMS sender modules
**File:** `src/sms.ts` vs `src/automation/senders/twilio-sms.ts`
**Issue:** Two completely separate Twilio SMS implementations with different interfaces.
**Suggestion:** Unify into one module with config-based approach.

---

### [P2] `computeFollowUpDelay` called with unsafe cast
**File:** `src/db/follow-ups.ts:116`
**Issue:** `newCount as 0 | 1 | 2` bypasses bounds check. Out-of-bounds index returns `undefined`.
**Suggestion:** Use `Math.min(newCount, FOLLOW_UP_DELAYS_MS.length - 1)` as index.

---

### [P2] `TierRates` optional T1 causes runtime crash potential
**File:** `src/data/rates.ts:9`
**Issue:** Some formats lack T1 entirely. `lookupPrice` accesses `durationRates[tierKey]` which returns `undefined` for T1 on mariachi/sourced formats — crashes at runtime.
**Suggestion:** Make type more precise or add runtime validation before access.

---

### [P2] `enriched` field mutated via type assertion in orchestrator.ts
**File:** `src/automation/orchestrator.ts:61-64`
**Issue:** `(lead as YelpLead).rawText = details.fullMessage` — mutating via `as` cast instead of narrowing.
**Suggestion:** Use a local typed variable after the platform check.

---

### [P3] `cspNonce` accessed via `res.locals.cspNonce as string`
**File:** `src/app.ts:57`
**Issue:** Could be typed by augmenting Express `Locals` interface.
**Suggestion:** Minor improvement, not critical.

---

### [P3] `SCOPES` const in gmail-watcher.ts never used
**File:** `src/automation/gmail-watcher.ts:12-15`
**Issue:** Dead code. Auth happens via stored tokens, scopes only needed in `scripts/gmail-auth.ts`.
**Suggestion:** Remove.

---

### [P3] Inconsistent error logging patterns
**File:** Throughout codebase
**Issue:** Some errors logged with full context, some with generic messages, some discarded entirely.
**Suggestion:** Standardize on `err instanceof Error ? err.message : err` pattern.

---

### [P3] `baseUrl()` helper duplicated
**File:** `src/twilio-webhook.ts:27`, `src/follow-up-scheduler.ts:14`
**Issue:** Same function, same implementation, two files.
**Suggestion:** Extract to shared utility.

---

### [P3] `FORMAT_FAMILIES` missing sourced cultural formats
**File:** `src/automation/router.ts:8-13`
**Issue:** Sourced cultural formats and `flamenco_trio_full` not in `FORMAT_FAMILIES`. Leads with these formats hit `"unknown"` return.
**Suggestion:** Add missing formats to the map.

---

### [P3] Missing return type annotations on exported functions
**File:** Throughout codebase
**Issue:** Many exported functions rely on type inference instead of explicit return types.
**Suggestion:** Add explicit return types on public API surfaces.

---

### [P3] `guessFormatFamily` uses redundant `/i` flag on lowercased string
**File:** `src/automation/router.ts:113-121`
**Issue:** String already lowercased, `/i` flag is redundant.
**Suggestion:** Remove `/i` flags.

---

### [P3] `close()` on YelpPortalClient is a no-op
**File:** `src/automation/portals/yelp-client.ts:360-362`
**Issue:** Method does nothing but callers await it.
**Suggestion:** Keep for API consistency, just noting.
