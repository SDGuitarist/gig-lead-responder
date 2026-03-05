# Architecture Strategist — Review Findings

**Agent:** architecture-strategist
**Branch:** fix/p2-batch-cycle-12
**Date:** 2026-03-05
**Files reviewed:** 21

## Findings

### [P1] Triplicated `stmt()` cache — three independent caches on one singleton DB
**Files:** `src/db/leads.ts:10-24`, `src/db/follow-ups.ts:10-24`, `src/db/queries.ts:9-24`
**Issue:** Each of the three data-access modules defines its own `cachedDb`, `stmtCache`, and `stmt()` function with identical 15-line implementations. Three separate Map caches for one database connection means 3x memory for overlapping statements. Cache invalidation divergence risk if the pattern needs to change. No shared abstraction at the data access foundation.
**Suggestion:** Extract `stmt()` into a shared module (`src/db/stmt.ts` or co-located in `src/db/migrate.ts` alongside `initDb()`). All three modules already import from `migrate.ts`, so adding `stmt` there requires no new dependency edges.

---

### [P1] `process.exit(1)` in lazy-initialized `getCookieSecret()` — runtime crash in request path
**File:** `src/auth.ts:11-16`
**Issue:** `getCookieSecret()` is called lazily via `getSecret()` on the first authenticated request. If `COOKIE_SECRET` is missing in production, this calls `process.exit(1)` inside a request handler, bypassing Express error handling and graceful shutdown. Violates project's own documented rule ("No process.exit() in request handlers").
**Suggestion:** Move `COOKIE_SECRET` check to `server.ts` alongside other production config checks (lines 20-29). Replace `process.exit(1)` in auth.ts with `throw new Error()`.

---

### [P2] Duplicated `baseUrl()` helper in two transport modules
**Files:** `src/follow-up-scheduler.ts:13-15`, `src/twilio-webhook.ts:26-28`
**Issue:** Identical function (strip trailing slashes from `process.env.BASE_URL`) defined independently in two files. Both are transport/orchestration layer modules formatting URLs for SMS.
**Suggestion:** Extract to `src/utils/base-url.ts` or `src/constants.ts`.

---

### [P2] Repeated "parse ID + validate lead" boilerplate in API handlers
**Files:** `src/api.ts:51-61,102-122,149-159`, `src/follow-up-api.ts:21-23,40-41`
**Issue:** The pattern `parseInt(req.params.id) -> isNaN -> getLead -> 404` appears 5 times. `follow-up-api.ts` already has `handleAction()` showing the team recognizes this pattern.
**Suggestion:** Extract shared `parseAndValidateLead(req, res)` utility or middleware.

---

### [P2] `follow-ups.ts` reaches into `leads.ts` for data and transactions — boundary ambiguity
**File:** `src/db/follow-ups.ts:7`
**Issue:** `follow-ups.ts` imports `getLead`, `updateLead`, `runTransaction`, and `normalizeLeadRow` from `leads.ts`. The module boundary is blurred — it directly mutates lead records rather than having follow-up-specific update functions. `normalizeLeadRow` is a semi-public internal API.
**Suggestion:** Acceptable at current codebase size. Document the intentional dependency. If codebase grows, consider merging follow-ups back into leads or making follow-ups fully self-contained.

---

### [P2] `run-pipeline.ts` imports `logVenueMiss` from data layer — pipeline reaching into persistence
**File:** `src/run-pipeline.ts:9`
**Issue:** Pipeline orchestration module directly calls `logVenueMiss()` from data access layer. This is the only direct DB import in the pipeline orchestration layer — all other DB interactions go through `post-pipeline.ts`. Creates a layering inconsistency.
**Suggestion:** Move `logVenueMiss` call to `post-pipeline.ts`. Pass venue lookup metadata through `PipelineOutput` type so post-pipeline handles the miss logging.

---

### [P3] `queries.ts` bypasses its own `stmt()` cache for `listLeadsFiltered`
**File:** `src/db/queries.ts:57`
**Issue:** `listLeadsFiltered()` builds dynamic SQL and calls `initDb().prepare(sql)` directly instead of `stmt()`. Creates a new statement object on every call for frequently-called dashboard endpoint.
**Suggestion:** Fine for current scale. No action needed now.

---

### [P3] `shapeLead` returns `null` for undefined input but API handlers do not guard the return
**File:** `src/utils/shape-lead.ts:12`
**Issue:** `shapeLead(lead: LeadRecord | undefined)` returns `LeadApiResponse | null`. Type signature suggests fragile guard pattern in callers.
**Suggestion:** Split into two functions — one that never returns null for definite LeadRecord input.

---

### [P3] `twilio-webhook.ts` has widest import surface from `db/index.ts` (8 functions)
**File:** `src/twilio-webhook.ts:4`
**Issue:** File handles approval, editing, follow-up send, and follow-up skip — four features in one module. Cohesion concern at current size (~297 lines).
**Suggestion:** Manageable now. Consider extracting handler functions if new SMS commands are added.

---

### [P3] No explicit barrel export ordering or enforcement mechanism
**File:** `src/db/index.ts`
**Issue:** `normalizeLeadRow` intentionally excluded from barrel (line 23 comment) but TypeScript has no way to enforce package-private exports.
**Suggestion:** Add lint rule or underscore prefix convention for internal-only exports.

---

## Compliance Summary

| Principle | Status | Notes |
|-----------|--------|-------|
| No circular dependencies | PASS | DAG confirmed |
| Dependency direction | MOSTLY PASS | One violation: run-pipeline.ts writes directly to DB |
| Single Responsibility | MOSTLY PASS | twilio-webhook.ts handles 4 features |
| DRY | FAIL | Triplicated stmt(), duplicated baseUrl(), repeated parse-ID |
| Separation of Concerns | MOSTLY PASS | Pipeline nearly pure except logVenueMiss |
| No process.exit in handlers | FAIL | auth.ts:15 violates documented rule |
