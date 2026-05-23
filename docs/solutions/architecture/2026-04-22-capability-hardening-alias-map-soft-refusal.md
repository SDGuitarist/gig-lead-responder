---
title: "Capability Hardening: Positive Alias Map + Soft Refusal Detection"
category: architecture
tags: [deterministic-gates, alias-map, soft-refusal, substring-matching, defense-in-depth]
module: hard-gate.ts, post-check.ts
symptom: "Unknown instruments pass the hard gate silently; AI drafts can undermine capability with hedging language"
root_cause: "Hard gate had negative-only list (NON_ALEX_FORMATS). Post-check had no refusal detection."
date: 2026-04-22
---

## Problem

The hard gate in `src/pipeline/hard-gate.ts` only had a negative list (`NON_ALEX_FORMATS`) -- formats Alex definitely doesn't offer (DJ, piano, violin, etc.). Instruments not on that list passed silently, even if Alex doesn't offer them (charango, mandolin, vihuela). The classifier might map an unknown instrument to a plausible format, and the pipeline generates a draft for something Alex can't deliver.

Separately, there was no check for AI-generated drafts that undermine Alex's capability. The LLM could produce "not really my specialty" or "may not be the best fit" -- soft refusals that pass the existing banned-phrase check but sabotage the response.

This was preventive hardening. The production bug (Opus 4.7 declining valid ukulele leads) was in expert-pipeline, not here. The LR pipeline was working correctly. But the gap existed.

## Solution

### Pattern 1: Positive Alias Map

Added `ALEX_ALIAS_MAP` to `hard-gate.ts` -- a lookup mapping messy lead language to `KNOWN` or `ESCALATE`. This complements the existing negative list:

```
format_requested → Check 1 (NON_ALEX_FORMATS) → auto-decline
                 → Check 3 (ALEX_ALIAS_MAP)   → KNOWN: pass
                                                → ESCALATE: flag "ambiguous_capability"
                                                → No match: flag "unknown_capability"
```

Flags surface in the dashboard via the existing `flagged_concerns` pipeline. No new UI, no new interfaces. Unknown capabilities are advisory, not blocking -- Alex decides.

### Pattern 2: Longest-First Sort (Review-Caught Bug)

The alias map is checked via `Object.entries().find()` with substring matching (`requested.includes(alias)`). The review phase found that `.find()` returns the first match in insertion order, not the most specific match. If "ensemble" (ESCALATE) appeared before "mariachi" (KNOWN), the input "mariachi ensemble" would incorrectly get flagged as ambiguous.

**Fix:** Sort entries by descending key length before matching:

```typescript
Object.entries(ALEX_ALIAS_MAP)
  .sort(([a], [b]) => b.length - a.length)
  .find(([alias]) => requested.includes(alias));
```

**General rule:** When using substring matching against a map, always sort candidates longest-first so the most specific match wins. This eliminates insertion-order dependency.

### Pattern 3: Soft Refusal Detection

Added `SOFT_REFUSAL_PATTERNS` to `post-check.ts` -- 6 regex patterns that catch AI drafts undermining Alex's capability:

- "not really my specialty/instrument/focus"
- "may not be the best fit"
- "if you're set on"
- "not something I typically do/offer/play"
- "you might want to look/search/try elsewhere"
- "I'd recommend looking/searching/trying elsewhere"

Checks both `full_draft` and `compressed_draft`, matching the existing dual-draft pattern. Triggers `gate_status: "fail"` via the existing violations mechanism.

**2 broader patterns deferred** ("primarily focus" and "while X isn't my main") because they false-positive on valid Alex sentences. The rule: ship tight patterns, expand from production data, not hypotheticals.

### Pattern 4: Defense-in-Depth, Not Load-Bearing

The soft refusal patterns are text-based checks on AI output. Per the structural bypass solution doc (`expert-pipeline/docs/solutions/architecture/2026-04-21-structural-bypass-for-ai-override-prevention.md`): text directives are suggestions, code is law. If the LLM invents new refusal language, these patterns won't catch it.

The load-bearing architecture is:
1. The alias map (code-enforced positive list -- the LLM can't override it)
2. The structural bypass in expert-pipeline (agent never runs for gate-passed leads)
3. Monitoring production drafts for unexpected refusal language (the real safety net)

Soft refusal patterns are defense-in-depth: they catch known failure modes but are not the primary guarantee.

## Files Changed

- `src/pipeline/hard-gate.ts` -- `ALEX_ALIAS_MAP`, Check 3, longest-first sort
- `src/pipeline/post-check.ts` -- `SOFT_REFUSAL_PATTERNS`, dual-draft check
- `src/hard-gate.test.ts` -- 14 test cases (11 original + 3 review-driven)
- `src/post-check.test.ts` -- 9 test cases (8 original + 1 review-driven)

## Related Patterns

- **Hybrid LLM/deterministic computation** (`docs/solutions/architecture/hybrid-llm-deterministic-computation.md`): LLM extracts `format_requested` (fuzzy), code checks it against the alias map (precise). Same division of labor.
- **Structural bypass** (`expert-pipeline/docs/solutions/architecture/2026-04-21-structural-bypass-for-ai-override-prevention.md`): When text directives fail, remove the AI from the loop entirely. The alias map is code-enforced; the soft refusal patterns are text-based backup.
- **Noop gut checks** (`docs/solutions/architecture/noop-gut-checks-conditional-features.md`): Conditional flags (unknown_capability, ambiguous_capability) follow the same pattern of keeping checks stable without complicating the interface.

## Pre-Existing Issues Surfaced by Review

The review phase found 3 pre-existing issues not introduced by our changes:

1. **XSS in `index.html` `kvHTML`** -- Renders `fail_reasons` (which embed `format_requested`) via `innerHTML` without escaping. `dashboard.html` already has `esc()`. Fix: add same escaping to `index.html`.
2. **`"drum"` substring in `NON_ALEX_FORMATS`** -- Can match inside other words ("conundrum"). Needs word-boundary regex like `RED_FLAG_PATTERNS` uses.
3. **`sanitizeClassification()` runs after hard gate** -- Should run immediately after classification so all downstream consumers get bounded values.

These are documented in HANDOFF.md deferred items.

## Three Questions

1. **Hardest pattern to extract?** The "defense-in-depth, not load-bearing" distinction. Soft refusal patterns feel like a solution, but the structural bypass and alias map are the real guarantees. It's tempting to add more patterns instead of trusting the architecture. Resist that.
2. **What was considered but left out?** A full `CAPABILITIES` data structure with `delivery: "performs" | "sources"` for each capability. Three review agents all flagged it as YAGNI -- nothing consumed it. The alias map alone is sufficient for the hard gate's purpose.
3. **What might future sessions miss?** The `guessFormatFamily()` function in `src/router.ts` does overlapping keyword matching for a different purpose (format routing vs capability gating). Two sources of truth for "what terms Alex recognizes." If one is updated without the other, they'll drift. A cross-reference comment exists in both files, but unification would be better.
