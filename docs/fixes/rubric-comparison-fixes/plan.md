# Fix Batch Plan — rubric-comparison-fixes

**Date:** 2026-02-21
**Source:** docs/reviews/rubric-comparison-fixes/REVIEW-SUMMARY.md
**Total findings:** 27

## Batch A — Deletes and Removals

| # | Finding | Severity | File | Risk |
|---|---------|----------|------|------|
| 1 | #25 Classify prompt leaks "Code may override" implementation detail | P3 | `src/prompts/classify.ts:91` | Zero — deletion only |
| 2 | #17 Friday-as-weekend needs documentation | P3 | `src/pipeline/enrich.ts:78` | Zero — comment addition only |
| 3 | #18 `tier === "premium"` as proxy for "corporate" is imprecise | P3 | `src/pipeline/enrich.ts:86-88` | Zero — comment addition only |
| 4 | #8 Implicit enrichment ordering dependency | P2 | `src/pipeline/enrich.ts:24-50` | Zero — comment addition only |

## Batch B — Data Integrity and Hot Path

| # | Finding | Severity | File | Risk |
|---|---------|----------|------|------|
| 1 | #1 Stale pricing after format routing override | P1 | `src/run-pipeline.ts:84-94` | High — changes pricing computation order |
| 2 | #2 Non-enriched classification returned in pipeline output | P1 | `src/run-pipeline.ts:124-127` | Medium — changes return value of pipeline |
| 3 | #3 "Today" computed independently — UTC timezone, clock-skew | P1 | `src/pipeline/classify.ts:10`, `src/pipeline/enrich.ts:17` | Medium — changes date computation across 2 files |
| 4 | #4 No validation of `event_date_iso` from LLM | P1 | `src/pipeline/enrich.ts:15-21`, `src/utils/dates.ts:6-8` | Medium — adds validation, could reject previously-accepted values |
| 5 | #13 Date calculations depend on deployment timezone | P2 | `src/pipeline/enrich.ts:77` | Low — addressed by fix #3 |

## Batch C — Code Quality and Abstractions

| # | Finding | Severity | File | Risk |
|---|---------|----------|------|------|
| 1 | #5 Optional vs required-nullable type inconsistency | P2 | `src/types.ts:42-43,50` | Low — type change, no runtime behavior change |
| 2 | #6 Magic string constants for `flagged_concerns` | P2 | `src/pipeline/enrich.ts:32-34`, `src/prompts/generate.ts:217,226`, `src/prompts/verify.ts:171,176` | Low — extract constants, import everywhere |
| 3 | #7 Hardcoded "12 of 14" threshold in verify prompt | P2 | `src/prompts/verify.ts:83` | Low — derive from constant |
| 4 | #15 Conditional spread readability in enrichClassification | P3 | `src/pipeline/enrich.ts:29-35` | Low — refactor for readability |
| 5 | #16 `resolveFormatRouting` return type annotation | P3 | `src/pipeline/enrich.ts:61-62` | Zero — type annotation only |
| 6 | #19 Builder function naming inconsistency | P3 | `src/prompts/verify.ts:158,169,186` | Low — rename functions |
| 7 | #23 `flagged_concerns` no deduplication guard | P3 | `src/pipeline/enrich.ts:30-36` | Low — add includes check |
| 8 | #14 Unit test uses fragile reference equality | P2 | `src/enrich-generate.test.ts:58` | Low — change assert method |
| 9 | #21 Error message leaks raw LLM response | P3 | `src/claude.ts:62` | Low — truncate error output |
| 10 | #26 `buildVerifyPrompt` takes `pricing` as optional | P3 | `src/prompts/verify.ts:10` | Low — make param required |

## Batch D — Deferred

| # | Finding | Severity | File | Why Deferred |
|---|---------|----------|------|-------------|
| 1 | #9 LLM JSON output trusted without runtime schema validation | P2 | `src/claude.ts:49` | Needs design decision — Zod or manual checks, affects all callers |
| 2 | #10 Prompt injection via raw lead text | P2 | `src/pipeline/classify.ts:12` | Low real-world risk, needs product decision on length cap |
| 3 | #11 Prompt token growth — full Classification serialized | P2 | `src/prompts/generate.ts:35`, `src/prompts/verify.ts:17` | Optimization — not urgent, simplicity has value |
| 4 | #12 Worst-case 7 LLM calls per lead | P2 | `src/pipeline/verify.ts:25-55` | Monitoring needed post-deployment, not a code fix |
| 5 | #20 Hardcoded phone number in source code | P3 | `src/pipeline/generate.ts:18` | Config refactor — low priority |
| 6 | #22 No stdin input length limit | P3 | `src/index.ts:16-20` | New feature (input validation) |
| 7 | #24 Three sequential object spreads | P3 | `src/pipeline/enrich.ts:12-50` | No action needed per review |
| 8 | #27 Duration "4" valid in type but missing from rate tables | P3 | `src/types.ts:36`, `src/data/rates.ts` | Needs product decision on duration constraints |
