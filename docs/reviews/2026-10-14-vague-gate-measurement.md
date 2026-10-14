# Vague-gate plan: the paired arm and the planted controls, 2026-10-14

**Plan:** `docs/plans/2026-10-14-fix-vague-quote-gate-opening-plan.md` (Revision 1b). **Code:** `3eb0b58` (worktree clean).
**Method:** `scripts/clarification-measure.ts --arm B --probe C8 --paired --runs 1`, 5 processes x the 10 made-up vague
leads (v1-v6, h1-h4) = 50 runs, each final draft re-verified under the new rule (twice) and under today's strict rule;
`scripts/vague-gate-controls.ts` in parallel (6 generic + 5 specific planted openings, 2 verifies each). Real model
(`claude-sonnet-4-6` per the manifest), scratch databases, today pinned 2026-10-12, nothing sent. **Exploratory,
observational, one model, made-up leads.** No usage-limit errors (0 of 5 logs); 50 of 50 runs paired, 0 excluded.

## Planted controls (decision table, first rows)

| Kind | Texts | `lead_specific_opening` per verify | Result |
|---|---|---|---|
| generic (g1-g6, incl. the generic-word `format_requested` case g6) | 6 | false, false for every text | none passed in either verify: not loose |
| specific (s1-s5) | 5 | true, true for every text | none failed in either verify: not too tight |

Script exit 0; `STOP_loose` false, `STOP_too_tight` false, no verifier errors.

## Paired result (same 50 drafts, replay_mode vs replay_default)

| | Count |
|---|---|
| verified under the new rule (`replay_mode`) / under today's strict rule (`replay_default`) | 11 / 7 |
| newly verified (b) / newly failed (c) | 6 / 2 |
| both pass / both fail | 5 / 37 |
| exact one-sided sign test (b vs b + c) | p = 0.145 |
| noise floor: `replay_mode` vs `replay_mode_repeat` disagree | 2 of 50 |
| pipeline's own gate verified (new rule, raw drafts, in the rewrite loop) | 9 of 50 |

`lead_specific_opening` false: 32 of 50 under the new rule, 33 of 50 under the strict rule. The new text moved this
check on ONE draft in 50.

Newly verified openings (manual deletion test): h1 "A milestone birthday deserves the moment ..."; v1 "Next month,
someone raises a glass ..."; v2 "A winter gathering where halfway through ..."; h1 "A 40th birthday in summer ...";
h4 "An art gallery opening: glasses in hand ..."; h1 "A milestone birthday, the kind where ...". Each cites an
occasion or time frame the lead wrote; none is a generic opener (the table's "a newly verified draft has a generic
opening" row did not fire).

## Reading against the pre-registered table

Controls ok, but **the sign test does not reach p < 0.05** (0.145) and b = 6 is not clearly above the noise count (2 of
50): the table's row "not distinguishable from verifier noise, or the rule is not the main cause" fires: **STOP; return
to Alex.** The planted openings show the rule CAN tell a generic opener from a specific one; the real drafts mostly do
not contain a specific opener to begin with.

## Why the real drafts still fail (the 39 unverified under the new rule)

False checks (not exclusive): `lead_specific_opening` 32, `sounds_like_alex` 12, `can_see_it` 9, `prose_flows` 5,
`genre_default_stated` 4, others 1-2; structural scene 9; `competitor_test` true 7; opening-only 10.

The verifier's own reasons (read for v3, v4, v5, v6, h2, h3) say the new text IS being applied: "contains no anchor from
this lead", "'private celebration' is the app's classification, not a word the lead wrote", "'corporate holiday party' is a
format the app inferred". The drafts open with an invented scene ("Guests arrive, the guitar is already working...") or
the app's own label ("A private celebration ..."), because **neither the drafter nor the verifier ever sees the lead's own
words** (the project rule: "the drafter never sees the lead text"); the classification holds the app's labels. A rule that
asks an opening to repeat what the lead WROTE cannot be satisfied reliably from fields the app wrote. 3 of the 6 newly
verified openings are for leads whose classification carries the occasion or time frame as a field.

## Limits

- 50 made-up leads, one model, one sample; the sign test has 8 discordant pairs.
- The replays verify the post-check-cleaned drafts, not the raw drafts the pipeline gated; `pipeline` verified 9 vs 11 is
  context, not a noise measure.
- The controls use a classification built from a test case, not a real lead; the verifier read them correctly.
- Verified rate overall is 9 to 11 of 50 under either rule, comparable to the earlier two samples (20 and 10).
