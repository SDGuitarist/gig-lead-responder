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



## Run B (Alex re-ran round 3 with the same prompt), verbatim

## Verdict: NO-GO

### P1 — Residency series still exposes both base and client-total prices

src/prompts/generate.ts:221-223

For a non-solo residency series with a travel fee, the prompt tells the model:

- $1,100 per night from q.rate;
- $1,250 in the appended travel block.

clientTotal(pricing, q.rate) is $1,250, so the $1,100 line is inconsistent with the required client-facing total and can produce two prices.

Root cause: the residency-series branch still interpolates q.rate directly instead of applying clientTotal().

Required fix: make the residency-series client-facing price use clientTotal(pricing, q.rate) and ensure the travel block does not create a conflicting second client price. Add a residency-series-with-fee regression test and ensure the post-check accepts its total/deposit.

The PRICING header, ordinary/budget modes, dual-format reachable paths, graceful decline, clarification, and post-check travel threshold are otherwise consistent. This is the third NO-GO; the review-loop hard cap now applies.

Checked clean:

- npm run test:match -- "port manifest R30" — passed
- npm run test:match -- "port manifest R058" — passed
- npm run test:match -- "residency" — passed
- npx tsc --noEmit — passed
- Worktree remains clean
- No files edited

---

**Closed 2026-10-09 (Alex chose option (a): fix and ship, no further Codex round; hard cap honoured).** `1fba7c4`: the
residency-series price is `clientTotal(pricing, q.rate)`, so it and the travel block state one total. Test
`residency series: with a travel fee, the per-night price is the one client total` (mutation-checked: reverting to
`q.rate` fails it). The run A P2 (dual-format mariachi) is unreachable through normal pricing (Codex says so; run B
found the reachable dual-format paths consistent): left as is. Not Codex-reviewed, by Alex's decision. Price-line
review CLOSED.
