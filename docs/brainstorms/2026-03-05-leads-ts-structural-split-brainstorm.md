# Brainstorm: leads.ts Structural Split

**Date:** 2026-03-05
**Origin:** HANDOFF.md structural debt (tracked since Cycle 9)
**Related P2s:** 026 (triple-read), 033 (analytics shaping), 034 (ignored return)

## What We're Building

A pure structural refactor of `src/leads.ts` (767 lines) into 4 focused modules
under `src/db/`, with a barrel file for backwards-compatible imports. No behavior
changes -- move code as-is, update imports, verify tests pass.

### Current State

`leads.ts` is the God Module: every data-touching file (8 consumers) imports from
it, and it mixes 4 distinct responsibilities:

| Section | Lines | Responsibility |
|---------|-------|----------------|
| DB init + migrations | 1-170 | Schema creation, ALTER migrations, indexes |
| Lead CRUD + utilities | 172-351 | Insert, get, update, claim, idempotency, venue misses |
| Follow-up state machine | 353-569 | 5-state machine, 8 transitions, delay logic |
| Dashboard queries | 571-767 | Filtered lists, stats, analytics, outcomes |

### Target State

```
src/db/
  migrate.ts      -- initDb(), all CREATE/ALTER/index logic
  leads.ts        -- CRUD, idempotency, venue misses, normalizeRow, runTransaction
  follow-ups.ts   -- follow-up state machine (all 8 transitions + queries)
  queries.ts      -- listLeadsFiltered, listFollowUpLeads, analytics, stats, outcomes
  index.ts        -- barrel re-exports from all 4 modules
```

Downstream files update imports from `./leads.js` to `./db/index.js` (or
`./db/leads.js` etc. for targeted imports).

## Why This Approach

### 4-way split (chosen over 3-way and 2-way)

- **Follow-ups** are the clearest standalone module (217 lines, own state machine,
  own consumers: follow-up-api.ts, follow-up-scheduler.ts, twilio-webhook.ts)
- **Migrations** are a completely different concern (run once at startup, never
  touched by request handlers)
- **Dashboard queries** are read-only aggregations with their own consumer (api.ts)
  and their own type exports (LeadStats, ListLeadsFilteredOpts)
- **CRUD** is the core shared layer that everything else builds on

A 3-way split would force dashboard queries back into leads.ts, keeping it at
~380 lines and still mixing read-heavy analytics with write-heavy CRUD. A 2-way
split would only extract follow-ups, leaving 550 lines with 3 responsibilities.

### Barrel file (chosen over direct imports only)

- Reduces the initial diff: downstream files change one import path, not four
- Allows gradual migration to targeted imports over time
- No runtime cost (tree-shaking in bundled environments, negligible in Node)

### Split only, no P2 fixes (chosen over split + fix)

- Pure refactor is easy to review: "do imports resolve? do tests pass?"
- P2s (026, 033, 034) become *easier* to fix after the split because each module
  is smaller and has a clear responsibility boundary
- Mixing structural and behavioral changes makes it hard to isolate regressions

## Key Decisions

1. **4 modules under src/db/** -- one per responsibility
2. **Barrel file at src/db/index.ts** -- re-exports everything for gradual migration
3. **Pure refactor** -- no behavior changes, P2 fixes are next cycle
4. **Shared db instance** -- `migrate.ts` exports `initDb()`, other modules import
   the db instance (existing pattern continues)
5. **normalizeRow stays in leads.ts** -- private helper, only used by CRUD functions
6. **Types stay in src/types.ts** -- no new type file; db modules import from types
   as they do today

## Downstream Consumer Mapping

Which file imports what (determines which db module they'll need):

| Consumer | Currently imports | After split, primary module |
|----------|-------------------|----------------------------|
| server.ts | initDb | db/migrate |
| webhook.ts | insertLead, isEmailProcessed, markEmailProcessed, runTransaction | db/leads |
| run-pipeline.ts | logVenueMiss | db/leads |
| post-pipeline.ts | getLead, updateLead | db/leads |
| api.ts | listLeadsFiltered, listFollowUpLeads, getLeadStats, getLead, updateLead, claimLeadForSending, setLeadOutcome, getAnalytics, completeApproval | db/leads + db/queries + db/follow-ups |
| twilio-webhook.ts | getLead, getLeadsByStatus, updateLead, completeApproval, approveFollowUp, skipFollowUp, getLeadAwaitingFollowUp, getLeadWithActiveFollowUp | db/leads + db/follow-ups |
| follow-up-api.ts | getLead, approveFollowUp, skipFollowUp, snoozeFollowUp, markClientReplied | db/leads + db/follow-ups |
| follow-up-scheduler.ts | getLeadsDueForFollowUp, updateLead, claimFollowUpForSending, storeFollowUpDraft | db/leads + db/follow-ups |

All consumers can import from `db/index.ts` initially -- targeted imports are a
future optimization.

## Open Questions

None -- scope is clear and constrained.

## Three Questions

1. **Hardest decision:** Whether to fix P2s alongside the split. The efficiency
   argument ("touch each file once") is real, but reviewability wins. A pure
   refactor is verifiable by running tests; mixed changes require reading every
   diff for subtle behavior shifts.

2. **Rejected alternatives:** (a) 2-way split (only extracting follow-ups) --
   leaves 550 lines with 3 responsibilities, doesn't solve the root problem.
   (b) Direct imports without barrel file -- correct long-term but creates a
   massive diff touching all 8 consumers with 4 different import paths each.
   (c) Split + P2 fixes -- more efficient but harder to review and riskier.

3. **Least confident about:** The db instance sharing pattern. Currently
   `initDb()` creates the db and every function in leads.ts uses it via closure.
   After the split, `migrate.ts` will own `initDb()` but `leads.ts`,
   `follow-ups.ts`, and `queries.ts` all need access to the db instance. Need to
   verify how this is wired today before planning the split.
