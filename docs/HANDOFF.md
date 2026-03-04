# HANDOFF — Gig Lead Responder

**Date:** 2026-03-03
**Branch:** `feat/lead-response-loop`
**Phase:** Work (Phase C1 complete, C2-C4 remain)

## Prior Phase Risk

> "Whether Stage 1's LLM will reliably extract venue names."

Phase C1 addresses this with pass/fail examples at the TOP of the classify prompt, empty-string sanitization, and backward compat for old records. Worst case: false misses logged, not broken drafts.

## What Was Done

2 commits on `feat/lead-response-loop`:

| Commit | Phase | What |
|--------|-------|------|
| `6820ac2` | C1 | `venue_name: string \| null` on Classification, prompt extraction rule, sanitization |
| `a357d98` | C1 | Test fixture fix — added `venue_name: null` to makeClassification |

### Files Changed

- `src/types.ts` — added `venue_name: string | null` to Classification interface
- `src/prompts/classify.ts` — venue extraction rule at top of prompt
- `src/pipeline/classify.ts` — empty-string sanitization + backward compat
- `src/enrich-generate.test.ts` — test fixture updated

## What Remains (this repo)

- [ ] **C2:** Create `src/venue-lookup.ts` (fetch client) + `src/constants.ts` + VenueContext types in `src/types.ts`
- [ ] **C3:** Create `src/pipeline/format-venue-context.ts`, update `context.ts` + `run-pipeline.ts`
- [ ] **C4:** Add `venue_misses` table to `src/leads.ts`, wire miss logging in pipeline

## Three Questions

1. **Hardest implementation decision?** Placing the venue extraction rule at the TOP of the classify prompt, before the role description. This follows the documented pattern (hard constraints first) but breaks the natural reading flow of the prompt. The LLM needs to see "do NOT extract cities" before it starts reading examples.

2. **What did you consider changing but left alone?** The Classification interface uses `string | null` (required-nullable) instead of `string?` (optional). This follows the documented pattern from `docs/solutions/logic-errors/required-nullable-vs-optional-types.md`. The backward compat code in classify.ts handles old records that lack the field.

3. **Least confident about going into review?** Whether the LLM consistently returns `null` vs empty string for no-venue cases. The sanitization catches empty strings, but the LLM might also return city names despite the examples. Need to monitor the miss log in week 1.

### Prompt for Next Session

```
Read ~/Projects/pacific-flow-hub/docs/plans/2026-03-03-feat-lead-response-loop-plan.md.
Implement Phases C2, C3, C4 in gig-lead-responder (venue lookup client, pipeline threading, miss logging).
Branch: feat/lead-response-loop. Relevant files: src/types.ts, src/run-pipeline.ts, src/pipeline/context.ts, src/leads.ts.
```
