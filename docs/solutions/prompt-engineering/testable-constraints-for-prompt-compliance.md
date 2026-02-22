# Testable Constraints for AI Prompt Compliance

**Category:** Prompt engineering
**Tags:** llm, forcing-rules, deletion-test, pass-fail-examples, prompt-compliance
**Module:** src/prompts/generate.ts
**Related:** [prompt-placement-for-hard-constraints.md](./prompt-placement-for-hard-constraints.md)

## Problem

The generation model understood what you *wanted* but produced generic output.
Opening sentences were cinematic but referenced no lead details. Named fears
were implied but never stated explicitly. The model followed the *spirit* of
instructions ("write a cinematic opening") while ignoring the *letter* ("it must
reference a concrete detail from this specific lead").

**Symptom:** Draft passes human vibes check on first read, but fails on second
read when you ask "could this sentence have been written for *any* lead?"

**Root cause:** Vague instructions ("be specific," "reference the lead") give
the model permission to *feel* specific without *being* specific. The model
optimizes for tone, not for verifiable compliance.

## What Was Tried

1. **Telling the model to "be specific"** — Too vague. The model writes
   evocative prose that sounds specific but contains zero lead details.
   "The room hums with conversation and the guitar slips underneath it" —
   beautiful, zero specificity.

2. **Listing what details to include** — Better, but the model treats it as
   a suggestion, not a requirement. Details appear sometimes, not always.

3. **Adding a verification gate** — Catches bad output but doesn't prevent
   it. First-attempt pass rate stayed low (~50%), meaning expensive retries.

## What Worked

Three techniques, layered together, raised first-attempt pass rate from ~50%
to ~75% and made failures fixable in one retry:

### 1. The Deletion Test

Give the model a *self-test* it can run on its own output:

```
FORCING RULE — Your first sentence MUST contain a concrete detail from this
lead (event type, date, location, format, or cultural context). Test: if you
delete the detail, does the sentence still work for any random lead? If yes,
it fails.
```

**Why it works:** The model can evaluate "does removing X change the sentence?"
in a way it can't evaluate "is this specific enough?" The test is binary, not
subjective.

**Analogy:** Telling someone "make it personal" vs. "write the person's name
on it — if the name isn't there, it's not personal." The second version has a
verifiable check built in.

### 2. Pass/Fail Examples in the Prompt

Abstract rules get interpreted loosely. Concrete examples anchor behavior:

```
Example FAIL: "The room hums with conversation and the guitar slips
underneath it."
Example PASS: "A corporate evening downtown on March 14 — the guitar is
already working the room before anyone finds their seat."
```

**Why it works:** The model sees *exactly* where the line is. The fail example
is well-written prose — the issue isn't quality, it's specificity. That
distinction is impossible to convey with instructions alone.

### 3. Reasoning Stage (Pre-Work Before Prose)

Force the model to extract facts before writing:

```json
{
  "reasoning": {
    "details_present": ["every concrete detail from the lead"],
    "absences": ["what is missing and what each absence signals"],
    "emotional_core": "what is this person actually trying to create?",
    "cinematic_opening": "the exact first sentence, written standalone",
    "validation_line": "the exact validation sentence, written standalone"
  }
}
```

**Why it works:** The model writes the critical sentences *in isolation* during
reasoning, where it can focus on compliance without the momentum of prose
pulling it toward generic phrasing. The draft then uses these pre-written
sentences.

### 4. Verification Gate Reinforcement

The verify prompt (section 6b) independently checks lead-specificity:

```
Does the opening sentence reference a CONCRETE DETAIL from the classification?
Generic openings like "What a beautiful event" → lead_specific_opening = false
Specific openings like "A mariachi serenata for your parents' 50th" → true
```

This is separate from the "competitor test" (could another vendor write this?)
because a sentence can be unique to your voice but still generic to the lead.

## Test Results

| Lead | Before (generic rate) | After (with forcing rules) |
|------|-----------------------|---------------------------|
| Wedding @ Hilton La Jolla | ~50% first-attempt pass | Pass on attempt 2 |
| Birthday March 22, sparse | ~30% first-attempt pass | Pass on attempt 1 |
| October 2026 birthday | ~40% first-attempt pass | Pass on attempt 2 |
| Corporate March 14 | ~30% first-attempt pass | Pass on attempt 1 |

All 4 leads achieve 10/10 gut checks after forcing rules added.

## Reusable Pattern

1. **Deletion test beats vague instructions** — Frame compliance as "remove X,
   does the output still work generically? If yes, it fails." Works for any
   constraint where specificity matters.

2. **Pass/fail examples beat abstract rules** — Show the model a *good* example
   that fails (well-written but non-compliant) alongside a passing example. The
   contrast teaches the boundary better than any instruction.

3. **Reasoning stage before generation** — Force the model to extract key facts
   into structured fields before writing prose. Critical sentences written in
   isolation are more compliant than sentences written mid-flow.

4. **Two-layer enforcement** — Generation prompt prevents bad output (forcing
   rules + examples). Verification gate catches what slipped through. Neither
   layer alone is reliable enough.

5. **Examples beat instructions, testable constraints beat vague rules** — If
   you can't write a mechanical test for your constraint, the model can't
   reliably follow it either.
