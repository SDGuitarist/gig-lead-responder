# Codex round 1 — T4 luxury-corporate tier (`32a1607`, `9d91d09`, `44e103d`, `fa81867`)

**Verdict: NO-GO** (run A, Claude Code: GO; run B, Alex: NO-GO with 2 P1 + 1 P2; the runs DISAGREE again and run B is the
one finding real defects). Pre-registered stops: a 2nd NO-GO stops automatic iteration; round 3 only with `Round 3
authorized by Alejandro: YES`.

**Claude Code check (2026-10-09):**
- P1 private party at T4 can auto-send: REAL. Fixed in round 2 scope (T4 held unless event_arc is corporate).
- P1 sourced formats absent from the classifier's format list: REAL and PRE-EXISTING (the Instrument Rule only routes
  to mariachi or bolero_trio; no code path ever chooses a sourced_cultural_* format, so those tables, old and T4, are
  dormant). Making them reachable is a NEW capability (which leads become sourced bookings), so it leaves the fix loop
  as separately planned work; put to Alex.
- P2 nonprofit fail-open on a classifier + backup miss: already ACCEPTED by Alex (option a, NP routing round 3); the
  limitation is stated in code and HANDOFF. No change. Verbatim:

---

## Verdict: GO

No P1, P2, or P3 findings.

Checked clean:

- T4 pricing, fallback, budget-gap/scoped alternatives, minimum-profit checks, residency, enrichment re-pricing, prompts, dashboard/analytics, edit pipeline, and auto-send routing.
- Nonprofit and platform T4 leads acquire hold concerns and cannot auto-send.
- `npm run test:match -- "port manifest R403 T4"` — 8 passed.
- `npm run test:match -- "runPipeline"` — 20 passed.
- `npx tsc --noEmit` — passed.
- Worktree remains clean at `fa81867`.


## Run B (Alex), verbatim

## Verdict: NO-GO

### P1 — T4 private parties can auto-send

`src/pipeline/classify-verify.ts:165-170`

The prompt says T4 is never for private parties, but the deterministic verifier only rejects platform leads and ceremonies. A direct birthday/private-party lead classified as `T4` can have no flagged concerns, pass routing, and auto-send through `src/automation/router.ts:74-102`.

Root cause: no check for `event_arc === "private_celebration"` or equivalent private-party signals.

Required fix: add a deterministic T4 hold for private-party classifications and regression-test that `routeLead` returns `hold`.

### P1 — Sourced T4 formats are omitted from the classifier’s format contract

`src/prompts/classify.ts:138,222`

The new T4 rows cover `sourced_cultural_solo`, `sourced_cultural_duo`, `sourced_cultural_trio`, `sourced_cultural_quartet`, and `sourced_cultural_5piece`, but the classifier prompt’s valid format list contains none of them. The model is therefore instructed to emit only the older formats, making the sourced T4 rows unreachable through the normal classification contract.

Root cause: the T4 pricing tables were added without updating the model-facing format enumeration.

Required fix: include all sourced formats in the classifier’s valid-format instructions and add a classification test proving a sourced T4 format can reach pricing.

### P2 — A nonprofit can still auto-send on a classifier and backup-detector miss

`src/pipeline/classify-verify.ts:156-163`

If the model returns `nonprofit_buyer: false` and the raw text contains none of the finite backup patterns, no nonprofit concern is added. Routing then sees no concern and may auto-send. This is documented as a known gap, but it conflicts with the stated “every nonprofit lead is held” policy.

Root cause: nonprofit detection is fail-open when both model classification and keyword backup miss.

Required fix: either add a stronger fail-closed rule for uncertain T4 buyer identity or explicitly narrow the acceptance claim and keep this limitation visible.

Checked clean:

- `npm run test:match -- "port manifest R403 T4"` — 8 passed
- `npm run test:match -- "runPipeline"` — 20 passed
- `npx tsc --noEmit` — passed
- Worktree clean; branch `feat/hub-phase0`; HEAD `fa81867`
- No files edited; no server, poller, database, network, or browser used
