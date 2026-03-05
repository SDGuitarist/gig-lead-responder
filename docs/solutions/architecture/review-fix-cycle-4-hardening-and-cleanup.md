---
title: "Review-Fix Cycle 4: Hardening & Cleanup (CSP, CSRF, Replay, LLM Validators, Dead Code)"
category: architecture
tags:
  - review
  - compound
  - csp
  - csrf
  - replay-protection
  - llm-boundary-validation
  - dead-code-removal
  - prepared-statement-cache
  - type-safety
module:
  - src/server.ts
  - src/auth.ts
  - src/webhook.ts
  - src/pipeline/classify.ts
  - src/pipeline/generate.ts
  - src/pipeline/verify.ts
  - src/leads.ts
  - src/claude.ts
  - src/types.ts
  - src/api.ts
symptoms:
  - "CSP nonce not injected on <script type=\"...\"> or <script src=\"...\"> tags -- only bare <script> matched"
  - "GET /logout vulnerable to CSRF logout attacks (one-click link logs user out)"
  - "Math.abs() in replay protection doubled acceptance window -- future-dated timestamps accepted up to 5 min"
  - "LLM returning JSON array or primitive bypasses validators -- typeof guard missing"
  - "stmt() cache returns stale prepared statement for dynamic SQL with variable WHERE/ORDER clauses"
  - "Exported JsonValidator<T> type used in only one place -- unnecessary public API surface"
  - "Dead FollowUpAction* types remain after response envelope refactor (#032)"
date_documented: 2026-03-05
related:
  - docs/solutions/architecture/review-fix-cycle-3-security-hardening.md
  - docs/solutions/architecture/review-fix-cycle-2-lead-response-loop.md
  - docs/solutions/architecture/escape-at-interpolation-site.md
  - docs/solutions/architecture/express-handler-boundary-validation.md
  - docs/solutions/architecture/fire-and-forget-timeout.md
---

# Review-Fix Cycle 4: Hardening & Cleanup

## Prior Phase Risk

> "The P1-1 CSP regex fix (`/<script(?=[\s>])/gi`) uses a lookahead that matches `<script>` and `<script ` but would NOT match a hypothetical `<script\n` (newline after tag name). Unlikely in practice but worth noting in the solution doc."

Accepted as low risk. The dashboard HTML is build-time static (no user-generated script tags), so `<script\n` won't appear unless someone edits the HTML that way. Documented in Pattern 1 below for future reference.

## Context

Cycle 12 was the final review pass on `fix/p2-batch-cycle-12`, covering code introduced in Cycles 10-11. Two P1s (security), five P2s (correctness/hardening), and two bonus cleanup items -- all committed individually, TypeScript build clean.

Four of the eight fixes correct code introduced in the immediately preceding Cycle 11 (P1-1 CSP regex, P2-3 replay protection, P2-5 stmt cache, P2-6 type alias). This validates running review cycles after every batch of fixes: new code introduced to fix problems creates its own problems, especially at security boundaries and in caching logic.

| Commit | Finding | Fix |
|--------|---------|-----|
| `8e09ce5` | P1-1: CSP nonce regex too narrow | Broadened to `/<script(?=[\s>])/gi` |
| `017c053` | P1-2: GET /logout is CSRF vector | POST + `sessionAuth` + `csrfGuard`, JSON response |
| `69839b5` | P2-3: Replay protection accepts future timestamps | One-sided check: reject <-60s or >5min |
| `0fb43f8` | P2-4: LLM validators lack typeof object guard | Added typeof+null+Array check to all 3 validators |
| `aaa110b` | P2-5: stmt() cache misused for dynamic SQL | Switched to `initDb().prepare()` |
| `7e497cb` | P2-6: JsonValidator type alias used once | Inlined as `(raw: unknown) => T` |
| `841ea4e` | P2-7: Dead FollowUpAction* types | Deleted |
| `475bd12` | Bonus: Dead re-export + missing semicolon | Cleaned up |

## Patterns That Emerged

### 1. Tag-matching regexes must account for attributes (P1-1)

**Problem:** `/<script>/g` only matched `<script>` exactly. A tag with attributes (`<script type="module">`) was missed, leaving it without a CSP nonce -- silently disabling CSP for that tag.

**Fix:** `/<script(?=[\s>])/gi` -- lookahead matches the tag name boundary without consuming the next character. Case-insensitive to handle `<SCRIPT>`.

```typescript
// Before
const html = dashboardHtml.replace(/<script>/g, `<script nonce="${nonce}">`);
// After
const html = dashboardHtml.replace(/<script(?=[\s>])/gi, `<script nonce="${nonce}"`);
```

**Lesson:** When injecting attributes into HTML tags via regex, test against all valid tag forms: bare (`<script>`), with attributes (`<script src="...">`), and case variants (`<SCRIPT>`). Regex that only matches the simplest form is a security gap. Lookahead (`(?=...)`) is the right tool for tag-name boundaries.

**Residual risk:** `<script\n` (newline after tag name) would not match. Acceptable because the dashboard HTML is static build-time content.

### 2. State-changing operations must never be GET (P1-2)

**Problem:** `/logout` was a GET endpoint. Any page could log a user out via `<img src="/logout">` -- a CSRF vector even though logout seems harmless (it degrades session state).

**Fix:** POST with `sessionAuth` + `csrfGuard`. Response changed from redirect to JSON for agent-friendliness.

```typescript
// Before
app.get("/logout", logout);
// After
app.post("/logout", sessionAuth, csrfGuard, logout);
```

**Lesson:** GET and HEAD must never change server state (RFC 7231 Section 4.2.1). Endpoints like `/logout`, `/approve`, `/delete` are common violations added casually. Every state-changing endpoint needs both authentication and CSRF protection.

### 3. Never use Math.abs() on security timestamps (P2-3)

**Problem:** `Math.abs(now - timestamp) < 5min` accepted timestamps up to 5 minutes in the future. An attacker could pre-generate signed requests with future timestamps for a wider replay window.

**Fix:** One-sided check with explicit future-tolerance:

```typescript
// Before
const tsAge = Math.abs(Math.floor(Date.now() / 1000) - parseInt(timestamp, 10));
if (isNaN(tsAge) || tsAge > MAILGUN_TIMESTAMP_MAX_AGE_S) {

// After
const tsAge = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10);
if (isNaN(tsAge) || tsAge < -60 || tsAge > MAILGUN_TIMESTAMP_MAX_AGE_S) {
```

**Lesson:** `Math.abs()` on timestamp deltas collapses two distinct failure modes (too old vs. too new) into one. Time validation must be directional. Allow a small clock-skew window for the future (60s), but don't treat future timestamps the same as past ones.

### 4. Validate shape before fields at LLM trust boundaries (P2-4)

**Problem:** Validators checked structural properties (`"tone" in raw`) without confirming `raw` was an object. LLM returning a JSON array or primitive would bypass validation via JavaScript auto-boxing (`"toString" in 42` returns `true`).

**Fix:** Guard at the top of every validator:

```typescript
if (typeof raw !== "object" || raw === null || Array.isArray(raw))
  throw new Error("Expected JSON object from LLM");
```

**Lesson:** At every LLM trust boundary, validate shape before fields. The first line of any LLM response validator must be `typeof === "object" && !Array.isArray && !== null`. This is the LLM equivalent of input validation at an API boundary -- extends the pattern from `express-handler-boundary-validation.md`.

### 5. Cache helpers must match query dynamism (P2-5)

**Problem:** `listLeadsFiltered` builds SQL dynamically (different WHERE clauses per call) but used the `stmt()` cache (designed for static SQL). Cache key varied every call -- zero hit rate, unbounded growth.

**Fix:** `initDb().prepare(sql)` directly, bypassing the cache.

```typescript
// Before
const rows = stmt(sql).all(params) as LeadRecord[];
// After
const rows = initDb().prepare(sql).all(params) as LeadRecord[];
```

**Lesson:** Caching layers must document their assumptions. When the cache key varies with every invocation, the cache is a memory leak, not an optimization. Audit every call site when introducing a cache: "Is the input deterministic and finite?"

### 6. Don't export single-use type aliases (P2-6)

**Problem:** `JsonValidator<T>` was exported from `claude.ts`, used only as a parameter type in one function. Three consumer files imported it unnecessarily.

**Fix:** Inlined as `(raw: unknown) => T` in the function signature. Deleted all imports.

**Lesson:** A type alias earns its existence when used in 3+ places or when the name adds clarity the signature alone doesn't convey. One usage = inline it.

### 7. Grep for orphaned symbols after refactoring (P2-7, Bonus)

**Problem:** Dead `FollowUpAction*` types and a dead `shapeLead` re-export survived because they caused no build errors. TypeScript's `noUnusedLocals` doesn't catch unused *exports*.

**Fix:** Deleted all dead symbols.

**Lesson:** After refactoring, `grep -rn "SymbolName" src/` for every moved/changed symbol. If it only appears in its own declaration, delete it.

## Cross-Cutting Lesson: Review Cycles Compound

Four of eight fixes correct code from the immediately preceding Cycle 11. Pattern: security hardening and caching infrastructure introduced to fix problems creates its own edge cases. Running review cycles after every fix batch catches these in minutes. The cost of not reviewing is catching them in production.

## Prevention Checklist

Items 1-8 are in [Cycle 3's doc](review-fix-cycle-3-security-hardening.md). These extend the list:

9. **Tag-matching regexes:** Does the regex account for attributes? Test against `<tag>`, `<tag attr="val">`, and `<TAG>`. Use lookahead `(?=[\s>])` instead of matching `>` literally. Always use the `i` flag for HTML tags.

10. **GET routes and state changes:** Does any GET/HEAD route modify server state? If yes, change to POST/PUT/DELETE and add CSRF protection. Red-flag verbs on GET routes: `/logout`, `/approve`, `/confirm`, `/delete`, `/toggle`.

11. **Timestamp direction:** Does timestamp validation use `Math.abs()` or accept future timestamps? Validate one-sided: reject older than window AND more than 60s in the future.

12. **Type guard ordering in validators:** Does every validator receiving `unknown`/`any` check `typeof === "object" && !== null` before property access or `in` operator? Primitives auto-box in JS.

13. **Cache assumptions match usage:** Is any cache helper called with dynamic/variable input? Static-SQL caches must not be used with dynamic SQL. Cache helpers should document their key-stability assumption.

14. **Dead type/code accumulation:** After refactoring, grep for types/exports that lost all consumers. `noUnusedLocals` won't catch unused exports -- requires manual audit.

15. **Regex case sensitivity on HTML:** HTML tags are case-insensitive. Any tag-matching regex needs the `i` flag unless input is guaranteed lowercase.

## Risk Resolution

### Fix-Batched Phase Risk (Cycle 12)

**Flagged:** "The P1-1 CSP regex fix uses a lookahead that would NOT match `<script\n>` (newline after tag name)."

**What happened:** Accepted as low risk. Dashboard HTML is build-time static -- `<script\n` won't appear unless manually introduced. Documented as residual risk in Pattern 1.

**Lesson:** When accepting a residual risk in a regex fix, document the specific input that would bypass it and why that input can't appear in the current system. If the system changes (e.g., dynamic script tag generation), the risk assessment changes.

### Review Phase Risk (Cycle 11 -> 12)

**Flagged:** "The email parser (`email-parser.ts`) was not reviewed by any agent -- if Mailgun payloads can be crafted to exploit the parser before signature validation, that's a pre-auth attack surface."

**What happened:** Not addressed in Cycle 12 (focused on P1/P2 fixes from the existing review). Remains an open gap for future review cycles.

**Lesson:** Carry forward unaddressed review blind spots to the next cycle's deferred items so they don't get lost.

## Three Questions

### 1. Hardest pattern to extract from the fixes?

The relationship between P2-4 (typeof guard) and the existing `express-handler-boundary-validation.md` doc. Both are about validating shape at trust boundaries, but one is HTTP input and the other is LLM output. Decided to frame P2-4 as "the LLM equivalent of input validation at an API boundary" -- extending the existing pattern rather than creating a new category.

### 2. What did you consider documenting but left out, and why?

The specific `Math.abs()` JavaScript auto-boxing behavior (`"toString" in 42` returning `true`). It's a JS language quirk worth knowing but too granular for a solution doc. The pattern "validate typeof before using `in`" captures the actionable lesson without the language trivia.

### 3. What might future sessions miss that this solution doesn't cover?

The interaction between the `stmt()` cache and database connection lifecycle. P2-5 bypasses the cache for dynamic SQL, but if the database connection is recycled (e.g., Railway redeploy), cached statements from `stmt()` could reference a stale connection. This wasn't observed but is a theoretical failure mode for long-running processes.
