# Clarification draft-shape measurement, arm A (the baseline, before the change), 2026-10-13

**Plan:** `docs/plans/2026-10-13-fix-clarification-draft-shape-plan.md` (Revision 1b), step 3. **Code:** `0f269d9`
(runner with the arm manifest; the generate prompt is UNCHANGED). **Method:** `scripts/clarification-measure.ts
--arm A --runs 1`, 5 parallel processes (tags A1-A5) x 10 made-up vague leads (v1-v6 and the held-out h1-h4), real
model, scratch databases, today pinned to 2026-10-12, nothing sent. **Exploratory and observational: 50 runs, one
model, made-up leads, one run per lead per process.** Report: `scripts/clarification-arm-report.ts` (counts only).
The per-run drafts of h1-h4 were NOT read.

## Manifest check (the arm's side)

| Check | Result |
|---|---|
| five manifests deep-equal in every field | yes |
| `promptSha256` equals the pre-change C0 hash in `src/fixtures/generate-prompt-hashes.json` | yes (`e4bbb581...c3ca`) |
| `gitSha` | `0f269d9957fd8ee8bab4a7998af83b6f1e0345bf` |
| `dirtyPromptFiles` | empty |
| `models` | `claude-sonnet-4-6` |
| `today` | 2026-10-12 |

The cross-arm checks (ancestry, equal model/date/lead set, B's hash differs) run when arm B exists.

## Result

| | Arm A (baseline) |
|---|---|
| runs | 50 |
| no draft (`GenerationError`) | **7** (14%) |
| returned drafts | 43 |
| **PRIMARY: unusable runs** (no draft, or scene not cinematic, or competitor test true) | **19 of 50 = 38%** (95% Wilson 26%-52%) |
| hard-condition failures among returned (scene structural 10, competitor true 4) | 12 of 43 |
| `verified` | 7 of 43 |
| drafts with an empty concern-traceability entry | 1 |
| full draft words (min / median / max) | 121 / **157** / 225; within 100 words: 0; within 125: 1 |
| sentences (min / median / max) | 5 / **8** / 11; within 4-6: 7 of 43 |
| per lead (unusable / runs) | h1 2/5, h2 2/5, h3 2/5, h4 2/5, v1 2/5, v2 2/5, v3 3/5, v4 2/5, v5 1/5, v6 1/5 |

The no-draft runs: "exactly one question" in 6 (5 full draft, 1 compressed draft), and a pricing-language rejection
on the word "anchor" in 1.

## Readings

- **The baseline is about 38%, near the 44% the plan assumed.** The ten leads give a similar rate (1 to 3 of 5 each),
  and the held-out leads are not easier or harder than v1-v6.
- **Power, for the record:** with this 38% baseline and 50 runs in arm B, a 15-point drop (to 23%) would be
  detected about 55-60% of the time; a 25-point drop about 90%.
- **"Exactly one question" is more frequent here:** 6 of 50 runs (12%); over all measurements 12 of 122 (10%). It is
  not this plan's change, but it moves the no-draft denominator, which the primary estimand counts.
- **"anchor" false reject, again:** 1 of 50 runs here, 2 of 68 over the two sets that recorded it (the verb in
  "to anchor the ceremony"). It is a validator item from the first cycle, not in this plan.
- **Length:** 0 of 43 full drafts within 100 words, median 157: the prompt's own 100-125 range is not followed.

## Limits

- 50 runs, one model, made-up leads, one run per lead per process; a rate from this sample has the interval above.
- The aggregate report prints no draft; whether an unread h1-h4 draft shows something the counts do not is not known.
