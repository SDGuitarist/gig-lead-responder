# Codex round 1 — structured price line R300-R302 (`5fe4acc..4c1d700`)

**Verdict: NO-GO** (2 P1, 1 P2; Codex CLI `codex exec -s workspace-write`, run by Claude Code on 2026-10-09 at `4c1d700`; tree clean after). Pre-registered stops: 2nd NO-GO stops automatic iteration; round 3 only with `Round 3 authorized by Alejandro: YES`.

**Claude Code note:** the budget-block vs travel-block total conflict (P1, first) predates this range (the small/large blocks stated the base quote while the travel block said one total); the new PRICE LINE made it three-way. Fixed in scope anyway.

Verbatim:

---

## Verdict: NO-GO

### P1 — Budget prompts can produce contradictory client-facing totals

`src/prompts/generate.ts:426`, `src/prompts/generate.ts:436-442`, `src/prompts/generate.ts:372`, `src/prompts/generate.ts:505-511`

With travel, `## PRICE LINE` correctly uses quote + fee, but the small/large budget blocks still instruct the model to state the base quote and scoped alternative without travel.

Example: base `$595` + `$150` travel:

- Budget block says `$595`
- Travel/price-line block says `$745`

The post-check accepts both because both are app-supplied figures, so this can pass while telling the client two different totals.

Root cause: budget-mode instructions and the new client-facing travel total use separate price representations.

Required fix: derive/use one client-facing price policy for budget modes, including travel totals and scoped alternatives. Add regression tests for small and large budget gaps with travel.

### P1 — “State the price once” conflicts with required large-budget behavior

`src/prompts/generate.ts:376-379`, `src/prompts/generate.ts:440-442`

The new block requires one price, once, on its own line. The large-budget block separately requires:

1. the scoped alternative price, and
2. the full-duration upgrade price.

The exception says the budget section may add only “its one scoped alternative,” but the large-budget section explicitly adds another upgrade price. The model receives incompatible instructions and may omit the alternative, omit the upgrade, or violate the structured-line rule.

Root cause: the global ordinary-quote price-line rule was added without mode-specific exceptions for budget qualification.

Required fix: explicitly define the permitted price lines for each budget mode and add tests proving the large-gap prompt preserves both required prices in the correct order.

### P2 — R301 test coverage omits `flamenco_trio_full`

`src/port-manifest-price-line.test.ts:32-40`

`ALEX_PERFORMS` includes `flamenco_trio_full`, but the positive test only checks `flamenco_trio`. A regression removing the included clause for `flamenco_trio_full` would pass the manifest tests.

Required fix: include `flamenco_trio_full` in the positive cases, plus an extended-dancer control if that distinction is intended to matter.

Checked clean:

- No concrete false promise found for `flamenco_trio` with a dancer; the format is intentionally in the approved Alex-performs list.
- Mariachi dual-format pricing remains explicitly instructed to lead with the full ensemble.
- Graceful-decline ordering remains present.
- Priced hours and travel total arithmetic align for ordinary non-budget quotes.
- `npm run test:match -- "port manifest R30"` — 4 passed.
- `npm run test:match -- "buildGeneratePrompt"` — 7 matched tests passed.
- `npx tsc --noEmit` — passed.
- No files were edited.

