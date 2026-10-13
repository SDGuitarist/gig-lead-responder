---
date: 2026-10-13
phase: plan review, round 2
subject: docs/plans/2026-10-13-fix-clarification-gate-opening-plan.md (Revision 1, HEAD 4b20f1b)
prior_verdicts: docs/reviews/2026-10-13-clarification-gate-plan-codex-round1.md (NO-GO)
verdict: NO-GO (2 prior findings not fixed, 1 new P2)
---

# Round 2 (plan): NO-GO. The 2nd NO-GO: automatic iteration STOPS.

One run. Pasted by Alex 2026-10-13; findings verbatim, the appended fix prompt summarized (its three numbered items
map one to one onto the findings below). Round 3 only with the literal `Round 3 authorized by Alejandro: YES`; a 3rd
NO-GO is the hard cap.

## Seven prior findings (verbatim)

1. **R1 P1-1 — FIXED.** The plan now separates the six boolean-arithmetic candidates into 4 opening-only, 1 additional
   verifier voice failure, and 1 deterministic post-check failure (plan lines 28-45). The post-check citation matches
   `src/pipeline/post-check.ts:140-145`.
2. **R1 P1-2 — FIXED.** The definition now requires a lead-supplied fact or uncertainty, explicitly rejects generic
   phrases, and says format openness alone is insufficient (plan lines 77-90).
3. **R1 P1-3 — NOT FIXED.** S0-S10 cover most major toggles, but the plan explicitly does not snapshot the active
   branches for past-date and mariachi pricing. Its claim that "S1, S2 and S10 reach them through the baseline" is not
   supported by the listed classifications (plan lines 103-127). Those branches are conditional in
   `src/prompts/verify.ts:98-100`; none of S1, S2, or S10 is specified as past-date or mariachi-active.
4. **R1 P1-4 — FIXED BUT INTRODUCES P2.** G1-G7 now use extracted sections, exact section-9/8 blocks, span-only G6,
   and predicate near-misses (plan lines 148-189). However, the extraction helper is described as matching
   `### <n>.` headings, while the target section is `### 6b. Lead-Specificity Check` (`src/prompts/verify.ts:79`).
   The plan must specify that alphanumeric section identifiers such as `6b` are supported.
5. **R1 P2-5 — NOT FIXED.** The decision table still uses "more than about 6 of 17" as a defect bound (plan lines
   191-207). That is not a stable or falsifiable threshold for a one-model stochastic rerun. The table also has no
   explicit row for no-draft/generation-error outcomes, despite the prior measurement containing them.
6. **R1 P2-6 — FIXED.** The command now creates `$OUT`, uses three tagged processes, passes `--today`, and explains
   the distinct scratch databases and result files (plan lines 217-234).
7. **R1 P2-7 — FIXED.** The plan now explicitly includes both stale-comment corrections, including the runner's
   "12 of 14" comment (plan lines 92-96).

## New defects (verbatim)

### P2 — Section extraction does not clearly support `6b`

The plan's helper description says `### <n>.` (plan lines 150-153), but the actual heading is `### 6b.`
(`src/prompts/verify.ts:79`). If implemented literally as numeric-only matching, G1, G5, and G6 cannot extract the
intended section. This is executable because the planned test helper runs.

## Verdict

NO-GO. R1 P1-3 and R1 P2-5 remain incomplete, and the revised test-helper specification adds a P2 implementation
risk. This is the second NO-GO; automatic iteration stops. Round 3 requires Alejandro's explicit authorization.

## Claude Code's check (2026-10-13)

| Finding | Check | Result |
|---|---|---|
| P1-3 inventory claim | `buildPastDateInstruction` is keyed on `past_date_detected` and `buildMariachiPricingInstruction` on `flagged_concerns` holding `CONCERN_4PIECE_ALT` / `CONCERN_FULL_ENSEMBLE` (`src/prompts/verify.ts:237-258`). My S1, S2 and S10 set neither, so "reached through the baseline" is false. | **Valid.** The claim must be dropped or two cases added. |
| P1-4 extractor wording | The prompt's headings are `### 6b.`, `### 7a.`, `### 7b.`, `### 7c.`, `### 7d.`, `### 8.` (twice, one per platform), `### 9.` (`src/prompts/verify.ts:79-153`); the plan says `### <n>.`. | **Valid.** |
| P2-5 decision rule | The table's fourth row reads "more than about 6 of 17"; no row names a no-draft run, which occurred in both measurements (2 of 18, 1 of 18). | **Valid.** |

All three accepted. All three are plan text; none touches production code.
