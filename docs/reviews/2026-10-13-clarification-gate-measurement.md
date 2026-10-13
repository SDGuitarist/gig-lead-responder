# Clarification mode: why does the verify gate fail the drafts? (measurement 2, 2026-10-13)

**Code:** `5349825` (runner records the final gate detail; app code `d1c5941`). **Method:**
`scripts/clarification-measure.ts`, 3 parallel processes x 6 made-up vague leads, 1 run each (18 runs), real model,
scratch DB, today pinned to 2026-10-12, nothing sent. **Observational: 18 runs, one model, made-up leads.** Follows
`docs/reviews/2026-10-13-clarification-verify-measurement.md` (1 of 18 verified; the cause was not known).

## Result

| | Count |
|---|---|
| runs | 18 |
| drafts returned | 17 |
| no draft | 1 (`exactly one question`: two sentences each ended in `?`) |
| `verified: true` | **0** (first set: 1 of 18; together 1 of 36) |
| generate calls | 53 |

## Why each of the 17 drafts failed (the gate's own rule, section 9 of `src/prompts/verify.ts`)

The rule: scene_type cinematic, competitor_test false, no empty traceability, and at least 16 of 18 gut checks true
(`GUT_CHECK_THRESHOLD` = total - 2; the `// 15` comment in `src/types.ts` is stale, the total is 18).
`competitor_test` is one of the 18 keys but passes when FALSE; the runner does not count it twice.

| Cause | Drafts |
|---|---|
| A hard condition fails: scene_type `structural` (8) and/or competitor_test true (3), 2 overlap | **9** |
| Hard conditions pass, at most 2 other checks false (the rule would PASS), the verifier failed it anyway | **6** |
| Hard conditions pass, 3 or more other checks false | 2 |

In the middle row, 4 have `lead_specific_opening` as the only false check and the only fail reason; `b v6` also has
`sounds_like_alex` false, and `a v5` also carries code-side voice-kill violations ("land", "lands", "here's the
thing"; `src/pipeline/post-check.ts:143-144`), which fail a draft deterministically (corrected after plan review
round 1, P1-1). The verifier's reasons say the opener "contains no concrete detail from the classification (no
date, venue, guest count, format)". `gate_status` is the verifier model's judgment, not computed in code
(`src/pipeline/verify.ts` copies it), so the gate is stricter than its own stated rule on these leads.

`lead_specific_opening` was false in **17 of 17** drafts, and the lead never contained a detail the opener could cite.
The generate prompt tells the model to build the scene "from the experience, not the lead details" on sparse leads;
the verify prompt asks the opener to cite a detail from the classification. The two instructions disagree for a
vague lead. Neither prompt is aware of the other.

## Other readings

- **"Exactly one question":** 1 of 18 runs this time (0 of 18 in the first set, 3 of 18 before the price fix): 4 of 54
  overall. A split question again ("Before I quote, one question: ... ?" then "Which direction fits?").
- **Cost:** 3 generate + 3 verify calls per run, because the rewrite loop runs to its cap and the rewrites do not fix it.

## Limits

- 18 runs, one model, one run per lead per process, made-up leads; the 8 structural-scene drafts were not read.
- "The rule would pass" is computed from the verifier's own gut-check booleans; the verifier may have judged other
  parts of section 9 (sign-off, platform check) that the booleans do not show.
