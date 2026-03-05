---
status: pending
priority: p2
issue_id: "027"
tags: [code-review, performance, database]
dependencies: []
unblocks: []
sub_priority: 2
---

# 027: Uncached prepared statements -- 24 .prepare() calls recompile SQL every time

## Problem Statement

Every DB function calls `initDb().prepare(...)` inline. SQLite must parse and compile each SQL statement on every invocation. With 24 `.prepare()` calls and `getLead` being called by `updateLead` (which is called by everything), SQL compilation overhead adds up.

**Found by:** Performance Oracle

## Findings

- `src/leads.ts` -- 24 inline `.prepare()` calls throughout the file
- `getLead` is the hottest path (called by every update operation)
- better-sqlite3's `.prepare()` involves SQL parsing and bytecode compilation

## Proposed Solutions

### Solution A: Module-level prepared statement cache (Recommended)
**Effort:** Medium | **Risk:** Low
Cache static prepared statements after `initDb()`. For dynamic queries (updateLead with variable SET clauses), cache by sorted key set.

## Acceptance Criteria

- [ ] Static queries cached as module-level prepared statements
- [ ] Dynamic queries (updateLead) cached by field combination
- [ ] All existing tests pass

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-05 | Created from final verification review | 24 uncached prepare calls, most on hot paths |
