# Codex round 2 — price line fix (`f0a71e3`), run twice

**Verdict: NO-GO, both runs** (Codex CLI `codex exec -s workspace-write`, 2026-10-09, at `f0a71e3`; tree clean after each). Run A by Claude Code; run B re-run by Alex with the same prompt pinned to `f0a71e3`. **Second NO-GO. Round 3 authorized by Alejandro: YES** (2026-10-09, his words: "record + fix + Round 3 authorized by Alejandro: YES").

## Claude Code check of the findings (2026-10-09)

- **PRICING header shows raw quote/anchor/floor beside travel totals** (A #1, B #1): REAL; predates this range (the TRAVEL FEE block always contradicted it). Fixed in round 3 scope.
- **Dual-format mariachi, residency series, graceful decline** (A #2, B #1): no second total reachable. `CONCERN_4PIECE_ALT` is set only for `mariachi_full` (`src/pipeline/enrich.ts:45`), whose travel is always custom quote or included, so `clientTotal` = base; a residency series has `rate: quote_price` (`src/pipeline/price.ts:164`); graceful decline uses the same PRICING block (only the header issue applies).
- **Post-check adds a fee on custom-quote or Local travel** (A #3, B #2): UNREACHABLE with real data. Sweep of every ZIP in `src/data/zip_distances.json` (1,265) x every format: 16,445 priced travel results, 0 custom-quote and 0 Local with a fee > 0 (`buildTravelComponent` sets fee 0 for a custom quote, `src/pipeline/price.ts:271-273`). Fixed anyway: post-check now derives totals from `clientTotal()` (one rule, not two).

## Run A (Claude Code), verbatim

## Verdict: NO-GO

### P1 — Raw PRICING header still contradicts travel-inclusive totals

`src/prompts/generate.ts:66-67`

With travel, the model sees raw `quote_price`, `anchor`, and `floor`, while the travel and price-line blocks use `base + fee`. This leaves contradictory numbers in one prompt.

Root cause: the PRICING header bypasses `clientTotal()`.

Required fix: apply the same client-facing total policy to the header, or clearly mark raw values as internal-only and prevent them from being used in drafts.

### P1 — Dual-format mariachi and residency-series travel paths still use inconsistent bases

`src/prompts/generate.ts:219-223`, `src/prompts/generate.ts:394`, `src/prompts/generate.ts:504-514`

- Dual-format mariachi says `pricing.quote_price`, while the price line uses the travel-inclusive total.
- A residency series states `q.rate`, but its appended travel block calculates from `pricing.quote_price`, which may be a different private-event rate.

Root cause: mode-specific pricing blocks do not share the same client-facing base/total calculation.

Required fix: use the correct mode-specific base with one shared total helper for residency series and dual-format mariachi.

### P1 — Custom-quote travel remains inconsistent in post-check

`src/pipeline/post-check.ts:224-226`

The prompt correctly says custom travel must not be calculated, but `belowFloorPrices()` still adds `travel.fee` and `quote_price + travel.fee` to `totals` whenever travel is not included. A valid base-price draft can therefore be held against an undisclosed calculated total, and an unshown travel total can be treated as supplied.

Root cause: post-check travel logic excludes `included_in_price` but not `custom_quote_required`.

Required fix: align post-check totals and supplied values with `clientTotal()`/`buildTravelBlock()` so custom-quote travel uses only the base quote.

Checked clean:

- `npm run test:match -- "port manifest R30"` — passed
- `npm run test:match -- "port manifest R058"` — passed
- `npm run test:match -- "buildGeneratePrompt"` — passed
- `npx tsc --noEmit` — passed
- Worktree remains clean
- No files edited



## Run B (Alex), verbatim

## Verdict: NO-GO

### P1 — Prompt still exposes contradictory prices

src/prompts/generate.ts:66-67, 394, 504

With a normal travel fee, the model sees raw quote/anchor/floor values such as $595, but also sees the client total $745. The same inconsistency remains in:

- the PRICING header;
- dual-format mariachi guidance;
- residency series with travel;
- graceful-decline prompts.

Custom-quote travel also says to use the base rate while other prompt sections can expose separate totals.

Root cause: clientTotal() was applied only to budget and price-line sections; other client-facing prompt numbers still use raw pricing fields.

Required fix: make every client-facing number in the prompt use the same travel policy, including the PRICING header, dual-format guidance, residency series, graceful decline, custom quote, included travel, and Local travel. Add regression coverage for those cases.

### P1 — Post-check threshold still disagrees with clientTotal()

src/pipeline/post-check.ts:222-227, 239

belowFloorPrices() adds quote_price + travel.fee whenever travel is not included, even when custom_quote_required is true or the band is Local. clientTotal() correctly excludes those cases.

Example: custom-quote travel with base $595 and fee $150 tells the model to use the base price, but post-check sets the told threshold to $745. A legitimate unsupplied $700 figure is then incorrectly held.

Root cause: post-check duplicates an older travel predicate instead of using the new client-total rule.

Required fix: derive the primary threshold and supplied totals from clientTotal(), and add custom-quote, included-travel, and Local regression tests.

Round-1 P2 (flamenco_trio_full) is closed. The targeted tests and TypeScript check pass, but the two remaining P1 consistency defects prevent GO.

Checked clean:

- npm run test:match -- "port manifest R30" — passed
- npm run test:match -- "port manifest R058" — passed
- npm run test:match -- "buildGeneratePrompt" — passed
- npx tsc --noEmit — passed
- Worktree remains clean
- No files edited

---

**Correction (2026-10-09, after round 3):** the residency-series bullet above is wrong. Equal bases do not make the
series sentence and the travel total agree; round 3 showed the contradiction is reachable. See
`2026-10-09-price-line-codex-round3.md`.
