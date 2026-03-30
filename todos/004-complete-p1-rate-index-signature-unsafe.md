---
status: pending
priority: p1
issue_id: "004"
tags: [code-review, typescript]
dependencies: []
unblocks: []
sub_priority: 4
---

# Unsafe index signature on `FormatRates`

## Problem

`FormatRates` uses `[durationKey: string]: TierRates` — the compiler cannot catch missing duration lookups. Also, `as keyof TierRates` cast in `price.ts` bypasses the optional T1 check. Flagged by TypeScript reviewer.

## Location

- `src/data/rates.ts` line 18
- `src/pipeline/price.ts` line 31

## Fix

Change the index signature to `[durationKey: string]: TierRates | undefined` so the compiler forces null checks.
