# Codex round 3 — price line fix (`8fcc962`)

**Verdict: NO-GO** (1 P1, 1 P2; Codex CLI `codex exec -s workspace-write`, run by Claude Code on 2026-10-09 at `8fcc962`; tree clean after). **Round 3 authorized by Alejandro: YES. Third NO-GO: the HARD CAP FIRED. No round 4; Alex decides what ships.**

**Claude Code correction (2026-10-09):** in round 2 I called the residency-series case unreachable because the series rate equals `quote_price`. That reasoning was WRONG: equal bases do not stop the series sentence stating the base while the appended travel block states base + fee. The P1 is real and reachable (duo residency series + a fee-bearing travel ZIP), and predates this range. The P2 (dual-format mariachi) is unreachable through normal pricing, as Codex itself notes.

Verbatim:

---

## Verdict: NO-GO

### P1 — Residency series with travel states contradictory totals

`src/prompts/generate.ts:221-223, 509-515`

A reachable duo residency series with a $150 travel fee tells the model:

- `$1050 per night`
- `Total ... $1200`
- “Present ONE total number ($1200)”

Root cause: residency-series pricing uses raw `q.rate`, while travel uses the client-total policy.

Required fix: apply `clientTotal(pricing, q.rate)` consistently to the series price and travel block. Add a regression test for residency series with fee, custom quote, included, Local, and no travel.

### P2 — Dual-format mariachi bypasses `clientTotal()`

`src/prompts/generate.ts:394`

The dual-format instruction interpolates `pricing.quote_price` directly. With a fee-bearing travel object, the header and price line use `clientTotal()`, but the dual-format text uses the base quote.

Root cause: mode-specific dual-format prose does not use the shared helper.

Required fix: use `clientTotal(pricing, pricing.quote_price)` and add a travel-matrix regression test. The fee case is currently unreachable through normal mariachi pricing, but the prompt builder accepts it and the requested invariant covers it.

Checked clean:

- `npm run test:match -- "port manifest R30"` — 124 tests, 0 failures
- `npm run test:match -- "port manifest R058"` — 128 tests, 0 failures
- `npm run test:match -- "residency"` — 131 tests, 0 failures
- `npx tsc --noEmit` — passed
- No files edited


