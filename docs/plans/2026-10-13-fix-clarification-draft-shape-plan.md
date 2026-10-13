---
title: "fix: clarification-mode drafts are written as explanatory essays; the generate prompt asks for steps a vague lead has nothing to fill"
date: 2026-10-13
status: plan, Revision 1 (plan review R1 NO-GO, 2 P1 / 3 P2 / 1 P3, all accepted and answered below; rewritten in place)
branch: feat/hub-phase0
---

# Clarification generate prompt: ask for a short reply, not a five-step essay

### Prior Phase Risk

Predecessor: `docs/plans/2026-10-13-fix-clarification-gate-opening-plan.md` (plan 1, built and reviewed to the cap).
Its "least confident" answer, quoted from `docs/solutions/architecture/2026-10-13-verify-gate-asked-a-vague-lead-for-a-detail-it-never-gave.md`:
"that two verified drafts generalise. The next measurement is plan 2's, and the same runner records `verified` and
the opening for each run." This plan accepts it and answers it with a larger two-arm measurement rather than another
18-run look, because the two 18-run sets with the SAME generate prompt gave a hard-condition fail rate of 9 of 17
and 4 of 16: one 18-run set cannot show a modest improvement.

## Problem (measured, not assumed)

After plan 1, a clarification draft's remaining blockers are generate-side. Over the two 18-run sets (36 runs, 33
drafts, same generate prompt, `docs/reviews/2026-10-13-clarification-gate-measurement.md` and
`...-clarification-gate-rerun.md`):

| Measured | Value |
|---|---|
| Runs that end in no draft (`GenerationError`) | 3 of 36 (1 and 2) |
| Hard-condition failures among the 33 returned drafts (scene `structural` 11, competitor test true 4, 2 overlap) | **13 of 33 (39%)**; 9 of 17 in one set, 4 of 16 in the other |
| Runs that do NOT yield a draft clearing the hard conditions (no draft or a hard-condition failure) | **16 of 36 (44%)** |
| Full drafts within the stated 100-125 words | 1 of 33 (min 124, median 150, max 212); 11 of 33 within 145 |
| The stock question quoted verbatim | 20 of 33 |
| Drafts with an empty concern-traceability entry | 0 of 33 |
| `verified` | 2 of 33 (0 of 17, then 2 of 16 after plan 1) |

The 8 structural-scene drafts of the first set were read (`...-clarification-scene-drafts-reading.md`): all explain
why format matters instead of showing a moment; 4 use a "most vendors guess" contrast (the competitor-test fails).

## What is true today (read 2026-10-13, `src/prompts/generate.ts`)

In clarification mode (`action === "one_question"` and `format_recommended === "unresolved"`) the prompt still says:

1. The 5-step sequence (lines 102-118): step 1 cinematic hook, **step 2 differentiator + named fear, step 3 fear/concern
   resolution ("every explicit AND inferred question answered")**, step 4 recommendation + price (marked "SKIP in
   clarification mode"), step 5 the CTA, which is the one binary question. Only step 4 is marked skipped.
2. The compressed draft "Must retain: wedge, validation sentence, at least one fear resolution, **price**, close"
   (line 313): `price` is dropped only for a residency that states none. In clarification mode the same prompt says
   "Do NOT state a price, rate, anchor, floor, or package" (line 284). A direct contradiction.
3. The full draft word count is the generic 100-125 (premium 125-145, cultural 145-165): written for a quote with a
   price, logistics and terms. Nothing in code enforces it (`compressed_word_count` is computed, not checked), and
   none should: a length failure would add no-draft runs.
4. The prompt separately requires every flagged concern to be addressed (lines 190-192: "Address each flagged
   concern") and the verifier fails a draft whose traceability entry has an empty sentence (verify section 3).
   Clarification leads can carry a flagged concern ("vague format request"). Step 3 is where the prompt asks for it.
5. The FORCING RULE (line 350) already requires the first sentence to contain a concrete detail from the lead; the
   Sparse-lead scene strategy says to build the scene from the experience, not the lead details.
6. The stock question appears twice (Type 4 "Default question" and the Clarification Mode "Good" example).

The verify prompt is not changed here (plan 1).

## Decision

D1. In clarification mode only, change the 5-step text:
- **Step 1** keeps the FORCING RULE and is stated to open with "a fact or an uncertainty the lead supplied" (the
  wording plan 1 gave the verifier; it is not literal word reuse), so the two prompts agree.
- **Step 2** becomes ONE sentence naming the specific thing that goes wrong when the format is chosen blind, plus what
  Alex does instead (the named-fear and differentiated checks), with no "most vendors" contrast.
- **Step 3 is KEPT, made lightweight** (answers R1 P1-1): "ONE sentence that answers every flagged concern together,
  bundled as the Type 3 rule does, no explanation beyond it". It is the sentence the traceability check will find.
  It is NOT marked skipped.
- Step 4 is unchanged ("SKIP in clarification mode"); step 5 is unchanged (the one binary question).

D2. In clarification mode only, replace the word-count line with ONE range and a sentence count: **70 to 100 words,
4 to 6 sentences** (answers R1 P2-4; used identically in P2, the decision table and Expected). These numbers are a
HYPOTHESIS to be measured, not a result: the two verified drafts are 132 and 145 words, so the data does not say
shorter passes.

D3. In clarification mode only, drop `price` from the compressed draft's "Must retain" list (item 2 above), exactly
as the residency branch already does.

D4. Not done, and why:
- relaxing `scene_type` or `competitor_test` in the verifier (the 8 structural drafts were essays; plan 1 settled it);
- a code check on word count (a new way to end with no draft);
- rewriting the stock question or the Type 4 default (a voice choice that is Alex's; recorded as an observation: 20
  of 33 drafts quote it);
- a reference clarification reply in Alex's voice (needs his exact words; held as option A for a later cycle only if
  this change does not move the primary rate);
- any change to the validator, the verify prompt, post-check, COI or payment lines.

## The invariant, stated exactly

This change makes the clarification prompt consistent with itself and shorter by instruction, and keeps concern
coverage. It does NOT guarantee a short, cinematic draft: the model may still write an essay. Nothing deterministic
enforces shape; the verifier and the two-arm measurement are the only checks, and both are model-dependent.

## Plan Quality Gate

1. **What exactly is changing?** Three spans of `buildGeneratePrompt` for clarification mode only (steps 1-3 text,
   the word-count line, the compressed "Must retain" line); a new `src/clarification-shape-prompt.test.ts`; a hash
   fixture and its generator; four held-out leads and an arm manifest in the runner; one record under `docs/reviews/`.
2. **What must not change?** The generate prompt for every non-clarification mode (the three committed baselines stay
   byte-equal; the hash inventory below); the Clarification Mode HARD CONSTRAINT text; the Concern Traceability
   block; the validator (V1-V11 unchanged); the verify prompt (G0-G8 unchanged); post-check; COI and payment lines;
   T4 withholding.
3. **How will we know it worked?** EARS below with a mutation for each; plus the two-arm measurement (arm A before
   the change, arm B after, each with a recorded manifest). Primary estimand: below. Exploratory: 50 runs per arm,
   one model, made-up leads.
4. **Most likely way this plan is wrong?** (a) The model ignores a shorter-reply instruction as it ignored 100-125
   (1 of 33 followed it): then the primary rate does not move, and the answer is option A (a reference reply, Alex's
   words), not a third wording round. (b) Shortening drops the one specific image the verifier wants and raises
   `can_see_it` failures, or the bundled step 3 sentence fails traceability: the guard table reports both.
5. **How will a human RUN this, and when?** Claude Code (or Alex) on the MacBook, after the code step and before the
   Codex code review: the two commands in the Execution Path. Alex reads
   `docs/reviews/2026-10-13-clarification-shape-measurement.md`.

## Acceptance Tests (EARS)

File `src/clarification-shape-prompt.test.ts`; names start `Clarification Shape P<n>` so
`npm run test:match -- "Clarification Shape P3"` runs one. Each builds the prompt with `buildGeneratePrompt`.

Span extractors (`spanOf`, in a test-support module): three spans, each found by literal anchors and the extractor
throws unless each anchor appears exactly once. Span 1 = from the line beginning `1. **` through the line before the
line beginning `4. **` (the 5-step list, steps 1-3). Span 2 = the line beginning `- Word count:`. Span 3 = the line
beginning `- Must retain:`.

- **P1** WHEN the classification is clarification mode, THE SYSTEM SHALL include, in span 1, the step 1 opening-anchor
  wording ("a fact or an uncertainty the lead supplied"), the one-sentence step 2 wording, and the bundled step 3
  wording, and SHALL NOT contain "SKIP" on step 3.
- **P2** WHEN the classification is clarification mode, THE SYSTEM SHALL state "70 to 100 words" and "4 to 6
  sentences" in span 2 and SHALL NOT state "100-125", "125-145" or "145-165" there.
- **P3** WHEN the classification is clarification mode, THE SYSTEM SHALL list "wedge, validation sentence" and "close"
  in span 3 and SHALL NOT list "price".
- **P4** WHEN the classification is any case of the inventory below other than C0 (clarification), THE SYSTEM SHALL
  return a prompt whose SHA-256 equals the pre-change hash stored in `src/fixtures/generate-prompt-hashes.json`, and
  the three committed baselines SHALL stay byte-equal to their fixtures.
- **P5** WHEN the clarification prompt is built, THE SYSTEM SHALL equal the pre-change clarification prompt outside
  the three spans: the prompt with spans 1-3 removed hashes to the pre-change value stored in the same file.
- **P5a (positive control)** WHEN text inside any of spans 1-3 is edited, THE SYSTEM SHALL leave the span-removed
  hash unchanged. **P5b (negative control)** WHEN text outside the spans is edited (a line of the HARD CONSTRAINT
  block, a line of the Concern Traceability block), P5 SHALL fail. **P5c** WHEN an anchor appears zero or two times,
  `spanOf` SHALL throw.
- **P6** WHEN the clarification prompt is built, THE SYSTEM SHALL contain the Clarification Mode HARD CONSTRAINT block
  unchanged, byte for byte, including "Ask exactly ONE binary clarifying question" and "Do NOT state a price".
- **P7** WHEN `npm run test:match -- "Clarification V"` and `"Clarification Gate G"` run, THE SYSTEM SHALL pass
  unchanged (the validator and verify prompt are untouched).
- **P8** WHEN the clarification classification has a flagged concern, THE SYSTEM SHALL contain "Address each flagged
  concern: <the concern>" (the Concern Traceability block) AND the bundled step 3 sentence instruction, so a
  traceable sentence is requested.

### The hash inventory (answers R1 P2-5)

Stored in `src/fixtures/generate-prompt-hashes.json` as `{ "<id>": "<sha256 of the full prompt>" }`, produced by
`scripts/snapshot-generate-prompts.ts` from the CURRENT code before any change. No prompt text is stored (the prompt
carries private venue text the leak check forbids in a new file). Inputs: the classification inventory of
`src/verify-prompt-cases.ts` (S0-S12) with one fixed `PricingResult` per budget tier case, giving: C0 clarification;
C1 quote baseline; C2 GigSalad; C3 residency; C4 `no_viable_scope`; C5 graceful decline; C6 `alex_sources`; C7
`hybrid`; C8 `one_question` + resolved format (near-miss); C9 `quote` + `unresolved` format (near-miss); C10 cultural
context; C11 past date; C12 dual-format concern. Plus the three committed baselines
(`src/fixtures/prompt-baseline/{direct-t3-wedding,gigsalad-t2-party,np2-nonprofit}.txt` via
`src/fixtures/prompt-baseline-inputs.json`; their existing tests stay unchanged).

**Refresh rule:** the hashes are intentionally stale on any unrelated edit to the generate prompt, and P4 then fails.
They change only in a commit whose message begins `snapshot refresh:` and shows the prompt diff that caused it; the
test header says so. The hashes do not prove what text changed, only that it did.

Mutation map (each must fail the named test; recorded, not committed): the new text applied to every mode (P4); the
branch dropped (P1, P2, P3, P5); `price` left in "Must retain" (P3); old word range left (P2); step 3 marked SKIP or
removed (P1, P8); the HARD CONSTRAINT block edited (P6, P5); the predicate `action` only, and `format_recommended`
only (P4 via C8, C9); a change outside the three spans (P5, P5b); the extractor anchored on a non-unique line (P5c).

## The measurement (pre-registered)

**Arms.** A = the generate prompt before the change (the commit before step 3); B = after. Same runner, same ten leads
(v1-v6 and held-out h1-h4), `--runs 1` in five parallel processes per arm, 50 runs per arm.

**Arm manifest (answers R1 P1-2).** The runner gains `--arm <A|B>` and writes into every result file a `manifest`:
`arm`, `gitSha` (`git rev-parse HEAD`), `dirtyPromptFiles` (`git status --porcelain src/prompts src/pipeline`),
`promptSha256` (SHA-256 of the clarification-mode generate prompt for a fixed probe classification, the same
function the hash inventory uses), `models` (the distinct `request.model` values seen), `today`, `leadSetSha256`
(over the ordered lead texts), `node`. The measurement record prints all ten manifests and checks, mechanically:
all five A manifests are identical in every field except the process tag; the same for B; `promptSha256` of A equals
the pre-change clarification hash in the fixture and B's differs from it and equals the post-change value;
`gitSha` of A is an ancestor of B's; `models`, `today` and `leadSetSha256` are equal across arms; `dirtyPromptFiles`
is empty. Any failure voids the comparison; the record says so.

**Held-out leads (answers R1 P1-2, last point).** h1-h4 are written and committed into the runner in step 1, before
the change exists. Arm A's per-run drafts for h1-h4 are NOT read before the change is committed: the analysis prints
only aggregate counts for them. That is procedural and self-attested (nothing prevents a read); the manifest proves
identity, not exposure, and the record states it.

**Estimand (answers R1 P2-3).** Primary: the **unusable-run rate** = the share of ALL 50 runs that do not yield a
draft with scene `cinematic` and `competitor_test` false (a no-draft run and a hard-condition failure both count as
unusable). The denominator is fixed at 50, so a change in the no-draft rate cannot hide inside it. Secondary
(reported, not gating): the hard-condition rate among returned drafts; `verified`; the word count of the final full
draft; the opening.

**Power, stated honestly.** The baseline unusable rate from the two earlier sets is 16 of 36 (44%). With 50 runs per
arm and a one-sided test at 0.10, power is about 60% for a 15-point drop (44% to 29%) and about 90% for a 25-point
drop. A real 15-point improvement would be missed about 4 times in 10. The measurement is therefore EXPLORATORY: it
can show a large effect; a null result does not show there is none.

| Observation (per arm, from the recorded fields) | Meaning | Action |
|---|---|---|
| The manifest check fails | the comparison is void | stop; fix the procedure; re-run the affected arm |
| B's unusable-run rate at least 15 points below A, one-sided Fisher exact p < 0.10 (exploratory rule) | the instruction moved the draft | record; continue to code review |
| Not lower by that margin | the instruction was ignored or insufficient (or the effect is below what 50 runs can see) | STOP; return to Alex; the next option is a reference reply (his words), not another wording round |
| No-draft rate in B more than 10 points above A | the change made drafts fail the validator | defect of this plan; revert D2 first |
| Any `pricing language` error in B | D3 or D1 pushed the model toward a price | read the draft; defect until explained |
| Any returned draft in B with an empty concern-traceability entry that A did not have at that rate | the bundled step 3 sentence is not doing its job | read the draft; return to Alex |
| `verified` in B below A | shortening lost what the verifier wants | read `can_see_it` and opening failures; return to Alex |
| Median words of B's full drafts within 70-100 | the length instruction was followed | report only; it does not gate |
| A non-clarification hash (P4) fails | regression | blocker before any run |

Each arm is reported with counts, the rate and a Wilson 95% interval; the comparison is labelled exploratory and
observational (50 runs per arm, one model, made-up leads). Arm A is run FIRST, before the code step, so it cannot be
tuned against.

## Work steps (one concern per commit; failing test first)

1. The runner: `--arm`, the manifest, and h1-h4 (one commit; no output read).
2. The hash inventory (generator, fixture, P4 and P5 with their controls) from the CURRENT prompt; confirm it passes.
3. Arm A run and recorded (the baseline), manifest checked.
4. P1, P2, P3, P6, P8 (failing), then the prompt change (all pass).
5. The mutation map; full suite, `tsc`, leak check.
6. Arm B run, and `docs/reviews/2026-10-13-clarification-shape-measurement.md` with the decision table filled in.

## Execution Path

- **Target:** Alex's MacBook, the real pipeline through `scripts/clarification-measure.ts`, real model, scratch
  databases under one output directory (nothing sent; `data/leads.db` untouched).
- **Mechanism:** the committed runner wraps the real model call, runs `runPipeline` per made-up lead, and records
  `ok`, `verified`, `gate_status`, `fail_reasons`, the final gate detail, `opening`, the final full draft's word
  count, and the manifest.
- **Command (exact), from the repo root, once per arm (arm A BEFORE step 4, arm B after):**
  `OUT=$(mktemp -d /tmp/clar-shape-<arm>.XXXXXX); echo "$OUT"; for t in 1 2 3 4 5; do npx tsx scripts/clarification-measure.ts --arm <arm> --runs 1 --tag <arm>$t --out "$OUT" --today 2026-10-12 & done; wait`
  with `<arm>` = `A` or `B`. Each process runs all ten leads once, with its own tag and scratch database
  (`$OUT/scratch-A1.db` ...); five processes make 50 runs per arm. About 25 minutes per arm; spend about 5 times an
  18-run set.
- **Prerequisites:** ALREADY HAVE (CHECKED 2026-10-13, used for four earlier runs): Node, `npm`, `tsx`;
  `ANTHROPIC_API_KEY` in `.env`; network. MUST OBTAIN: none. NONE other.
- **Output:** the ten JSON files per arm and each process's summary; recorded in
  `docs/reviews/2026-10-13-clarification-shape-measurement.md` with the manifest check.
- **Who:** Claude Code or Alex. **Trigger:** arm A after step 2, arm B after step 5.
- **Expected (a hypothesis until run):** the unusable-run rate falls from about 44% toward 25% or lower, and the
  median full draft moves toward 70-100 words. What this does NOT show: that real leads behave the same, or that a
  smaller effect than the power allows is absent.

## Feed-Forward

- **Hardest decision:** how to measure a modest change when two samples of the same prompt differ by 28 points: a
  two-arm, held-out, fixed-denominator design with a recorded manifest, and an honest 60% power.
- **Rejected:** a length check in code; relaxing the verifier; a reference reply now (needs Alex's words); skipping
  step 3 outright (it would drop concern traceability); another 18-run look.
- **Least confident:** that a shorter-reply instruction is followed. The prompt already says 100-125 words and 1 of
  33 drafts complied.

## Three Questions

1. **Hardest decision in this session?** Not claiming a number for the length range from the 2 verified drafts
   (132 and 145 words): they are longer than the proposal, and the data does not say that shorter passes.
2. **What did you reject, and why?** A code-side word limit (it ends in no draft); skipping step 3 (review showed it
   removes the only dedicated place for the concern the verifier traces); tuning on the six leads already read.
3. **Least confident about going into the next phase?** That the instruction will be followed at all, and that 50
   runs per arm can see an effect of 15 points.
