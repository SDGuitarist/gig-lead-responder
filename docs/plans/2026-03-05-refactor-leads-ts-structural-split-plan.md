---
title: "refactor: Split leads.ts into focused db modules"
type: refactor
status: active
date: 2026-03-05
origin: docs/brainstorms/2026-03-05-leads-ts-structural-split-brainstorm.md
feed_forward:
  risk: "DB instance sharing pattern after split — how do 4 modules access the same singleton?"
  verify_first: true
---

# refactor: Split leads.ts into focused db modules

## Enhancement Summary

**Deepened on:** 2026-03-05 (round 2)
**Agents used:** 13 (TypeScript Reviewer, Architecture Strategist, Pattern Recognition, Code Simplicity, Performance Oracle, Data Integrity Guardian, Learnings Researcher, Best Practices Researcher x4, Framework Docs Researcher, Context7 better-sqlite3 docs)

### Key Improvements (Round 1)
1. **P1 gap closed:** `stmt()` + `stmtCache` handling now explicitly planned (duplicate per module)
2. **P1 gap closed:** `UPDATE_ALLOWED_COLUMNS` explicitly assigned to `db/leads.ts`
3. **Simplified:** Dropped `getDb()` — keep using `initDb()` directly (YAGNI)
4. **Safer commits:** Merged commits 2+3 into one (avoid broken duplicate-export state)
5. **Two-tier exports:** `normalizeLeadRow` exported from leads.ts but excluded from barrel
6. **Defensive guard:** `runTransaction` gets async callback detection + JSDoc warning
7. **Export count corrected:** 27 (current public) stays at 27 in barrel; internal helpers shared directly

### Key Improvements (Round 2 — Deepen)
8. **P1 upgraded:** `runTransaction` async guard upgraded from `constructor.name` check to three-layer defense (compile-time type + `util.types.isAsyncFunction` + post-hoc Promise check)
9. **P1 new:** Stale `stmtCache` invalidation risk identified — added db-reference guard to `stmt()` template
10. **Renamed:** `normalizeRow` → `normalizeLeadRow` for clarity as cross-module export
11. **Enforcement tooling:** Documented `eslint-plugin-import` configs + lighter `dependency-cruiser` alternative for barrel import rules (deferred — no ESLint in project yet)
12. **3 missed solution docs surfaced:** `environment-aware-fatal-guards`, `railway-healthcheck-auth-middleware-ordering`, `dead-code-env-var-collision`
13. **Simplicity challenge absorbed:** Considered 3-module merge (migrate+leads) — rejected because migrate is ~170 lines of pure SQL schema, conceptually distinct from CRUD operations
14. **`listLeadsFiltered` dynamic SQL flagged:** Plan now documents that this function produces multiple `stmtCache` entries by design (variable SQL based on opts)

### New Considerations Discovered (Round 1)
- Barrel file is a new pattern in this codebase (no other subdirectory uses one)
- `getAnalytics()` uses `db.transaction()` directly — queries.ts is not purely read-only
- IDE autocomplete hazard: old `./leads.js` paths can linger post-refactor
- `stmt()` cache is per-module (each module's SQL is disjoint — no shared cache needed)

### New Considerations Discovered (Round 2 — Deepen)
- `fn.constructor.name === 'AsyncFunction'` misses `.bind()` wrappers, sync-functions-returning-Promises, and can break under minification
- better-sqlite3 v11.10+ now throws natively on async transaction callbacks (C++ level detection) — verify project version
- `NotPromise<T>` conditional type can catch async callbacks at compile time (partial — bypassed with explicit type params)
- Stale prepared statements after table rebuild: per-module caches increase blast radius from 1 to 3 caches
- `DISABLE_FOLLOW_UPS` does NOT live in `leads.ts` — it's in `follow-up-scheduler.ts`. Plan note about moving it is inaccurate.
- `follow-ups.ts` and `queries.ts` must remain peer siblings with no lateral dependency — if shared logic emerges, extract upward
- Adding ESLint just for barrel enforcement is scope creep for this refactor; consider `dependency-cruiser` or code review

---

## Prior Phase Risk

> **Least confident about:** The db instance sharing pattern. Currently `initDb()`
> creates the db and every function in leads.ts uses it via closure. After the
> split, `migrate.ts` will own `initDb()` but `leads.ts`, `follow-ups.ts`, and
> `queries.ts` all need access to the db instance.

**Resolution:** Research confirmed every function already calls `initDb()`
independently (44 calls total). The pattern is a lazy singleton via module-level
`let db`. Solution: `migrate.ts` exports `initDb()` and other modules import it
directly. No `getDb()` wrapper needed — `initDb()` already handles both
initialization and retrieval (returns cached instance on subsequent calls). No DI
needed, no extra files.

### Research Insight: Singleton Pattern Validated

better-sqlite3 docs confirm sharing one `Database` instance across modules is
the correct and recommended pattern for single-process Node.js servers. Node.js
module caching guarantees `migrate.ts` evaluates exactly once regardless of how
many modules import from it. Multiple instances would cause WAL checkpoint
conflicts and lock contention. (Source: better-sqlite3 API docs, threads docs)

---

## Overview

Split `src/leads.ts` (751 lines, 27 public exports, 8 consumers) into 4 focused
modules under `src/db/` with a barrel file for backwards-compatible imports. Pure
structural refactor — no behavior changes.

(see brainstorm: docs/brainstorms/2026-03-05-leads-ts-structural-split-brainstorm.md)

---

## Problem Statement / Motivation

`leads.ts` is the God Module — every data-touching file imports from it, and it
mixes 4 distinct responsibilities: migrations, CRUD, follow-up state machine, and
dashboard queries. This makes it hard to:

- Reason about changes (which of 751 lines are affected?)
- Fix P2 issues cleanly (026, 033, 034 all live in this file)
- Review PRs (every PR touching lead data modifies the same file)

Tracked as structural debt since Cycle 9. Recommended split documented in
`docs/solutions/architecture/review-fix-cycle-2-lead-response-loop.md` line 83.

---

## Proposed Solution

### Target Structure

```
src/db/
  migrate.ts      ~170 lines  Schema, migrations, indexes, initDb()
  leads.ts        ~200 lines  CRUD, idempotency, venue misses, normalizeLeadRow, runTransaction, stmt()
  follow-ups.ts   ~230 lines  5-state machine, 8 transitions, completeApproval, stmt()
  queries.ts      ~210 lines  Dashboard lists, stats, analytics, outcomes, stmt()
  index.ts        ~30 lines   Barrel re-exports (27 public exports only)
```

### Research Insight: Module Sizes

Median project file is ~88 lines. The 170-230 line targets are on the upper range
but well below the problem threshold (751 lines). Acceptable for a first refactor.
Further splitting would add complexity for marginal gain.

### DB Instance Sharing

```
migrate.ts  <- owns `let db` + initDb() (lazy singleton)
    ^
leads.ts  <- imports initDb from ./migrate.js
    ^
follow-ups.ts  <- imports initDb from ./migrate.js + getLead/updateLead/runTransaction from ./leads.js
    ^
queries.ts  <- imports initDb from ./migrate.js + normalizeLeadRow from ./leads.js
```

No circular dependencies. Clean DAG. Verified by Architecture Strategist agent
tracing every function's cross-module calls.

**DAG preservation rule (from Deepen round):** `follow-ups.ts` and `queries.ts`
must remain peer siblings with no lateral dependency between them. If a future
feature needs `queries.ts` to call a follow-up function (e.g., follow-up analytics
needing `computeFollowUpDelay`), extract the shared logic upward to `leads.ts` or
a new utility module — never resolve it with a lateral import.

**Rule: Sub-modules import from each other directly (e.g., `from "./migrate.js"`).
Never import from the barrel (`./index.js`) inside `src/db/`. This prevents
circular dependencies.** (Source: barrel file best practices, 2024-2026)

### stmt() and stmtCache — Per-Module Duplication

**This was the #1 gap found by 7 of 9 review agents.**

Currently, `stmtCache` (line 12) and `stmt()` (lines 15-22) are module-scoped in
`leads.ts`. Every DB function uses `stmt()` to prepare and cache SQL statements
(33 call sites). After the split, 3 modules need this pattern.

**Decision: Each module gets its own `stmtCache` + `stmt()` copy.**

Rationale:
- Each module's SQL is disjoint — no SQL string appears in multiple modules
- Separate caches cause zero waste (no duplicate prepared statements)
- Keeps each module self-contained (~8 lines of boilerplate per module)
- Avoids coupling all modules to migrate.ts for a utility concern

Template for each module:
```typescript
let cachedDb: Database.Database | undefined;
const stmtCache = new Map<string, Database.Statement>();
function stmt(sql: string): Database.Statement {
  const db = initDb();
  // Guard: if db instance changed (test reset, migration rebuild), clear stale cache
  if (db !== cachedDb) {
    stmtCache.clear();
    cachedDb = db;
  }
  let s = stmtCache.get(sql);
  if (!s) {
    s = db.prepare(sql);
    stmtCache.set(sql, s);
  }
  return s;
}
```

Note: `updateLead` (line 323) calls `initDb().prepare()` directly for dynamic SQL
with `RETURNING *`. This is a different pattern from `stmt()` — keep it as-is.

Note: `listLeadsFiltered` builds SQL dynamically based on `opts.status` and
`opts.sort`, producing up to 8 different SQL strings. Each variant gets its own
cache entry — this is intentional multi-key caching, not a bug. Do not "fix" it
by extracting the SQL during work phase.

### Deepen Research: stmt()/stmtCache Alternatives Evaluated

**Alternatives considered and rejected:**

| Alternative | Lines | Coupling | Verdict |
|---|---|---|---|
| Per-module duplication (plan) | ~12/module | None | **Chosen** — simplest, matches codebase patterns |
| Shared `db/stmt-cache.ts` utility | ~15 shared + 1 import/module | All → stmt-cache | Adds a file for 12 lines of code |
| Factory function from `migrate.ts` | ~15 in migrate + 1/module | All → migrate (already coupled) | Viable but modules already import `initDb` — adding `createStmt` is marginal gain |
| Class-based `StmtCache` | ~25 shared + instantiation/module | All → class module | Over-engineered for a Map + prepare() |
| Export `stmt()` from `migrate.ts` | 0 extra files | All → migrate (already coupled) | Simplicity reviewer's preference — valid, but couples utility concern to migration module |

**Why per-module wins:** The codebase has no shared utility files — `pipeline/`,
`data/`, `utils/`, `prompts/` all define helpers inline. Duplicating `stmt()` is
consistent with this pattern. Each module's SQL is disjoint (no SQL string appears
in 2+ modules), so separate caches waste zero memory.

**better-sqlite3 has NO built-in statement caching** (confirmed via Context7 docs
query). `db.prepare()` creates a new Statement object every call. The manual cache
is necessary for performance.

**Stale cache risk (P1 from Data Integrity Guardian):** The `initDb()` function
performs a table rebuild migration (lines 100-157) that DROPs and recreates the
`leads` table. After DROP, all cached prepared statements become invalid
(`SqliteError: database schema has changed`). Today this is safe because `initDb()`
runs once at startup before any `stmt()` calls. But splitting into 3 caches
increases the blast radius if a future change triggers migration after startup.

**Mitigation:** The updated `stmt()` template above includes a db-reference guard.
If the `db` instance changes (test reset, recovery, etc.), the cache auto-clears.
This costs one reference comparison per `stmt()` call — negligible.

**Keep-in-sync comment:** Add `// stmt() pattern also in follow-ups.ts, queries.ts — keep in sync`
to each module's `stmt()` implementation.

### Complete Export Map

Every export from current `leads.ts` mapped to its new home:

**From `db/migrate.ts` (public — re-exported via barrel):**
- `initDb` (function — startup bootstrap + runtime lazy getter)

**From `db/leads.ts` (public — re-exported via barrel):**
- `InsertLeadInput` (interface)
- `insertLead`, `getLead`, `getLeadsByStatus`, `updateLead`, `claimLeadForSending`
- `isEmailProcessed`, `markEmailProcessed`
- `runTransaction`
- `logVenueMiss`
- `setLeadOutcome` (write operation that calls getLead + updateLead internally)

**From `db/leads.ts` (internal — NOT in barrel, imported directly by siblings):**
- `normalizeLeadRow` (converts SQLite 0/1 to boolean — implementation detail)

**From `db/follow-ups.ts` (public — re-exported via barrel):**
- `getLeadsDueForFollowUp`, `getLeadAwaitingFollowUp`, `getLeadWithActiveFollowUp`
- `scheduleFollowUp`, `approveFollowUp`, `storeFollowUpDraft`
- `skipFollowUp`, `snoozeFollowUp`, `markClientReplied`
- `claimFollowUpForSending`, `completeApproval`

**From `db/follow-ups.ts` (private — not exported at all):**
- Constants: `MAX_FOLLOW_UPS`, `FOLLOW_UP_DELAYS_MS`, `computeFollowUpDelay`
- Constants: `TERMINAL_CLEAR`

**From `db/queries.ts` (public — re-exported via barrel):**
- `ListLeadsFilteredOpts` (interface)
- `LeadStats` (interface)
- `listLeadsFiltered`, `listFollowUpLeads`
- `getAnalytics`, `getLeadStats`

**From `db/index.ts` (barrel):**
- Re-exports 27 public symbols from all 4 modules
- Does NOT re-export `normalizeLeadRow` (internal cross-module helper)

**Internal symbols that move with their functions (not exported, not in barrel):**
- `stmtCache` + `stmt()` — duplicated per module (leads, follow-ups, queries)
- `UPDATE_ALLOWED_COLUMNS` — moves to `db/leads.ts` with `updateLead`

### Research Insight: Two-Tier Export Strategy

Architecture Strategist recommended separating public API (barrel) from internal
API (direct sibling imports). This prevents `normalizeLeadRow` from leaking to
consumers — it's an SQLite implementation detail (0/1 to boolean conversion) that
only sibling modules need. Consumers should never see it.

### Deepen Research: Enforcing Two-Tier Exports with Tooling

The project has no ESLint config. Three enforcement options were researched:

**Option A: `eslint-plugin-import` (most direct, but requires adding ESLint)**

```js
// eslint.config.js (flat config)
import importPlugin from 'eslint-plugin-import';

export default [
  // R1: External consumers must use the barrel
  {
    files: ['src/**/*.ts'],
    ignores: ['src/db/**/*.ts'],
    plugins: { import: importPlugin },
    rules: {
      'import/no-internal-modules': ['error', {
        forbid: ['**/db/leads*', '**/db/follow-ups*', '**/db/queries*', '**/db/migrate*']
      }]
    }
  },
  // R3: Internal db files cannot import the barrel
  {
    files: ['src/db/**/*.ts'],
    plugins: { import: importPlugin },
    rules: {
      'import/no-restricted-paths': ['error', {
        zones: [{
          target: './src/db/',
          from: './src/db/index.ts',
          message: 'Import siblings directly (e.g., ./leads.js), not the barrel.'
        }]
      }]
    }
  }
];
```

**Option B: `dependency-cruiser` (lightweight, no ESLint needed)**

```js
// .dependency-cruiser.cjs
module.exports = {
  forbidden: [
    {
      name: 'no-barrel-self-import',
      comment: 'db/ modules must import siblings directly, not the barrel',
      severity: 'error',
      from: { path: '^src/db/' },
      to: { path: '^src/db/index\\.ts$' }
    },
    {
      name: 'no-deep-db-imports',
      comment: 'External consumers must use the barrel',
      severity: 'warn',
      from: { path: '^src/', pathNot: '^src/db/' },
      to: { path: '^src/db/(?!index)' }
    }
  ]
};
```

Run: `npx depcruise --config .dependency-cruiser.cjs src/`

**Option C: Comments + code review (zero tooling)**

Add a comment at the top of each `db/*.ts` file documenting allowed imports:
```typescript
// Allowed imports: ./migrate.js, ./leads.js (direct sibling only)
// NEVER import from ./index.js (circular dependency risk)
```

**Decision for this refactor: Option C (comments) now, consider Option B later.**

Adding ESLint or dependency-cruiser is scope creep for a structural refactor.
The barrel file comment already explains the convention. If the team grows or
the pattern spreads, revisit with `dependency-cruiser` as a CI check — it
requires no ESLint, runs as a standalone CLI, and is the lightest enforcement.

**Note:** `@typescript-eslint/no-restricted-imports` was evaluated and rejected —
it cannot restrict based on the importing file's location, only globally.

### Downstream Consumer Changes

All consumers switch from `./leads.js` to `./db/index.js`:

| Consumer | Current import | New import |
|----------|---------------|------------|
| `server.ts` | `from "./leads.js"` | `from "./db/index.js"` |
| `webhook.ts` | `from "./leads.js"` | `from "./db/index.js"` |
| `run-pipeline.ts` | `from "./leads.js"` | `from "./db/index.js"` |
| `post-pipeline.ts` | `from "./leads.js"` | `from "./db/index.js"` |
| `api.ts` | `from "./leads.js"` | `from "./db/index.js"` |
| `twilio-webhook.ts` | `from "./leads.js"` | `from "./db/index.js"` |
| `follow-up-api.ts` | `from "./leads.js"` | `from "./db/index.js"` |
| `follow-up-scheduler.ts` | `from "./leads.js"` | `from "./db/index.js"` |

### Research Insight: Barrel File is a New Pattern

This is the first barrel/re-export file in the project (no `pipeline/index.ts`,
`data/index.ts`, or `utils/index.ts` exists). Other subdirectories use direct
imports (e.g., `from "./pipeline/classify.js"`). Add a comment at the top of
`index.ts` explaining why `db/` uses a barrel when others don't:

```typescript
// Barrel re-export for backwards-compatible imports.
// All 8 consumers previously imported from "../leads.js".
// This barrel lets them switch to "../db/index.js" with no other changes.
// Internal modules (leads, follow-ups, queries) import from each other directly.
```

---

## Technical Considerations

### Module boundary decisions

- **`setLeadOutcome` in `leads.ts`** not `queries.ts` — it's a write (calls
  `getLead` + `updateLead`). Placing it in queries would create a reverse
  dependency violating the DAG.
- **`completeApproval` in `follow-ups.ts`** — straddles both concerns (sets
  `status: "done"` AND schedules first follow-up) but primary purpose is
  initiating the follow-up chain. Imports `updateLead` from leads for the status
  transition.
- **`normalizeLeadRow` exported from `leads.ts` but NOT from barrel** — needed by
  `queries.ts` and `follow-ups.ts` to convert SQLite 0/1 to boolean. Internal
  implementation detail, not public API.
- **`UPDATE_ALLOWED_COLUMNS` moves to `db/leads.ts`** — security whitelist for
  `updateLead()` column names. Must stay with updateLead.

### Research Insight: normalizeLeadRow Risk is Low

All current callers already receive boolean values (normalizeLeadRow is applied to
every return path today). The promotion from private to exported does not change
any call site's behavior. `Boolean(true)` returns `true`, so double-normalization
is idempotent. Quick verification during work phase:
```bash
grep -r "gate_passed === 0\|gate_passed === 1" src/
```
If zero matches, the risk is eliminated.

### Deepen Research: normalizeLeadRow Naming and Placement

**Decision: Rename to `normalizeLeadRow`.**

Once a function crosses module boundaries, its name must carry enough context to
be understood at the import site. Inside `leads.ts`, `normalizeLeadRow` is unambiguous.
But when `follow-ups.ts` imports it, a reader seeing `normalizeLeadRow(row)` asks:
"which row? what normalization?" The type annotation only shows if you hover in
the IDE — code review, `grep`, and diffs don't show inline types.

`normalizeLeadRow` is self-documenting at every call site. The "more characters"
concern is negligible — editor autocomplete handles it, and readability wins.

**Naming convention alternatives evaluated and rejected:**

| Convention | Verdict |
|---|---|
| `_normalizeLeadRow` (underscore prefix) | Python convention, frowned upon in TypeScript. `no-underscore-dangle` ESLint rule is widely enabled. |
| `@internal` JSDoc tag | Only affects `.d.ts` output via `stripInternal`. Does NOT prevent runtime imports. Irrelevant for apps (not libraries). |
| `@package` / `@access package` | Pure documentation tag — no compiler or runtime effect. |
| Inline the one-liner | Rejected: 10+ call sites, and if `LeadRecord` gains another boolean column, every inline must update. |

**Barrel omission IS the API boundary.** The simplest and most effective approach:
export `normalizeLeadRow` from `db/leads.ts`, do NOT re-export from `db/index.ts`.
The barrel file defines the public surface. Everything excluded is implicitly internal.
This is the consensus approach in Google TypeScript Style Guide and TypeScript Deep Dive.

**TypeScript reviewer note (P2):** The current signature `normalizeLeadRow(row: LeadRecord): LeadRecord`
is technically a type lie — SQLite returns `gate_passed: number | null`, not `boolean | null`.
The function works because `Boolean(0)` is `false` and `Boolean(1)` is `true`. For this refactor,
a JSDoc comment is sufficient scope. A `RawLeadRow` input type can be added in a future pass.

**Placement stays in `db/leads.ts`** — the function operates on `LeadRecord` and
is owned by the leads CRUD module. A separate `db/utils.ts` was considered but
adds a file for one function. If more cross-module helpers emerge later (e.g.,
`normalizeFollowUpRow`, `parseDateColumn`), extract a `db/utils.ts` at that point.

### Institutional learnings to preserve

Per `docs/solutions/database-issues/async-sqlite-transaction-boundary.md`:
- Never `await` inside `db.transaction()` — better-sqlite3 is sync-only
- All async work happens BEFORE db writes
- This pattern must remain intact in `follow-ups.ts` and `leads.ts`

Per `docs/solutions/architecture/atomic-claim-for-concurrent-state-transitions.md`:
- Each function gets its own `initDb()` call (unchanged by split)
- Dedicated functions for atomic claims (not generic updateLead with conditionals)
- `claimLeadForSending` stays in leads.ts, `claimFollowUpForSending` stays in
  follow-ups.ts — both are single atomic SQL statements, safe across modules

Per `docs/solutions/logic-errors/constants-at-the-boundary.md`:
- Status enums (`LeadStatus`, `FollowUpStatus`) live in `src/types.ts`
- SQL CHECK constraints have `-- SYNC:` comments referencing the TypeScript source
- After the split, ensure no inline status literals drift between modules

Per `docs/solutions/architecture/silent-failure-escape-hatches.md`:
- `DISABLE_FOLLOW_UPS` kill switch lives in `follow-up-scheduler.ts` (NOT in `leads.ts`)
- Correction: the plan originally said "must move to follow-ups.ts" but it does not
  exist in the file being split. No action needed for this refactor.
- Validation pattern preserved: check `=== "true"` only (not truthy), log on bypass

Per `docs/solutions/database-issues/align-derived-stat-queries.md`:
- `queries.ts` functions (`getAnalytics`, `getLeadStats`) must use the same WHERE
  filter for derived stats. Verify consistency during work phase.

### Deepen: Solution Docs Missed by Original Plan

Learnings Researcher scanned all 27 solution docs and found 3 the plan missed:

**1. `docs/solutions/architecture/environment-aware-fatal-guards.md`**
- When `initDb()` moves to `db/migrate.ts`, verify the startup guard is fail-closed
  in production. Don't let a missing `DATABASE_PATH` silently fall back to `:memory:`.
- Current code: `const DB_PATH = process.env.DATABASE_PATH || "./data/leads.db"`.
  The fallback is a local file, not `:memory:` — acceptable for Railway where the
  volume mount provides persistence. But add a startup log confirming the actual path.

**2. `docs/solutions/architecture/railway-healthcheck-auth-middleware-ordering.md`**
- When updating imports in `server.ts`, import order matters for initialization.
  Verify that `initDb()` is called before any route handler that uses the db.
  Current code calls `initDb()` at the top of `server.ts` — ensure the split
  doesn't change this ordering.
- Test the actual deployment sequence (not just local `npm run dev`).

**3. `docs/solutions/workflow/dead-code-env-var-collision.md`**
- When splitting modules, watch for env var references that might collide or
  become orphaned. Grep for `process.env` in `leads.ts` to ensure all env var
  references land in the correct module. Currently only `DATABASE_PATH` (→ migrate.ts).

### Deepen Research: runTransaction Async Guard (Three-Layer Defense)

Data Integrity Guardian found that TypeScript will NOT catch `async` callbacks
passed to `db.transaction()` — `async () => T` is assignable to `() => T`.

**The original plan used `fn.constructor.name === 'AsyncFunction'`. Deep research
found this is unreliable:**

| Scenario | `constructor.name` catches? | `util.types.isAsyncFunction` catches? |
|---|---|---|
| `async function foo() {}` | Yes | Yes |
| `async () => {}` | Yes | Yes |
| `() => someAsyncFn()` (sync returning Promise) | **No** | **No** |
| `asyncFn.bind(context)` | **No** | **No** |
| Minified/bundled code | **Maybe not** | Yes (native check) |

**Upgraded implementation — three layers of defense:**

```typescript
import { types } from 'node:util';

// Layer 1: Compile-time — catches most cases in IDE with red squiggles
type NotPromise<T> = T extends Promise<any> ? never : T;

/**
 * Wraps db.transaction(). Callback MUST be synchronous.
 * @see docs/solutions/database-issues/async-sqlite-transaction-boundary.md
 */
export function runTransaction<T>(fn: () => NotPromise<T>): T {
  // Layer 2: Pre-execution — catches async-declared functions (not .bind()'d)
  if (types.isAsyncFunction(fn)) {
    throw new Error(
      'runTransaction: callback must be synchronous. ' +
      'See docs/solutions/database-issues/async-sqlite-transaction-boundary.md'
    );
  }

  // Layer 3: Post-execution — catches .bind()'d async and sync-returning-Promise
  const wrappedFn = () => {
    const result = fn();
    if (result != null && typeof (result as any).then === 'function') {
      throw new Error(
        'runTransaction: callback returned a Promise. ' +
        'Transaction already committed. Use only synchronous operations. ' +
        'See docs/solutions/database-issues/async-sqlite-transaction-boundary.md'
      );
    }
    return result;
  };

  return initDb().transaction(wrappedFn as () => T)();
}
```

**Layer details:**

| Layer | What it catches | When | Cost |
|---|---|---|---|
| `NotPromise<T>` type | `async` callbacks in editor | Compile time | Zero runtime cost |
| `util.types.isAsyncFunction` | `async` functions (not bound) | Before execution | One native call |
| Post-hoc thenable check | `.bind()`, sync-returning-Promise | After execution | One typeof check per call |

**Caveat:** Layer 3 fires after the transaction has already committed for the
synchronous portion (everything before the first `await`). The throw prevents
the caller from proceeding as if the full transaction completed — it surfaces the
bug loudly rather than silently corrupting data.

**better-sqlite3 v11.10+ note:** Recent versions throw natively on async callbacks
at the C++ level. Verify the project's `better-sqlite3` version during work phase.
If >= 11.10, layers 2 and 3 are defense-in-depth rather than the primary guard.

**Simplicity counterpoint:** The Code Simplicity Reviewer argued this is YAGNI
(only 2 call sites: `approveFollowUp` and `completeApproval`). The existing
solution doc is the real guard. **Decision: Keep the guard** — it costs ~15 lines
and the async-in-transaction bug is a data corruption risk, not a cosmetic issue.
The solution doc prevents informed developers from making the mistake; the runtime
guard catches it when they do anyway.

**ES2022 target confirmed safe:** TypeScript preserves `async` keyword at ES2017+
targets. No transpilation concern with `"target": "ES2022"`.

### Research Insight: Transaction Boundaries Safe Across Modules

better-sqlite3 docs confirm `db.transaction(fn)` returns a regular JavaScript
function that internally holds a reference to the `db` instance. No file-level
binding. Nested transactions auto-become savepoints. Cross-module calling is safe.
(Source: better-sqlite3 API reference)

### Research Insight: getAnalytics Uses db.transaction() Directly

`getAnalytics()` (~line 650) calls `initDb().transaction()` directly for a read
transaction. This means `queries.ts` is not purely read-only — it runs a
transaction for consistent multi-query analytics. This is architecturally correct
(consistent snapshot across derived stats) but worth noting.

### No tests for leads.ts

Verification strategy: `npx tsc --noEmit` (catches all import/export mismatches)
+ server startup smoke test (`/api/health` + `/api/leads`).

### Research Insight: ESM Startup Cost is Negligible

Performance Oracle confirmed: splitting 1 file into 5 adds ~4ms startup time.
Node.js caches modules after first load. Railway cold starts are dominated by
container boot and `better-sqlite3` native addon loading, not local file
resolution. (Sources: Node.js ESM docs, AppSignal performance guide)

---

## Acceptance Criteria

- [ ] `src/db/migrate.ts` contains `initDb()`, all CREATE/ALTER/index SQL
- [ ] `src/db/leads.ts` contains CRUD functions, idempotency, venue misses, runTransaction, setLeadOutcome, UPDATE_ALLOWED_COLUMNS, own stmtCache+stmt() with db-reference guard
- [ ] `src/db/follow-ups.ts` contains all follow-up state machine functions + completeApproval, own stmtCache+stmt() with db-reference guard
- [ ] `src/db/queries.ts` contains dashboard list/stats/analytics functions, own stmtCache+stmt() with db-reference guard
- [ ] `src/db/index.ts` barrel re-exports 27 public symbols (normalizeLeadRow EXCLUDED)
- [ ] All 8 consumer files updated to import from `./db/index.js`
- [ ] `src/leads.ts` deleted
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `grep -r "from.*\/leads\.js" src/` returns zero matches (no stale imports)
- [ ] `grep -r "gate_passed === 0\|gate_passed === 1" src/` returns zero matches
- [ ] Server starts and `/api/health` responds 200
- [ ] No behavior changes — all functions have identical signatures and return types
- [ ] `runTransaction` has three-layer async guard (`NotPromise<T>` + `util.types.isAsyncFunction` + post-hoc thenable check)
- [ ] `normalizeRow` renamed to `normalizeLeadRow` in all call sites
- [ ] Each `stmt()` copy has `// stmt() pattern also in [other modules] — keep in sync` comment
- [ ] Each `db/*.ts` file has allowed-imports comment at top
- [ ] `initDb()` call order in `server.ts` unchanged (must run before route handlers)
- [ ] `grep -r "process.env" src/db/` confirms only `DATABASE_PATH` in `migrate.ts`

---

## Implementation Steps

### Commit 1: Create src/db/ modules (~5 files)

**Prerequisite: `git commit` any uncommitted work first (mid-edit protection).**

1. `mkdir -p src/db`
2. Create `src/db/migrate.ts`:
   - Move lines 1-170 (imports, DB_PATH, initDb, all migrations)
   - Export `initDb` (no getDb — initDb already handles both init and retrieval)
3. Create `src/db/leads.ts`:
   - Add own `cachedDb` + `stmtCache` + `stmt()` helper with db-reference guard (calls `initDb()` from `./migrate.js`)
   - Add `// stmt() pattern also in follow-ups.ts, queries.ts — keep in sync` comment
   - Move logVenueMiss, normalizeLeadRow (renamed from normalizeRow), CRUD, idempotency, runTransaction
   - Move `setLeadOutcome` (from ~line 617-660)
   - Move `UPDATE_ALLOWED_COLUMNS` with `updateLead`
   - Export `normalizeLeadRow` (for sibling use — NOT re-exported via barrel)
   - Upgrade `runTransaction` to three-layer async guard (`NotPromise<T>` type + `util.types.isAsyncFunction` + post-hoc thenable check)
   - Import `{ types } from 'node:util'`
   - Import types from `../types.js`
4. Create `src/db/follow-ups.ts`:
   - Add own `cachedDb` + `stmtCache` + `stmt()` helper with db-reference guard
   - Add keep-in-sync comment
   - Move constants, delay computation, all state machine functions, completeApproval
   - `DISABLE_FOLLOW_UPS` is NOT in leads.ts — no action needed (lives in follow-up-scheduler.ts)
   - Import `initDb` from `./migrate.js`
   - Import `getLead`, `updateLead`, `runTransaction`, `normalizeLeadRow` from `./leads.js`
   - Import types from `../types.js`
   - Add allowed-imports comment at top: `// Allowed imports: ./migrate.js, ./leads.js (direct sibling only)`
5. Create `src/db/queries.ts`:
   - Add own `cachedDb` + `stmtCache` + `stmt()` helper with db-reference guard
   - Add keep-in-sync comment
   - Move remaining lines (lists, stats, analytics)
   - Import `initDb` from `./migrate.js` (needed for `getAnalytics` transaction)
   - Import `normalizeLeadRow` from `./leads.js`
   - Import types from `../types.js`
6. Create `src/db/index.ts`:
   - Add comment explaining why this barrel exists (first in codebase)
   - `export { initDb } from "./migrate.js";`
   - `export { InsertLeadInput, insertLead, getLead, ... } from "./leads.js";`
     (27 symbols — explicitly named, NOT `export *`)
   - `export { getLeadsDueForFollowUp, approveFollowUp, ... } from "./follow-ups.js";`
   - `export { ListLeadsFilteredOpts, LeadStats, listLeadsFiltered, ... } from "./queries.js";`
   - Do NOT re-export `normalizeLeadRow`

Run `npx tsc --noEmit` — should show errors only for duplicate exports (old leads.ts still exists).

### Commit 2: Update consumer imports + delete src/leads.ts

**Combined into one commit to avoid broken duplicate-export intermediate state.**

1. Update all 8 consumer files: change `from "./leads.js"` to `from "./db/index.js"`
2. Delete `src/leads.ts`
3. Run `npx tsc --noEmit` — should pass clean
4. Run `grep -r "from.*\/leads\.js" src/` — should return zero matches
5. Start server and verify `/api/health` + `/api/leads` respond correctly

### Research Insight: Commit Strategy

The original 3-commit plan (create, repoint, delete) left a broken intermediate
state where both old and new files existed with consumers pointing at new.
Simplicity Reviewer identified that merging repoint+delete is safer — `tsc` catches
all issues in one pass. This matches the "expand and contract" refactoring pattern
(Fowler). (Sources: Heap engineering TypeScript migration, refactoring best practices)

---

## Dependencies & Risks

**Risk: Missed export in barrel** — mitigated by the complete export map above
(27 symbols) and `tsc --noEmit` catching any missing re-export.

**Risk: Runtime import ordering** — Node ESM caches modules by URL. Since all
modules import `initDb` from `./migrate.js`, and `server.ts` calls `initDb()` at
startup before any request handler runs, the singleton is guaranteed to be
initialized. No risk of accessing `db` before init.

**Risk: Mid-refactor abort** — mitigated by committing before starting (CLAUDE.md
safety rule) and 2-commit strategy with safe rollback at each point.

**Risk: `initDb()` called at module scope** — if any module adds a top-level
`const s = initDb().prepare(...)`, it would trigger migrations during import.
Current code only calls `initDb()` inside function bodies. Constraint: never call
`initDb()` at module scope.

**Risk: Stale imports after delete** — mitigated by post-delete grep:
`grep -r "from.*\/leads\.js" src/`. IDE autocomplete may suggest old paths.

**Risk: Async callback in runTransaction** — mitigated by three-layer guard:
compile-time `NotPromise<T>` type, runtime `util.types.isAsyncFunction` pre-check,
and post-hoc thenable detection. TypeScript's type system alone cannot fully prevent
this (`async () => T` is assignable to `() => T`), hence the runtime layers.

**Risk: Stale stmtCache after db recreation (NEW from Deepen)** — if the `db`
instance is ever replaced (test reset, recovery), cached prepared statements
become invalid. Mitigated by db-reference guard in `stmt()` template (compare
current `initDb()` return to cached reference, clear cache on mismatch).

**Risk: Lateral dependency between follow-ups.ts and queries.ts (NEW from Deepen)**
— if a future feature creates a dependency between these peer siblings, the clean
DAG breaks. Mitigated by allowed-imports comments and the rule: extract shared
logic upward, never resolve with lateral imports.

---

## Sources & References

- **Origin brainstorm:** [docs/brainstorms/2026-03-05-leads-ts-structural-split-brainstorm.md](docs/brainstorms/2026-03-05-leads-ts-structural-split-brainstorm.md)
- **Structural debt tracking:** [docs/solutions/architecture/review-fix-cycle-2-lead-response-loop.md](docs/solutions/architecture/review-fix-cycle-2-lead-response-loop.md) line 83
- **Async SQLite pattern:** [docs/solutions/database-issues/async-sqlite-transaction-boundary.md](docs/solutions/database-issues/async-sqlite-transaction-boundary.md)
- **Atomic claim pattern:** [docs/solutions/architecture/atomic-claim-for-concurrent-state-transitions.md](docs/solutions/architecture/atomic-claim-for-concurrent-state-transitions.md)
- **Follow-up lifecycle:** [docs/solutions/architecture/follow-up-pipeline-human-in-the-loop-lifecycle.md](docs/solutions/architecture/follow-up-pipeline-human-in-the-loop-lifecycle.md)
- **Constants at boundary:** [docs/solutions/logic-errors/constants-at-the-boundary.md](docs/solutions/logic-errors/constants-at-the-boundary.md)
- **Silent failure escape hatches:** [docs/solutions/architecture/silent-failure-escape-hatches.md](docs/solutions/architecture/silent-failure-escape-hatches.md)
- **Align derived stats:** [docs/solutions/database-issues/align-derived-stat-queries.md](docs/solutions/database-issues/align-derived-stat-queries.md)
- **Dead code env var collision:** [docs/solutions/workflow/dead-code-env-var-collision.md](docs/solutions/workflow/dead-code-env-var-collision.md)
- **better-sqlite3 API docs:** https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md
- **Barrel file best practices (2024):** TkDodo, Marvin Hagemeister, DEV Community articles
- **AsyncFunction detection:** MDN AsyncFunction docs, David Walsh "detect async function", Node.js util.types docs
- **Node.js .bind() blind spot:** Node.js help issue #1808 (util.types.isAsyncFunction returns false for bound async)
- **better-sqlite3 async transaction throw (v11.10+):** better-sqlite3 issue #1262
- **TypeScript NotPromise<T> pattern:** Total TypeScript (Matt Pocock), NoInfer article
- **Drizzle ORM async transaction bug:** drizzle-orm issue #2275
- **eslint-plugin-import no-restricted-paths:** eslint-plugin-import docs
- **eslint-plugin-boundaries:** npm docs, configuration reference
- **dependency-cruiser:** npm docs, .dependency-cruiser.cjs configuration
- **Google TypeScript Style Guide:** Module exports and barrel conventions
- **TypeScript stripInternal:** TSConfig docs (not relevant for apps, only libraries)
- **API Extractor @internal:** Microsoft API Extractor docs (ae-internal-missing-underscore)
- **VS Code source organization:** GitHub wiki — layered architecture as visibility boundary
- **Environment-aware fatal guards:** `docs/solutions/architecture/environment-aware-fatal-guards.md`
- **Railway healthcheck ordering:** `docs/solutions/architecture/railway-healthcheck-auth-middleware-ordering.md`
- **Dead code env var collision:** `docs/solutions/workflow/dead-code-env-var-collision.md`

---

## Three Questions

1. **Hardest decision:** Where `setLeadOutcome` and `completeApproval` land. Both
   straddle module boundaries. Research resolved it: `setLeadOutcome` is a CRUD
   orchestrator (calls getLead + updateLead) -> `leads.ts`. `completeApproval`
   initiates the follow-up chain -> `follow-ups.ts`.

2. **Rejected alternatives:** (a) Dependency injection (pass db to every function)
   — violates "no behavior changes" and changes every function signature.
   (b) Separate `connection.ts` for db singleton — unnecessary extra file when
   `migrate.ts` already owns initialization. (c) Moving types to `types.ts` —
   scope creep, can be done later. (d) `getDb()` wrapper around `initDb()` —
   YAGNI, `initDb()` already handles both init and retrieval. (e) Shared
   `stmtCache` in migrate.ts — couples all modules to migrate for a utility
   concern; per-module duplication is simpler since SQL sets are disjoint.

3. **Least confident about:** The `normalizeLeadRow` promotion from private to exported.
   It converts SQLite integers (0/1) to booleans — if any caller was relying on the
   integer representation (e.g., truthy check on 1), exporting and sharing it could
   surface subtle bugs. Work phase should verify all callers handle boolean returns
   correctly before splitting. Mitigation: grep for `gate_passed === 0` or `=== 1`.
