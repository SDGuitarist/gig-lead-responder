---
date: 2026-10-13
phase: plan review, round 1
subject: docs/plans/2026-10-13-fix-clarification-gate-opening-plan.md (Revision 0, HEAD d691f59)
prior_verdicts: none
verdict: NO-GO (4 P1, 3 P2)
---

# Round 1 (plan): NO-GO, 4 P1, 3 P2

One run. Pasted by Alex 2026-10-13; findings verbatim below, the fix prompt Codex appended is summarized (its seven
numbered items map one to one onto the findings). Claude Code's check of each finding is in the last table.

## Findings (verbatim)

Process note from the run: `ps`/`pgrep` were blocked, so concurrent-session status could not be independently
confirmed; repo identity matched, HEAD and worktree clean.

### P1 — Diagnosis overstates the "only false check" evidence

`docs/plans/2026-10-13-fix-clarification-gate-opening-plan.md:28-31` says all six candidates have only
`lead_specific_opening` false. The measurement says two also had `sounds_like_alex` or a voice-kill failure
(`docs/reviews/2026-10-13-clarification-gate-measurement.md:30-33`).

The arithmetic does support six "rule-would-pass" candidates: there are 18 checks, threshold 16, and
`competitor_test = false` is passing (`...measurement.md:20-28`). But this does not prove the verifier failed only
because of the opening. Section 9 also requires sign-off/platform checks, and those are not represented in the
gut-check count (`src/prompts/verify.ts:153-160`).

Revise the diagnosis to distinguish: gut-check arithmetic; `lead_specific_opening` being common to the six;
unobserved section-8 or model-judgment reasons.

### P1 — The proposed definition still permits generic openers

The definition allows an opener tied to "what the lead asked for" or "the fact that the format is still open"
(plan lines 57-64). That could let generic text such as "You're looking for the right music for your event" pass for
almost any inquiry.

The fail example only excludes a generic compliment. It does not exclude generic acknowledgements, such as "It makes
sense to think through the right fit" or "You're still deciding what would work best."

Add an explicit minimum anchor: the first sentence must quote or paraphrase a lead-supplied fact or uncertainty,
while generic references such as "your event," "this inquiry," "what you're looking for," or "the right fit" do not
qualify. Add both a clarification positive control and a generic-opening negative control.

### P1 — The byte-equality scope is under-specified

G2 claims protection for quote, residency, `no_viable_scope`, graceful decline, and other non-clarification modes,
but the plan only calls for three baseline classifications (plan lines 77-82, 103-105, 118-119).

`buildVerifyPrompt` has conditional branches for residency, graceful decline, sourced/hybrid delivery, GigSalad
policy, sign-off, cultural context, and pricing (`src/prompts/verify.ts:91-104, 124-160`). Three snapshots cannot
demonstrate byte equality across that surface.

Define a bounded snapshot inventory covering every prompt branch affected by the surrounding text, especially: quote
and clarification near-misses; residency; `no_viable_scope`; graceful decline; sourced and hybrid delivery;
platform/sign-off variants. Also state that snapshots are intentionally stale when unrelated prompt text changes and
may only be refreshed through an explicit reviewed update.

### P1 — G2, G4, and G5 can pass for the wrong reason

The mutation map is incomplete (plan lines 113-114).

- G5 says the "section 6b" differs, but does not specify extracting that section. Comparing whole prompts could pass
  because another field changed.
- G4 checks that section-9 text and threshold numbers remain, but does not require exact section-9 equality. An edit
  could preserve those substrings and still pass.
- No mutation tests the clarification predicate itself, such as `one_question + resolved format` or
  `quote + unresolved format`.

Make the tests compare exact extracted sections, add near-miss classifications, and extend the mutation map to cover
an incorrect mode predicate and partial section-9 edits.

### P2 — The measurement expectation is not falsifiable enough

"Verified rises from 0 of 17 toward at most 6" is a hypothesis, not a decision rule (plan lines 83-90, 137-138). The
plan says what to do if all six still fail, but not what to do if zero, some, or more than six pass, or if generic
openers begin passing.

Add a decision table based on final gate detail: candidate rows still failing for `lead_specific_opening`; candidate
rows failing only section 8 or other checks; verified count exceeding the prior six-candidate bound; generic opener
found in a verified draft; non-clarification snapshot regression.

The runner records full drafts, but the plan should explicitly define how the first sentence of every verified draft
is extracted and reviewed.

### P2 — The execution command is not directly runnable as written

The "exact" command contains the unresolved placeholder `<scratch>` (plan lines 131-133). Give a concrete setup
command, such as creating a temporary directory first, and state that all three processes share the output directory
but use distinct tags and scratch databases.

### P2 — A stale runner comment is omitted from the correction

The plan only corrects the stale comments in `src/types.ts` (plan lines 66-68, 121). The measurement runner still
says "at least 12 of 14" at `scripts/clarification-measure.ts:106-108`, while the live rule is 16 of 18
(`src/types.ts:253-254`, `src/prompts/verify.ts:153-160`). This is non-executable, but it can mislead future
measurement interpretation. Include it in the comment-only correction or explicitly explain why it remains unchanged.

### Verdict

NO-GO. The narrow implementation direction is plausible, but the plan needs tighter wording, a complete
prompt-branch inventory, non-vacuous section-specific tests, and a falsifiable measurement decision rule before code
work begins.

## Claude Code's check (2026-10-13)

| Finding | Check | Result |
|---|---|---|
| P1-1 "only false check" | Re-read the six candidates' booleans and reasons. 4 have only `lead_specific_opening` in every signal; `b v6` also has `sounds_like_alex` false (a voice judgment); `a v5` also carries `voice_kill_full: "land"`, `voice_kill_compressed: "lands"`, `voice_kill_full: "here's the thing"`. Those are post-check violations (`src/pipeline/post-check.ts:143-144`): a deterministic code failure, not a verifier override. All six end with "Alex Guillen" (sign-off is not the cause). | **Valid.** The bound on this plan's effect is 4, not 6. |
| P1-2 generic openers | Read the proposed text: "what the lead asked for" and "the format is still open" are satisfiable by any vague lead. | **Valid.** |
| P1-3 snapshot scope | Listed the conditionals of `buildVerifyPrompt`: clarification, residency, delivery_mode alex_sources/hybrid, graceful_decline, platform gigsalad (two places), plus builder functions for budget, past date, mariachi, cultural vocabulary, timeline, genre. Three snapshots do not reach them. | **Valid.** |
| P1-4 non-vacuous tests | Whole-prompt comparison in G5 and substring checks in G4 can pass for the wrong reason; no predicate mutation exists. | **Valid.** |
| P2-5 decision rule | The plan names one branch (all six fail). | **Valid.** |
| P2-6 `<scratch>` | The command has a placeholder. | **Valid.** |
| P2-7 runner comment | My own comment at `scripts/clarification-measure.ts:106-108` says 12 of 14; the code uses `<= 2` false of 18 (16). | **Valid, mine.** |

All seven accepted; none rejected.
