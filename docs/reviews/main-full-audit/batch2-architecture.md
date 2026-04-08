# Architecture Strategist — Review Findings

**Agent:** architecture-strategist
**Branch:** main (full codebase audit)
**Date:** 2026-04-07
**Files reviewed:** 63

## Findings

### [P1] Triplicated stmt() cache — architectural debt
**File:** `src/db/leads.ts:10-24`, `src/db/follow-ups.ts:9-24`, `src/db/queries.ts:31-46`
**Issue:** Three identical copies of the prepared statement cache function with "keep in sync" comments. This was flagged in Cycle 12 at 8/9 agent consensus. A shared `src/db/stmt-cache.ts` was recommended but never merged to main.
**Suggestion:** Extract to shared module. High maintenance impact across 3 files.

---

### [P1] Dual parser/SMS systems — largest architectural debt
**File:** `src/email-parser.ts` vs `src/automation/parsers/`, `src/sms.ts` vs `src/automation/senders/twilio-sms.ts`
**Issue:** Two completely separate code paths for parsing GigSalad emails (webhook path vs automation path) with different types, regex, and a `ParsedLead` name collision. Two separate Twilio SMS implementations with different interfaces. These dual systems make it easy for a fix in one path to not reach the other.
**Suggestion:** Unify types and share parsing/sending logic. Depends on platform type unification (Finding 010).

---

### [P2] Automation leads not persisted to dashboard database
**File:** `src/automation/orchestrator.ts`
**Issue:** Gmail-polled leads are processed through the pipeline but results are only logged to a JSONL file and sent via SMS. They are NOT inserted into the SQLite database. This means ~1/3 of leads are invisible on the dashboard, excluded from analytics, and cannot be managed (follow-ups, outcome tracking).
**Suggestion:** After pipeline completes, call `insertLead()` + `updateLead()` to persist results. This is the second-highest impact fix.

---

### [P2] Platform type not unified across systems
**File:** `src/types.ts`, `src/automation/types.ts`, `src/automation/source-validator.ts`
**Issue:** `Classification.platform` is `"gigsalad" | "thebash" | "direct"`. Automation `Platform` is `"gigsalad" | "thebash" | "yelp" | "squarespace"`. DB column is `source_platform`. No shared type. GigSalad leads via Gmail don't get their `platform` field set, which means contact suppression policies (if any) are bypassed.
**Suggestion:** Unify platform types. This is the root cause of both the contact policy bypass and the precondition for persisting automation leads.

---

### [P2] Unify dedup to database
**File:** `src/automation/dedup.ts` vs `src/db/leads.ts` (processed_emails table)
**Issue:** Two separate dedup stores: file-based JSON for Gmail automation, SQLite table for Mailgun webhooks. Same lead delivered via both channels could be processed twice. The file-based store has performance and reliability issues (full read/write per check, no pruning, race conditions).
**Suggestion:** Migrate Gmail dedup to use the existing `processed_emails` SQLite table. Depends on automation leads being persisted to DB first.

---

### [P2] Deduplicate poll loop (main.ts vs poller.ts)
**File:** `src/automation/main.ts` vs `src/automation/poller.ts`
**Issue:** Core polling logic (watermark management, message processing, error handling, auth failure detection) is nearly identical in both files. `main.ts` is the older standalone CLI entry point; `poller.ts` is the newer server-embedded version.
**Suggestion:** Delete `main.ts` if standalone mode is no longer needed, or refactor to delegate to `poller.ts`.

---

### [P2] Missing webhook rate limits
**File:** `src/app.ts:69-73`, `src/rate-limit.ts`
**Issue:** Rate limiters are defined in `rate-limit.ts` but not applied to Mailgun or Twilio webhook routes. MEMORY.md says Cycle 12 added this but code shows no rate limiter on webhook routes.
**Suggestion:** Apply rate limiters to webhook routes.

---

### [P2] `process.cwd()` for doc file paths in context.ts
**File:** `src/pipeline/context.ts`
**Issue:** Uses `process.cwd()` to resolve doc file paths. Works when the server is started from the project root, but would break if started from a different directory (e.g., Railway might set a different cwd).
**Suggestion:** Use `import.meta.dirname` (or `__dirname` equivalent) for reliable path resolution.

---

### [P2] Dead `src/data/venues.ts`
**File:** `src/data/venues.ts:1-83`
**Issue:** Zero imports. Static venue map superseded by PF-Intel API integration. 83 lines of dead code.
**Suggestion:** Delete the file.

---

### [P2] Dynamic import for automation module
**File:** `src/server.ts:5`
**Issue:** `import { startGmailPoller, stopGmailPoller } from "./automation/poller.js"` is a static import that loads the entire automation module tree (parsers, portal clients, config, dedup, logger, orchestrator) at server startup, even if Gmail polling is disabled.
**Suggestion:** Use dynamic `import()` inside `startGmailPoller` to lazy-load the automation module only when needed.

---

### [P2] SMS error logging swallows error context
**File:** `src/api.ts:85,252`
**Issue:** `void err; console.error("SMS delivery failed")` discards the actual error. In production, diagnostics are lost.
**Suggestion:** Log the error: `console.error("SMS delivery failed:", err instanceof Error ? err.message : err)`.

---

### [P2] `/api/analyze` SSE endpoint not wrapped with asyncHandler
**File:** `src/api.ts`
**Issue:** The SSE endpoint handles its own errors internally but is not wrapped with `asyncHandler`. If an error occurs before the SSE stream is established, it could result in an unhandled rejection.
**Suggestion:** Wrap with `asyncHandler` for defense-in-depth.

---

### [P2] Dev-mode dashboard reload
**File:** `src/app.ts:55`
**Issue:** `readFileSync` loads `dashboard.html` once at startup. During development, changes to the file require a server restart.
**Suggestion:** In development mode, read the file per-request. Use the cached version only in production.

---

### [P3] Extract `baseUrl()` helper
**File:** `src/twilio-webhook.ts:26-28`, `src/follow-up-scheduler.ts:14`
**Issue:** Same function duplicated in two files.
**Suggestion:** Move to shared utility.

---

### [P3] Safe JSON parse in twilio-webhook
**File:** `src/twilio-webhook.ts:143-146`
**Issue:** Bare `JSON.parse` on stored classification/pricing JSON with no try-catch.
**Suggestion:** Wrap in try-catch with clear error message.

---

### [P3] Add sourced_cultural formats to FORMAT_FAMILIES
**File:** `src/automation/router.ts:8-13`
**Issue:** New sourced cultural formats and `flamenco_trio_full` not in `FORMAT_FAMILIES` map. Leads with these formats return `"unknown"` from `getFormatFamily`.
**Suggestion:** Add missing formats to the map.

---

### [P3] Move plan-gate.ts out of src/
**File:** `src/plan-gate.ts`
**Issue:** CLI tool for validating plan documents. Not part of application runtime. Lives in `src/` alongside production code.
**Suggestion:** Move to `scripts/plan-gate.ts`.

---

### [P3] Filter voice references by type
**File:** `src/data/voice-references.ts`, `src/pipeline/context.ts`
**Issue:** All 8 voice references concatenated into every generate prompt regardless of lead type. Token cost could be reduced by selecting relevant references.
**Suggestion:** Filter references by format/event type. Optimization, not a bug.

---

### [P3] Document env var access conventions
**File:** Throughout codebase
**Issue:** Some modules read env vars directly (`process.env.X`), others take config objects. No consistent pattern.
**Suggestion:** Document the convention: server-layer modules may read env vars; library/utility modules should accept config parameters.

---

## Compliance Check

| Principle | Status |
|-----------|--------|
| Single Responsibility | Mostly upheld. Exception: `twilio-webhook.ts` (296 lines) handles routing, business logic, and SMS dispatch. |
| Open/Closed | Upheld. New formats/tiers added to data files without modifying pipeline. |
| Interface Segregation | Good. `PricingResult`, `Classification`, `GateResult` are well-scoped. |
| Dependency Inversion | Partial. `claude.ts` has test DI. `sms.ts`, `venue-lookup.ts`, `follow-up-scheduler.ts` call external services directly. |
| No Circular Dependencies | Upheld. Explicit import rules in db module prevent cycles. |

## Risk Analysis

| Risk | Severity | Impact |
|------|----------|--------|
| Gmail-polled leads invisible on dashboard | High | Operator cannot see/manage ~1/3 of leads. Analytics incomplete. |
| Platform type not passed from automation | High | GigSalad leads via Gmail ignore contact suppression. |
| Dual dedup stores | Medium | Same lead via both channels could be processed twice. |
| Triplicated stmt cache | Medium | Maintenance burden; cache invalidation risk. |
| Missing webhook rate limits | Medium | Webhook amplification (mitigated by HMAC). |

## Summary

- **P1:** 2 (stmt cache, dual parser/SMS systems)
- **P2:** 11
- **P3:** 6

**Key cascade chain:** Findings 010 (platform types) → 008 (persist automation leads) → 007 (unify dedup) form a dependency chain. Fixing them in order resolves the largest data integrity gap.
