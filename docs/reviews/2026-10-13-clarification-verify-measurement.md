# Clarification mode after the validator fix: does a draft pass the verify gate? (measurement, 2026-10-13)

**Code:** `55dcf1f` (runner now records `verified`, gate status, fail reasons and question sentences; app code is
`d1c5941`). **Method:** `scripts/clarification-measure.ts`, 3 parallel processes x 6 made-up vague leads, 1 run each
(18 runs), real model, scratch `DATABASE_PATH`, today pinned to 2026-10-12, nothing sent. **Observational: 18 runs,
one model, made-up leads.** Raw JSON in the session scratchpad (not committed).

## Result

| | Count |
|---|---|
| runs | 18 |
| runs that returned a draft | 16 |
| runs with no draft | 2 (both `must not include pricing language`) |
| drafts with `verified: true` | **1** |
| drafts with `verified: false` (`gate_status: fail` after the 3 attempts) | **15** |
| generate calls | 48 (about 3 per run: the rewrite loop runs to its cap) |
| generate calls with a draft holding other than one `?` | **0 of 48** |

Gate fail reasons across the 15 (a draft can fail several): `lead_specific_opening` 11, `can_see_it` 5,
`scene_type` 4, `differentiated` 4, `competitor_test` 3, `named_fear` 3, `voice_kill_*` 4, `sounds_like_alex` 2,
`prose_flows` 2, `concern_traceability` 1.

## Three readings

1. **The path now fails at the verify gate, not at the validator.** 15 of 16 drafts that exist are not verified, so
   auto-send holds them and the dashboard shows a failed gate. 11 of 15 fail `lead_specific_opening`: a vague lead
   has no concrete detail to open with, and the gate asks for one (`src/prompts/verify.ts`, section 6b). The gate
   already special-cases `budget_acknowledged` and `genre_default_stated` for clarification mode; it does not
   special-case the opening. A gate at 1 of 18 cannot separate "weak draft" from "check calibrated for another mode".
2. **"Exactly one question" did not recur: 0 of 48 calls** (earlier: 3 of 18 runs ended on it; 0 of 21 before the
   first fix). Across both re-runs that is 3 of 36 runs. Noise or a rare model habit; no evidence for a change now.
3. **The pricing-language check rejected 2 of 18 runs; one is a false reject.**
   - v5: "the number I send you right now could be off by a thousand dollars" (a spelled-out amount next to dollars:
     inside the grammar by design, though it is a magnitude, not a quote).
   - v3: "which part of the day they want live music to **anchor**" (the verb; rejected by the internal term `anchor`).
     Ordinary prose rejected. The plan's review focus named this risk; V4a pins `anchor` as a rejected word.

## Limits

- 18 runs, one model, made-up leads; 1 run per lead per process; the contexts of the gate's reasons were not read
  draft by draft beyond the two rejections above.
- `verified` here is the pipeline's final `verified` (gate pass AND no post-check violations).
