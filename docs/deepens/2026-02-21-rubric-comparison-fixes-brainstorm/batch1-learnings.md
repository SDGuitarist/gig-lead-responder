# Batch 1 — Learning Findings

**Date:** 2026-02-21
**Learnings checked:** 4
**Relevant:** 4

---

## Sparse Lead Type Classification

**Path:** docs/solutions/sparse-lead-type-classification.md
**Applies to:** Fix 2 (Mariachi Pricing) + Fix 3 (Cultural Vocabulary)
**Key insight:** Bundling beats enumeration — one confident sentence covering
multiple gaps is better than addressing each concern separately. Also: genre
default rule (always state the default when style unspecified).

**Recommendations:**

1. **Fix 2 — Apply bundling to dual-format presentation.** When both 4-piece and
   full ensemble are viable, don't list them as trade-offs. Bundle into one
   confident sentence:
   > "For weekday events, I field a tighter 4-piece that moves between tables;
   > for larger celebrations where everyone gathers, the full ensemble brings the
   > authentic experience you're planning for."

2. **Fix 3 — Place vocab table early in draft structure.** The genre default rule
   shows cultural vocabulary should appear as an explicit standalone statement
   early in the draft (after cinematic opening, before benefit explanation), not
   buried in examples. Mirrors how the genre default is placed.

3. **Fix 1 — Date proximity rule as template.** The learning's "events within 6
   weeks must have timeline acknowledged" pattern is a template for how to inject
   past-date clarification: explicit, standalone, early in structure.

---

## Testable Constraints for Prompt Compliance

**Path:** docs/solutions/testable-constraints-for-prompt-compliance.md
**Applies to:** Fix 3 (Cultural Vocabulary) verification + general pattern
**Key insight:** "Deletion test beats vague instructions — frame compliance as
'remove X, does the output still work generically? If yes, it fails.'"

**Recommendations:**

1. **Fix 3 — The few-shot examples already use this pattern.** The FAIL/PASS
   examples for cultural vocabulary ("Las Posadas" vs "Nochebuena") are deletion
   tests in disguise. The brainstorm is already aligned.

2. **Enhancement — Add FAIL/PASS examples for Fix 2 format routing.** When
   presenting dual pricing, add explicit examples to the generate prompt:
   ```
   FAIL: "We could do 1 hour instead, which would be $450."
   PASS: "A confident 1-hour solo set at $450, fully self-contained."
   ```
   Shows the difference between generic scope-down language vs confident bundling.

3. **Enhancement — Consider reasoning stage for complex routing.** For mariachi
   format routing (Fix 2), forcing the LLM to pre-write the format recommendation
   in isolation before the full draft could improve compliance with signal-based
   routing rules.

---

## Prompt Placement for Hard Constraints

**Path:** docs/solutions/prompt-placement-for-hard-constraints.md
**Applies to:** Fix 1 (Past-Date Detection) + Fix 3 (Cultural Vocabulary)
**Key insight:** Hard constraints go at the TOP of the system prompt, before
persona, before examples, before data. Conditional rules buried in data sections
get ignored ~30% of the time. Two-layer reinforcement: generation prompt +
verification gate.

**Recommendations:**

1. **Fix 1 — Past-date flag instruction goes at TOP of classify prompt.** Don't
   bury "check if the date is before today" in the timeline_band section. Place
   it as a standalone instruction before the classification schema.

2. **Fix 1 — Two-layer enforcement.** Layer 1: classify prompt detects past date.
   Layer 2: generate prompt conditionally injects the clarification. If the
   generate prompt misses it, the verify gate should catch drafts that treat a
   past date as future.

3. **Fix 3 — Cultural vocab injection placement.** The few-shot examples and vocab
   table should be injected near the top of the cultural context section in the
   generate prompt, not appended at the bottom. Kitchen-door-sign principle:
   Claude reads it before it starts drafting.

---

## Platform Policy Enforcement

**Path:** docs/solutions/platform-policy-enforcement.md
**Applies to:** Fix 1 (conditional injection pattern) + Fix 3 (conditional injection)
**Key insight:** Two-layer enforcement for conditional rules: hard constraint at
the top of the system prompt + inverse enforcement at the gate. If/else branching
for opposite behaviors with permissive fallback as default.

**Recommendations:**

1. **Fix 1 — Mirrors the conditional injection pattern.** `past_date_detected`
   triggers a conditional block in the generate prompt, just like platform policy
   triggers platform-specific instructions. Same if/else structure:
   ```
   if (past_date_detected):
     inject date clarification concern
   else:
     no-op (permissive default)
   ```

2. **Fix 3 — Cultural vocab injection is the same pattern.** When
   `cultural_context_active === true && cultural_tradition === "spanish_latin"`,
   inject the vocab block. When false, no-op. The platform policy solution
   validates this approach — conditional prompt injection with permissive default
   is a proven pattern in this codebase.

3. **No structural changes needed.** The brainstorm already applies these patterns
   correctly. The learning reinforces that the approach is sound.
