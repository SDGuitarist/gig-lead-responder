---
title: "Extract Constants at Module Boundaries"
category: logic-errors
tags: [constants, magic-strings, threshold, drift, types]
module: types
symptoms:
  - Same string literal duplicated across 3+ files
  - Threshold number hardcoded in prompt text
  - Adding a new enum value silently breaks matching in other files
  - Count-based logic drifts when items are added/removed
date_documented: 2026-02-21
---

# Extract Constants at Module Boundaries

## Problem

Two kinds of silent drift existed in the pipeline. First, the flagged concern
strings `"mention_4piece_alternative"` and `"mention_full_ensemble_upgrade"` were
hardcoded as inline string literals in three files (`enrich.ts`, `generate.ts`,
`verify.ts`) — a typo in any one file would silently break concern matching with
no type error. Second, the verify prompt literally said "12 of 14" for the gut
check threshold, and `src/index.ts` hardcoded 14 for total count — adding or
removing a gut check would leave the threshold silently wrong.

## Root Cause

Both issues stem from the same structural mistake: a value that must stay in sync
across multiple files was defined inline at each usage site instead of once at the
source of truth. TypeScript cannot catch string mismatches between files (they are
all just `string`), and it cannot catch a stale number literal in a template
string. The drift is invisible until a specific code path runs and produces wrong
behavior.

## Solution

### String constants (fix #6)

Export named constants from `src/types.ts` where the concern values originate:

```ts
// src/types.ts
export const CONCERN_4PIECE_ALT = "mention_4piece_alternative" as const;
export const CONCERN_FULL_ENSEMBLE = "mention_full_ensemble_upgrade" as const;
```

Every file that previously used the inline string now imports the constant:

```ts
// src/pipeline/enrich.ts, src/prompts/generate.ts, src/prompts/verify.ts
import { CONCERN_4PIECE_ALT, CONCERN_FULL_ENSEMBLE } from "../types.js";

// Before:
if (concerns.includes("mention_4piece_alternative")) { ... }

// After:
if (concerns.includes(CONCERN_4PIECE_ALT)) { ... }
```

A typo in the import name is now a compile error, not a silent mismatch.

### Threshold constants (fix #7)

Define the gut check key list, total, and threshold together in `src/types.ts`:

```ts
// src/types.ts
export const GUT_CHECK_KEYS = [
  "can_see_it",
  "validated_them",
  "named_fear",
  "differentiated",
  "preempted_questions",
  "creates_relief",
  "best_line_present",
  "prose_flows",
  "competitor_test",
  "lead_specific_opening",
  "budget_acknowledged",
  "past_date_acknowledged",
  "mariachi_pricing_format",
  "cultural_vocabulary_used",
] as const;

export const GUT_CHECK_TOTAL = GUT_CHECK_KEYS.length;     // 14
export const GUT_CHECK_THRESHOLD = GUT_CHECK_TOTAL - 2;   // 12
```

The verify prompt and index.ts now use computed values:

```ts
// src/prompts/verify.ts
`Pass ${GUT_CHECK_THRESHOLD} of ${GUT_CHECK_TOTAL} to pass the gate.`

// src/index.ts
const passed = Object.values(checks).filter(Boolean).length;
console.log(`Gut checks: ${passed}/${GUT_CHECK_TOTAL}`);
```

Adding a 15th gut check to the array automatically updates both the total (15)
and the threshold (13). No file needs to be manually edited to stay in sync.

## What Was Rejected

Auto-deriving the `gut_checks` type from the constant array
(`Record<typeof GUT_CHECK_KEYS[number], boolean>`) was considered. This would
guarantee that the interface and the array can never diverge. It was rejected
because it replaces explicit named booleans (`can_see_it: boolean`,
`validated_them: boolean`, etc.) with a computed record type, making the
`GateResult` interface harder to read at a glance. The array + manual interface
is slightly redundant but much clearer for a beginner-level codebase. If the
list grows past ~20 items, revisit this tradeoff.

## Prevention

- **Grep for repeated string literals** during review: if the same string appears
  in 3+ files and is used for matching/comparison, extract it to a constant in
  the module that owns the concept.
- **Co-locate counts with their source.** If a threshold depends on the length of
  a list, define both in the same file and derive the threshold arithmetically
  (`list.length - 2`) instead of hardcoding the result.
- **Prompt text is code.** Numbers and identifiers inside template strings are
  just as susceptible to drift as any other hardcoded value. Interpolate constants
  into prompts the same way you would into application logic.

## Second Instance: Outcome Enum Drift (2026-02-25)

The lead conversion tracking feature introduced `LeadOutcome` and `LossReason`
types with values duplicated across 5 locations: TypeScript union types, runtime
`Set<string>`, SQL CHECK constraints, and JavaScript object literals.

The same pattern applied: const array as single source of truth, derived type.

```ts
// src/types.ts
export const LEAD_OUTCOMES = ["booked", "lost", "no_reply"] as const;
export type LeadOutcome = (typeof LEAD_OUTCOMES)[number];

export const LOSS_REASONS = ["price", "date", "style", "no_response", "other"] as const;
export type LossReason = (typeof LOSS_REASONS)[number];
```

Runtime validation sets now import from the same source:

```ts
// src/api.ts
const VALID_OUTCOMES = new Set<LeadOutcome>(LEAD_OUTCOMES);
const VALID_LOSS_REASONS = new Set<LossReason>(LOSS_REASONS);
```

**One gap remains:** The SQL CHECK constraints (`CHECK(outcome IN ('booked',
'lost', 'no_reply'))`) are string literals in the migration SQL — they can't
import from TypeScript. SYNC comments (`-- SYNC: LEAD_OUTCOMES in types.ts`)
mark the dependency, but the link is human-enforced, not compiler-enforced.
If someone adds a value to `LEAD_OUTCOMES` but skips the CHECK constraint,
the DB rejects at runtime.

**TypeScript gotcha:** `Set<LeadOutcome>.has(untrustedString)` fails because
TypeScript won't let you pass `string` to `has()` on a typed Set. The fix is
casting the Set at the call site: `(VALID_OUTCOMES as ReadonlySet<string>).has(outcome)`.
This is safe because you're checking membership, not assigning.

## Related

- `docs/solutions/ui-bugs/shallow-copy-for-preview-state.md`
- `docs/solutions/architecture/escape-at-interpolation-site.md`
- `docs/solutions/database-issues/align-derived-stat-queries.md`
