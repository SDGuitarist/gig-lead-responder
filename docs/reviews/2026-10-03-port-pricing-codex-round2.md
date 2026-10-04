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

| Finding | Root cause | Fix | Test (red first) |
|---|---|---|---|
| 1 Classify casts | validator checked a subset, then `raw as Classification` | `e23baf4`: `stealth_premium` boolean, `competition_quote_count` finite ≥ 0, `format_requested` string, `event_energy` enum or null, `venue_name` / `client_first_name` string or null | `classify parse: remaining runtime fields are rejected when malformed` (red: `TypeError: result.venue_name.trim is not a function`); control: nulls, zero, real values, blank venue → null |
| 2 Manifest contract | marker and test title were checked separately, never against each other | `e575b0c`: the named test file must contain the row's marker; a conditional row's test must contain an absence assertion | `port manifest PORTED rows: the named test asserts the marker...` (red: 16 rows) |

Inventory (120 PORTED rows): 12 named tests never asserted their marker (R027, R028, R031–R034, R037, R039, R048,
R051, R094, R097); 4 conditional rows had no absence assertion (R078, R079, R369, R406). Fixed by adding the marker to
the named test (F2, F2 verify, F5), output markers for R037/R048/R051 (R051 also gained an in-county control), and
truthful conditions for R078/R079/R369/R406: `buildClassifyPrompt` takes no lead, so its output cannot vary by
condition; the model applies those rules.

**Deferred, explicitly:** whether the model applies the venue/urgency/ukulele conditions (R078, R079, R094, R097,
R369, R406) is UNEXECUTED. No deterministic seam evaluates them; a code cross-check would change tier/pricing
outcomes (Alex's call, separately planned). Reason: drafting bills the paid key. Owner: Claude. Trigger: first
Max-provider real-lead runs. The check is per test FILE, not per test body.

Full suite: 491 pass, 0 fail, 4 skip; `tsc` clean; `git diff --check` clean.

**Not in Codex's findings (Claude's earlier pass, Alex flagged 2026-10-03):** `docs/RESPONSE_CRAFT.md:210` (loaded
for every lead) states four T2P-only prices; a D-column lead's real prices differ. Not fixed in this pass.
