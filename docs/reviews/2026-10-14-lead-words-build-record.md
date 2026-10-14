# lead_words plan (Revision 1c): build record, 2026-10-14

**Plan:** `docs/plans/2026-10-14-feat-lead-words-field-plan.md`. Plan reviews R1, R2 NO-GO and R3 `(b)` (one finding, the
`RESULT=PASS` line), cap fired, Alex chose "Accept the plan, fix the one line, build". Code is NOT yet code-reviewed and
**no real-model run has been made** (the classifier regression `before`/`after`, the grounding count, the arm and the
controls are API spend and wait for Alex's "go").

## What was built (commits after `95f3dda`)

1. `src/lead-words.ts`: `coerceLeadWords` (shape, never throws), `groundLeadWords` (normal form, lexical substring,
   token-level negation guard for occasion and time_frame, doubt-marker list and never equal to the occasion/time frame),
   `leadWordsOf` (the accessor); the optional `Classification.lead_words`; `sanitizeClassification` reads through the
   accessor (absent stays absent). Tests LW1, LW8, LW10, LW11, LW14.
2. the classifier prompt (one paragraph + one schema line), `classifyLead` coerces then grounds; the prompt's SHA-256 pin
   re-pinned on purpose (`snapshot refresh:`, `eb8c9b54...` to `d6a9583b...`). Tests LW2, LW6.
3. the drafter section "WHAT THE LEAD WROTE" (after the classification block, before the pricing, voice examples,
   reference blocks and STEP 1; gated to vague + one_question with a non-null phrase; wrapped; precedence sentence) and the
   verifier sentence in the two scoped 6b texts (only with a phrase). Tests LW4, LW5, LW12.
4. `src/regression-compare.ts` and `classifier-regression.ts --compare` (exit 0 / 1 / 2). Tests LW13 (incl. a real
   process run).
5. `scripts/lead-words-grounding.ts`, the five-cell controls matrix (`vague-gate-controls.ts`), `lead_words` in the route
   record, the report's opening-false and kept-phrase lines; `LEADS` moved to `scripts/measure-leads.ts` (the lead-set
   hash is unchanged: `7663845c...`).

## Mutation map (each row applied by hand, then `npm run test:match -- "Lead Words"`, then restored)

| # | Mutation | Result |
|---|---|---|
| 1 | substring check removed | caught (LW2, LW11) |
| 2 | 80-character cap removed | caught (LW10, LW14) |
| 3 | section applied to `quote` | caught (LW4) |
| 4 | section gate drops `vagueness` | caught (LW4) |
| 5 | verify sentence applied when all null | caught (LW5) |
| 6 | generate section unwrapped | caught (LW4) |
| 7 | `coerceLeadWords` not called in `validateClassification` | **SURVIVES, by design:** `classifyLead` coerces again before grounding (defence in depth), so no observable difference; the stored-classification path is covered by LW10/LW14 through `leadWordsOf` |
| 8 | `leadWordsOf` dropped from the generate consumer | caught (LW14) |
| 9 | `sanitizeClassification` serializes the raw field | caught (LW14) |
| 10 | doubt-shape guard removed | caught (LW11) |
| 11 | regression tie-break removed | **first run SURVIVED**; added a tie whose first-seen value is not the smallest; now caught (LW13) |
| 12 | negation guard removed | caught (LW11) |
| 13 | accent folding removed | caught (LW11) |
| 14 | `--compare` exit status ignored | **first run SURVIVED** (no test ran the script); added a real-process test; now caught (LW13) |

## Pinned limits (stated, not hidden)

- The negation guard looks at the ONE token before the span: "we don't want a wedding" keeps "a wedding" (LW11 pins it).
- A doubt in words outside the bounded marker list is null; the verifier then falls back to the classification text.
- Grounding is LEXICAL copying, not semantic truth.
- `before` regression: taken on a worktree of `95f3dda` at the measurement stage, not now (API spend).

## Verification (CHECKED on the build)

`npm test` 1134 pass / 0 fail / 1 skip (after the two added LW13 tests); `npx tsc --noEmit` clean; leak check exit 0.
