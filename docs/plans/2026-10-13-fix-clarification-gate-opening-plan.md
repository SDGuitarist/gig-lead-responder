---
title: "fix: the verify gate's opening rule asks a vague lead's reply to cite a detail the lead never gave"
date: 2026-10-13
status: plan, Revision 1 (plan review R1 NO-GO, 4 P1 / 3 P2, all accepted and answered below; rewritten in place)
branch: feat/hub-phase0
---

# Clarification verify gate: scope the opening rule for a vague lead

### Prior Phase Risk

No brainstorm: skip gate, the input is two measurements with records
(`docs/reviews/2026-10-13-clarification-verify-measurement.md`, `...-clarification-gate-measurement.md`). The previous
plan's own "least confident" answer, quoted from `docs/plans/2026-10-13-fix-clarification-pricing-validator-plan.md`:
"an unmarked amount ... now passes. The re-run counts the vocabulary so it is visible, but 18 runs cannot rule it
out and nothing deterministic stops it." That risk is untouched here (this plan changes the verify prompt only). The
measurement's own limit carries over: 18 runs, one model, made-up leads, and `gate_status` is the verifier model's
judgment, so a prompt change moves it, it does not set it.

## Problem (measured, not assumed)

Clarification mode asks one binary question. After the price-validator fix, drafts reach the verify gate and **0 of 17
verified** (1 of 36 across two sets). The gate's rule (section 9 of `src/prompts/verify.ts`): cinematic scene,
competitor test false, no empty traceability, at least `GUT_CHECK_THRESHOLD` of `GUT_CHECK_TOTAL` gut checks true
(16 of 18; `competitor_test` is one of the 18 keys and passes when false), and a platform / sign-off check (section 8).
The runner records the final gate of each draft. Three separate signals, kept apart (answers R1 P1-1):

| Signal | What it shows | Drafts |
|---|---|---|
| Hard condition fails (scene `structural` 8, competitor test true 3; 2 overlap) | the gate's rule fails on its own terms | 9 (plan 2, not this plan) |
| Hard conditions pass, 3 or more other gut checks false | the gate's rule fails on its own terms | 2 |
| Hard conditions pass, at most 2 other gut checks false: **the boolean arithmetic passes** | the gate still failed | 6, split next |

The 6 whose arithmetic passes, by what else is visible in their final gate:

| Draft set | Count | Other signals |
|---|---|---|
| `lead_specific_opening` is the only false check and the only fail reason | **4** | none observed; all end with "Alex Guillen" (section 8 satisfied) |
| plus `sounds_like_alex` false (a voice judgment by the verifier) | 1 | `b v6` |
| plus code-side voice-kill violations ("land", "lands", "here's the thing") from `postCheckDrafts` (`src/pipeline/post-check.ts:143-144`), which fail the draft deterministically | 1 | `a v5` |

So the opening is the only observed cause in **4** drafts, a contributing cause in 2, and the opening was false in
17 of 17. What is NOT observed: whether the verifier weighed anything the booleans and reasons do not show (it
writes `gate_status` itself; `src/pipeline/verify.ts` copies it). This plan therefore expects at most 4 drafts to
move, and 6 only if the voice items also resolve, which this plan does not touch.

The cause of the opening failure: the generate prompt tells the model to build a sparse lead's scene "from the
experience, not the lead details"; the verify prompt (section 6b and the gut-check line) asks the first sentence to
reference "a concrete detail from the classification: event type, date, venue, format, cultural context". For a vague
lead the classification has none of date, venue or count, and the verifier's reason is "no date, venue, guest count,
format". The two prompts cannot both be satisfied.

## What is true today (read 2026-10-13)

- `buildVerifyPrompt` (`src/prompts/verify.ts`) computes `clarificationMode` (`action === "one_question"` and
  `format_recommended === "unresolved"`) at line 37 and already scopes three lines to it: `preempted_questions`,
  `budget_acknowledged`, `genre_default_stated`. `lead_specific_opening` and section 6b are not scoped.
- The prompt's other conditionals (the surface a snapshot must cover): `pricing.residency` (preempted_questions,
  budget_acknowledged, the residency rule), `delivery_mode` `alex_sources` / `hybrid` (section 7c), `graceful_decline`
  (7d), `platform === "gigsalad"` (section 8 and the section 9 line), and builder functions for budget, past date,
  mariachi pricing, cultural vocabulary, timeline and genre default.
- `gate_status` is copied from the verifier's JSON; only the always-fail prefixes and post-check violations override
  it. The code does not recompute the rule.
- No existing test pins the verify prompt for a non-clarification mode (the three prompt baselines are generate
  prompts); `src/verify-prompt.test.ts` has one test.
- `src/types.ts` comments `// 15` (total) and `// 13` (threshold) are stale: the total is 18 and the threshold 16.
  `scripts/clarification-measure.ts` (the runner I wrote) says "at least 12 of 14" in its comment at line 107 while
  its code uses `<= 2` false of 18.

## Decision

D1. In `buildVerifyPrompt`, when `clarificationMode`, replace section 6b and the `lead_specific_opening` gut-check
line with the clarification definition below; every other mode keeps today's text byte-for-byte.

The clarification definition, as it goes into the prompt (plan review may change the words, not the minimum anchor):

> This lead is vague: the form gave no date, venue, guest count or format, so the opening cannot cite them. The
> first sentence passes only if it repeats or restates a fact or an uncertainty the lead itself supplied: the
> occasion or event type the lead wrote (a birthday, a wedding, a party), the time frame the lead wrote (next month,
> this winter, spring), or the lead's own stated doubt ("not sure what kind of music"). References that could be said
> to any inquiry do NOT qualify: "your event", "this inquiry", "what you're looking for", "the right fit",
> "the right music", "what would work best". Deletion test: remove the words that came from this lead; if the
> sentence still works for any inquiry, lead_specific_opening = false.
> Pass: "You said live music next month and haven't picked a format yet, which is the right moment for one question."
> Fail (compliment): "What a wonderful way to celebrate!"
> Fail (generic acknowledgement): "You're looking for the right music for your event."

Why a generic opener cannot pass on "the format is still open" alone (R1 P1-2): the pass test requires a word that
came from THIS lead (the occasion, the time frame, or the lead's own doubt); the format being open is not a pass
route on its own, it only counts when the lead said it was unsure. The two fail examples are literal and pinned by G3.

D2. The gate's rule, threshold, every other check, the generate prompt, the validator, the post-check and
non-clarification prompts do not change. Two comment-only corrections ride as a separate commit: `src/types.ts`
(total 18, threshold 16) and `scripts/clarification-measure.ts` (16 of 18; the comment I wrote said 12 of 14).
Plus one runner addition: the opening (first sentence of the final full draft) is recorded per run, so the review of
verified drafts is mechanical (R1 P2-5).

D3. Not done, and why: relaxing `scene_type` (the 8 structural drafts really are essays;
`docs/reviews/2026-10-13-clarification-scene-drafts-reading.md`); recomputing `gate_status` in code from the booleans
(a new gate with its own failure modes; separate planned work); changing the generate prompt (plan 2); changing
`sounds_like_alex` or the voice-kill list.

## The snapshot inventory (answers R1 P1-3)

A committed snapshot of the verify prompt, generated from the CURRENT code before any change, for each
classification below. Each is a bounded toggle of one conditional or a predicate near-miss; the full cross product is
not claimed.

| # | Classification (made up) | What it toggles |
|---|---|---|
| S0 | clarification (`one_question`, `unresolved`), direct platform | the CHANGING mode, pre-change; used by G6 |
| S1 | quote, direct, `solo`, no budget | the baseline |
| S2 | quote, GigSalad | platform policy section 8 and section 9 line |
| S3 | residency (`pricing.residency` set) | residency rule |
| S4 | `no_viable_scope` budget tier | budget instruction |
| S5 | quote with `graceful_decline: true` | section 7d |
| S6 | quote, `delivery_mode: alex_sources` | section 7c |
| S7 | quote, `delivery_mode: hybrid` | section 7c |
| S8 | `one_question` with `format_recommended: solo` (predicate near-miss 1) | the mode predicate |
| S9 | `quote` with `format_recommended: unresolved` (predicate near-miss 2) | the mode predicate |
| S10 | quote with `cultural_context_active` | cultural vocabulary builder |

Snapshots are **intentionally stale on any unrelated edit** to `buildVerifyPrompt`: G2 fails, and the only way to
update them is a commit whose message begins `snapshot refresh:` with a reviewed diff of the prompt change that
caused it. The test header says so. Where the conditional is already exercised elsewhere (past date, mariachi), the
builder functions are not re-snapshotted separately: S1, S2 and S10 reach them through the baseline, and that is a
stated limit, not a claim.

## Plan Quality Gate

1. **What exactly is changing?** Two spans of `src/prompts/verify.ts` (section 6b and one gut-check line), for
   clarification mode only; a new `src/clarification-gate-prompt.test.ts`; eleven snapshot files under
   `src/fixtures/verify-prompt-baseline/`; two comments (`src/types.ts`, the runner); one runner field (`opening`).
2. **What must not change?** The verify prompt for every non-clarification mode (byte-equal to S1-S10); section 9 and
   section 8 text in every mode (byte-equal, G4); `GUT_CHECK_*`; `src/pipeline/verify.ts`; the generate prompt; the
   clarification validator; the rewrite loop; post-check; COI and payment lines.
3. **How will we know it worked?** EARS below, each with a named mutation; plus the 18-run re-run judged by the
   decision table below, not by "rises toward". Observational: 18 runs, one model, made-up leads.
4. **Most likely way this plan is wrong?** (a) The verifier fails the 4 for a reason the booleans do not show, and a
   scoped definition moves nothing: the decision table's row 2 stops the cycle and returns to Alex. (b) The scoped
   definition passes a generic opener: G3 pins two literal fail examples; the table's row 4 treats a generic opener
   in a verified draft as a failure of this plan. (c) The snapshots miss a branch: the inventory is bounded and its
   limit is stated.
5. **How will a human RUN this, and when?** Claude Code (or Alex) on the MacBook, after the code step and before the
   Codex code review, with the exact command in the Execution Path. Alex reads
   `docs/reviews/2026-10-13-clarification-gate-rerun.md`.

## Acceptance Tests (EARS)

File `src/clarification-gate-prompt.test.ts`; names start `Clarification Gate G<n>` so
`npm run test:match -- "Clarification Gate G3"` runs one. Each calls `buildVerifyPrompt`. A helper extracts a section
by its `### <n>.` heading up to the next `### ` heading; tests compare extracted sections, never whole-prompt
inequality.

- **G1** WHEN the classification is clarification mode, THE SYSTEM SHALL include, as the extracted section 6b and
  as the `lead_specific_opening` line, exactly the clarification definition, including the minimum-anchor sentence and
  the list of non-qualifying phrases ("your event", "this inquiry", "what you're looking for", "the right fit").
- **G2** WHEN the classification is any of S1-S10 (every non-clarification mode and both near-misses), THE SYSTEM
  SHALL return a prompt byte-equal to its committed snapshot, and SHALL NOT contain "does NOT qualify" or
  "do NOT qualify".
- **G3** WHEN the clarification prompt is built, THE SYSTEM SHALL carry both literal fail examples ("What a
  wonderful way to celebrate!" and "You're looking for the right music for your event.") and the pass example, and
  the deletion-test sentence.
- **G4** WHEN any prompt of S0-S10 or the new clarification prompt is built, THE SYSTEM SHALL contain a section 9
  block and a section 8 block byte-equal to the pre-change block of the same classification (extracted, whole block).
- **G5** WHEN the clarification prompt and S9 (`quote` + `unresolved`) are built, THE SYSTEM SHALL differ in the
  extracted section 6b and in the `lead_specific_opening` line, and S9's extracted 6b SHALL equal the pre-change text.
- **G6** WHEN the pre-change clarification snapshot S0 has its section 6b and its `lead_specific_opening` line
  replaced by the new definition, THE SYSTEM SHALL equal the new clarification prompt byte for byte (the change is
  exactly those two spans, nothing else).
- **G7** WHEN the classification is S8 (`one_question` + a resolved format) or S9 (`quote` + `unresolved`), THE
  SYSTEM SHALL NOT use the clarification definition (the predicate is both conditions, not either).

Positive controls: G1 and G6 are the clarification positive controls; G2 with S1 is the unchanged-behaviour control.
Negative controls: G3 (generic openers defined as fails) and G7 (near-misses stay on the old text).

Mutation map (each must fail the named test; recorded, not committed):

| Mutation | Fails |
|---|---|
| clarification text applied to every mode | G2, G5, G7 |
| the clarification branch dropped | G1, G6 |
| predicate `action === "one_question"` only (format ignored) | G7 (S8 passes through to new text) |
| predicate `format_recommended === "unresolved"` only | G7 (S9) |
| a fail example removed | G3 |
| the non-qualifying phrase list removed | G1 |
| the gut-check line left unscoped (6b changed only) | G1, G6 |
| one line of section 9 edited, substrings kept | G4 |
| section 8 edited | G4 |

## Decision table for the re-run (answers R1 P2-5)

"Candidates" are the 4 drafts above (opening is the only observed cause); the runner records, per run, the final
gate detail and the opening sentence `opening` (first sentence of the final full draft, split at the first `.`, `!`,
`?` or line break). Every verified draft's opening is read by Claude Code and listed in the record with a
pass/fail against the minimum anchor.

| Observation | Meaning | Action |
|---|---|---|
| A candidate-type run verifies | the scoped definition moved the verifier | record; continue to code review |
| Runs whose only false check was the opening still fail with `lead_specific_opening` false | the verifier does not follow the definition | STOP; return to Alex; no further wording round in this cycle |
| Runs fail with the opening true and only section 8, `sounds_like_alex` or other checks | another cause, outside this plan | record by name; feeds plan 2 or a voice item |
| Verified count above the 6 arithmetic-pass drafts' share (more than about 6 of 17, since scene and competitor failures are untouched) | the instrument or the definition is passing drafts it should not | read every verified draft; treat as a defect of this plan until explained |
| A verified draft's opening is generic by the minimum anchor | the definition is too loose | the plan failed; tighten or revert |
| Any non-clarification snapshot (G2) fails | regression | blocker |
| Zero verified, with openings now true in the gate detail | the opening was not the binding cause | record; return to Alex with the new fail reasons |

## Work steps (one concern per commit; failing test first)

1. Snapshots S0-S10 from the CURRENT code and G2 (and the extraction helper); confirm they pass.
2. G1, G3, G4, G5, G6, G7 (failing), then the prompt change (all pass).
3. The two comment corrections and the runner's `opening` field (one commit, a docs/script-only change).
4. The mutation map, run and recorded; full suite, `tsc`, leak check.
5. The 18-run re-run (Execution Path) and `docs/reviews/2026-10-13-clarification-gate-rerun.md` with the decision
   table filled in.

## Execution Path

- **Target:** Alex's MacBook, the real pipeline through `scripts/clarification-measure.ts`, real model, scratch
  databases under one output directory (nothing sent; `data/leads.db` untouched).
- **Mechanism:** the committed runner wraps the real model call, runs `runPipeline` for the six made-up vague leads,
  and records `verified`, `gate_status`, `fail_reasons`, the final gate detail and `opening` per run.
- **Command (exact), from the repo root:**
  `OUT=$(mktemp -d /tmp/clar-gate.XXXXXX); echo "$OUT"; for t in a b c; do npx tsx scripts/clarification-measure.ts --runs 1 --tag g$t --out "$OUT" --today 2026-10-12 & done; wait`
  All three processes write into the one `$OUT` directory; each has its own tag, so each has its own scratch
  database (`$OUT/scratch-ga.db`, `-gb.db`, `-gc.db`) and its own result file (`$OUT/clarification-ga.json` ...).
  About 9 minutes.
- **Prerequisites:** ALREADY HAVE (CHECKED 2026-10-13, used for both earlier runs): Node, `npm`, `tsx`;
  `ANTHROPIC_API_KEY` in `.env` (the script exits 2 if it is missing); network. MUST OBTAIN: none. NONE other.
- **Output:** the three JSON files and each process's summary; recorded in
  `docs/reviews/2026-10-13-clarification-gate-rerun.md` with the opening sentence of every verified draft.
- **Who:** Claude Code or Alex. **Trigger:** after step 4, before the Codex code review.
- **Expected (a hypothesis until run):** up to about 4 of 17 verify; the scene and competitor failures stay. What
  this does NOT show: that the gate is right for real leads; 18 runs, one model, made-up leads, one run per lead.

## Feed-Forward

- **Hardest decision:** whether to touch the verifier at all while 9 of 17 failures are a real generate-side gap, and
  how far to trust "the opening is the cause" when only 4 of 17 show it alone.
- **Rejected:** relaxing the scene check; computing the gate's pass in code; editing the generate prompt in this
  cycle; a broader "clarification gate" rewrite; claiming 6 of 17 will move.
- **Least confident:** that the verifier follows a scoped definition. `gate_status` is its judgment and the same
  drafts may fail for a reason the booleans do not show; the decision table's second row is written for that.

## Three Questions

1. **Hardest decision in this session?** Keeping the scene check as is after reading the 8 essays, and then
   shrinking my own bound from 6 to 4 when review showed two of the six had a second cause.
2. **What did you reject, and why?** Recomputing the gate in code (a new gate); relaxing `scene_type` (it was
   right); a definition that passes on "the format is still open" alone (it admits generic openers).
3. **Least confident about going into the next phase?** Whether scoping `lead_specific_opening` moves `gate_status`
   at all.
