---
title: "fix: the verify gate's opening rule asks a quoted vague lead's reply to cite a detail the lead never gave"
date: 2026-10-14
status: plan, Revision 0 (not plan-reviewed; one open decision for Alex)
branch: feat/hub-phase0
---

# Vague-lead quote: scope the verify opening rule to the mode the route created

### Prior Phase Risk

No brainstorm: skip gate, the input is a measurement with a record
(`docs/reviews/2026-10-14-vague-quote-false-checks.md`). The previous phase's "least confident" answer, quoted from
`docs/solutions/architecture/2026-10-14-vague-lead-quote-route-default-in-code-and-the-gate-it-left-behind.md`:
"that the verify-gate opening rule is the whole reason 40 of 50 drafts failed; I read counts and two reasons, and
have not run the verifier with the rule changed." This plan makes that run the first thing it measures.

## Problem (measured, not assumed)

The vague-lead route quotes a default format (`solo`/`duo`) with one question. Of 50 runs on the final prompt (`2aa57e1`),
10 verified; of the 40 that did not, 33 have `lead_specific_opening` false (`competitor_test` excluded from the false
list) and 17 fail on it alone (15 with nothing else false, 2 where the same generic opener also set `competitor_test`
true). The earlier arm: 24 of 30. Plan 1 (`2026-10-13-fix-clarification-gate-opening-plan.md`) fixed this defect for
clarification mode, whose predicate is `action === "one_question" && format_recommended === "unresolved"`. The route
gives these leads a default format, so they left that predicate and the strict rule ("references a CONCRETE DETAIL from
the classification") applies again to a lead with no detail.

## What is true today (read 2026-10-14)

- `src/prompts/verify.ts:60` `clarificationMode` selects `CLARIFICATION_LEAD_SPECIFICITY` (section 6b), the
  `lead_specific_opening` line, and also `preempted_questions`, `budget_acknowledged`, `genre_default_stated` (those
  three say "does not quote yet" / "defer genre"; WRONG for a quoted lead, so they must NOT move).
- S8 in `src/verify-prompt-cases.ts` is `one_question` + `vague` + `solo`: it is the changing mode, not a near-miss any more.
- `genre_default_stated` already reads `vagueness === "vague"` (`verify.ts:297`), so `vagueness` cannot be forced to
  `clear` to reproduce the old prompt in a replay (it would move that line too).
- Verified 20 vs 10 of 50 across two samples of nearly the same prompt: the verifier and the generator are noisy, so an
  unpaired before/after comparison cannot separate the rule from variation.

## Decision

D1. **A new mode, `vagueQuoteMode`** = `action === "one_question" && vagueness === "vague" && format_recommended !== "unresolved"`.
Only section 6b and the `lead_specific_opening` line switch to a new text, `VAGUE_QUOTE_LEAD_SPECIFICITY`. The other
three clarification lines, the whole of section 8 and 9, `GUT_CHECK_*`, and every other mode are unchanged
byte-for-byte. The text (review may change the words, not the anchor):

> This lead is vague and its format was assumed: the form gave no date, venue or guest count, so the opening cannot cite
> them. The first sentence passes only if it repeats or restates a fact or an uncertainty the lead itself supplied: the
> occasion or event type the lead wrote, the time frame the lead wrote, or the lead's own stated doubt ("not sure what
> kind of music"). The assumed format ("solo guitar") is NOT a fact the lead supplied. References that could be said to
> any inquiry do NOT qualify: "your event", "this inquiry", "what you're looking for", "the right fit", "the right
> music", "what would work best". Deletion test: remove the words that came from this lead; if the sentence still
> works for any inquiry, lead_specific_opening = false.
> Pass: "Your mom's birthday, and you're not sure what kind of music: that is the right place for one question."
> Fail (compliment): "What a wonderful way to celebrate!"
> Fail (generic acknowledgement): "You're looking for the right music for your event."
> Fail (assumed format only): "A solo guitarist is a lovely way to set the tone."

D2. **A measurement seam, not a production switch.** `buildVerifyPrompt(classification, pricing, options?)` gains an
optional third argument `{ openingRule?: "default" }`; when `"default"` the vague-quote mode is ignored and today's
strict text is used. Production never passes it (the only caller of the 3-argument form is the measurement script);
a test pins that the two-argument and the `{}` call are identical and that `"default"` on a non-vague-quote lead
changes nothing. This lets one set of drafts be verified under both rules (a paired comparison).

D3. **Scope is `one_question` only, by evidence.** The 50 runs are all `one_question` leads. An `assume_and_quote`
lead that is also `vague` (Vague + Medium/High competition) probably has the same defect; this plan does NOT include
it because no run covers it. **Decision for Alex:** include `assume_and_quote`+`vague` now (wider, unmeasured) or leave
it for a measured follow-up (recommended).

D4. **Not done, and why:** relaxing `scene_type` or `competitor_test`; recomputing `gate_status` in code; editing the
generate prompt (length 203 words, copying: separate items); touching the three other clarification lines;
changing the router (it still holds every vague `one_question` lead for Alex).

## The snapshot inventory

Snapshots S0-S12 exist (plan 1). **S8 changes by design** (refreshed in a `snapshot refresh:` commit with the prompt
diff). Added by this plan: **S13** `one_question`+`vague`+`duo` (the duo branch of the mode), **S14**
`assume_and_quote`+`vague`+`solo` (near-miss: must equal today's text if D3 is "leave"), **S15**
`one_question`+`clear`+`solo` (near-miss: vagueness clear). S0 (clarification) and S1-S7, S9-S12 must be byte-equal
outside the voice block (G8 pin unchanged).

## Plan Quality Gate

1. **What exactly is changing?** Two spans of `src/prompts/verify.ts` for `vagueQuoteMode` plus the optional third
   argument; three new snapshots and one refreshed (S8); a new `src/vague-gate-prompt.test.ts`; the runner stores
   `classification` and `pricing` per run and re-verifies each draft under the default rule; a controls script.
2. **What must not change?** Every other mode's verify prompt (G2 pattern); clarification mode's text; section 8 and 9;
   `GUT_CHECK_*`; `src/pipeline/verify.ts`; the generate prompt; the voice block hash; the router hold.
3. **How will we know it worked?** EARS below, each with a named mutation; plus the paired arm and the controls
   judged by the decision table, not by "rises toward". Observational: 50 runs + 20 control verifies, one model,
   made-up leads.
4. **Most likely way this plan is wrong?** (a) The rule is loosened so a generic opener passes: the planted controls
   exist to catch exactly that, and a verified draft's opening is listed mechanically. (b) 17 is not the ceiling:
   16 more fail on the opening plus other checks (`can_see_it`, `sounds_like_alex`); fixing the opening may move
   fewer than 17 and the gate may still fail 80%: the table's "gain below 8" row stops the cycle. (c) The verifier
   ignores the scoped text, as plan 1's Feed-Forward feared.
5. **How will a human RUN this, and when?** Claude Code (or Alex) on the MacBook, after the code and its Codex code
   review, with the command in the Execution Path. Alex reads
   `docs/reviews/2026-10-14-vague-gate-measurement.md`.

## Acceptance Tests (EARS)

File `src/vague-gate-prompt.test.ts`; names start `Vague Gate VG<n>`; reuse `sectionOf` and the snapshot helpers of
`src/clarification-gate-prompt.test.ts`.

- **VG1** WHEN the classification is `one_question`, `vague`, format `solo` or `duo`, THE SYSTEM SHALL include as
  section 6b and as the `lead_specific_opening` line exactly the vague-quote definition, with all four literal
  examples and the sentence "The assumed format ... is NOT a fact the lead supplied".
- **VG2** WHEN the classification is S0-S7 or S9-S12 or S14-S15, THE SYSTEM SHALL return a prompt byte-equal to its
  snapshot outside the voice block, and SHALL NOT contain "its format was assumed".
- **VG3** WHEN the prompt is built for S8 or S13, THE SYSTEM SHALL keep `preempted_questions`, `budget_acknowledged`
  and `genre_default_stated` equal to the quote-mode text (the three lines are not the clarification lines).
- **VG4** WHEN `buildVerifyPrompt(c, p, { openingRule: "default" })` is called for S8, THE SYSTEM SHALL equal the
  PRE-change S8 snapshot; for every other case the third argument SHALL change nothing; a call with no third argument
  SHALL equal a call with `{}`.
- **VG5** WHEN the clarification prompt (S0) is built, THE SYSTEM SHALL still equal plan 1's text (the vague-quote
  text SHALL NOT leak into clarification mode).
- **VG6** WHEN any case's prompt is built, THE SYSTEM SHALL carry a voice block whose SHA-256 equals the pinned value.
- **VG7** The change is exactly the two spans: pre-change S8 with the two spans replaced equals the new S8.

Mutation map (each run, each must fail exactly its own test): mode predicate drops `vagueness`; mode drops the
`!== "unresolved"` clause; the seam ignored; the three lines moved into the mode; the assumed-format sentence removed;
a fail example removed; the mode also applied to `assume_and_quote`.

## Decision table for the measurement (pre-registered)

Arm: 5 processes x 10 leads (the 50 runs of the route plan), the real pipeline on the NEW prompt, each final draft
re-verified under `openingRule: "default"` in the same process; plus the controls: 5 planted generic and 5 planted
specific openings on a fixed made-up lead, each verified twice (20 verifies). Counts only.

| Observation | Meaning | Action |
|---|---|---|
| controls: a generic opening passes `lead_specific_opening` in 3 or more of 10 verifies, or a specific one fails in 3 or more of 10 | the new rule is loose (or too tight) | STOP; revert the prompt change; return to Alex |
| controls ok AND new-rule verified exceeds default-rule verified by 8 or more (of the same 50 drafts), and every newly verified opening listed passes a manual deletion test | the opening rule is a main cause and the scoped rule holds | proceed to code review, compound |
| controls ok AND the gain is below 8 | the rule is not the whole story (`can_see_it`, `sounds_like_alex`, structural scene remain) | STOP; record the other failures; return to Alex |
| controls ok AND a newly verified draft has a generic opening | the verifier did not follow the text | STOP; that is a failure of this plan |

8 is half of the 17 opening-only drafts (a ceiling of 17 is not expected); this is a threshold set before the run.

## Work steps (one concern per commit; failing test first)

0. **HARD STOP:** plan review R1 and Alex's D3 decision. No production code before.
1. Snapshots S13-S15 from the CURRENT code; VG2 passes.
2. VG1, VG3-VG7 failing, then the prompt change and the seam; all pass; S8 refreshed in a `snapshot refresh:` commit.
3. Runner: store `classification` and `pricing`; the paired re-verify; the controls script (docs/script-only).
4. Mutation map run and recorded; full suite, `tsc`, leak check.
5. Codex code review (one run per round).
6. The measurement arm and `docs/reviews/2026-10-14-vague-gate-measurement.md` with the table filled in.

## Execution Path

- **Target:** Alex's MacBook, `scripts/clarification-measure.ts --arm B --probe C8` (extended in step 3) and
  `scripts/vague-gate-controls.ts`, real model, scratch databases, nothing sent.
- **Mechanism:** the committed runner wraps the real model call, runs `runPipeline` for the ten made-up vague leads on
  the new prompt, re-verifies each final draft with `buildVerifyPrompt(..., { openingRule: "default" })`, and records
  both verdicts, `classification` and `pricing` per run; the controls script verifies planted openings.
- **Command (exact), from the repo root:**
  `OUT=$(mktemp -d /tmp/vague-gate.XXXXXX); for t in 1 2 3 4 5; do npx tsx scripts/clarification-measure.ts --arm B --probe C8 --runs 1 --tag B$t --out "$OUT" --today 2026-10-12 & done; wait; npx tsx scripts/vague-gate-controls.ts --out "$OUT"`
- **Prerequisites:** ALREADY HAVE: Node, `npm`, `tsx`, `ANTHROPIC_API_KEY` in `.env`, network, a raised API spend
  limit (it voided the first route arm). MUST OBTAIN: none.
- **Output:** five result files with both verdicts per run, the controls file; recorded in the review doc.
- **Who:** Claude Code or Alex. **Trigger:** after step 5, on Alex's "go" (real API spend, about one arm).
- **Expected (a hypothesis until run):** up to about 17 more verified drafts; the structural scene, `can_see_it` and
  `sounds_like_alex` failures stay. What this does NOT show: that quoted vague drafts are good enough to send;
  50 runs, one model, made-up leads; the router still holds every one.

## Feed-Forward

- **Hardest decision:** a measurement seam in production code versus an unpaired before/after; the seam is three
  lines and tested, the unpaired design could not separate the rule from the verifier's noise (20 vs 10).
- **Rejected:** forcing `vagueness: "clear"` for the replay (it moves `genre_default_stated`); extending the mode to
  `assume_and_quote` without a run; relaxing `competitor_test`; recomputing the gate in code.
- **Least confident:** that fixing the opening moves 8 or more drafts: 16 of the 33 also fail other checks, and the
  verifier's `can_see_it` and `sounds_like_alex` judgments sit next to the opening on the same generic text.

## Three Questions

1. **Hardest decision in this session?** Whether the old-verifier replay needs a production seam; every seam-free route
   either moved another line or compared unpaired samples.
2. **What did you reject, and why?** Widening to `assume_and_quote` now (no run covers it) and a threshold of "rises".
3. **Least confident about going into the next phase?** That the verifier follows the scoped text; plan 1 feared the
   same, and its re-run moved 0 of 17 until the rule was scoped, so the controls are the real test.
