---
date: 2026-10-13
phase: plan review, round 1
subject: docs/plans/2026-10-13-fix-clarification-draft-shape-plan.md (Revision 0, HEAD 65e53c8)
prior_verdicts: none
verdict: NO-GO (2 P1, 3 P2, 1 P3)
---

# Round 1 (plan): NO-GO, 2 P1, 3 P2, 1 P3

One run. Pasted by Alex 2026-10-13; findings verbatim, the appended fix prompt summarized (its six numbered items map
one to one onto the findings). Claude Code's check is in the last table.

## Findings (verbatim)

### P1 — D1 can remove required concern coverage

The plan skips step 3 entirely (plan line 58). The generator still requires every flagged concern to be addressed
(`src/prompts/generate.ts:192`). Clarification leads can carry "vague format request" as a flagged concern, and the
verifier requires every traceability entry to have a non-empty sentence (`src/prompts/verify.ts:170`).

A single step-2 sentence naming what goes wrong when format is chosen blindly may not satisfy concern traceability,
`named_fear`, and `differentiated` simultaneously. The plan needs to specify that step 2 must also provide the
sentence used to trace the flagged concern and include Alex's differentiating behavior, or retain a lightweight
concern-resolution instruction.

### P1 — Arm identity and A-before-change ordering are procedural, not enforceable

The plan says arm A runs before the code change and arm B afterward (plan line 139). But the runner records run
results without the prompt hash, commit SHA, model identifier, or lead-set hash (`scripts/clarification-measure.ts:94`).
Therefore a report cannot prove that A used the pre-change prompt, that B used the changed prompt, or that the
model/date stayed constant. Add an arm manifest containing at least: arm name; git SHA; full prompt SHA or
prompt-input SHA; model identifier; pinned date; lead-set hash. Without this, a procedural mistake can invalidate
the primary comparison while still producing plausible-looking results.

### P2 — The statistical rule lacks an honest power statement and a stable denominator

The plan declares a one-sided Fisher test with a 15-point margin and p < 0.10 (plan line 143). But it does not state
the expected power, and the primary rate is "among returned drafts." The intervention could change the no-draft
rate, changing the denominator. Define the estimand precisely and state that 50 runs per arm are exploratory, with
the likely power or detectable-effect limitation.

### P2 — The proposed word-count range contradicts the measurement rule

D2 proposes 70-100 words and 4 to 6 sentences (plan line 64), but the decision table treats a median of 70-110 as
following the instruction (plan line 150). The plan must choose one range and use it consistently in D2, P2, the
measurement table, and the expected-results section.

### P2 — P4/P5 do not fully specify the snapshot inventory or refresh contract

P4 refers to "three committed baselines" and additional near-miss/platform hashes (plan line 92), but it does not
name the exact fixture/input files, expected hash storage, or the reviewed procedure for refreshing hashes after a
legitimate prompt change. P5 also depends on a span extractor whose correctness is not independently pinned (plan
line 121). Specify the exact inventory, require unique-anchor checks, add a positive control proving an edit inside
each allowed span is tolerated, and require an outside-span mutation to fail.

### P3 — "Opening anchor" wording is stronger than the existing forcing rule

The current forcing rule already requires a concrete detail from the lead (`src/prompts/generate.ts:349`). D1 says
the opener must use "a word the lead supplied" (plan line 60). That may unintentionally prohibit valid paraphrases
already accepted by plan 1. Change this to "a fact or uncertainty the lead supplied," or explain why literal word
reuse is intended.

No P0 findings.

## Verdict

NO-GO. The plan has two P1 gaps: concern-traceability preservation and unverifiable arm identity/order. It also has
clear P2 contradictions in the measurement and snapshot specification.

## Claude Code's check (2026-10-13)

| Finding | Check | Result |
|---|---|---|
| P1 concern coverage | `src/prompts/generate.ts:190-192` carries "Address each flagged concern"; the verify prompt section 3 makes an empty `draft_sentence` an automatic fail; `concern_traceability` was non-empty in 33 of 33 drafts of the two sets (0 empty). Step 3 is where the prompt asks for resolution; SKIP removes the only dedicated place. | **Valid.** The risk is introduced by the plan, not present today. |
| P1 arm identity | The runner's JSON holds `today`, `runs` and `results` only; no SHA, prompt hash, model or lead-set hash. `src/claude.ts` takes the model as a parameter (default `claude-sonnet-4-6`); the request object carries it. | **Valid.** |
| P2 estimand | The primary rate was "among returned drafts"; no-draft runs were 3 of 36 (1 and 2), so the denominator can move with the change. Power was not stated. | **Valid.** |
| P2 range | D2 says 70-100, the decision table says 70-110. | **Valid** (my inconsistency). |
| P2 P4/P5 | P4 said "the three committed baselines" without file names; no hash storage or refresh rule; P5's extractor has no control. | **Valid.** |
| P3 wording | The FORCING RULE says "a concrete detail from this lead"; plan 1's verifier definition says "a fact or an uncertainty the lead itself supplied". | **Valid.** |

All six accepted; none rejected.
