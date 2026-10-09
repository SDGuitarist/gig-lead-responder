# NP2 local runs (execution before Codex round 2), 2026-10-09

**Reader and trigger:** Codex round 2 (cited in its prompt) and the next session (HANDOFF NP2 block). Why: Alex's
rule, "software never executed: run it before reviewing more". Command: `DATABASE_PATH=<scratch> npx tsx
src/index.ts --json < lead.txt` (no send; `data/leads.db` untouched, last modified Oct 3). Leads are made up
(Example names only). Model: the app's configured Claude model.

## Run 1 (at `7d7e4a3`, after round-1 fixes)

| Lead | Classified | Price | In-kind line | Checks |
|---|---|---|---|---|
| 1 foundation donor reception, 2h | NP2, T2D | standard $700 (no NP price: $5 above) | none | held, note correct |
| 2 arts foundation, 1h, "budget not a concern" | NP2, T3D | NP2 $500, standard $650 | exact, placed right; org = "your organization" | PASSED (false pass) |
| 3 hope foundation at a named hotel, 1h | NP2, T3D | NP2 $500, standard $650 | exact, venue right; org left as "[organization]" | held (correct) |
| 4 literacy foundation, 1h | NP2, T3D | NP2 $500, standard $650 | exact, placed right; org = "your foundation" | PASSED (false pass) |

**Finding:** wording and placement right 3/3 (no false holds), organization name 0/3. Root cause: the drafter
never sees the lead text (`generateResponse` gets the classification only), so it could not fill [organization].
Alex chose: the classifier extracts `organization_name`; the app writes it (`43ba208`, `fc35d66`, `6d40b8a`).

## Run 2 (after the fix)

| Lead | organization_name | Price | In-kind line | Checks |
|---|---|---|---|---|
| 2 | Example Arts Foundation | NP2 $500, standard $650 | "...contribution to the Example Arts Foundation." both drafts, right after the price | pass |
| 3 | Example Hope Foundation | NP2 $500, standard $650 | "My standard Example Grand Hotel rate is $650, ...to the Example Hope Foundation." | pass |
| 4 | Example Literacy Foundation | T2D $595 (no NP price: $95 above) | none | held |

**Observed:** lead 4 was T3D in run 1 and T2D in run 2 (same text): NP2 eligibility at 1h flips with the
classifier's T2/T3 call. Sample is 3 priced drafts; the false-hold rate on varied real leads is unmeasured.
