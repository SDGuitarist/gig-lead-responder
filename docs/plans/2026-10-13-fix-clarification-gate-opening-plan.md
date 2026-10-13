---
title: "fix: the verify gate's opening rule asks a vague lead's reply to cite a detail the lead never gave"
date: 2026-10-13
status: plan, Revision 0 (not yet reviewed)
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
verified** (1 of 36 across two sets). Why, from the final gate of each draft:

| Cause | Drafts |
|---|---|
| Hard condition fails (scene `structural` 8, competitor test 3; 2 overlap) | 9 (plan 2, not this plan) |
| Hard conditions pass, at most 2 other checks false (the gate's stated rule passes it), the verifier failed it anyway | **6** (this plan) |
| 3 or more other checks false | 2 |

`lead_specific_opening` was false in **17 of 17** drafts and is the only false check in all 6 of the middle row. The
generate prompt tells the model to build a sparse lead's scene "from the experience, not the lead details"; the verify
prompt (section 6b and the gut-check line) asks the first sentence to reference "a concrete detail from the
classification: event type, date, venue, format, cultural context". For a vague lead there is none, so the two
prompts cannot both be satisfied, and the verifier's reason is "no date, venue, guest count, format".

## What is true today (read 2026-10-13)

- `buildVerifyPrompt` (`src/prompts/verify.ts`) computes `clarificationMode` (`action === "one_question"` and
  `format_recommended === "unresolved"`) at line 37 and already scopes three lines to it: `preempted_questions`,
  `budget_acknowledged`, `genre_default_stated`. `lead_specific_opening` and section 6b are not scoped.
- `gate_status` is copied from the verifier's JSON (`src/pipeline/verify.ts`); only the always-fail prefixes override
  it. The code does not recompute the rule. The rule: cinematic scene, competitor test false, no empty traceability,
  at least `GUT_CHECK_THRESHOLD` of `GUT_CHECK_TOTAL` true (16 of 18; the `// 15` and `// 13` comments in
  `src/types.ts` are stale).
- No existing test pins the verify prompt for a non-clarification mode byte-for-byte (the three prompt baselines are
  generate prompts). `src/verify-prompt.test.ts` has one test.
- The gate also feeds the rewrite loop: a failed draft is rewritten up to 3 times (each a generate plus a verify call).

## Decision

D1. In `buildVerifyPrompt`, when `clarificationMode`, replace section 6b and the `lead_specific_opening` gut-check
line with a clarification definition; every other mode keeps today's text byte-for-byte.

The clarification definition (exact words go in the prompt as written here, plan review may change them):

> This lead is vague: the form gave no date, venue, guest count or format, so the opening cannot cite them. The first
> sentence passes when it is tied to THIS inquiry by any of: the occasion or event type the lead named, the time frame
> the lead gave, what the lead asked for, or the fact that the format is still open (naming the vagueness itself).
> It fails only when it could open a reply to ANY inquiry: a generic congratulation or compliment with no tie to what
> this lead wrote. Deletion test: remove the words that tie it to this lead; if it still works for any inquiry,
> lead_specific_opening = false.
> Pass: "You said live music next month and haven't picked a format yet, which is the right moment for one question."
> Fail: "What a wonderful way to celebrate!"

D2. The gate's rule, threshold, every other check, the generate prompt, the validator, and non-clarification prompts
do not change. A comment-only correction of the stale `// 15` / `// 13` in `src/types.ts` (total 18, threshold 16)
rides in the same commit as a separate hunk.

D3. Not done, and why: relaxing `scene_type` (the 8 structural drafts really are essays;
`docs/reviews/2026-10-13-clarification-scene-drafts-reading.md`); recomputing `gate_status` in code from the booleans
(a new gate with its own failure modes; the measurement says the verifier's judgment, not the arithmetic, is the
issue; separate planned work); changing the generate prompt (plan 2).

## Plan Quality Gate

1. **What exactly is changing?** Two spans of `src/prompts/verify.ts` (section 6b and one gut-check line), for
   clarification mode only; a new `src/clarification-gate-prompt.test.ts`; one comment in `src/types.ts`; a committed
   baseline fixture of the verify prompt for three non-clarification leads.
2. **What must not change?** The verify prompt for every non-clarification mode (byte-equal to a snapshot taken before
   the change); `GUT_CHECK_*`; `src/pipeline/verify.ts`; the generate prompt; the clarification validator; the
   rewrite loop; post-check; COI and payment lines.
3. **How will we know it worked?** EARS below; plus the 18-run re-run: `verified` count, and for each unverified draft
   the final gate detail (the runner records it). Hypothesis: up to 6 of 17 verify; the other 11 fail on the scene or
   competitor test or several checks, which is plan 2. If the 6 still fail, the cause is not the opening and this
   plan returns to Alex before anything else is built.
4. **Most likely way this plan is wrong?** The verifier fails those 6 for a reason other than `lead_specific_opening`
   (it treats a gut check as blocking, or reads another part of section 9) and a scoped definition changes nothing.
   Or, the opposite: a scoped definition passes generic openings. Test G3 pins the fail example literally; the
   re-run counts verified drafts and the opener sentence of each is read, not only counted.
5. **How will a human RUN this, and when?** Claude Code (or Alex) on the MacBook, after the code step and before the
   Codex code review: the command in the Execution Path. Alex reads
   `docs/reviews/2026-10-13-clarification-gate-rerun.md`.

## Acceptance Tests (EARS)

File `src/clarification-gate-prompt.test.ts`; names start `Clarification Gate G<n>` so
`npm run test:match -- "Clarification Gate G3"` runs one. Each calls `buildVerifyPrompt`.

- **G1** WHEN the classification is clarification mode (`action: one_question`, `format_recommended: unresolved`),
  THE SYSTEM SHALL include the clarification definition of the lead-specificity check, and the sentence "naming the
  vagueness itself", and NOT the generic line "references a concrete detail from the classification (not generic)".
- **G2** WHEN the classification is any other mode (quote, residency, `no_viable_scope`, graceful decline), THE
  SYSTEM SHALL return a prompt byte-equal to the committed snapshot made before the change, and SHALL NOT contain the
  words "naming the vagueness itself".
- **G3** WHEN the clarification prompt is built, THE SYSTEM SHALL carry the literal fail example "What a wonderful way
  to celebrate!" and the deletion-test sentence, so a generic opener is still defined as a fail.
- **G4** WHEN a clarification prompt is built, THE SYSTEM SHALL still contain the gate rule text of section 9
  (cinematic scene, competitor test false, the threshold numbers) unchanged.
- **G5** WHEN the same lead's classification differs only in `action` (a quote), THE SYSTEM SHALL produce a different
  section 6b than clarification mode (the scope is the mode, not a keyword in the lead).

Mutation map (each must fail the named test; recorded, not committed): apply the clarification text to every mode
(G2, G5); drop the fail example (G3); drop the clarification branch (G1); edit section 9 (G4).

## Work steps (one concern per commit; failing test first)

1. Snapshot: write `src/fixtures/verify-prompt-baseline/` for three non-clarification classifications from the
   CURRENT code, and G2 against it; confirm it passes.
2. G1, G3, G5 (failing), then the prompt change (G1-G5 pass).
3. The stale comment in `src/types.ts`.
4. Mutation map; full suite, `tsc`, leak check.
5. The 18-run re-run and its record.

## Execution Path

- **Target:** Alex's MacBook, the real pipeline through `scripts/clarification-measure.ts`, real model, a scratch
  `DATABASE_PATH` under `--out` (nothing sent; `data/leads.db` untouched).
- **Mechanism:** the committed runner wraps the real model call, runs `runPipeline` for the six made-up vague leads,
  and records `verified`, `gate_status`, `fail_reasons` and the final gate detail per run.
- **Command (exact):** from the repo root, three processes in parallel (about 9 minutes):
  `for t in a b c; do npx tsx scripts/clarification-measure.ts --runs 1 --tag g$t --out <scratch> --today 2026-10-12 & done; wait`
- **Prerequisites (CHECKED 2026-10-13):** Node, `npm`, `tsx`; `ANTHROPIC_API_KEY` in `.env`; network. Nothing else.
- **Output:** `<out>/clarification-g{a,b,c}.json` and a summary; recorded in
  `docs/reviews/2026-10-13-clarification-gate-rerun.md` with the opener sentence of every verified draft.
- **Who:** Claude Code or Alex. **Trigger:** after step 4, before the Codex code review.
- **Expected (a hypothesis until run):** `verified` rises from 0 of 17 toward at most 6; the scene and competitor
  failures stay. What this does NOT show: that the gate is right for real leads; 18 runs, one model, made-up leads.

## Feed-Forward

- **Hardest decision:** whether to touch the verifier at all while 9 of 17 failures are a real generate-side gap.
  The 6 are a real disagreement between two prompts, and scoping it is the same move the prompt already makes three
  times; the 9 are left for plan 2 and not hidden.
- **Rejected:** relaxing the scene check; computing the gate's pass in code; editing the generate prompt in this
  cycle; a broader "clarification gate" rewrite.
- **Least confident:** that the verifier will pass the 6 once the definition is scoped; `gate_status` is its
  judgment, and the same drafts may fail on another reason the booleans do not show.

## Three Questions

1. **Hardest decision in this session?** Keeping the scene check as is after reading the 8 essays.
2. **What did you reject, and why?** Recomputing the gate in code (a new gate); relaxing `scene_type` (it was right).
3. **Least confident about going into the next phase?** Whether scoping `lead_specific_opening` moves `gate_status`
   at all.
