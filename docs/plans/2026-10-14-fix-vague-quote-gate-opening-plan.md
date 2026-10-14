---
title: "fix: the verify gate's opening rule asks a quoted vague lead's reply to cite a detail the lead never gave"
date: 2026-10-14
status: plan, Revision 1b (plan review R1 NO-GO 5 P1 / 3 P2, R2 NO-GO 3 P1 / 1 P2 at the cap, both answered; D3 decided by Alex 2026-10-14; Alex chose "Accept, fix the 4, build")
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
- `verifyGate` (`src/pipeline/verify.ts:68`) builds the prompt with `buildVerifyPrompt(classification, pricing)` and
  calls `callClaude(..., validateGateResult)`; `validateGateResult` is not exported.
- Verified 20 vs 10 of 50 across two samples of nearly the same prompt: the verifier and the generator are noisy, so an
  unpaired before/after comparison cannot separate the rule from variation.

## Production paths that reach the predicate (answers R1 P1-3, bounded inventory)

`action === "one_question" && vagueness === "vague"` with a resolved format is produced by: (a) `defaultVagueFormat`
(`src/pipeline/classify.ts`) in `classifyLead` for a category-only lead: `solo` or `duo` only; (b) the classifier
itself, when the lead names a format ("a solo guitarist") or the SPECIAL CASE does not fire: any resolved format,
including cultural and ensemble formats; (c) a stored classification reused by `runEditPipeline`, which keeps whatever
(a) or (b) produced. Only (a) is covered by measured runs; (b) with `solo`/`duo` is the same shape and has the same
defect; (b) with any other format is NOT covered and is out of scope here. The mode therefore uses
`format_recommended` in {`solo`, `duo`}; the rest stay on today's strict text (pinned by S16).

## Decision

D1. **A new mode, `vagueQuoteMode`** = `action === "one_question" && vagueness === "vague" && (format_recommended ===
"solo" || format_recommended === "duo")`. Only section 6b and the `lead_specific_opening` line switch to a new text,
`VAGUE_QUOTE_LEAD_SPECIFICITY`. The other three clarification lines, the whole of section 8 and 9, `GUT_CHECK_*`, and
every other mode are unchanged byte-for-byte. The text (review may change the words, not the anchor):

> This lead is vague and its format was assumed: the form gave no date, venue or guest count, so the opening cannot cite
> them. The first sentence passes only if it repeats or restates a fact or an uncertainty the lead itself supplied. The
> minimum anchor is ONE of: the occasion or event type the lead wrote (a birthday, a wedding, a party); the time frame
> the lead wrote (next month, this winter, spring); the lead's own stated doubt ("not sure what kind of music"); or a
> format the lead itself named, which shows in the classification's `format_requested` (a lead that wrote "a solo
> guitarist" supplied that format). Any one is enough. A format that does NOT appear in `format_requested` ("solo
> guitar", "a duo" chosen by the app) is an assumption, not a fact the lead supplied, and is NOT an anchor. References that could
> be said to any inquiry do NOT qualify: "your event", "this inquiry", "what you're looking for", "the right fit",
> "the right music", "what would work best". Deletion test: remove the words that came from this lead; if the sentence
> still works for any inquiry, lead_specific_opening = false.
> Pass: "Your mom's birthday, and you're not sure what kind of music: that is the right place for one question."
> Fail (compliment): "What a wonderful way to celebrate!"
> Fail (generic acknowledgement): "You're looking for the right music for your event."
> Fail (assumed format only, solo): "A solo guitarist is a lovely way to set the tone."
> Fail (assumed format only, duo): "A duo is a warm way to fill an evening."
> Pass (format the lead named, `format_requested` = "a solo guitarist"): "A solo guitarist for your mom's birthday: that is a clear ask, and one question settles the rest."

D2. **A measurement seam, not a production switch** (answers R1 P1-1, P2-6). `buildVerifyPrompt(classification,
pricing, options?)` gains an optional third argument `{ openingRule?: "default" }`; when `"default"` the vague-quote
mode is ignored and today's strict text is used. `verifyGate(drafts, classification, pricing, options?)` passes the
same optional argument through (the only other change to `src/pipeline/verify.ts`: one added parameter, one forwarded
argument; `validateGateResult`, the retries and the prompt wrapper are untouched, so the replay uses the SAME
validator). Production calls never pass it. A test pins that a call without the argument equals a call with `{}`, and
that `"default"` on every non-vague-quote case changes nothing.

D3. **Scope is `one_question` only, by evidence. Decision record (Alex, chat answer 2026-10-14): "Leave them out and
measure them as a follow-up."** The mode is `one_question` only; `assume_and_quote`+`vague` is a separate measured
follow-up, as is any other resolved format (S16 pins that it is untouched).

D4. **Not done, and why:** relaxing `scene_type` or `competitor_test`; recomputing `gate_status` in code; editing the
generate prompt (length 203 words, copying: separate items); touching the three other clarification lines; changing
the router (it still holds every vague `one_question` lead for Alex); widening the mode beyond `solo`/`duo`.

## The paired measurement (answers R1 P1-1, P2-6)

For each of the 50 runs the runner records, for the SAME final draft pair (full and compressed):

| Field | Source | What it is |
|---|---|---|
| `pipeline` | the gate verdict `runPipeline` already produced (new rule, in the rewrite loop; the final attempt's verdict) | gate_status, fail_reasons, `lead_specific_opening`, scene_type, competitor_test, false_checks |
| `replay_mode` | `verifyGate(finalDrafts, classification, pricing)`, a fresh call | same fields, new rule |
| `replay_default` | `verifyGate(finalDrafts, classification, pricing, { openingRule: "default" })`, a fresh call | same fields, today's strict rule |
| `replay_error` | a thrown `VerificationError` (the validator's own two attempts) | recorded; the run is excluded from the pairs and counted |

Each recorded verdict also carries `pass` = `gate.gate_status === "pass"` (the gate's own rule: the verifier's
status, the value the rewrite loop tests; `verified` in a pipeline result is the same value). The paired comparison
uses `replay_mode.pass` and `replay_default.pass` ONLY; post-check results, which are deterministic and independent of the
opening rule, are NOT part of it and are recorded separately. A run with a `replay_error` is excluded from both
counts and reported. `classification` and `pricing` are stored per run (`o.classification`, `o.pricing`). The replays are gate-only: the
deterministic post-check is independent of the opening rule and is recorded as it already is. The comparison uses
`replay_mode` against `replay_default` (same time, same function, only the prompt differs). `pipeline` against
`replay_mode` is the verifier's own noise floor on identical input and prompt: the number of runs where they differ
is reported next to the result, so a gain smaller than the noise floor is not read as an effect. This is a paired,
observational comparison of one model's two stochastic verdicts, not a deterministic or causal measurement.

## The snapshot inventory

Snapshots S0-S12 exist (plan 1). Before S8 changes, **its current text is copied, unchanged, to
`src/fixtures/verify-prompt-baseline/S8-pre-vague-gate.txt`** (answers R1 P1-4) in the same commit that adds S13-S16,
so VG4 compares the seam against an artifact that survives S8's refresh. **S8 changes by design** (refreshed in a
`snapshot refresh:` commit with the prompt diff). Added: **S13** `one_question`+`vague`+`duo` (the duo branch);
**S14** `assume_and_quote`+`vague`+`solo` (near-miss, today's text, D3); **S15** `one_question`+`clear`+`solo`
(near-miss); **S16** `one_question`+`vague`+`mariachi_full` (a resolved non-solo/duo format, today's text); **S17**
`one_question`+`vague`+`solo` with `format_requested` = "a solo guitarist" (a classifier-supplied format: the vague-quote
text, whose fourth anchor is the format the lead named). S0
(clarification), S1-S7, S9-S12 and S14-S16 must be byte-equal outside the voice block (G8 pin unchanged).

## Plan Quality Gate

1. **What exactly is changing?** Two spans of `src/prompts/verify.ts` for `vagueQuoteMode` plus the optional third
   argument and its pass-through in `verifyGate`; snapshots S13-S17, a retained S8-pre fixture and S8 refreshed; a new
   `src/vague-gate-prompt.test.ts`; the runner stores `classification` and `pricing` and records the two replays; a
   controls script.
2. **What must not change?** Every other mode's verify prompt (G2 pattern); clarification mode's text; section 8 and 9;
   `GUT_CHECK_*`; `validateGateResult` and `callClaude`'s retry; the generate prompt; the voice block hash; the router
   hold; every `verifyGate` call that passes no options.
3. **How will we know it worked?** EARS below, each with a named mutation; plus the paired arm and the controls read
   by the table below. Observational: 50 runs + 20 control verifies, one model, made-up leads.
4. **Most likely way this plan is wrong?** (a) The rule is loosened so a generic opener passes: the planted controls
   (solo and duo) and a mechanical list of newly verified openings catch exactly that. (b) 17 is not the ceiling:
   16 more fail on the opening plus other checks (`can_see_it`, `sounds_like_alex`); the gain may be small and the
   gate may still fail most drafts: the table reports it as that, without a pass. (c) The verifier ignores the scoped
   text, as plan 1's Feed-Forward feared. (d) Verifier noise is as large as the gain: the noise floor is printed.
5. **How will a human RUN this, and when?** Claude Code (or Alex) on the MacBook, after the code and its Codex code
   review, with the command in the Execution Path. Alex reads
   `docs/reviews/2026-10-14-vague-gate-measurement.md`.

## Acceptance Tests (EARS)

File `src/vague-gate-prompt.test.ts`; names start `Vague Gate VG<n>`; reuse `sectionOf` and the snapshot helpers of
`src/clarification-gate-prompt.test.ts`.

- **VG1** WHEN the classification is `one_question`, `vague`, format `solo` or `duo`, THE SYSTEM SHALL include as
  section 6b and as the `lead_specific_opening` line exactly the vague-quote definition, with all six literal
  examples (including the pass example for a format the lead named) and the sentence "is an assumption, not a fact the
  lead supplied".
- **VG2** WHEN the classification is S0-S7, S9-S12 or S14-S16 (S17 is VG9), THE SYSTEM SHALL return a prompt byte-equal to its
  snapshot outside the voice block, and SHALL NOT contain "its format was assumed".
- **VG3** WHEN the prompt is built for S8 or S13, THE SYSTEM SHALL keep `preempted_questions`, `budget_acknowledged`
  and `genre_default_stated` equal to the quote-mode text (the three lines are not the clarification lines).
- **VG4** WHEN `buildVerifyPrompt(c, p, { openingRule: "default" })` is called for S8, THE SYSTEM SHALL equal
  `S8-pre-vague-gate.txt` (outside the voice block); for every other case the third argument SHALL change nothing; a
  call with no third argument SHALL equal a call with `{}`; and `verifyGate` called with no options SHALL build the
  same prompt as before (a recorded `callClaude` spy).
- **VG5** WHEN the clarification prompt (S0) is built, THE SYSTEM SHALL still equal plan 1's text.
- **VG6** WHEN any case's prompt is built, THE SYSTEM SHALL carry a voice block whose SHA-256 equals the pinned value.
- **VG7** The change is exactly the two spans: S8-pre with the two spans replaced equals the new S8.
- **VG8** WHEN the new text is read, THE SYSTEM SHALL carry the minimum-anchor sentence (the four anchors, "Any one is
  enough") and both assumed-format fail examples (solo and duo), each literal.
- **VG9** WHEN the classification is S17 (`format_requested` = "a solo guitarist"), THE SYSTEM SHALL build the vague-quote
  text and the serialized classification in the prompt SHALL contain that `format_requested` (the verifier can see
  that the lead named the format); WHEN it is S8 (`format_requested` empty), the same text applies and the format
  anchor has nothing to match.
- **VG10** (bounded call-site inventory) WHEN the source tree outside tests and the measurement scripts is scanned for
  `verifyGate(`, THE SYSTEM SHALL find exactly three call sites (`src/run-pipeline.ts` edit path,
  `src/pipeline/verify.ts` twice in `runWithVerification`), each passing three arguments and none containing
  `openingRule`; and a spy on the model call SHALL show `runWithVerification` building the same system prompt as the
  two-argument `buildVerifyPrompt`.

Mutation map (each run, each must fail exactly its own test): mode predicate drops `vagueness`; mode drops the
format clause; mode widened to any resolved format; the seam ignored; the `verifyGate` pass-through dropped; the three
lines moved into the mode; the assumed-format sentence removed; the duo fail example removed; the format anchor removed; the mode applied to
`assume_and_quote`; a production call site passing `openingRule`.

## Decision table for the measurement (pre-registered; descriptive, derived)

Arm: 5 processes x 10 leads (the route plan's 50 runs), the real pipeline on the NEW prompt, each final draft
re-verified under both rules (the table above); plus the controls: 5 planted generic and 5 planted specific openings
on a fixed made-up lead, each verified twice (20 verifies). The five texts per kind are the unit; repeats are not
independent. The rules are asymmetric by cost: a false pass is the harm (a generic opener reaching the sending path),
a false fail only loses gain. Counts only; the table is a reading guide set before the run, not a pass bar.

| Observation | Meaning | Action |
|---|---|---|
| ANY planted generic text (solo or duo) passes `lead_specific_opening` in EITHER of its two verifies | a generic opening was accepted once: the harm direction is a false pass, so one observation is a control defect | STOP; revert the prompt change; return to Alex |
| 2 or more planted specific texts fail it in AT LEAST ONE verify | the new rule is too tight (the cost is lost gain, so one miss on one text is tolerated) | STOP; return to Alex |
| controls ok AND `replay_mode` verified exceeds `replay_default` verified: b newly verified, c newly failed, b > c with exact one-sided sign-test p < 0.05, AND every newly verified opening passes a manual deletion test | the scoped rule moved the gate and holds | proceed to code review, compound |
| controls ok AND the sign test does not reach p < 0.05, or b is within the `pipeline` vs `replay_mode` disagreement count | not distinguishable from verifier noise or the rule is not the main cause | STOP; record the other failures; return to Alex |
| a newly verified draft has a generic opening | the verifier did not follow the text | STOP; a failure of this plan |

Why the sign test: the 50 pairs are the same drafts under two prompts; only discordant pairs carry information, and an
exact binomial on b versus b + c is the standard test for that. With 17 opening-only failures a one-direction b of
about 10 or more gives p < 0.001; a b of 6 with c of 1 gives p = 0.06. **The threshold is the test, not a number
chosen for this plan.** Limits stated: 50 made-up leads, one model, verdict noise, five planted texts per kind.

**Sending boundary (answers R1 P2-8):** passing this measurement does NOT make any draft sendable. A verified draft
still needs the post-check, the COI and payment-sentence checks, Alex's router hold (every vague `one_question` lead
is held for him) and his own read. This plan changes what the verifier asks of an opening, nothing else.

## Verification Commands (answers R1 P1-5)

| What | Command (from the repo root) | Expected |
|---|---|---|
| Snapshots, VG2 | `npm run test:match -- "Vague Gate VG2"` | all pass, exit 0 |
| New text, VG1, VG8 | `npm run test:match -- "Vague Gate VG1"` ; `... "Vague Gate VG8"` | pass, exit 0 |
| The three lines, VG3 | `npm run test:match -- "Vague Gate VG3"` | pass, exit 0 |
| The seam, VG4 | `npm run test:match -- "Vague Gate VG4"` | pass, exit 0 |
| Clarification unchanged, VG5; voice block, VG6; exactly two spans, VG7 | `npm run test:match -- "Vague Gate VG5"` ; `VG6` ; `VG7` | pass, exit 0 |
| Plan 1's suite unchanged | `npm run test:match -- "Clarification Gate"` | all pass, exit 0 |
| Mutation map | the eleven rows, each applied by hand and `npm run test:match -- "Vague Gate"` | each fails exactly its own VG, exit 1 per row |
| Full suite | `npm test` | all pass, 0 fail (the sandbox of a reviewer may block localhost sockets: `listen EPERM` is a sandbox limit, recorded as UNEXECUTED, never as a pass) |
| Types | `npx tsc --noEmit` | clean, exit 0 |
| Leak check | `npx tsx scripts/check-venue-history.ts; echo $?` | exit 0 |
| Controls | `npx tsx scripts/vague-gate-controls.ts --out "$OUT"` | prints counts per planted text, exit 0 |
| The arm | the Execution Path command | 5 result files, no usage-limit error in any log |

## Work steps (one concern per commit; failing test first)

0. **HARD STOP:** plan review R2 (R1 is answered here). No production code before.
1. Snapshots S13-S16 and S8-pre from the CURRENT code; VG2 passes.
2. VG1, VG3-VG8 failing, then the prompt change, the seam and the `verifyGate` pass-through; all pass; S8 refreshed in
   a `snapshot refresh:` commit.
3. Runner: store `classification` and `pricing`; the two replays; the controls script (script-only).
4. Mutation map run and recorded; full suite, `tsc`, leak check.
5. Codex code review (one run per round).
6. The measurement arm and `docs/reviews/2026-10-14-vague-gate-measurement.md` with the table filled in.

## Execution Path

- **Target:** Alex's MacBook, `scripts/clarification-measure.ts --arm B --probe C8` (extended in step 3) and
  `scripts/vague-gate-controls.ts`, real model, scratch databases, nothing sent.
- **Mechanism:** the committed runner wraps the real model call, runs `runPipeline` for the ten made-up vague leads on
  the new prompt, then calls `verifyGate` twice more on each final draft (new rule, then `{ openingRule: "default" }`),
  and records `pipeline`, `replay_mode`, `replay_default`, `classification` and `pricing` per run; the controls script
  verifies the planted openings.
- **Command (exact), from the repo root:**
  `OUT=$(mktemp -d /tmp/vague-gate.XXXXXX); for t in 1 2 3 4 5; do npx tsx scripts/clarification-measure.ts --arm B --probe C8 --paired --runs 1 --tag B$t --out "$OUT" --today 2026-10-12 & done; wait; npx tsx scripts/vague-gate-controls.ts --out "$OUT"`
- **Prerequisites:** ALREADY HAVE: Node, `npm`, `tsx`, `ANTHROPIC_API_KEY` in `.env`, network, a raised API spend
  limit (it voided the first route arm). MUST OBTAIN: none.
- **Output:** five result files with all three verdicts per run, the controls file; recorded in the review doc.
- **Who:** Claude Code or Alex. **Trigger:** after step 5, on Alex's "go" (real API spend, about one arm plus 120
  verifier calls).
- **Expected (a hypothesis until run):** up to about 17 more verified drafts; the structural scene, `can_see_it` and
  `sounds_like_alex` failures stay. What this does NOT show: that quoted vague drafts are good enough to send;
  50 runs, one model, made-up leads; the router still holds every one.

## Feed-Forward

- **Hardest decision:** a measurement seam in production code versus an unpaired before/after; the seam is one
  optional parameter forwarded through `verifyGate`, tested, and the unpaired design could not separate the rule from
  the verifier's noise (20 vs 10).
- **Rejected:** forcing `vagueness: "clear"` for the replay (it moves `genre_default_stated`); extending the mode to
  `assume_and_quote` or to every resolved format; a gain threshold of 8 chosen by me (replaced by the sign test);
  relaxing `competitor_test`; recomputing the gate in code.
- **Least confident:** that fixing the opening moves enough drafts to matter: 16 of the 33 also fail other checks, and
  the verifier's `can_see_it` and `sounds_like_alex` judgments sit next to the opening on the same generic text.

## Three Questions

1. **Hardest decision in this session?** Whether the old-rule replay needs a production seam; every seam-free route
   either moved another line or compared unpaired samples.
2. **What did you reject, and why?** Widening to `assume_and_quote` or to non-solo/duo formats (no run covers them), and
   a hand-picked threshold in place of a test.
3. **Least confident about going into the next phase?** That the verifier follows the scoped text; plan 1 feared the
   same and its re-run moved 0 of 17 until the rule was scoped, so the planted controls are the real test.
