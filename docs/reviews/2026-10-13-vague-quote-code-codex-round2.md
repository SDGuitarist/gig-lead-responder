# Codex code review round 2: vague-lead quote route, 2026-10-14

**Verdict: NO-GO** (one P1), pasted by Alex. **Reviewed:** `687995b..35a8568` (HEAD `35a8568720...`), fixes only. Prior
verdict: R1 NO-GO, `docs/reviews/2026-10-13-vague-quote-code-codex-round1.md`. This is the second NO-GO on the same
change: **automatic iteration stops**; round 3 only with the literal `Round 3 authorized by Alejandro: YES`.
Codex made no repository change.

## Finding and my check

| # | Codex finding | My check | Status |
|---|---|---|---|
| P1 | `src/data/vague-quote-reference.ts` (step 5) permits the model to copy the setup sentence word for word with no condition. For a lead that contradicts it (no outlet, no seating, a space where "restaurant" is wrong), a generally true rig statement becomes a false claim | CONFIRMED by reading step 5: the permission is "you may use the example's own setup sentence word for word: it is Alex's fact about his rig", and the sentence also makes a venue claim ("home, backyard, or restaurant all work"). It is the exact question I put to Codex as focus item 3, and the NO INVENTED FACTS paragraph does not carve it out. Findings 1, 2 and 4 were not re-raised | valid, small |

Counters: fix attempts so far 1; Codex reviews 2 (R1 NO-GO, R2 NO-GO).

## Recommendation for round 3 (not authorized)
Remaining finding is prompt wording that a deterministic test pins (one sentence of the block plus V10c). Round 3
would settle whether that one sentence is right, which a unit test on the text already shows; it touches no money,
data, auth or send path. Recommend STOP: apply the one named wording fix and run no round 3. On another NO-GO the
hard cap would fire with no round 4.

## Fix applied (iteration 2; Alex chose "Fix the one sentence, no round 3")

- **Root cause:** step 5 of the block granted the setup-sentence permission with no condition, while the sentence
  carries a venue claim ("home, backyard, or restaurant all work").
- **Fix:** the permission now reads "ONLY when it is compatible with this lead and does not contradict the venue or
  setup facts the lead gave; otherwise write the setup need from this lead and the Quote Terms"; the DO NOT REUSE
  paragraph exempts the sentence only "where step 5 allows it". The prohibition on every other example sentence and
  the cut in `sharedWindows` are unchanged; no runtime rejection.
- **Test:** V10c pins the condition, the contradiction case and the fallback; it FAILS on the pre-fix block (0 pass, 1
  fail, run against the old data file). Positive control (the setup sentence cut gives 0 windows) and the copied-clause
  negative control are unchanged and still pass.
- **Bounded inventory** (`rg "may use|word for word|EXCEPT|apart from|example's own" src/data src/prompts`): one other
  hit, `src/data/t4-reference.ts:66` ("DO NOT REUSE the example's own moves"), a prohibition, not a permission. No
  second unconditional permission.
- **Results:** `npm test` 1061 pass / 0 fail / 1 skip, `tsc` clean, leak check exit 0.
- **No round 3.** Remaining risk: the model's judgment of "compatible" is not measured (no real-model arm on this
  prompt); owner Alex ("go"), trigger any later vague-lead measurement.
