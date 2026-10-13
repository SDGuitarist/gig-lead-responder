---
title: "Verify gate: a vague lead's reply was failed for not citing a detail the lead never gave"
category: architecture
tags: [verify-gate, clarification, prompt-contradiction, measurement, snapshot-tests, leak-check, plan-review, codex-review, observational-evidence]
module: src/prompts/verify.ts, src/verify-prompt-cases.ts, src/clarification-gate-prompt.test.ts, src/draft-opening.ts, scripts/clarification-measure.ts
symptom: "After the price validator was fixed, 0 of 17 clarification-mode drafts passed the verify gate; every draft failed lead_specific_opening."
root_cause: "The generate prompt told the model to build a sparse lead's scene from the experience, not the lead's details; the verify prompt told the verifier the first sentence must cite a concrete detail from the classification. A vague lead has none, so the two prompts could not both be satisfied."
date: 2026-10-13
model: claude-sonnet-5-5
predecessor: architecture/2026-10-13-clarification-validator-rejects-stated-prices-not-vocabulary.md
related:
  - docs/plans/2026-10-13-fix-clarification-gate-opening-plan.md
  - docs/reviews/2026-10-13-clarification-verify-measurement.md
  - docs/reviews/2026-10-13-clarification-gate-measurement.md
  - docs/reviews/2026-10-13-clarification-scene-drafts-reading.md
  - docs/reviews/2026-10-13-clarification-gate-rerun.md
  - docs/reviews/2026-10-13-clarification-gate-plan-codex-round1.md
  - docs/reviews/2026-10-13-clarification-gate-plan-codex-round2.md
  - docs/reviews/2026-10-13-clarification-gate-code-codex-round1.md
  - docs/reviews/2026-10-13-clarification-gate-code-codex-round2.md
---

# Verify gate: scope the opening rule, and say what the evidence supports

## Prior Phase Risk

> "that the verifier follows a scoped definition. `gate_status` is its judgment and the same drafts may fail for a
> reason the booleans do not show; the decision table's opening-only-candidate category is written for that."
> (plan Feed-Forward, least confident)

It happened in part. The scoped definition moved the gate (0 to 2 verified, 17 to 8 drafts failing the opening), and
4 runs still failed on the opening alone: 3 correctly (the draft never used the lead's words), 1 that the definition
would have passed. The pre-registered stop row fired and the cycle returned to Alex instead of iterating on wording.

## Problem

The previous fix let vague-lead drafts reach the verify gate. 0 of 17 verified. `lead_specific_opening` was false in
all 17. The gate's own rule (cinematic scene, competitor test false, no empty traceability, at least 16 of 18 gut
checks) would have passed 6 of those drafts on the booleans, yet each was failed.

## Solution (what ships)

| Piece | What it does |
|---|---|
| Section 6b + the `lead_specific_opening` line, clarification mode only | the opener passes only if it repeats a fact or an uncertainty the lead itself supplied (the occasion, the time frame, the lead's own doubt); "your event", "the right fit", "what you're looking for" do not qualify; two literal fail examples |
| Every other mode | byte-equal to a committed snapshot outside the voice-reference block (S1-S12 incl. two predicate near-misses) |
| Voice-reference block | pinned by SHA-256 (G8): the snapshots store it as a marker because its reference replies carry private venue text |
| Runner | records the final gate detail, the rule-implied pass (with `competitor_test` not double-counted) and the opening sentence via `openingOf` |
| Comments | the stale `// 15` / `// 13` in `src/types.ts` (total 18, threshold 16) and the runner's "12 of 14" |

Evidence: 946 pass / 0 fail / 1 skip; 10 mutations each fail a named test (a further 3 for `openingOf`); the 18-run
re-run went from 0 of 17 to 2 of 16 verified, 17 to 8 failing the opening.

## How it got there (what each step taught)

1. **Count what decided the outcome, not how often a reason is listed.** "11 of 15 fail the opening" read as a root
   cause. The gate is a conjunction; the second measurement recorded the final gate per draft and the causes split:
   9 hard-condition fails, 6 arithmetic passes the verifier failed, 2 several-false.
2. **Two prompts can contradict each other and each look right alone.** The generate prompt said "from the
   experience, not the lead details"; the verify prompt said "reference a concrete detail from the classification".
   Neither was wrong for a rich lead.
3. **Reasons from two producers look the same in one list.** `a v5` failed through code-side voice-kill violations
   (`post-check.ts`), not through the verifier; both land in `fail_reasons`. Read where each string is produced.
4. **My own count was wrong, and review caught it.** "All 6 have only `lead_specific_opening`" was 4; two had a
   voice judgment or a post-check violation. The bound on the fix shrank from 6 to 4 before any code existed.
5. **An instrument that double-counts.** `competitor_test` passes when false, and it is one of the 18 keys. My first
   "false checks" list counted passes. Re-derived, the count moved by one and the conclusion held.
6. **A test can only claim what it compares.** Snapshots stored without the voice block were "byte-equal outside the
   block"; Codex found the plan and a test title said "byte-equal". Reproduced (an edit inside the block passed
   20 of 20), pinned by hash, and the wording now says what it covers. It took two rounds because the plan text was
   fixed in one place and not the others.
7. **The leak check is an instrument that was right.** The first snapshots embedded the voice reference replies and
   `check-venue-history.ts` failed on all 13 new files. The commit was local only, so it was rebuilt; the exemption
   was not widened.
8. **A pre-registered stop row fired and was honoured.** The decision table named "opening-only candidate still
   failing" as STOP, return to Alex, no more wording. It fired (4 runs), and the cycle went to review instead.

## What this does NOT fix

- **4 of 16 drafts are hard-condition failures** (structural scene, competitor test): the generate prompt gives the
  model no picture of a good clarification reply. Plan 2, undecided.
- **`b v3`** ("A wedding music inquiry with no date, no venue, no format, just a price question..."): the definition
  would pass it; the verifier failed it. The gate is the verifier's judgment, not arithmetic in code.
- **The verified drafts are 2 counts** on 18 runs, one model, made-up leads, one run per lead per process.
- **"Exactly one question":** 6 of 72 runs over four measurements; no change made.
- **`openingOf` misses** "Good morning Sarah," and may treat a conversational "Hey, ..." as a salutation; it only
  feeds a human-read measurement field.

## Prevention

- **Record the final gate per run, not the list of reasons**, and classify each run into one cause category before
  planning (a conjunction hides its binding term).
- **When two prompts judge the same output, read both for the same input** (a vague lead) before trusting either.
- **Say what a normalised comparison covers**, in the test title and in every document that cites it, and pin the
  normalised-away part separately (a hash stores no private text).
- **Check an instrument against a known answer** (`competitor_test` passes when false) before counting with it.
- **Pre-register the stop condition in the decision table, per category and not as a fixed total**, and honour it.
- **When a rewritten-in-place plan changes a concept, sweep the whole document for the old wording**, not the
  sentence that was cited.

## Feed-Forward

- **Hardest decision:** whether to touch the verifier while 9 of 17 failures were a real generate-side gap, and
  keeping the scene check strict after reading the 8 essays.
- **Rejected:** relaxing `scene_type`; recomputing the gate in code; changing the generate prompt in this cycle;
  claiming 6 of 17 would move; a definition that passes on "the format is still open" alone.
- **Least confident:** that two verified drafts generalise. The next measurement is plan 2's, and the same runner
  records `verified` and the opening for each run.

## Three Questions

1. **Hardest pattern to extract from the fixes?** That one symptom (no verified draft) was three defects with three
   owners: a validator, a prompt contradiction, and a generate-side gap. Each fix exposed the next, and only the
   per-run gate record separated them.
2. **What did you consider documenting but left out, and why?** The full list of the 8 structural drafts (it is in
   the scene-drafts reading) and the 10 mutation rows (they are in the plan).
3. **What might future sessions miss that this solution doesn't cover?** The verify prompt's voice-reference block
   is no longer snapshot-compared, only hashed: a legitimate reference update needs a `snapshot refresh:` commit and
   a new hash, or G8 fails with no diff to read.
