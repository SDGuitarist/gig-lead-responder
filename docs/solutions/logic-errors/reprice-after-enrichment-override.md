---
title: "Reprice After Enrichment Override"
category: logic-errors
tags: [pipeline, pricing, enrichment, stale-data]
module: pipeline
symptoms:
  - Customer-facing draft shows wrong dollar amounts
  - Pricing reflects pre-enrichment format instead of post-enrichment format
  - Format routing override doesn't update pricing
date_documented: 2026-02-21
---

# Reprice After Enrichment Override

## Problem

The pipeline runs classify -> price -> enrich -> generate -> verify. Enrichment (`enrichClassification`) can change `format_recommended` -- for example, upgrading `mariachi_4piece` to `mariachi_full` for weekend cultural events. But pricing was computed before enrichment using the original format, so the pipeline quoted 4-piece rates ($650) for full-ensemble bookings ($1,650+). Customer-facing drafts contained wrong dollar amounts.

## Root Cause

`lookupPrice` ran once on the raw classification, then `enrichClassification` changed `format_recommended` based on day-of-week rules (weekends force `mariachi_full`). Nothing re-ran pricing after the override, so stale pricing from the original format flowed into generation and verification. The `pricing` variable was declared with `const`, making reassignment impossible even if someone tried.

## Solution

```typescript
// src/run-pipeline.ts (lines 86-107)

let pricing = lookupPrice(classification);
pricing.budget = detectBudgetGap(
  classification.stated_budget,
  pricing.floor,
  pricing.format,
  pricing.duration_hours,
  pricing.tier_key,
);

const enriched = enrichClassification(classification, pricing, today);

// Re-price if enrichment changed the format (e.g., mariachi_4piece -> mariachi_full)
if (enriched.format_recommended !== classification.format_recommended) {
  pricing = lookupPrice(enriched);
  pricing.budget = detectBudgetGap(
    enriched.stated_budget,
    pricing.floor,
    pricing.format,
    pricing.duration_hours,
    pricing.tier_key,
  );
}
```

Changed `const pricing` to `let pricing`. After enrichment runs, compare `enriched.format_recommended` against the original `classification.format_recommended`. If they differ, re-run `lookupPrice` and `detectBudgetGap` with the enriched classification so downstream stages get correct pricing.

## What Was Rejected

Splitting `enrichClassification` into pre-price and post-price phases. That would mean two functions with shared state and a harder-to-follow pipeline. The single function with post-hoc repricing keeps enrichment as one cohesive unit and avoids restructuring.

## Prevention

- **Treat enrichment outputs as new inputs**: any time a pure enrichment step changes a field that was already consumed by a calculation, add a conditional re-run of that calculation after enrichment.
- **Name the dependency**: when pricing depends on `format_recommended`, document that dependency in a comment so future enrichment rules that touch `format_recommended` trigger the same check.
- **Test with format-changing leads**: include at least one test lead where enrichment overrides the format (e.g., a weekend mariachi lead) and assert that `pricing.format` matches the enriched format, not the original.

## Related

- `docs/solutions/prompt-placement-for-hard-constraints.md` -- another case where pipeline ordering affected output correctness
