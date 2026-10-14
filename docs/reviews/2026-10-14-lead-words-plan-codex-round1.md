# Codex plan review round 1: the lead_words field, 2026-10-14

**Verdict: NO-GO** (5 P1, 2 P2), pasted by Alex. **Reviewed:** `docs/plans/2026-10-14-feat-lead-words-field-plan.md`
Revision 0 at HEAD `6126a75a9a...`.

| # | Codex finding | My check | Status |
|---|---|---|---|
| P1-1 | `validateClassification` has no `rawText`, the stored path bypasses it, and malformed `lead_words` values are undefined behaviour | CONFIRMED: `validateClassification(raw)` is the `callClaude` validator; only `classifyLead(rawText)` has the lead | valid |
| P1-2 | substring grounding permits "a wedding" inside "not a wedding"; trimming, accents, quote styles, line breaks unspecified | CONFIRMED: the plan's "cannot survive" claim is lexical, not semantic | valid |
| P1-3 | the regression stop rule "outside the baseline's spread" is not executable; `--compare` only prints | CONFIRMED: `scripts/classifier-regression.ts` compares observed value sets and never exits non-zero | valid |
| P1-4 | the arm design contradicts itself (paired vs plain counts, `--paired` in the command); the controls lack `lead_words` cells | CONFIRMED in the plan text and in `scripts/vague-gate-controls.ts` | valid |
| P1-5 | no insertion point or precedence for the drafter section | CONFIRMED: the plan said "outrank" without a position (the classification block is at `generate.ts:63`, reference blocks at line 85, STEP 1 after) | valid |
| P2-6 | the null-field verifier text is only byte-equality pinned | CONFIRMED | valid |
| P2-7 | spend and failure propagation understated; `--paired` adds three replays per run, the five background jobs are not checked | CONFIRMED (`--paired` adds three; a `wait` hides a failed job) | valid |

Counters: plan fix attempts so far 0; Codex plan reviews 1 (R1 NO-GO). A second NO-GO stops automatic iteration.

## Answers (plan Revision 1; no code)

| # | Answer |
|---|---|
| P1-1 | two boundaries and one accessor: `coerceLeadWords` (shape, no lead text, never throws, runs in `validateClassification`), `groundLeadWords` (lexical check in `classifyLead`), `leadWordsOf` (every consumer, so a stored malformed or missing value reaches a prompt as all-null); LW10 |
| P1-2 | the guarantee is narrowed to LEXICAL copying; a bounded negation guard for occasion and time frame ("not", "no", "never", "n't" right before the span); a defined normal form; LW11 |
| P1-3 | the unit is the modal value per (lead, field) and the count of runs off the mode; `--compare` exits 1 on a changed mode or a rise of 2; LW13 |
| P1-4 | plain counts, no `--paired`; a four-cell control matrix (null/valid x generic-or-label/quoted) with the stop rules per cell |
| P1-5 | the section goes immediately after the `lead_classification` block and before the voice examples, reference blocks and STEP 1, with a precedence sentence; LW12 |
| P2-6 | the null-field verifier text is called a lower-confidence fallback and tested by behaviour (cells A and B, LW9) |
| P2-7 | spend recomputed (about 350 arm calls at most, 28 for the controls); per-job status, `usage limits` count, file count and exit statuses must hold before any result is recorded |
