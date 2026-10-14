---
title: "Clarification draft shape: a shorter-reply instruction shortened the draft but did not move the primary, and the report gate had to be made a gate"
category: architecture
tags: [generate-prompt, clarification, two-arm-measurement, exploratory-power, manifest, held-out-leads, hash-pinning, plan-review, codex-review, observational-evidence]
module: src/prompts/generate.ts, src/generate-prompt-cases.ts, src/arm-manifest.ts, scripts/clarification-measure.ts, scripts/clarification-arm-report.ts
symptom: "After the verify-gate fix, 13 of 33 clarification drafts failed a hard condition (structural scene or competitor test), full drafts were a median 150 words against a stated 100-125, and the compressed draft was told to retain a price while forbidding one."
root_cause: "In clarification mode the generate prompt still asked for the full five-step essay (named fear, fear resolution), the generic quote word range, and a price in the compressed retain list; nothing in it described a short reply to a vague lead."
date: 2026-10-13
model: claude-sonnet-5-5
predecessor: architecture/2026-10-13-verify-gate-asked-a-vague-lead-for-a-detail-it-never-gave.md
related:
  - docs/plans/2026-10-13-fix-clarification-draft-shape-plan.md
  - docs/reviews/2026-10-13-clarification-shape-arm-a.md
  - docs/reviews/2026-10-13-clarification-shape-measurement.md
  - docs/reviews/2026-10-13-clarification-shape-plan-codex-round1.md
  - docs/reviews/2026-10-13-clarification-shape-plan-codex-round2.md
  - docs/reviews/2026-10-13-clarification-shape-code-codex-round1.md
  - docs/reviews/2026-10-13-clarification-shape-code-codex-round2.md
---

# Clarification draft shape: say what the evidence supports, and make the gate a gate

## Prior Phase Risk

> "that a shorter-reply instruction is followed. The prompt already says 100-125 words and 1 of 33 drafts complied."
> (plan Feed-Forward, least confident)

It was followed in part. Sentences fell from a median 8 to 5 (42 of 44 within 4-6) and words from 157 to 119, but
only 7 of 44 drafts landed in 70-100. The pre-registered primary did not move (38% to 34%, p = 0.42), and the
decision table's stop row fired: return to Alex, the next lever is a reference reply in his words, not another
wording round.

## Problem

After plan 1 the verify gate no longer failed every clarification draft, but 13 of 33 failed a hard condition (scene
structural 11, competitor test true 4). Reading the generate prompt for that mode showed three things it still said:
the five-step essay (named fear and fear resolution for a lead with nothing to resolve), the generic 100-125 word
range, and a compressed draft that "must retain price" while the same prompt forbade a price.

## Solution (what ships)

| Piece | What it does |
|---|---|
| Steps 1-3, clarification mode only | step 1 opens with a fact or an uncertainty the lead supplied; step 2 is one sentence naming what goes wrong when a format is chosen blind; step 3 is KEPT as one bundled sentence so concern traceability is still requested |
| Length | 70 to 100 words, 4 to 6 sentences (a hypothesis, measured) |
| Compressed retain list | `price` dropped in clarification mode (the contradiction) |
| Every other mode | SHA-256 pinned for 12 cases and three committed baselines (`src/fixtures/generate-prompt-hashes.json`); the clarification prompt differs only in three spans (P5) |
| Measurement tooling | an arm manifest per run (git SHA, prompt hash, model, date, lead-set hash), `compareArms`/`assessArms`, an aggregate-only report, four held-out leads |

## What the measurement showed (50 runs per arm, one model, made-up leads, exploratory)

| | Arm A | Arm B |
|---|---|---|
| Unusable runs (no draft, structural scene, or competitor true) | 19 of 50 = 38% | 17 of 50 = 34% (p = 0.42) |
| `verified` | 7 of 43 | 11 of 44 |
| Competitor-test failures / structural scene | 4 / 10 | 1 / 11 |
| Words, median; sentences, median | 157; 8 | 119; 5 |
| `differentiated` false | 5 | 9 |

## How it got there (what each step taught)

1. **One sample cannot show a modest change.** The same prompt gave 9 of 17 and 4 of 16 hard-condition failures in
   two 18-run sets. The design became two arms of 50, a fixed denominator (all runs; a no-draft run counts as
   unusable) and a stated power: about 55-60% for a 15-point effect. The null cannot say there is none.
2. **A "skip" would have broken a different check.** The first plan marked step 3 skipped; review showed the
   prompt separately requires every flagged concern be addressed and the verifier fails an empty traceability
   sentence. Step 3 was kept as one bundled sentence. (Neither the prompt nor the 33 drafts had an empty entry; the
   risk was the plan's own.)
3. **Identity must be recorded, not promised.** "Arm A runs before the change" was procedure. The manifest makes it
   mechanical: five identical manifests per arm, A's prompt hash equal to the stored pre-change hash, B's equal to
   the current tree's, A's commit an ancestor of B's, the same model, date and lead set.
4. **Store a hash, not private text.** The generate prompt carries private venue text the leak check forbids in a new
   file. SHA-256 per case pins "unchanged" without storing it; the span-removed hash proves the change is exactly the
   three spans; positive and negative controls pin the extractor.
5. **A printed check is not a gate.** The report printed the manifest result and then computed the Fisher p. Codex
   found it; reproduced with crafted directories (40 runs compared as complete). It now exits non-zero with
   `COMPARISON VOID` before any statistic.
6. **A broad check masks a narrow guard.** Two mutants survived the same way (the pre-change prompt check hidden by
   the current-prompt check; the empty-models guard hidden by the cross-arm model comparison). Each needed a case
   where the broader check could not fire.
7. **Shortening is not cinematic.** The instruction removed the "most vendors" contrast and cut sentences; the
   verifier's scene check wants one concrete moment and the change never asked for an image.
8. **The validator rejected ordinary words again.** The internal terms rejected `anchor` (the verb, 3 times) and
   `floor` (a dance floor, once) in 172 runs, each costing a usable run; one `$500` was correctly rejected.

## What this does NOT fix

- **The structural-scene failures** (10 of 43, then 11 of 44). The lever is a reference reply in Alex's voice, which
  needs his exact words and a copy check like T4's.
- **The `anchor` / `floor` false rejects** in the clarification validator.
- **"Exactly one question":** 12 of 122 runs over all measurements; not touched.
- **The primary below about 15 points** is invisible at this power.
- **Report residuals** (stated in its header): a result file copied under a second name, or a partial lead set run
  enough times to total 50, still passes; `dirtyPromptFiles` covers `src/prompts` and `src/pipeline` only.

## Prevention

- **Fix the denominator before you read the numerator** (all runs, not "returned drafts"), and write the power.
- **Record the identity of every arm in the artifact** and make the comparison fail on a mismatch.
- **A check that must gate must also stop the output**, and a test must spawn the real script to prove it.
- **When two checks overlap, test the narrow one on a case the broad one cannot fire for.**
- **Pin private text by hash**; pin a changed region by removing it and hashing the rest.
- **Hold out leads, and keep the held-out outputs unread until the change is committed**; say it is self-attested.
- **Pre-register what a null means and what to do**, then do it.

## Feed-Forward

- **Hardest decision:** how to measure a modest change when two samples of the same prompt differed by 28 points.
- **Rejected:** a length check in code (ends in no draft); relaxing the verifier; skipping step 3; another 18-run look.
- **Least confident:** that two verified drafts of 11 generalise, and that the reference reply will move the scene.

## Three Questions

1. **Hardest pattern to extract from the fixes?** That the measurement tooling needed the same rigour as the
   product: a report that prints a failed check and then a statistic was the one real defect Codex found in a change
   whose prompt text was fine.
2. **What did you consider documenting but left out, and why?** The three read pricing-language drafts' full text
   (they are in the measurement record) and the per-lead counts (5 runs each, noise).
3. **What might future sessions miss that this solution doesn't cover?** The hash fixture goes stale on ANY
   unrelated edit to the generate prompt, and G8/P4 then fail with no text to diff: refresh only in a
   `snapshot refresh:` commit with the prompt diff.
