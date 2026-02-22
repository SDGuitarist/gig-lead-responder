# Fix Summary — rubric-comparison-fixes

**Date:** 2026-02-21
**Batches executed:** 3
**Total findings fixed:** 19
**Total findings deferred:** 8

## Fixed

| # | Finding | Severity | Batch | Commit |
|---|---------|----------|-------|--------|
| 1 | #25 Classify prompt leaks "Code may override" implementation detail | P3 | A | `dc06ae7` |
| 2 | #17 Friday-as-weekend needs documentation | P3 | A | `dc06ae7` |
| 3 | #18 `tier === "premium"` as proxy for "corporate" is imprecise | P3 | A | `dc06ae7` |
| 4 | #8 Implicit enrichment ordering dependency | P2 | A | `dc06ae7` |
| 5 | #3 + #13 Centralize "today" computation in Pacific time | P1 + P2 | B | `11f50cf` |
| 6 | #4 No validation of `event_date_iso` from LLM | P1 | B | `10e9cfd` |
| 7 | #1 Stale pricing after format routing override | P1 | B | `9be5e43` |
| 8 | #2 Non-enriched classification returned in pipeline output | P1 | B | `d00f448` |
| 9 | #5 Optional vs required-nullable type inconsistency | P2 | C | `0874426` |
| 10 | #6 Magic string constants for `flagged_concerns` | P2 | C | `3db252b` |
| 11 | #7 Hardcoded "12 of 14" threshold in verify prompt | P2 | C | `6f3553a` |
| 12 | #15 Conditional spread readability in enrichClassification | P3 | C | `0f74994` |
| 13 | #16 `resolveFormatRouting` return type annotation | P3 | C | `0f74994` |
| 14 | #23 `flagged_concerns` no deduplication guard | P3 | C | `0f74994` |
| 15 | #19 Builder function naming inconsistency | P3 | C | `1dfc29e` |
| 16 | #26 `buildVerifyPrompt` takes `pricing` as optional | P3 | C | `15d5b2c` |
| 17 | #14 Unit test uses fragile reference equality | P2 | C | `bfe76cc` |
| 18 | #21 Error message leaks raw LLM response | P3 | C | `2406541` |

## Deferred

| # | Finding | Severity | Reason |
|---|---------|----------|--------|
| 1 | #9 LLM JSON output trusted without runtime schema validation | P2 | Needs design decision — Zod or manual checks, affects all callers |
| 2 | #10 Prompt injection via raw lead text | P2 | Low real-world risk, needs product decision on length cap |
| 3 | #11 Prompt token growth — full Classification serialized | P2 | Optimization — not urgent, simplicity has value |
| 4 | #12 Worst-case 7 LLM calls per lead | P2 | Monitoring needed post-deployment, not a code fix |
| 5 | #20 Hardcoded phone number in source code | P3 | Config refactor — low priority |
| 6 | #22 No stdin input length limit | P3 | New feature (input validation) |
| 7 | #24 Three sequential object spreads | P3 | No action needed per review |
| 8 | #27 Duration "4" valid in type but missing from rate tables | P3 | Needs product decision on duration constraints |

## Patterns Worth Capturing

1. **"Reprice after enrichment" pattern** — When a pure enrichment step changes inputs to a pricing function, reprice conditionally rather than restructuring the enrichment into pre/post phases. Simpler code, same correctness. (Batch B, fix #1)

2. **"Today as parameter" pattern** — Wall-clock dependencies (`new Date()`, timezone-dependent calculations) should be computed once at pipeline entry and passed as parameters. Makes functions pure and testable. (Batch B, fix #3)

3. **"Required-nullable vs optional" type convention** — When an LLM always returns a field but the value can be absent, use `field: T | null` (required-nullable), not `field?: T | null` (optional). The `?` hides the contract. (Batch C, fix #5)

4. **"Constants at the boundary" pattern** — Magic strings used across 3+ files should be extracted to a shared constants location. Gut check thresholds that must stay in sync with the type definition should be derived from or co-located with the source of truth. (Batch C, fixes #6 and #7)
