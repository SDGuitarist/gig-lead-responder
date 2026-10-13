# Review Context -- Gig Lead Responder

## Risk Chain

**Brainstorm risk:** None -- **no brainstorm** (skip gate: Alex's stated COI rule, 2026-10-12, plus measured drift of
the model's own COI timeline in four T4 smoke sets).

**Plan mitigation:** `docs/plans/2026-10-12-feat-coi-sentence-by-request-plan.md` (Revisions 0-3c). The app writes the
exact sentence (`COI available upon request.` by default; the timeline sentence only when the client says they
require a COI) and the post-check confirms it, the pattern payment terms use. A wrong sentence count returns one flag
and stops; other COI wording is scanned only at count 1. Plan review R1-R3 NO-GO at the cap, mostly stale text from
appending revisions instead of rewriting; Alex accepted with two text fixes and built.

**Work risk (from Feed-Forward):** the classifier's `coi_required` on indirect phrasings. Five real-model leads
behaved as set (one run each); the capability question ("Do you carry liability insurance?") is false by Alex's
trigger and is observation-only.

**Review resolution:** code review R1 NO-GO, 1 P1: the dashboard approve route sent a stored draft with no COI
sentence. Alex chose "refuse, like payment": 409 `coi_sentence_unverifiable` before the claim. R2 GO, no new defects.

## Files to Scrutinize

| File | What changed | Risk area |
|------|-------------|-----------|
| `src/pipeline/coi.ts` | `coiTermsFor` (mode matrix), `coiLine`, `coiViolations` | a new response mode with its own shape must be added to the matrix; the regex list for other COI wording |
| `src/api.ts` | the approve route applies `coiViolations` to the stored drafts | any new send path (Module 1) must apply the same check and refresh payment |
| `src/prompts/generate.ts` | the Quote Terms COI line; `buildGeneratePrompt` calls `coiTermsFor` itself | prompt and post-check must stay on the same function |
| `src/pipeline/post-check.ts`, `src/run-pipeline.ts` | `coiTerms` option, passed from both pipelines | a violation FAILS the draft and holds auto-send |
| `src/pipeline/classify.ts`, `src/prompts/classify.ts` | `coi_required` (only a real true), literal definition lines | indirect phrasings; a venue name alone is not a signal |
| `docs/RESPONSE_CRAFT.md` and three more injected docs | stop teaching a COI timeline | the docs are read at run time, not in the baseline fixtures |

## Plan Reference

`docs/plans/2026-10-12-feat-coi-sentence-by-request-plan.md`
