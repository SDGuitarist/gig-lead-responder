# Codex code review round 1: the lead_words build (plan Revision 1c), 2026-10-14

**Verdict: NO-GO** (2 P1, 1 P2), pasted by Alex. **Reviewed:** `95f3dda..7381d967af` (HEAD `7381d967af...`). Codex's sandbox
blocked the leak check and unrelated socket tests (`listen EPERM`): UNEXECUTED on its side; my run at the same HEAD:
1134 pass / 0 fail / 1 skip, `tsc` clean, leak check exit 0. It found no defect in the boundary, the grounding rules,
the prompts or the regression gate; all three findings are in the measurement scripts.

| # | Codex finding | My check | Status |
|---|---|---|---|
| P1-1 | the report prints `opening-false` over RETURNED drafts, the plan's table says "of 50 runs": no-draft runs shrink the denominator and can dodge the "20 of 50" stop | CONFIRMED in `scripts/clarification-arm-report.ts` (`openingFalse` of `returned.length`) | valid |
| P1-2 | `lead-words-grounding.ts` calls `callClaude` with an identity validator, not `classifyLead`, so it skips `validateClassification` and the production grounding path | CONFIRMED in the script; the plan's Execution Path says it "calls `classifyLead` only" | valid |
| P2-3 | the runner reads `o.classification.lead_words` raw, a consumer outside the accessor | CONFIRMED (`scripts/clarification-measure.ts`, the route record) | valid |

Counters: code fix attempts so far 0; Codex code reviews 1 (R1 NO-GO). A second NO-GO stops automatic iteration.

## Fixes applied (fix attempt 1)

| # | Root cause | Fix | Test (positive control) |
|---|---|---|---|
| P1-1 | the report divided by returned drafts, so no-draft runs left the denominator | `summarizeOpening` (`src/route-metrics.ts`) counts over ALL runs; the report prints "N of 50 runs (M returned a draft, K none)" | LW15 (30 of 50 with 10 no-draft runs; the returned-draft number is unchanged) |
| P1-2 | the grounding script called the model directly with an identity validator | `src/lead-words-measure.ts` `groundingRun` runs the production `classifyLead` and only wraps the requester to capture the model's raw `lead_words` before the code check | LW15 (a copied phrase returned and kept; a paraphrase returned and dropped; a classification the production validator rejects is an error; the requester is restored) |
| P2-3 | the runner read `o.classification.lead_words` raw | the route record reads `leadWordsOf(o.classification)` | LW15 inventory: an AST allowlist of every `.lead_words` property access in non-test `src` and `scripts` (accessor 1, producer in classify.ts 4, measurement seam 2, sanitize presence check 1, the report's stored-record read 1); a new raw consumer fails |

**Bounded inventory (`rg lead_words src scripts`, non-test):** the accessor and producers in `src/lead-words.ts` and
`src/pipeline/classify.ts`; the type in `src/types.ts`; the prompt text in `src/prompts/*`; `sanitize` (presence check, then
`leadWordsOf`); the measurement seam; the controls script (builds inputs); the report (reads an already-coerced stored
record). No other reader.

**Mutations added (each caught, then restored):** 15 the seam returns the raw coerce as kept (LW15, 2 tests); 16 the
opening denominator over returned only (LW15); 17 a raw `.lead_words` read added to a production file (LW15).

**Results:** `npm test` below; the real-model measurement is NOT run (API spend, Alex's "go").
