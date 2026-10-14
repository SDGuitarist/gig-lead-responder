# Vague-lead route: why 40 of 50 drafts did not verify (offline read of the final-prompt arm), 2026-10-14

**Source:** `/tmp/vague-quote.UOUjXd` (`2026-10-14-vague-quote-final-prompt-measurement.md`; `gate_detail` per run, no new
model call) against the earlier arm in `/tmp/vague-quote.W63bO1`. `competitor_test` is excluded from "false checks"
(it passes when false; the list prints it as a key with value false). Counts, not a sample read of every draft; two
`fail_reasons` were read in full.

## Result

| Unverified drafts (final / earlier arm) | 40 / 30 |
|---|---|
| false check `lead_specific_opening` | **33** / 24 |
| false check `can_see_it` | 11 / 5 |
| false check `sounds_like_alex` | 6 / 5 |
| any other check | 12 / 9 (named_fear 2, timeline 2, preempted 2, prose_flows 2, genre_default 3, differentiated 1, compressed 1) |
| structural scene | 11 of 40 |
| competitor_test true | 6 of 40 |

**17 of the 40 fail on `lead_specific_opening` alone** (15 with nothing else false, 2 more where the same generic
opening also set `competitor_test` true). 16 more combine it with other checks.

## Reading (descriptive)

- The verifier's opening check demands a concrete detail from the classification. A vague lead supplies none, so the
  opening of a drafted quote reads generic ("Whatever the occasion... the question of live music usually comes before
  the details do") and fails. This is the same defect the plan-1 gate-opening cycle fixed, which scoped the rule to
  clarification mode only (`one_question` AND an unresolved format). **This route moved the lead out of that mode**
  (format now `solo`/`duo`), so the default opening rule applies again. That is a reading of the code and the failure
  counts; I have not run the verifier with the rule changed.
- The prompt-wording fixes of this review cycle (setup sentence) are not what moved the gate: the earlier arm already
  failed 24 of 30 on the same check; verified 20 vs 10 is the rate on a similar failing check, not a new one.
- **Not read:** 6 `sounds_like_alex` and 11 `can_see_it` drafts individually.

## What this implies (a decision, not a fix made here)

Extending the plan-1 opening rule to a vague `one_question` lead with a resolved default is a change to
`src/prompts/verify.ts`, i.e. a new plan with its own review and a measured arm; it is not part of this review
cycle's bounded fixes. It needs Alex's decision.
