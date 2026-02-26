# Architecture Strategist — Review Findings

**Agent:** compound-engineering:review:architecture-strategist
**Branch:** feat/lead-conversion-tracking
**Date:** 2026-02-25
**Files reviewed:** 4 (src/types.ts, src/leads.ts, src/api.ts, public/dashboard.html)

## Findings

### [P1] Analytics query scoping mismatch between Query 1 and Queries 2/3
**File:** `src/leads.ts:308-349`
**Issue:** Query 1 scopes to `WHERE status IN ('sent', 'done')`, but Queries 2 (by_platform) and 3 (by_format) scope to `WHERE outcome IS NOT NULL` with no status filter. The breakdown queries could include leads with status `received` or `failed` if they somehow have an outcome set (the API prevents this, but the DB constraint does not). The three queries answer subtly different questions against different row populations within the same analytics response object. If breakdown totals were summed, they could theoretically exceed `total_leads`.
**Suggestion:** Add `AND status IN ('sent', 'done')` to Queries 2 and 3 so all three queries operate on the same row set. This makes the response internally consistent regardless of what data exists in the DB.

---

### [P2] `setLeadOutcome` silently discards `actual_price` on non-booked and `outcome_reason` on non-lost without API feedback
**File:** `src/leads.ts:282-301` and `src/api.ts:218-244`
**Issue:** The storage layer silently clears `actual_price` unless outcome is `booked`, and clears `outcome_reason` unless outcome is `lost`. The API layer validates these fields individually but does not warn the client when they will be discarded. A client can POST `{ outcome: "no_reply", actual_price: 500 }` and get a 200 back with `actual_price: null` — the field was accepted, validated, then silently dropped. Validation happens in the API layer, but business-rule filtering happens in the storage layer, so the two layers disagree on what constitutes a valid request.
**Suggestion:** Either (a) reject inapplicable sub-fields in the API layer (return 400 if `actual_price` is provided but outcome is not `booked`), or (b) move the conditional-clearing logic into the API layer so validation and business rules live in the same place. Option (a) is simpler and prevents client confusion.

---

### [P2] `getAnalytics()` builds response shape in storage layer, violating the `shapeLead()` pattern
**File:** `src/leads.ts:304-378` vs `src/api.ts:257-259`
**Issue:** The existing architecture has a clear pattern: `leads.ts` returns raw `LeadRecord` objects, and `api.ts` transforms them via `shapeLead()`. The new `getAnalytics()` function breaks this — it returns a fully-formed `AnalyticsResponse` directly from the storage layer. The API route at line 258 is a bare pass-through: `res.json(getAnalytics())`. This means the storage layer now knows about the API contract shape, creating upward coupling from storage to API concerns.
**Suggestion:** Split `getAnalytics()` into a raw-data query function in `leads.ts` and a `shapeAnalytics()` function in `api.ts`. This matches the established pattern. Low-risk now because the function is small, but sets a precedent that could scale poorly.

---

### [P2] Duplicate outcome/loss-reason value lists in three places with no shared source
**File:** `src/types.ts:161-162`, `src/api.ts:197-198`, `public/dashboard.html:1130-1142`
**Issue:** Valid outcome values and loss reasons are defined in three separate places: TypeScript union types, runtime `Set<string>` objects, and JavaScript object literals. The existing codebase has a pattern for `GUT_CHECK_KEYS` (defined once as `const` array, derived into count/threshold), but the new outcome values do not follow it. Each location must be updated independently, with `SYNC` comments as the only guard.
**Suggestion:** Add a `VALID_OUTCOMES` const array in `types.ts` (like `GUT_CHECK_KEYS`), derive the `LeadOutcome` type from it, and have `api.ts` import and use it. The dashboard will remain a manual sync (plain JS), but at least server-side has a single source:
```typescript
export const OUTCOME_VALUES = ["booked", "lost", "no_reply"] as const;
export type LeadOutcome = typeof OUTCOME_VALUES[number];
```

---

### [P2] Full table re-render after outcome save causes layout thrash and loses scroll position
**File:** `public/dashboard.html:1768-1783`
**Issue:** After outcome save, the code calls `renderTable(currentLeads)` and `renderMobile(currentLeads)`, rebuilding entire table innerHTML. This destroys the expanded detail panel and any scroll position. The existing approve flow has the same pattern, but outcome saves are expected to be more frequent (every completed lead), making this more noticeable.
**Suggestion:** Instead of re-rendering the entire table, update only the specific row's badge HTML using `outcomeBadgeHTML()`. This avoids destroying the expanded detail panel and matches the principle of minimal DOM mutation.

---

### [P3] `getAnalytics` transaction uses write-capable `database.transaction()` for read-only queries
**File:** `src/leads.ts:306`
**Issue:** `database.transaction()` in `better-sqlite3` defaults to `DEFERRED` transactions, which is functionally fine for reads (no write lock acquired). Semantically misleading for future developers.
**Suggestion:** Add a comment: `// Read-only transaction for snapshot consistency (no write lock acquired)`.

---

### [P3] CHECK constraints in CREATE TABLE and ALTER TABLE are duplicated string literals
**File:** `src/leads.ts:40-43` and `src/leads.ts:67-70`
**Issue:** `CHECK(outcome IN ('booked','lost','no_reply'))` appears identically in both the CREATE TABLE DDL and the ALTER TABLE migration. Same for `outcome_reason` and `actual_price`. Four places for one conceptual change (types, Set, DDL, migration). Existing `status` pattern has the same duplication, so not a regression.
**Suggestion:** Add `// SYNC:` comment near migration pointing to CREATE TABLE block, or extract constraint strings into constants.

---

### [P3] No index on `outcome` column despite analytics queries filtering on it
**File:** `src/leads.ts:40-80`
**Issue:** All three analytics queries filter on `outcome IS NOT NULL` or `outcome = 'booked'`. The `outcome` column has no index. At current scale negligible, but analytics queries run three SELECTs per Insights tab load.
**Suggestion:** Add `CREATE INDEX IF NOT EXISTS idx_leads_outcome ON leads(outcome)` after migrations.

---

### [P3] Dashboard Insights tab re-fetches analytics on every tab switch with no caching
**File:** `public/dashboard.html:1669-1671`
**Issue:** Every Insights tab click calls `loadInsights()`, firing a fresh `GET /api/analytics` request (3 SQL statements in a transaction). No staleness check or short TTL cache. Rapid tab switching fires redundant queries.
**Suggestion:** Cache analytics response with a short TTL (30 seconds) or only re-fetch when an outcome was saved since the last fetch.
