# Review Summary — feat/lead-conversion-tracking

**Date:** 2026-02-25
**Agents run:** 9 (3 batches of 3)
**Total unique findings:** 40

## P1 — Critical (4)

### 1. `_pendingOutcome` shared state mutation without try/finally
**Found by:** kieran-typescript (P1), pattern-recognition (P1), code-simplicity (P1), data-integrity (P3), deployment-verification (P3)
**File:** `public/dashboard.html:1718-1736`
**Issue:** The outcome `change` handler temporarily mutates `lead.outcome` on the shared `currentLeads` object to trick `renderDetailPanel` into showing the correct sub-fields, then restores the original value. If `renderDetailPanel` throws, `lead.outcome` is permanently corrupted for the session. The `_pendingOutcome` property is set then deleted but never read (dead code). Five agents independently flagged this — highest-confidence finding in the review.
**Suggestion:** Create a shallow copy: `var preview = Object.assign({}, lead, { outcome: sel.value || null });` and pass that to `renderDetailPanel`. No mutation, no restore, no corruption risk, fewer lines.

---

### 2. XSS: `g.gate_status` injected into innerHTML without escaping
**Found by:** security-sentinel (P1)
**File:** `public/dashboard.html:1997-1998`
**Issue:** `analyzeKvHTML` inserts its value argument directly into `innerHTML`. On lines 1997-1998, `g.gate_status.toUpperCase()` is interpolated without calling `esc()`. The `gate_status` field originates from LLM output parsed as JSON via the `/api/analyze` SSE stream. If the pipeline ever produces a malformed `gate_status` containing HTML (prompt injection or parsing bug), it executes as DOM content. Combined with `authHeader` stored in a JS closure (P3 #35), XSS here could extract Basic Auth credentials.
**Suggestion:** Escape the value: `esc(g.gate_status).toUpperCase()`. Also escape the label column in `analyzeKvHTML` as defense-in-depth (see P3 #36).

---

### 3. Missing body guard — `req.body` undefined when Content-Type header absent
**Found by:** security-sentinel (P1)
**File:** `src/api.ts:218-224`
**Issue:** When a request arrives without `Content-Type: application/json`, Express's `json()` middleware skips parsing and `req.body` is `undefined`. The destructuring `const { outcome, actual_price, outcome_reason } = req.body` throws an unhandled exception, crashing the request and leaking a stack trace. Downstream validation handles `outcome: undefined` correctly when body IS parsed, but fails catastrophically when body is absent entirely.
**Suggestion:** Add early guard: `if (!req.body || typeof req.body !== 'object') { res.status(400).json({ error: 'Request body must be JSON' }); return; }`

---

### 4. Analytics queries use inconsistent WHERE scopes — `total_untracked` permanently inflated
**Found by:** architecture-strategist (P1), data-integrity-guardian (P2)
**File:** `src/leads.ts:308-349`
**Issue:** Query 1 scopes to `WHERE status IN ('sent', 'done')`, so `total_leads` includes `sent` leads that can never have outcomes (API restricts outcomes to `done` leads). `total_untracked = total_leads - total_with_outcome` is permanently inflated by `sent` lead count. Queries 2 and 3 filter `WHERE outcome IS NOT NULL` with no status filter — different row population than Query 1. The three queries answer subtly different questions within the same analytics response.
**Suggestion:** Use `WHERE status = 'done'` in Query 1 (since only done leads can have outcomes), and add `AND status = 'done'` to Queries 2 and 3 for internal consistency.

---

## P2 — Important (17)

### 5. Inapplicable sub-fields silently discarded without API feedback
**Found by:** architecture-strategist (P2), security-sentinel (P2), data-integrity-guardian (P2)
**File:** `src/api.ts:218-244` / `src/leads.ts:282-301`
**Issue:** `{ outcome: "no_reply", actual_price: 500 }` passes API validation, then `setLeadOutcome` silently discards `actual_price` because outcome isn't `booked`. User gets 200 OK with `actual_price: null`. Validation happens in API layer, business-rule filtering in storage layer — the two layers disagree on what's valid. Three agents independently flagged this.
**Suggestion:** Reject inapplicable sub-fields in the API layer: return 400 if `actual_price` provided but outcome is not `booked`, or if `outcome_reason` provided but outcome is not `lost`.

---

### 6. Orphaned `renderDetailPanel(updated)` call — dead code
**Found by:** kieran-typescript (P2), pattern-recognition (P2), code-simplicity (P1), performance-oracle (P3)
**File:** `public/dashboard.html:1773`
**Issue:** Calls `renderDetailPanel(updated)` as a bare statement — returns HTML string that is thrown away. The actual DOM update happens on lines 1775-1779 where the same function is called again and its result assigned to `innerHTML`. Builds an HTML string (escaping, date formatting, concatenation) for nothing.
**Suggestion:** Delete line 1773.

---

### 7. `OutcomeUpdateBody` interface defined but never used
**Found by:** kieran-typescript (P2), pattern-recognition (P2), code-simplicity (P2)
**File:** `src/types.ts:164-168`
**Issue:** Exported interface never imported or referenced anywhere. Dead type.
**Suggestion:** Delete it, or use it to type `req.body` in the outcome endpoint.

---

### 8. `as` cast instead of type guard for outcome validation
**Found by:** kieran-typescript (P2), pattern-recognition (P2)
**File:** `src/api.ts:221, 242-244`
**Issue:** Uses `outcome as LeadOutcome | null` instead of a type guard. Plan called for `isLeadOutcome()` type guard to narrow types safely. `as` cast bypasses TypeScript's narrowing.
**Suggestion:** Add type guards (`isLeadOutcome()`, `isLossReason()`) to eliminate all `as` casts in the handler.

---

### 9. Enum values duplicated across 5 locations with no shared source of truth
**Found by:** pattern-recognition (P2), architecture-strategist (P2)
**File:** Multiple — `src/types.ts:161-162`, `src/api.ts:197-198`, `src/leads.ts` (SQL), `public/dashboard.html:1130-1142`
**Issue:** Valid outcome values and loss reasons defined in 5 separate places: TypeScript union types, runtime `Set<string>`, SQL CHECK constraints, and JavaScript object literals. SYNC comments are the only guard. Existing `GUT_CHECK_KEYS` pattern (defined once, derived into count/threshold) not followed.
**Suggestion:** Export `OUTCOME_VALUES` const array from `types.ts`, derive `LeadOutcome` type from it: `export const OUTCOME_VALUES = ["booked", "lost", "no_reply"] as const; export type LeadOutcome = typeof OUTCOME_VALUES[number];`

---

### 10. `getAnalytics()` builds API response shape in storage layer
**Found by:** architecture-strategist (P2)
**File:** `src/leads.ts:304-378` / `src/api.ts:257-259`
**Issue:** Existing pattern: `leads.ts` returns raw `LeadRecord`, `api.ts` transforms via `shapeLead()`. New `getAnalytics()` returns fully-formed `AnalyticsResponse` from the storage layer. The API route is a bare pass-through: `res.json(getAnalytics())`. Storage layer now knows about API contract shape — upward coupling.
**Suggestion:** Split into raw-data query in `leads.ts` and `shapeAnalytics()` in `api.ts`. Low-risk now but sets a precedent.

---

### 11. Full table re-render after outcome save (layout thrash)
**Found by:** kieran-typescript (P3), architecture-strategist (P2)
**File:** `public/dashboard.html:1768-1783`
**Issue:** After outcome save, calls `renderTable(currentLeads)` and `renderMobile(currentLeads)` rebuilding entire table innerHTML. Destroys the expanded detail panel and scroll position. The detail re-render on lines 1775-1779 is immediately destroyed. Outcome saves will be more frequent than approve actions.
**Suggestion:** Update only the specific row's badge HTML using `outcomeBadgeHTML()` instead of full table rebuild.

---

### 12. `finally` block re-enables destroyed DOM nodes
**Found by:** kieran-typescript (P3), code-simplicity (P2)
**File:** `public/dashboard.html:1788-1792`
**Issue:** On success path, `btn` and `dropdown` point to detached nodes (full re-render already rebuilt them). On error path, they're still valid and correctly re-enabled. Logic works but is confusing.
**Suggestion:** Re-render panel in `.catch()` for fresh controls, simplify `finally` to just reset `savingOutcomeForId`.

---

### 13. Missing index on `outcome` column
**Found by:** architecture-strategist (P3), performance-oracle (P2), data-integrity-guardian (P3)
**File:** `src/leads.ts:40-80`
**Issue:** All three analytics queries filter on `outcome IS NOT NULL` or aggregate by outcome values. No index exists. At 5,000-10,000 leads, three full table scans per Insights tab load.
**Suggestion:** `CREATE INDEX IF NOT EXISTS idx_leads_outcome ON leads(outcome);`

---

### 14. `VALID_OUTCOMES` and `VALID_LOSS_REASONS` typed as `Set<string>` instead of union types
**Found by:** kieran-typescript (P2)
**File:** `src/api.ts:197-198`
**Issue:** Typed as `Set<string>` — misses compile-time sync check if enum values change.
**Suggestion:** Use `new Set<LeadOutcome>(...)` and `new Set<LossReason>(...)`.

---

### 15. CHECK constraint mismatch — API validates upper bound, DB does not
**Found by:** data-integrity-guardian (P1)
**File:** `src/leads.ts:42` / `src/api.ts:228`
**Issue:** DB CHECK says `actual_price > 0`, API validates `actual_price <= 0` and `actual_price < 100000`. DB has no upper bound. If `setLeadOutcome` is called from outside the API (future cron job, CLI, test), the 100k guard is bypassed. Also, TypeScript type allows `0`, which the DB rejects with an opaque SQLite CHECK failure.
**Suggestion:** Add runtime guard inside `setLeadOutcome`: reject `actual_price <= 0` with a clear error before hitting the DB.

---

### 16. `setLeadOutcome` doesn't validate lead is in `done` status
**Found by:** data-integrity-guardian (P2)
**File:** `src/leads.ts:282-301`
**Issue:** API checks `lead.status !== "done"` on line 213, but `setLeadOutcome` as an exported function does not enforce this. Any caller (webhook, batch script, test) can set an outcome on a non-done lead. No DB constraint prevents this.
**Suggestion:** Add status guard inside `setLeadOutcome`.

---

### 17. No security headers (CSP, X-Frame-Options, X-Content-Type-Options)
**Found by:** security-sentinel (P2)
**File:** `src/server.ts:17-20`
**Issue:** No Content-Security-Policy (inline scripts unrestricted), no X-Frame-Options (dashboard can be iframed for clickjacking — user could be tricked into setting outcomes), no HSTS. Previously flagged in dashboard-ui-redesign review. Higher risk now with state-changing outcome endpoint.
**Suggestion:** Install `helmet` and add `app.use(helmet())`. At minimum, `X-Frame-Options: DENY` and `X-Content-Type-Options: nosniff`.

---

### 18. No CSRF protection on state-changing endpoints
**Found by:** security-sentinel (P2)
**File:** `src/api.ts:200` (and lines 108, 162)
**Issue:** POST/PATCH endpoints rely solely on Basic Auth. No CSRF token. Browser auto-attaches cached Basic Auth credentials on cross-origin requests. Combined with missing X-Frame-Options, enables clickjacking or cross-origin outcome changes.
**Suggestion:** Short term: add `X-Requested-With` custom header check. Long term: token-based auth or CSRF token.

---

### 19. `AnalyticsBreakdown` imported but unused in leads.ts
**Found by:** kieran-typescript (P2)
**File:** `src/leads.ts:4`
**Issue:** Imported but never directly referenced. TypeScript resolves nested type through `AnalyticsResponse`.
**Suggestion:** Remove `AnalyticsBreakdown` from the import.

---

### 20. Missing index on `source_platform` column
**Found by:** performance-oracle (P2)
**File:** `src/leads.ts:335-340`
**Issue:** Analytics Query 2 does `GROUP BY source_platform` with no index. Full scan for grouping.
**Suggestion:** `CREATE INDEX IF NOT EXISTS idx_leads_source_platform ON leads(source_platform);`

---

### 21. `json_extract` on TEXT columns — full table scan, unindexable
**Found by:** performance-oracle (P3), deployment-verification (P2)
**File:** `src/leads.ts:320, 344`
**Issue:** Analytics Queries 2 and 3 use `json_extract()` on `pricing_json` and `classification_json`. SQLite parses JSON blob for every matching row. At 1,000+ leads, significant overhead. Cannot be indexed.
**Suggestion:** Denormalize `format_recommended` and `quote_price` into own columns, populated at write time. Or accept and monitor.

---

## P3 — Minor (19)

### 22. No `express.json({ limit: '100kb' })` per plan
**Found by:** kieran-typescript (P3)
**File:** `src/server.ts:18`
**Issue:** Plan called for explicit body size limit. Not implemented.
**Suggestion:** Add `express.json({ limit: '100kb' })`.

---

### 23. Global lock `savingOutcomeForId` naming suggests per-ID tracking
**Found by:** pattern-recognition (P3)
**File:** `public/dashboard.html:1716, 1744`
**Issue:** Name implies per-ID tracking but behavior is a global lock.
**Suggestion:** Rename to `savingOutcome`.

---

### 24. `database` vs `db` naming inconsistency
**Found by:** pattern-recognition (P3)
**File:** `src/leads.ts:305`
**Issue:** New `getAnalytics()` uses `const database = initDb()` while rest of file uses `db`.
**Suggestion:** Use `const db = initDb()`.

---

### 25. Client clock used for stale nudge detection
**Found by:** pattern-recognition (P3)
**File:** `public/dashboard.html:1191-1196`
**Issue:** `isStale()` compares server UTC timestamp with `Date.now()`. Wrong client clock = inaccurate nudge badges.
**Suggestion:** Acceptable for v1. Add comment noting the assumption.

---

### 26. Inline style in Insights pricing section
**Found by:** code-simplicity (P3)
**File:** `public/dashboard.html` (renderInsights)
**Issue:** Inline `style="display:flex;..."` while every other element uses CSS classes.
**Suggestion:** Add `.pricing-row` class or leave it.

---

### 27. Read-only transaction uses write-capable `database.transaction()`
**Found by:** architecture-strategist (P3)
**File:** `src/leads.ts:306`
**Issue:** Semantically misleading. Functionally fine (DEFERRED, no write lock).
**Suggestion:** Add comment: `// Read-only transaction for snapshot consistency`.

---

### 28. CHECK constraints duplicated in CREATE TABLE and ALTER TABLE
**Found by:** architecture-strategist (P3)
**File:** `src/leads.ts:40-43, 67-70`
**Issue:** Identical CHECK constraints in both blocks. Existing pattern with `status` column.
**Suggestion:** Add `// SYNC:` comment pointing to CREATE TABLE block.

---

### 29. `loadInsights()` re-fetches on every tab click — no cache
**Found by:** architecture-strategist (P3), performance-oracle (P3), deployment-verification (P3)
**File:** `public/dashboard.html:1669-1671`
**Issue:** Every Insights tab click fires `GET /api/analytics` (3 SQL queries). No cache, no debounce. Rapid tab-switching fires redundant queries.
**Suggestion:** Cache response with 30-second TTL; invalidate after outcome save.

---

### 30. `error_message` field may leak internal details
**Found by:** security-sentinel (P3)
**File:** `src/api.ts:55`
**Issue:** `shapeLead()` returns `lead.error_message` which may contain Anthropic API errors, stack traces, or internal paths.
**Suggestion:** Truncate to generic message or strip after first newline.

---

### 31. SMS error forwarded to client
**Found by:** security-sentinel (P3)
**File:** `src/api.ts:142-143`
**Issue:** Raw Twilio error forwarded. Could leak account SIDs or API error codes.
**Suggestion:** Log full error server-side, return generic message.

---

### 32. Basic Auth credentials stored in JS closure
**Found by:** security-sentinel (P3)
**File:** `public/dashboard.html:1152,1221,1245`
**Issue:** `authHeader` in JS closure for page lifetime. XSS (P1 #2) could extract credentials. Inherent to Basic Auth in browser.
**Suggestion:** Consider migrating to `HttpOnly` cookie-based sessions long term.

---

### 33. `analyzeKvHTML` label values not escaped
**Found by:** security-sentinel (P3)
**File:** `public/dashboard.html:1947`
**Issue:** Label parameter `p[0]` inserted into innerHTML without `esc()`. Currently all hardcoded (safe), but future dynamic labels would be XSS vectors.
**Suggestion:** Add `esc(p[0])` as defense-in-depth.

---

### 34. No rate limiting on analytics endpoint
**Found by:** security-sentinel (P3), deployment-verification (P3)
**File:** `src/api.ts:257` / `src/leads.ts:304-378`
**Issue:** `GET /api/analytics` runs 3 synchronous SQL queries with no rate limit. Insights tab fires on every tab click.
**Suggestion:** Client-side cache (P3 #29) mitigates. Server-side rate limit optional.

---

### 35. Triple SELECT per outcome save
**Found by:** performance-oracle (P3)
**File:** `src/api.ts:207` / `src/leads.ts:282-301`
**Issue:** Outcome save does 3 `SELECT * FROM leads WHERE id = ?` (check in API, check in updateLead, return after update). Microseconds per query in SQLite.
**Suggestion:** Use `UPDATE ... RETURNING *` (SQLite 3.35+) or pass pre-fetched lead into `setLeadOutcome`.

---

### 36. `isStale()` creates Date per lead per render on visibility change
**Found by:** performance-oracle (P3)
**File:** `public/dashboard.html:1183-1189`
**Issue:** Called per lead in both `renderTable` and `renderMobile`. Visibility change triggers 400+ Date constructions with 200 leads.
**Suggestion:** Cache `Date.now()` once per render pass. Debounce `visibilitychange`.

---

### 37. `SELECT *` on list endpoint fetches large unused columns
**Found by:** performance-oracle (P2)
**File:** `src/leads.ts:245`
**Issue:** `listLeadsFiltered` does `SELECT *`, fetching `raw_email`, `gate_json`, etc. for every row. `shapeLead` parses 3 JSON blobs per lead. Pre-existing pattern but analytics keeps more leads in "done" status.
**Suggestion:** Use explicit column list omitting `raw_email` and `gate_json`. (Pre-existing — not introduced by this branch.)

---

### 38. Out-of-order types commit — non-compiling intermediate commits
**Found by:** git-history-analyzer (P1)
**File:** `src/types.ts` (branch-level, commit `128e0fe`)
**Issue:** Types committed last (1:14 PM) but consumers (`leads.ts`, `api.ts`) committed 38 minutes earlier. 4 consecutive commits would not compile. Makes `git bisect` unreliable across this branch. Final state is correct.
**Suggestion:** Process improvement: commit type definitions first. No code change needed.

---

### 39. Dashboard commit oversized (506 lines, 10 features)
**Found by:** git-history-analyzer (P2)
**File:** `public/dashboard.html` (commit `8c86265`)
**Issue:** Single commit adds 506 lines covering 10 distinct features. 5x the recommended 50-100 line commit size. Tab switching bug fix mixed into feature commit.
**Suggestion:** Process improvement: separate commits per feature/fix in future branches.

---

### 40. Dashboard growing into monolith (2,092 lines)
**Found by:** git-history-analyzer (P3)
**File:** `public/dashboard.html:1-2092`
**Issue:** Single HTML file with all CSS, HTML, and JavaScript. This branch added 506 more lines. Backend files are 283-407 lines. Pre-existing concern, accelerated by this branch.
**Suggestion:** Consider extracting Insights tab into a separate module in future iteration.

---

## Batch Coverage

| Batch | Agent | Findings |
|-------|-------|----------|
| batch1 | kieran-typescript-reviewer | 9 |
| batch1 | pattern-recognition-specialist | 8 |
| batch1 | code-simplicity-reviewer | 5 |
| batch2 | architecture-strategist | 9 |
| batch2 | security-sentinel | 10 |
| batch2 | performance-oracle | 7 |
| batch3 | data-integrity-guardian | 5 |
| batch3 | git-history-analyzer | 5 |
| batch3 | deployment-verification-agent | 5 |

**Cross-agent agreement:** The `_pendingOutcome` mutation hack (P1 #1) was flagged by 5 of 9 agents — highest convergence. The orphaned `renderDetailPanel` call (#6) was flagged by 4 agents. Silent sub-field discard (#5) was flagged by 3 agents.

## Three Questions

### 1. Hardest judgment call in this review?

Severity assignment for the `_pendingOutcome` mutation hack vs. the analytics scoping mismatch. The mutation hack had 5 agents converge on it, but it's a client-side session corruption risk (user refreshes and it's gone). The analytics scoping mismatch is quieter — only 2 agents flagged it — but it produces permanently incorrect data in the Insights tab that users would trust. I kept both at P1 because one is high-likelihood low-impact and the other is lower-likelihood higher-impact (silent wrong numbers). I also downgraded the git-history P1 ("out-of-order types commit") to P3 because the final state is correct and it's a process concern, not a code defect — despite the agent assigning it P1.

### 2. What did you consider flagging but chose not to, and why?

The deployment agent marked "partial migration failure" as P1, but its own analysis concluded "acceptable risk — the existingCols check makes migrations idempotent." I omitted it as a standalone finding because the self-healing behavior means the realistic failure mode is "server crashes, restarts, finishes migration" — which is the expected Railway behavior. Also omitted the `SELECT *` finding (performance-oracle P2) from the P2 list since it's pre-existing and not introduced by this branch — listed it as P3 #37 instead for awareness.

### 3. What might this review have missed?

- **Accessibility:** No agent checked whether outcome dropdowns, nudge badges, or the Insights tab are keyboard-navigable or screen-reader friendly.
- **Internationalization:** Hardcoded English strings for loss reasons, outcome labels, and Insights copy.
- **Logging:** No agent checked whether outcome changes are logged for audit trail. The `setLeadOutcome` function modifies data silently — no `console.log` or structured log on state transitions.
- **Error UX:** No agent checked what the user sees when the outcome save fails (network error, 500, validation error) — the `.catch()` block may not surface helpful messages.
- **Mobile responsiveness:** The Insights tab has inline flex layout but no agent tested mobile viewport rendering.
- **Timezone handling:** `outcome_at` is stored as TEXT with ISO timestamp, but no agent verified whether the server writes UTC consistently or if client display handles timezone conversion.
