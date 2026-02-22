---
category: prompt-engineering
tags: [llm, cultural-vocabulary, contrastive-pairs, terminology-enforcement]
module: src/prompts/generate.ts, src/prompts/verify.ts
symptoms: [wrong cultural terms, adjacent-tradition confusion, generic translations]
---

# Contrastive Pair Prompting for Domain Vocabulary

**Related:**
- [testable-constraints-for-prompt-compliance.md](./testable-constraints-for-prompt-compliance.md)
- [prompt-placement-for-hard-constraints.md](./prompt-placement-for-hard-constraints.md)

## Prior Phase Risk

Previous phase's "least confident" flagged no actionable risk (batch scope only). No risk to address — proceeding normally.

## Problem

The generation model used culturally adjacent but incorrect terminology when referencing Mexican traditions. The output was well-written and confident, but wrong in ways that would signal unfamiliarity to the family reading it.

## Symptom

- "the mariachi opens with the first notes of Las Posadas" — Las Posadas is a 9-day pre-Christmas procession, not Christmas Eve. The family calls Christmas Eve "Nochebuena."
- "a traditional birthday performance with Mexican songs" — Las Mañanitas is the specific name for the birthday song. Every Spanish-speaking family knows this term. Using the generic phrase reads as outsider ignorance.

The errors pass a casual read. The terms are all real Mexican cultural references. The problem is precision, not plausibility.

## Root Cause

Generic LLMs learn that multiple terms map to overlapping cultural contexts and treat them as interchangeable synonyms. "Las Posadas," "Nochebuena," and "Christmas Eve" all appear in Mexican Christmas contexts, so the model assigns them roughly equal probability. It picks the term that fits the sentence best stylistically, not the one the family uses.

Pass/fail examples (from `testable-constraints-for-prompt-compliance.md`) teach quality thresholds — they distinguish high-quality from low-quality output. They do not solve this problem because the FAIL example here is high-quality writing. The wrong term is well-placed, the sentence is evocative — it just uses the wrong word. A generic pass/fail pair cannot convey that distinction.

## What Was Tried

1. **"Use culturally specific language"** — Too vague. The model was already using culturally specific language; it was using the wrong specific word.

2. **Listing correct terms** — Partially helpful, but without context for why substitution is wrong, the model continued treating adjacent terms as interchangeable.

3. **Generic pass/fail example** — Did not help. The fail example in a standard pass/fail pair is low-quality or generic; here the fail example is high-quality prose with a precise word error. The existing pattern cannot teach this distinction.

## What Worked

### Contrastive Pairs in the Generation Prompt

In `src/prompts/generate.ts`, `buildCulturalVocabBlock()` injects FAIL/PASS pairs when `cultural_tradition === "spanish_latin"`. Each pair shows a well-written FAIL, a correct PASS, and a WHY line explaining the vocabulary distinction:

```typescript
function buildCulturalVocabBlock(classification: Classification): string {
  if (classification.cultural_tradition !== "spanish_latin") {
    return "ACTIVE — Use cultural terminology appropriate to the tradition.";
  }

  return `ACTIVE — Gift-giver frame, heritage validation.

CULTURAL VOCABULARY — Use the word the family uses, not an adjacent tradition.

FAIL: "the mariachi opens with the first notes of Las Posadas"
PASS: "Nochebuena in Chula Vista — the mariachi opens and someone stops mid-sentence"
WHY: Las Posadas is a 9-day procession, not Christmas Eve. The family calls it Nochebuena. Use THEIR word.

FAIL: "a traditional birthday performance with Mexican songs"
PASS: "Las Mañanitas at her table, three generations surrounding her"
WHY: Las Mañanitas IS the birthday song. Name it — the family knows exactly what it is.

GENERALIZATION: This rule applies to ALL cultural terms. Adjacent terms from the same tradition are NOT interchangeable.`;
}
```

The GENERALIZATION line is required. Without it, the model learns to use "Nochebuena" and "Las Mañanitas" specifically but does not internalize the principle and fails on other cultural terms not covered by the examples.

### Deletion Test in the Verification Gate

In `src/prompts/verify.ts`, `buildCulturalVocabInstruction()` adds a `cultural_vocabulary_used` gut check:

```
Draft must use specific cultural terminology (e.g., "Nochebuena" not
"Christmas Eve", "Las Mañanitas" not "birthday song"). Deletion test:
swap the cultural term for a generic English equivalent — does the
sentence still work? If yes → false.
```

The gut check is a no-op (`"Always true"`) when `cultural_context_active` is false, so it does not penalize non-cultural leads.

## Reusable Pattern

Use contrastive pairs when the constraint is **vocabulary precision**, not quality:

1. **Write the FAIL example as high-quality prose** — if the fail example looks obviously bad, the pair does not teach the right lesson. The model needs to see that well-written output can still use the wrong term.

2. **Include a WHY line** — explains the semantic distinction, not just which word to prefer. The model needs to understand *why* the adjacent term is wrong.

3. **HARD REQUIREMENT: Every contrastive pair block MUST end with a GENERALIZATION rule.** Without it, the model memorizes the specific examples ("use Nochebuena, not Las Posadas") but does not transfer the principle to new terms not covered by the pairs. The generalization tells the model: "this rule applies to ALL terms in this domain, not just the ones I showed you." Omitting the generalization is the most common failure mode when applying this pattern — the pairs feel complete without it, but the model will fail on the first uncovered term.

4. **Two pairs is the right calibration** — one pair risks the model treating it as a one-off exception; three or more risks over-prompting and inconsistent behavior. Two pairs establishes the pattern without over-constraining.

5. **Mirror with a deletion test in the verify gate** — generation-side pairs prevent errors; verify-side deletion test catches regressions. The deletion test for vocabulary: swap the specific term for a generic English equivalent — if the sentence still communicates the same thing, the specific term was not doing its job.

### When to Use This Pattern vs. Pass/Fail Examples

| Situation | Use |
|-----------|-----|
| Output is low-quality or vague | Pass/fail examples (quality threshold) |
| Output is high-quality but uses the wrong specific term | Contrastive pairs (vocabulary precision) |
| Output fails a self-test on specificity | Deletion test |

## Three Questions

1. **Hardest pattern to extract:** Whether contrastive pairs are a sub-pattern of pass/fail examples or a distinct pattern. Decided distinct — pass/fail examples teach quality thresholds where the FAIL is low-quality or generic; contrastive pairs teach vocabulary precision where the FAIL is high-quality prose with the wrong word. The distinction matters because the wrong mental model leads to writing a low-quality FAIL example that doesn't teach the vocabulary lesson.

2. **What was left out:** Did not document when 3+ pairs would be appropriate. Research during implementation found 2 pairs to be the calibration sweet spot — 3 pairs risks over-prompting with diminishing returns. This limit is a calibration detail, not a transferable pattern, so it was left out.

3. **What future sessions might miss:** The GENERALIZATION rule at the end of the contrastive block. It is easy to skip because the two pairs feel sufficient, but without the generalization the model applies the examples narrowly and fails on uncovered cultural terms. Every contrastive pair block in any prompt must include its own generalization rule.
