---
status: pending
priority: p2
issue_id: "064"
tags: [pipeline, classify, generate, ux]
dependencies: []
unblocks: []
sub_priority: 1
---

# Binary Question Strategy for Vague Format Requests

## Problem

When a lead requests something vague like "Latin Band," the pipeline currently
assumes a format (e.g., duo) and quotes a price immediately. This risks:

- Quoting the wrong format and losing the lead
- Overwhelming a casual inquiry with a detailed pitch
- Missing what the client actually wants

### Root Cause: Forced Format Selection

The deeper issue is structural. The `format_recommended` field is **required**
in the Classification type, so Claude must always pick a format even when the
lead doesn't give enough information. There is no "I don't know yet" option.

The classify prompt's format routing rules only cover a narrow set of mappings:

- Mexican heritage + music request → mariachi_full
- Flamenco request → flamenco_duo or flamenco_trio
- Generic "Spanish guitar" or "Latin music" → solo or duo
- Bolero/romantic → bolero_trio

But "Latin Band" could legitimately mean salsa group, bossa nova duo, cumbia
band, mariachi, Latin jazz ensemble, flamenco group, or bolero trio. The
pipeline has no path for most of these and no way to say "clarify first."

The `action` field has three options (`quote`, `assume_and_quote`,
`one_question`), but even `one_question` still requires a `format_recommended`.
Claude picks a format AND asks a question, rather than deferring format
selection entirely.

## Proposed Solution

### 1. Allow deferred format selection

Make `format_recommended` nullable or add a new value like `"unresolved"` when
the request is a vague category. This lets classify say "I can't determine the
format from this lead" without forcing a guess.

### 2. Add a `binary_question` action type

When classify detects `vague_format_request` AND format is unresolved, set
action to `binary_question`. This tells the generate stage to skip the quote
and ask a clarifying either/or question instead.

### 3. Binary question strategy in generate

Ask a simple either/or question like:

> "Are you looking for solo guitar or a Mariachi group?"

This is low-friction for the client to answer, and if neither option fits
(e.g., they want a Bossa Nova band), they'll naturally clarify.

### 4. Follow-up pipeline handles the quote

Once the client responds, the follow-up pipeline re-classifies with the new
information and generates the actual quote.

## Why This Works

- Binary questions are easy to answer — higher reply rate
- Either answer gives useful signal to classify the next response
- A "neither" answer reveals what they actually want
- Avoids quoting a price before understanding the request
- Stops the pipeline from guessing when it doesn't have enough information

## Implementation Notes

- `src/types.ts` — make `format_recommended` nullable or add `"unresolved"`
- `src/prompts/classify.ts` — update format routing rules to allow unresolved
- `src/pipeline/price.ts` — handle null/unresolved format (skip pricing)
- `src/prompts/generate.ts` — add binary question instructions for this action
- `src/pipeline/verify.ts` — adjust gate checks (no pricing line to verify,
  scene test may need different criteria for a short clarifying response)
- `src/run-pipeline.ts` — skip pricing stage when format is unresolved

## Origin

Real lead from Alondra R. (GigSalad, 2026-04-13) — requested "Latin Band" for
a 50-person birthday party with no budget or venue details. Pipeline assumed duo
and quoted $1,100 immediately. A binary question would have been a better first
response.

Root cause analysis (2026-04-13): the forced `format_recommended` requirement
means every lead gets slotted into a format whether or not there's enough
information to do so correctly.
