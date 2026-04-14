---
status: pending
priority: p2
issue_id: "065"
tags: [pipeline, verify, voice, quality]
dependencies: []
unblocks: []
sub_priority: 1
---

# Verify Prompt Missing Voice Reference Examples

## Problem

The generate prompt (Stage 4) gets 5 active voice reference examples from
`src/data/voice-references.ts` — 3 real sent messages and 2 validated synthetic
ones. These are labeled "the voice ceiling" and the AI matches against them.

The verify prompt (Stage 5) grades `sounds_like_alex` but has NO voice examples.
It only gets a text description of what Alex sounds like (contractions, no sales
vocabulary, peer-to-peer register, varied sentence length). The AI grading the
draft is judging voice fidelity without ever hearing the voice.

This means the gate could pass a draft that technically follows the rules
(contractions present, no banned words) but doesn't actually sound like the
real examples.

## Proposed Solution

Inject 1-2 voice reference examples into `buildVerifyPrompt()` so the verify
AI has a concrete calibration target for the `sounds_like_alex` check.

Options:
1. **Minimal:** Include the strongest reference (Patterson) as a single example
   with a note: "This is the voice ceiling. The draft should sound like it was
   written by the same person."
2. **Balanced:** Include Patterson + one contrasting type (e.g., Sparse Cocktail)
   so the verifier sees Alex's voice at different energy levels.

Option 2 is probably better — it shows the AI that Alex sounds consistent
across lead types, not just on premium wedding leads.

## Files to Change

- `src/prompts/verify.ts` — inject voice references into the system prompt
- May need to import `VOICE_REFERENCES` from `src/data/voice-references.ts`

## Origin

Discovered while reviewing prompt architecture (2026-04-13). The generate prompt
has strong voice calibration; the verify prompt does not. The gap means the
quality gate's voice check is weaker than the drafting stage's voice adherence.
