# Clarification draft-shape measurement: arm A against arm B, 2026-10-13

**Plan:** `docs/plans/2026-10-13-fix-clarification-draft-shape-plan.md` (Revision 1b), step 6. **Arm A** =
`0f269d9` (unchanged generate prompt), record `docs/reviews/2026-10-13-clarification-shape-arm-a.md`. **Arm B** =
`f762e23` (the change). **Method:** the committed runner, `--arm A|B --runs 1`, 5 parallel processes x 10 made-up
vague leads (v1-v6 and held-out h1-h4) per arm, 50 runs per arm, real model, scratch databases, today pinned to
2026-10-12, nothing sent. **Exploratory and observational: 50 runs per arm, one model, made-up leads.** The report is
`scripts/clarification-arm-report.ts` (counts only). The h1-h4 drafts of arm A were not read before the change was
committed; arm B's drafts were read only for the three pricing-language errors below.

## Manifest check (mechanical, `compareArms`)

`{"ok":true}`: five identical manifests per arm; A's `promptSha256` equals the pre-change C0 hash; B's differs and
equals the current tree's; A's commit is an ancestor of B's; `claude-sonnet-4-6`, today 2026-10-12, the same lead
set and node version in both arms; `dirtyPromptFiles` empty.

## Result

| | Arm A | Arm B |
|---|---|---|
| runs | 50 | 50 |
| **PRIMARY: unusable runs** (no draft, structural scene, or competitor test true) | **19 = 38%** (26-52%) | **17 = 34%** (22-48%) |
| difference, one-sided Fisher exact (B lower) | | **-4 points, p = 0.42** |
| no draft | 7 (14%) | 6 (12%) |
| hard-condition failures among returned | 12 of 43 | 11 of 44 |
| scene `structural` / competitor test true | 10 / 4 | 11 / **1** |
| `verified` | 7 of 43 (16%) | **11 of 44 (25%)** |
| full draft words, median (min-max) | 157 (121-225) | **119** (81-159) |
| drafts within 70-100 words | 0 | 7 |
| sentences, median; within 4-6 | 8; 7 of 43 | **5; 42 of 44** |
| `lead_specific_opening` false | 19 of 43 | 18 of 44 |
| drafts with an empty traceability entry | 1 | 1 |
| per lead unusable/runs | h1 2/5, h2 2/5, h3 2/5, h4 2/5, v1 2/5, v2 2/5, v3 3/5, v4 2/5, v5 1/5, v6 1/5 | h1 2/5, h2 1/5, h3 2/5, h4 0/5, v1 4/5, v2 2/5, v3 2/5, v4 2/5, v5 2/5, v6 0/5 |

## The pre-registered decision table, applied

| Observation | Result | Action the plan names |
|---|---|---|
| The manifest check | ok | continue |
| B's unusable rate at least 15 points below A, p < 0.10 | **no**: -4 points, p = 0.42 | **STOP; return to Alex; the next option is a reference reply (his words), not another wording round** |
| No-draft rate in B more than 10 points above A | no (12% against 14%) | none |
| Any `pricing language` error in B | **3** (A had 1) | read the drafts; below |
| An empty traceability entry in B at a higher rate | no (1 and 1) | none |
| `verified` in B below A | no (25% against 16%, up) | none |
| Median words within 70-100 / sentences within 4-6 | words 119 (not met), sentences 5 (met) | report only |
| A non-clarification hash (P4) fails | no | none |

## The three pricing-language errors in B, read

| Run | Matched text | Reading |
|---|---|---|
| h1 | `anchor` in "the wrong call either disappears when it should anchor the room" | the verb, ordinary prose: a **false reject** |
| h1 | `floor` in "a solo guitar disappear under the noise of a dance floor" | ordinary noun: a **false reject** |
| v1 | `$500` in "the wrong assumption by $500 doesn't help either of us" | a dollar figure, a hypothetical magnitude: **correctly rejected** by the grammar. B's step 2 asks for "the specific thing that goes wrong when a format is chosen blind"; whether that wording invites a price-like consequence is a hypothesis from one draft, not a finding |

So 2 of the 3 are false rejects of the validator's internal terms (`anchor`, `floor`). Over the 172 runs since the
validator fix, the internal terms rejected ordinary prose 4 times (anchor 3, floor 1); each cost a usable run.

## Readings

- **The primary did not move beyond what 50 runs can see.** 38% to 34% is inside the intervals, and the power was
  stated as about 55-60% for 15 points. This measurement cannot show an effect below about 15 points and does not
  show that there is none.
- **The instruction was partly followed.** Sentences fell from a median 8 to 5 (42 of 44 within 4-6) and words
  from 157 to 119, but only 7 of 44 fall within 70-100.
- **The competitor-test failures fell from 4 to 1;** the structural-scene failures did not (10 to 11). The
  "most vendors guess" contrast disappeared; the lack of a concrete moment did not. The change shortens the reply
  and removes the contrast; it does not ask for an image, and the verifier's scene check wants one.
- **`verified` rose from 7 of 43 to 11 of 44 (16% to 25%):** a secondary, exploratory observation, in the
  direction the change aimed at; no test of it was pre-registered.
- **`differentiated` false rose from 5 to 9** (step 2 is one sentence now): a possible cost, one count.

## Limits

- 50 runs per arm, one model, made-up leads, one run per lead per process; the primary has about 55-60% power for
  a 15-point effect.
- Arm B's lead-level counts are small (5 runs per lead): v1 4/5 and h4 0/5 are noise at that size.
- The A arm's held-out drafts were never read; the B drafts were read only as stated above.
