# Pattern Recognition Specialist — Review Findings

**Agent:** pattern-recognition-specialist
**Branch:** main (full codebase audit)
**Date:** 2026-04-07
**Files reviewed:** 63

## Findings

### [P2] Dual email parser systems with name collision
**File:** `src/email-parser.ts` vs `src/automation/parsers/`
**Issue:** Two completely separate codepaths parse GigSalad emails with different types, different regex, and a `ParsedLead` name collision. The webhook path uses `email-parser.ts`, the automation path uses `automation/parsers/`. Maintenance burden as email formats change.
**Suggestion:** Unify or rename the `ParsedLead` collision. Consider sharing parsing logic.

---

### [P2] Two separate Twilio/SMS modules
**File:** `src/sms.ts` vs `src/automation/senders/twilio-sms.ts`
**Issue:** Both send SMS to Alex via different interfaces and different Twilio client lifecycles.
**Suggestion:** Share a Twilio client factory or consolidate into one module.

---

### [P2] Triplicated stmt() cache (known, unfixed)
**File:** `src/db/leads.ts:10-24`, `src/db/queries.ts:31-46`, `src/db/follow-ups.ts:9-24`
**Issue:** Exact same function in 3 files with "keep in sync" comments. Identified in Cycle 12, never extracted.
**Suggestion:** Extract to `src/db/stmt-cache.ts`.

---

### [P2] Duplicated poll loop in main.ts and poller.ts
**File:** `src/automation/main.ts` vs `src/automation/poller.ts`
**Issue:** Core polling logic (watermark management, message processing loop, error handling, auth failure detection) is nearly identical in both files.
**Suggestion:** Extract shared `createPollLoop()` or have `main.ts` delegate to `poller.ts`.

---

### [P2] Portal clients share ~80 lines of boilerplate
**File:** `src/automation/portals/gigsalad-client.ts` vs `src/automation/portals/yelp-client.ts`
**Issue:** Both clients duplicate: constructor pattern, `ensureContext()` with data directory creation, `login()` flow with login page detection, `close()` method, error handling patterns. ~80 lines of shared boilerplate.
**Suggestion:** Extract `BasePortalClient` class with shared constructor, context management, and login flow.

---

### [P2] Mixed naming for platform/source concepts
**File:** `src/types.ts`, `src/automation/source-validator.ts`, `src/db/leads.ts`
**Issue:** "platform" vs "source" vs "source_platform" used interchangeably. `Classification.platform` is `"gigsalad" | "thebash" | "direct"`, automation uses `Platform = "gigsalad" | "thebash" | "yelp" | "squarespace"`, DB column is `source_platform`. No consistent naming.
**Suggestion:** Document the naming convention or align on one term.

---

### [P3] `dedup.ts` re-reads full file on every call
**File:** `src/automation/dedup.ts`
**Issue:** Full disk I/O per poll cycle. No caching.
**Suggestion:** In-memory set with file append on changes.

---

### [P3] `processLead` has 5 parameters
**File:** `src/automation/orchestrator.ts`
**Issue:** `processLead(msg, config, auth, yelpClient, gigsaladClient)` — long parameter list.
**Suggestion:** Bundle portal clients and auth into a `ClientContext` object.

---

### [P3] `new Date().toISOString()` scattered 15+ times
**File:** Multiple db/ and pipeline files
**Issue:** Same timestamp expression repeated throughout. Minor duplication.
**Suggestion:** Extract `nowISO()` utility if desired, though this is borderline.

---

### [P3] `dispatchReply` duplicates result conversion
**File:** `src/automation/orchestrator.ts`
**Issue:** Portal result → send result conversion repeated for each portal type.
**Suggestion:** Extract `portalResultToSendResult()` helper.

---

### [P3] `baseUrl()` helper duplicated
**File:** `src/twilio-webhook.ts:26-28`, `src/follow-up-scheduler.ts:14`
**Issue:** Same function, same implementation, two files.
**Suggestion:** Move to shared utility.

---

### [P3] Error message extraction pattern repeated 8+ times
**File:** Multiple files
**Issue:** `err instanceof Error ? err.message : String(err)` repeated throughout codebase.
**Suggestion:** Extract `getErrorMessage(err: unknown): string` utility.

---

### [P3] Duplicated labeled-field extraction in parsers
**File:** `src/automation/parsers/gigsalad.ts`, `src/automation/parsers/squarespace.ts`
**Issue:** Both parsers extract labeled fields (e.g., "Event Type: ...") with similar regex patterns.
**Suggestion:** Extract generic field extractor function.

---

### [P3] Default export style used only for routers
**File:** `src/api.ts`, `src/webhook.ts`, `src/twilio-webhook.ts`, `src/follow-up-api.ts`
**Issue:** Routers use `export default router` while everything else uses named exports. Inconsistency.
**Suggestion:** Informational only — this is a common Express convention.

---

### [P3] `data/venues.ts` is dead code
**File:** `src/data/venues.ts:1-83`
**Issue:** Zero imports confirmed. Static venue map superseded by PF-Intel API integration.
**Suggestion:** Delete the file.

---

### [P3] `plan-gate.ts` is a devtool mixed into src/
**File:** `src/plan-gate.ts`
**Issue:** Compound-engineering automation tool that validates plan documents. Not part of the application runtime.
**Suggestion:** Move to `scripts/plan-gate.ts`.

---

## Positive Findings

### Well-organized module boundaries
The codebase has clean module boundaries. The automation module is properly isolated with its own types/config/parsers/portals/senders. The pipeline directory cleanly separates stages. The DB layer has explicit circular-dependency guards. No god objects, no circular dependencies.

### Consistent pipeline pattern
All pipeline stages (classify, enrich, generate, verify, price) follow the same input/output pattern and are composed cleanly in `run-pipeline.ts`.

## Summary

- **P1:** 0
- **P2:** 6
- **P3:** 10
- **Positive:** 2

Key theme: **duplication is the main debt category.** The triplicated stmt() cache, duplicated poll loop, portal client boilerplate, and dual SMS/parser systems account for most findings.
