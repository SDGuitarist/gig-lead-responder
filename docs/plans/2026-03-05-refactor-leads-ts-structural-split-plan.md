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

## Prior Phase Risk

> **Least confident about:** The db instance sharing pattern. Currently `initDb()`
> creates the db and every function in leads.ts uses it via closure. After the
> split, `migrate.ts` will own `initDb()` but `leads.ts`, `follow-ups.ts`, and
> `queries.ts` all need access to the db instance.

**Resolution:** Research confirmed every function already calls `initDb()`
independently (44 calls total). The pattern is a lazy singleton via module-level
`let db`. Solution: `migrate.ts` exports `initDb()` (startup) + `getDb()`
(runtime getter). Other modules import `getDb()` from `./migrate.js`. No DI
needed, no extra files.

## Overview

Split `src/leads.ts` (767 lines, 27 exports, 8 consumers) into 4 focused modules
under `src/db/` with a barrel file for backwards-compatible imports. Pure structural
refactor — no behavior changes.

(see brainstorm: docs/brainstorms/2026-03-05-leads-ts-structural-split-brainstorm.md)

## Problem Statement / Motivation

`leads.ts` is the God Module — every data-touching file imports from it, and it
mixes 4 distinct responsibilities: migrations, CRUD, follow-up state machine, and
dashboard queries. This makes it hard to:

- Reason about changes (which of 767 lines are affected?)
- Fix P2 issues cleanly (026, 033, 034 all live in this file)
- Review PRs (every PR touching lead data modifies the same file)

Tracked as structural debt since Cycle 9. Recommended split documented in
`docs/solutions/architecture/review-fix-cycle-2-lead-response-loop.md` line 83.

## Proposed Solution

### Target Structure

```
src/db/
  migrate.ts      ~170 lines  Schema, migrations, indexes, getDb()
  leads.ts        ~190 lines  CRUD, idempotency, venue misses, normalizeRow, runTransaction
  follow-ups.ts   ~220 lines  5-state machine, 8 transitions, completeApproval
  queries.ts      ~200 lines  Dashboard lists, stats, analytics, outcomes
  index.ts        ~30 lines   Barrel re-exports (all 27 public exports)
```

### DB Instance Sharing

```
migrate.ts  ← owns `let db` + initDb() + getDb()
    ↑
leads.ts  ← imports getDb from ./migrate.js
    ↑
follow-ups.ts  ← imports getDb from ./migrate.js + getLead/updateLead/runTransaction from ./leads.js

queries.ts  ← imports getDb from ./migrate.js + normalizeRow from ./leads.js
```

No circular dependencies. Clean DAG.

### Complete Export Map

Every export from current `leads.ts` mapped to its new home:

**From `db/migrate.ts`:**
- `initDb` (function — startup bootstrap)
- `getDb` (NEW function — runtime singleton getter, replaces direct `initDb()` calls)

**From `db/leads.ts`:**
- `InsertLeadInput` (interface)
- `insertLead`, `getLead`, `getLeadsByStatus`, `updateLead`, `claimLeadForSending`
- `isEmailProcessed`, `markEmailProcessed`
- `runTransaction`
- `logVenueMiss`
- `normalizeRow` (currently private — must be exported for queries.ts and follow-ups.ts)
- `setLeadOutcome` (write operation that calls getLead + updateLead internally)

**From `db/follow-ups.ts`:**
- `getLeadsDueForFollowUp`, `getLeadAwaitingFollowUp`, `getLeadWithActiveFollowUp`
- `scheduleFollowUp`, `approveFollowUp`, `storeFollowUpDraft`
- `skipFollowUp`, `snoozeFollowUp`, `markClientReplied`
- `claimFollowUpForSending`, `completeApproval`
- Constants: `MAX_FOLLOW_UPS`, `FOLLOW_UP_DELAYS_MS`, `computeFollowUpDelay` (private)
- Constants: `TERMINAL_CLEAR` (private)

**From `db/queries.ts`:**
- `ListLeadsFilteredOpts` (interface)
- `LeadStats` (interface)
- `listLeadsFiltered`, `listFollowUpLeads`
- `getAnalytics`, `getLeadStats`

**From `db/index.ts`** (barrel):
- Re-exports all public symbols from all 4 modules (27 total)

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

## Technical Considerations

### Module boundary decisions

- **`setLeadOutcome` in `leads.ts`** not `queries.ts` — it's a write (calls
  `getLead` + `updateLead`). The brainstorm listed "outcomes" under queries but
  research showed it's a CRUD orchestrator.
- **`completeApproval` in `follow-ups.ts`** — straddles both concerns (sets
  `status: "done"` AND schedules first follow-up) but primary purpose is
  initiating the follow-up chain. Imports `updateLead` from leads for the status
  transition.
- **`normalizeRow` must be exported** — currently private, but needed by
  `queries.ts` (`listLeadsFiltered`, `listFollowUpLeads`) and `follow-ups.ts`
  (`getLeadsDueForFollowUp`, etc.) to convert SQLite 0/1 to boolean.

### Institutional learnings to preserve

Per `docs/solutions/database-issues/async-sqlite-transaction-boundary.md`:
- Never `await` inside `db.transaction()` — better-sqlite3 is sync-only
- All async work happens BEFORE db writes
- This pattern must remain intact in `follow-ups.ts` and `leads.ts`

Per `docs/solutions/architecture/atomic-claim-for-concurrent-state-transitions.md`:
- Each function gets its own `initDb()` call (will become `getDb()`)
- Dedicated functions for atomic claims (not generic updateLead with conditionals)

### No tests for leads.ts

Verification strategy: `npx tsc --noEmit` (catches all import/export mismatches)
+ server startup smoke test (`/api/health` + `/api/leads`).

## Acceptance Criteria

- [ ] `src/db/migrate.ts` contains `initDb()`, `getDb()`, all CREATE/ALTER/index SQL
- [ ] `src/db/leads.ts` contains CRUD functions, idempotency, venue misses, runTransaction, setLeadOutcome
- [ ] `src/db/follow-ups.ts` contains all follow-up state machine functions + completeApproval
- [ ] `src/db/queries.ts` contains dashboard list/stats/analytics functions
- [ ] `src/db/index.ts` barrel re-exports all 27 public symbols
- [ ] All 8 consumer files updated to import from `./db/index.js`
- [ ] `src/leads.ts` deleted
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] Server starts and `/api/health` responds 200
- [ ] No behavior changes — all functions have identical signatures and return types

## Implementation Steps

### Commit 1: Create src/db/ modules (~4 files)

**Prerequisite: `git commit` any uncommitted work first (mid-edit protection).**

1. `mkdir -p src/db`
2. Create `src/db/migrate.ts`:
   - Move lines 1-170 (imports, DB_PATH, initDb, all migrations)
   - Add `export function getDb(): Database.Database` that calls `initDb()` and returns `db`
   - Export both `initDb` and `getDb`
3. Create `src/db/leads.ts`:
   - Move lines 172-351 (logVenueMiss, normalizeRow, CRUD, idempotency, runTransaction)
   - Move `setLeadOutcome` (from dashboard section ~lines 617-660)
   - Import `getDb` from `./migrate.js`, replace all `initDb()` calls with `getDb()`
   - Export `normalizeRow` (was private)
   - Import types from `../types.js`
4. Create `src/db/follow-ups.ts`:
   - Move lines 353-569 (constants, delay computation, all state machine functions, completeApproval)
   - Import `getDb` from `./migrate.js`
   - Import `getLead`, `updateLead`, `runTransaction`, `normalizeRow` from `./leads.js`
   - Import types from `../types.js`
5. Create `src/db/queries.ts`:
   - Move remaining lines 571-767 minus setLeadOutcome (lists, stats, analytics)
   - Import `getDb` from `./migrate.js`
   - Import `normalizeRow` from `./leads.js`
   - Import types from `../types.js`
6. Create `src/db/index.ts`:
   - `export { initDb, getDb } from "./migrate.js";`
   - `export { InsertLeadInput, insertLead, getLead, ... } from "./leads.js";`
   - `export { getLeadsDueForFollowUp, approveFollowUp, ... } from "./follow-ups.js";`
   - `export { ListLeadsFilteredOpts, LeadStats, listLeadsFiltered, ... } from "./queries.js";`

Run `npx tsc --noEmit` — should show errors only for duplicate exports (old leads.ts still exists).

### Commit 2: Update all consumer imports

Update all 8 files: change `from "./leads.js"` to `from "./db/index.js"`. No other changes.

Run `npx tsc --noEmit` — may still show duplicate warnings from old file.

### Commit 3: Delete src/leads.ts

Remove the original file.

Run `npx tsc --noEmit` — should pass clean.
Start server and verify `/api/health` + `/api/leads` respond correctly.

## Dependencies & Risks

**Risk: Missed export in barrel** — mitigated by the complete export map above
(27 symbols) and `tsc --noEmit` catching any missing re-export.

**Risk: Runtime import ordering** — Node ESM caches modules by URL. Since all
modules import `getDb` from `./migrate.js`, and `server.ts` calls `initDb()` at
startup before any request handler runs, the singleton is guaranteed to be
initialized. No risk of accessing `db` before init.

**Risk: Mid-refactor abort** — mitigated by committing before starting (CLAUDE.md
safety rule) and incremental 3-commit strategy with safe rollback at each point.

## Sources & References

- **Origin brainstorm:** [docs/brainstorms/2026-03-05-leads-ts-structural-split-brainstorm.md](docs/brainstorms/2026-03-05-leads-ts-structural-split-brainstorm.md) — 4-way split, barrel file, pure refactor decisions
- **Structural debt tracking:** [docs/solutions/architecture/review-fix-cycle-2-lead-response-loop.md](docs/solutions/architecture/review-fix-cycle-2-lead-response-loop.md) line 83
- **Async SQLite pattern:** [docs/solutions/database-issues/async-sqlite-transaction-boundary.md](docs/solutions/database-issues/async-sqlite-transaction-boundary.md)
- **Atomic claim pattern:** [docs/solutions/architecture/atomic-claim-for-concurrent-state-transitions.md](docs/solutions/architecture/atomic-claim-for-concurrent-state-transitions.md)
- **Follow-up lifecycle:** [docs/solutions/architecture/follow-up-pipeline-human-in-the-loop-lifecycle.md](docs/solutions/architecture/follow-up-pipeline-human-in-the-loop-lifecycle.md)

## Three Questions

1. **Hardest decision:** Where `setLeadOutcome` and `completeApproval` land. Both
   straddle module boundaries. Research resolved it: `setLeadOutcome` is a CRUD
   orchestrator (calls getLead + updateLead) → `leads.ts`. `completeApproval`
   initiates the follow-up chain → `follow-ups.ts`.

2. **Rejected alternatives:** (a) Dependency injection (pass db to every function)
   — violates "no behavior changes" and changes every function signature.
   (b) Separate `connection.ts` for db singleton — unnecessary extra file when
   `migrate.ts` already owns initialization. (c) Moving types to `types.ts` —
   scope creep, can be done later.

3. **Least confident about:** The `normalizeRow` promotion from private to exported.
   It converts SQLite integers (0/1) to booleans — if any caller was relying on the
   integer representation (e.g., truthy check on 1), exporting and sharing it could
   surface subtle bugs. Work phase should verify all callers handle boolean returns
   correctly before splitting.
