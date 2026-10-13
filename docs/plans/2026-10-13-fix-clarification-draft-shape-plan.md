---
title: "fix: clarification-mode drafts are written as explanatory essays; the generate prompt asks for steps a vague lead has nothing to fill"
date: 2026-10-13
status: plan, Revision 0 (not yet reviewed)
branch: feat/hub-phase0
---

# Clarification generate prompt: ask for a short reply, not a five-step essay

### Prior Phase Risk

Predecessor: `docs/plans/2026-10-13-fix-clarification-gate-opening-plan.md` (plan 1, built and reviewed to the cap).
Its "least confident" answer, quoted from `docs/solutions/architecture/2026-10-13-verify-gate-asked-a-vague-lead-for-a-detail-it-never-gave.md`:
"that two verified drafts generalise. The next measurement is plan 2's, and the same runner records `verified` and
the opening for each run." This plan accepts it and answers it with a larger, two-arm measurement (below) rather than
another 18-run look, because the two 18-run sets with the SAME generate prompt gave a hard-condition fail rate of 9
of 17 and 4 of 16: one 18-run set cannot show a modest improvement.

## Problem (measured, not assumed)

After plan 1, a clarification draft's remaining blockers are generate-side. Over the two 18-run sets (33 drafts,
same generate prompt, `docs/reviews/2026-10-13-clarification-gate-measurement.md` and
`...-clarification-gate-rerun.md`):

| Measured on the 33 returned drafts | Value |
|---|---|
| Hard-condition failures (scene `structural` 11, competitor test true 4, 2 overlap) | **13 of 33 (39%)**; 9 of 17 in one set, 4 of 16 in the other |
| Full drafts within the stated 100-125 words | 1 of 33 (min 124, median 150, max 212); 11 of 33 within 145 |
| The stock question quoted verbatim | 20 of 33 |
| `verified` | 2 of 33 (both sets, with plan 1 in only the second) |

The 8 structural-scene drafts of the first set were read (`...-clarification-scene-drafts-reading.md`): all explain
why format matters instead of showing a moment; 4 use a "most vendors guess" contrast (the competitor-test fails).

## What is true today (read 2026-10-13, `src/prompts/generate.ts`)

In clarification mode (`action === "one_question"` and `format_recommended === "unresolved"`) the prompt still says:

1. The 5-step sequence (line 102-118): step 1 cinematic hook, **step 2 differentiator + named fear, step 3 fear/concern
   resolution ("every explicit AND inferred question answered")**, step 4 recommendation + price (marked "SKIP in
   clarification mode"), step 5 the CTA, which is the one binary question. Only step 4 is marked skipped. A vague lead
   has no concerns to resolve, so steps 2 and 3 are filled with explanation.
2. The compressed draft "Must retain: wedge, validation sentence, at least one fear resolution, **price**, close"
   (line 313): `price` is dropped only for a residency that states none. In clarification mode the same prompt says
   "Do NOT state a price, rate, anchor, floor, or package" (line 284). A direct contradiction.
3. The full draft word count is the generic 100-125 (premium 125-145, cultural 145-165): written for a quote with a
   price, logistics and terms. The measured drafts exceed it by about 20 to 70 percent. Nothing in code enforces it
   (`compressed_word_count` is computed, not checked), and none should: a length failure would add no-draft runs.
4. The Sparse-lead protocol (Type 4: "one binary question that demonstrates expertise") and the scene strategy ("build
   the cinematic moment from the experience, not the lead details") sit far from the Clarification Mode block; the
   FORCING RULE (line 350) already requires the first sentence to contain a concrete detail from the lead.
5. The stock question appears twice (Type 4 "Default question" and the Clarification Mode "Good" example).

The verify prompt is not changed here (plan 1).

## Decision

D1. In clarification mode only, change the 5-step text: step 2 becomes ONE sentence naming the specific thing that
goes wrong when the format is chosen blind (not a "most vendors" contrast); step 3 is marked "(SKIP in clarification
mode: nothing to resolve until the question is answered)", as step 4 already is; step 1 keeps the FORCING RULE and
is stated to open with a word the lead supplied (the same minimum anchor plan 1 gave the verifier), so the two
prompts agree.

D2. In clarification mode only, replace the word-count line with a clarification range and a sentence count. The
numbers are a HYPOTHESIS to be measured, not a result: with steps 3 and 4 skipped the reply is a hook, one named
fear, validation and the question; the range goes in the plan review as an open choice (70-100 words and 4 to 6
sentences are the proposal). The measurement reports the observed word count; it does not gate on it.

D3. In clarification mode only, drop `price` from the compressed draft's "Must retain" list (the contradiction in
item 2 above), exactly as the residency branch already does.

D4. Not done, and why:
- relaxing `scene_type` or `competitor_test` in the verifier (the 8 structural drafts were essays; plan 1 settled it);
- a code check on word count (a new way to end with no draft);
- rewriting the stock question or the Type 4 default (a voice choice that is Alex's; out of scope, recorded as an
  observation: 20 of 33 drafts quote it);
- a reference clarification reply in Alex's voice (needs his exact words; held as option A for a later cycle only if
  this change does not move the hard-condition rate);
- any change to the validator, the verify prompt, post-check, COI or payment lines.

## The invariant, stated exactly

This change makes the clarification prompt consistent with itself and shorter by instruction. It does NOT guarantee
a short, cinematic draft: the model may still write an essay. Nothing deterministic enforces shape; the verifier and
the 2-arm measurement are the only checks, and both are model-dependent.

## Plan Quality Gate

1. **What exactly is changing?** Three spans of `buildGeneratePrompt` for clarification mode only (step 2 and 3 text,
   the word-count line, the compressed "Must retain" line); a new `src/clarification-shape-prompt.test.ts`; four new
   made-up leads (h1-h4) in the runner; one record under `docs/reviews/`.
2. **What must not change?** The generate prompt for every non-clarification mode (the three committed baselines stay
   byte-equal, plus a SHA-256 for each near-miss and platform case listed below); the Clarification Mode HARD
   CONSTRAINT text; the validator (V1-V11 pass unchanged); the verify prompt (G0-G8 pass unchanged); post-check; the
   COI and payment lines; the T4 reference withholding.
3. **How will we know it worked?** EARS below with a mutation for each; plus a two-arm measurement on ten made-up
   leads (the six used so far and four held out, written before the change), 50 runs per arm, same runner. Primary:
   the hard-condition failure rate among returned drafts. Guards: no-draft rate, pricing-language errors, `verified`.
   Observational: 50 runs per arm, one model, made-up leads.
4. **Most likely way this plan is wrong?** The model ignores a shorter-reply instruction as it ignored 100-125
   (1 of 33 followed it). Then the hard-condition rate does not move, and the plan's answer is option A (a reference
   reply, Alex's words) rather than a third wording round. Second: shortening reduces the one specific image the
   verifier wants and raises `can_see_it` failures; the guard table reports it.
5. **How will a human RUN this, and when?** Claude Code (or Alex) on the MacBook, after the code step and before the
   Codex code review: the two commands in the Execution Path. Alex reads
   `docs/reviews/2026-10-13-clarification-shape-measurement.md`.

## Acceptance Tests (EARS)

File `src/clarification-shape-prompt.test.ts`; names start `Clarification Shape P<n>` so
`npm run test:match -- "Clarification Shape P3"` runs one. Each builds the prompt with `buildGeneratePrompt`. A helper
extracts the 5-step list, the Full Draft block and the compressed "Must retain" line by their literal anchors and
throws unless each is found exactly once.

- **P1** WHEN the classification is clarification mode, THE SYSTEM SHALL include, in the extracted 5-step list, the
  step 3 SKIP marker, the one-sentence step 2 wording and the opening-anchor wording of step 1.
- **P2** WHEN the classification is clarification mode, THE SYSTEM SHALL state the clarification word range and
  sentence count, and SHALL NOT state "100-125", "125-145" or "145-165" in the Full Draft block.
- **P3** WHEN the classification is clarification mode, THE SYSTEM SHALL list "wedge, validation sentence" and "close"
  in the compressed "Must retain" line and SHALL NOT list "price".
- **P4** WHEN the classification is any case of the inventory other than clarification (the three committed
  baselines; quote near-misses `one_question` + resolved format and `quote` + `unresolved`; GigSalad; residency;
  `no_viable_scope`; graceful decline; sourced; hybrid; cultural), THE SYSTEM SHALL return a prompt whose SHA-256
  equals the pre-change hash, and the committed baselines SHALL stay byte-equal to their fixtures.
- **P5** WHEN the clarification prompt is built, THE SYSTEM SHALL equal the pre-change clarification prompt outside
  the three spans (the prompt with the three extracted spans removed hashes to the pre-change value).
- **P6** WHEN the clarification prompt is built, THE SYSTEM SHALL contain the Clarification Mode HARD CONSTRAINT block
  unchanged, byte for byte, including "Ask exactly ONE binary clarifying question" and "Do NOT state a price".
- **P7** WHEN `npm run test:match -- "Clarification V"` and `"Clarification Gate G"` run, THE SYSTEM SHALL pass
  unchanged (the validator and verify prompt are untouched).

Mutation map (each must fail the named test; recorded, not committed): the new text applied to every mode (P4); the
branch dropped (P1, P2, P3, P5); `price` left in "Must retain" (P3); old word range left (P2); step 3 SKIP removed
(P1); the HARD CONSTRAINT block edited (P6); the predicate `action` only, and `format_recommended` only (P4 near-
misses); a change outside the three spans (P5).

## The measurement (pre-registered)

Two arms, same runner, same ten leads (v1-v6 and h1-h4), `--runs 1` in five parallel processes each, 50 runs per arm:
arm A = the generate prompt before the change (current `HEAD`), arm B = after. The held-out leads h1-h4 are written
into the runner BEFORE arm B exists and before any output is read; none of the 8 structural drafts came from them.

| Observation (per arm, from the recorded fields) | Meaning | Action |
|---|---|---|
| Hard-condition rate in B at least 15 points below A, one-sided Fisher exact p < 0.10 | the instruction moved the draft | record; continue to code review |
| Hard-condition rate not lower by that margin | the instruction was ignored or insufficient | STOP; return to Alex; the next option is a reference reply (his words), not another wording round |
| No-draft rate in B more than 10 points above A | the change made drafts fail the validator | defect of this plan; revert D2 first |
| Any `pricing language` error in B | D3 or D1 pushed the model toward a price | read the draft; defect until explained |
| `verified` in B below A | shortening lost what the verifier wants | read `can_see_it` and opening failures; return to Alex |
| Word count: median of B within 70-110 | the length instruction was followed | report only; it does not gate |
| A non-clarification hash (P4) fails | regression | blocker before any run |

Each arm is reported with counts, the rate and a Wilson 95% interval; the comparison is labelled observational
(50 runs per arm, one model, made-up leads). The A arm is run FIRST, before the code step, so it cannot be tuned
against.

## Work steps (one concern per commit; failing test first)

1. h1-h4 added to the runner (no output read); arm A run and recorded (the baseline).
2. The pre-change SHA-256 inventory (P4, P5) from the CURRENT prompt, and P4 passing.
3. P1, P2, P3, P6 (failing), then the prompt change (all pass).
4. The mutation map; full suite, `tsc`, leak check.
5. Arm B run, and `docs/reviews/2026-10-13-clarification-shape-measurement.md` with the decision table filled in.

## Execution Path

- **Target:** Alex's MacBook, the real pipeline through `scripts/clarification-measure.ts`, real model, scratch
  databases under one output directory (nothing sent; `data/leads.db` untouched).
- **Mechanism:** the committed runner wraps the real model call, runs `runPipeline` per made-up lead, and records
  `ok`, `verified`, `gate_status`, `fail_reasons`, the final gate detail and `opening`, and (for B) the words of the
  final full draft.
- **Command (exact), from the repo root, once per arm (arm A BEFORE step 3, arm B after):**
  `OUT=$(mktemp -d /tmp/clar-shape-<arm>.XXXXXX); echo "$OUT"; for t in 1 2 3 4 5; do npx tsx scripts/clarification-measure.ts --runs 1 --tag <arm>$t --out "$OUT" --today 2026-10-12 & done; wait`
  with `<arm>` = `A` or `B`. Each process runs all ten leads once, with its own tag and scratch database
  (`$OUT/scratch-A1.db` ...); five processes make 50 runs per arm. About 25 minutes per arm; spend about 5 times an
  18-run set.
- **Prerequisites:** ALREADY HAVE (CHECKED 2026-10-13, used for four earlier runs): Node, `npm`, `tsx`;
  `ANTHROPIC_API_KEY` in `.env`; network. MUST OBTAIN: none. NONE other.
- **Output:** the ten JSON files per arm and each process's summary; recorded in
  `docs/reviews/2026-10-13-clarification-shape-measurement.md`.
- **Who:** Claude Code or Alex. **Trigger:** arm A after step 1, arm B after step 4.
- **Expected (a hypothesis until run):** the hard-condition rate falls from about 39% toward 20% or lower; a draft
  length near 100 words. What this does NOT show: that real leads behave the same.

## Feed-Forward

- **Hardest decision:** how to measure a modest change when two samples of the same prompt differ by 28 points
  (9 of 17 against 4 of 16): a two-arm, held-out, 50-run design, with the A arm taken before the change.
- **Rejected:** a length check in code; relaxing the verifier; a reference reply now (needs Alex's words); another
  18-run look.
- **Least confident:** that a shorter-reply instruction is followed. The prompt already says 100-125 words and 1 of
  33 drafts complied.

## Three Questions

1. **Hardest decision in this session?** Not claiming a number for the length range from the 2 verified drafts
   (132 and 145 words): they are longer than the proposal, and the data does not say that shorter passes.
2. **What did you reject, and why?** A code-side word limit (it ends in no draft), and tuning on the six leads I
   have already read (the four held-out leads exist for that).
3. **Least confident about going into the next phase?** That the instruction will be followed at all.
