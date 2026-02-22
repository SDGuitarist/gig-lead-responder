---
category: architecture
tags: [llm, deterministic, hybrid-extraction, enrichment, pure-function]
module: src/pipeline/enrich.ts, src/pipeline/price.ts
symptoms: [LLM math errors, incorrect date comparisons, inconsistent constraint enforcement]
---

# Hybrid LLM Extraction with Deterministic Computation

## Problem

Several pipeline features require both fuzzy interpretation (understanding natural language) and precise computation (date math, price comparisons, hard constraint enforcement). LLMs excel at the first and fail at the second. Putting computation inside prompts produces inconsistent results — the LLM may "calculate" a budget gap differently on each run, misidentify past dates because it doesn't reliably know today, or violate hard business constraints by reasoning around them.

## Three Instances

### 1. Past-Date Detection

- **LLM extracts:** `event_date_iso` — converts natural language like "December 24, 2025" to `"2025-12-24"` (fuzzy NLP)
- **Code computes:** `past_date_detected = parseLocalDate(event_date_iso) < parseLocalDate(today)` (precise date comparison)
- **Why not LLM?** LLMs don't reliably know today's date and make errors comparing dates across year boundaries.

In `src/pipeline/enrich.ts`:
```typescript
// Past-date detection (deterministic — never ask the LLM)
if (classification.event_date_iso) {
  const eventDate = parseLocalDate(classification.event_date_iso);
  const todayDate = parseLocalDate(today);
  if (eventDate < todayDate) {
    enriched = { ...enriched, past_date_detected: true };
  }
}
```

### 2. Budget Gap Detection

- **LLM extracts:** `stated_budget` — converts "$350-400" to `400` using the range-high rule (fuzzy parsing with an explicit extraction rule in the classify prompt)
- **Code computes:** `gap = floor - stated_budget`, then routes to tier: `<75` small, `75-200` large, `>200` no_viable_scope (precise arithmetic)
- **Why not LLM?** LLMs fail at multi-step arithmetic that involves rate card lookups and threshold comparisons.

In `src/pipeline/price.ts`, `detectBudgetGap()` is a pure function:
```typescript
// Code does the math the LLM can't: gap = floor - stated_budget
// Then routes to tier based on thresholds: <75 small, 75-200 large, >200 no_viable_scope
```

### 3. Format Routing (Mariachi Weekday/Weekend)

- **LLM extracts:** `event_date_iso` + `event_energy` (`"background"` | `"performance"`) — fuzzy interpretation of event signals in the lead
- **Code computes:** day-of-week check → hard format constraint (4-piece weekday only, full ensemble default on weekends)
- **Why not LLM?** This is a hard business constraint that must never be violated. Code is deterministic; a prompted LLM could reason around it.

In `src/pipeline/enrich.ts`:
```typescript
function resolveFormatRouting(classification: Classification): FormatRoutingResult | null {
  // Only applies to mariachi formats
  if (classification.format_recommended !== "mariachi_4piece" &&
      classification.format_recommended !== "mariachi_full") {
    return null;
  }
  const day = parseLocalDate(dateISO).getDay();
  const isWeekend = day === 0 || day === 5 || day === 6; // Fri, Sat, Sun
  if (isWeekend) {
    return { format_recommended: "mariachi_full", show_alternative: false };
  }
  // ... weekday logic
}
```

## The Pattern

**Division of labor:** LLM does fuzzy extraction (NLP, intent parsing, range interpretation). Deterministic code does precise computation (date math, price arithmetic, constraint enforcement).

The `enrichClassification()` function in `src/pipeline/enrich.ts` is the architectural boundary. It takes raw LLM output and applies deterministic overrides before anything downstream sees the classification.

Key design properties:

- `enrichClassification()` is a **pure function** — signature: `(classification, pricing, today)`. No system clock reads inside it. Fully unit-testable.
- The `today` parameter is injected from the call site, never read from `new Date()` inside the function. This is the "today as parameter" pattern (see related solutions).
- Enrichment runs **after** classify and **before** price/generate. Downstream functions see only the enriched classification — they never know what the raw LLM output was.

## Reusable Pattern

When a new feature requires understanding natural language AND precise computation, apply this checklist:

1. Add an extraction field to the **classify prompt** — LLM normalizes the value (e.g., date string, numeric budget, energy level).
2. Add deterministic logic to **`enrichClassification()`** in `src/pipeline/enrich.ts` — code computes the derived fact.
3. Never put the computation in the classify prompt. "Tell the LLM to calculate the gap" is the anti-pattern this architecture exists to prevent.
4. If the enrichment changes a value that pricing depends on, re-run the pricing function after enrichment (see `reprice-after-enrichment-override.md`).

## Prior Phase Risk

No risk flagged by the previous phase. The fix-batched phase did not surface an actionable concern about this pattern specifically. Proceeding normally.

## Three Questions

1. **Hardest pattern to extract:** Deciding whether this is one pattern or three. Each instance (dates, budgets, format routing) has the same structure — LLM extracts, code computes — but different domains. Documented as one pattern with three examples because the principle is identical: LLMs are fuzzy parsers, not calculators.

2. **What was left out:** The classify prompt extraction rules (e.g., "$350-400" → take the high end). These are prompt engineering details, not an architectural pattern. The range extraction rule was a one-line fix documented in HANDOFF.md. Including it here would blur the boundary between "how the LLM extracts" and "why code computes."

3. **What future sessions might miss:** New features that need both fuzzy understanding and precise calculation might accidentally put the computation inside the classify prompt ("tell the LLM to calculate the gap"). The enrichment layer exists specifically to prevent this. The rule: if the answer requires arithmetic, a date comparison, or a hard constraint — it belongs in `enrichClassification()`, not in a prompt.
