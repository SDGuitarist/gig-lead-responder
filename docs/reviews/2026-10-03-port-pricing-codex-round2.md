# Codex round 2 — fixes for the port/pricing round 1 (`198d94d..68af85b`)

**Verdict: NO-GO** (pasted by Alex on 2026-10-03). This is the second NO-GO on this change set: automatic review
iteration stops here. Round 3 only with `Round 3 authorized by Alejandro: YES`.
Gate: run at `6f8635d` (docs-only after `68af85b`).

(An earlier pass on the same prompt was run by Claude Code by mistake; it is not a Codex verdict and is not recorded.)

## Findings (as reported)

1. **P1 — Classification validator still accepts malformed runtime fields.** `validateClassification` still ends in
   `raw as Classification`. Unchecked, with downstream effects: `stealth_premium` (`"false"` is truthy: confidence,
   generate wedge), `competition_quote_count` (scoring, classify-verify), `format_requested` (`normalizeFormatText`
   can throw), `event_energy` (mariachi routing in `enrich.ts`), `venue_name` / `client_first_name`
   (`{}` → `TypeError: result.venue_name.trim is not a function`).
2. **P2 — Manifest test does not enforce the §0.5 contract.** `port-manifest.test.ts` checks marker + test-title
   existence only, not that the named test runs the real runtime function with meeting and non-meeting fixtures.
   R094 and R097 name `port manifest F5`, which only inspects `buildClassifyPrompt()` text.

Sweep: no further price/hours/table mismatch; generate validates the two drafts it uses; the five Bolero range lines
are allowlisted. Real-model behaviour stays UNEXECUTED (paid provider; owner Claude; trigger first Max-provider run).

## Fixes

(filled in by the fix pass)
