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

## Patterns Captured (solutions 9-12)

1. **"Reprice after enrichment"** → [`logic-errors/reprice-after-enrichment-override.md`](../../solutions/logic-errors/reprice-after-enrichment-override.md) (Batch B, fix #1)
2. **"Today as parameter"** → [`logic-errors/today-as-parameter-timezone.md`](../../solutions/logic-errors/today-as-parameter-timezone.md) (Batch B, fix #3)
3. **"Required-nullable vs optional"** → [`logic-errors/required-nullable-vs-optional-types.md`](../../solutions/logic-errors/required-nullable-vs-optional-types.md) (Batch C, fix #5)
4. **"Constants at the boundary"** → [`logic-errors/constants-at-the-boundary.md`](../../solutions/logic-errors/constants-at-the-boundary.md) (Batch C, fixes #6 and #7)
