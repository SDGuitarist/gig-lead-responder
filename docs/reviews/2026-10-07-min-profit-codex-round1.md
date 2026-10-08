# Codex round 1 — $150 minimum profit R295/R362 (`6a496df..471efe7`)

**Verdict: NO-GO** (1 P1, 1 P2; Codex CLI `codex exec -s workspace-write`, run by Claude Code on 2026-10-07 at `471efe7`; tree clean after). Pre-registered stops: 2nd NO-GO stops automatic iteration; round 3 only with `Round 3 authorized by Alejandro: YES`.

**Claude Code check of the P1 (2026-10-07):** `docs/TRAVEL_FEES.md` (Duo Travel Split): the client pays the travel fee and the musician stipend comes OUT of it, Alex keeps the remainder. The example ($150 - $50 stipend = $100) omits the travel fee as income, so it does not reproduce as stated. The kernel is real: the helper ignored travel; with `custom_quote_required` the fee is $0 while the stipend is still set, so profit does drop. Fix counts both: fee (when not included in price) as income, stipend as cost.

Verbatim:

---

## Verdict: NO-GO

P1 — `src/pipeline/price.ts:350-364`, `src/run-pipeline.ts:214`

A sourced duo booking with travel can fall below the $150 profit floor. Example: 1-hour sourced duo at the $550 floor has $150 profit before the known Near-band `$50` `musician_stipend`, leaving only $100. `minimumProfitHold()` ignores `pricing.travel.musician_stipend`.

Root cause: the helper accepts only format, duration, tier, and quote price; it does not include known travel-related musician costs.

Required fix: include applicable musician stipends in the cost calculation and add a regression test for a sourced duo with a travel stipend.

P2 — `src/pipeline/price.ts:214-243`, `src/prompts/generate.ts:414-424`

Budget-gap scoped alternatives are separate client-visible prices, but the minimum-profit check evaluates only `pricing.quote_price`. A future or changed sourced rate could produce a shorter alternative below the profit floor without any hold.

Root cause: scoped alternatives are calculated as raw rate-card floors and are not passed through the profit guard.

Required fix: validate the scoped alternative against the same cost rule before presenting it; add a regression test proving an under-floor sourced alternative is held or suppressed.

Checked clean:

- Focused manifest tests: 118 pass, 0 fail.
- `runPipeline` tests: 129 pass, 0 fail.
- `npx tsc --noEmit`: passed.
- Final repricing is checked after enrichment.
- Snapped priced duration is used by the helper.
- T1 fallback uses the effective `tier_key`.
- Webhook, dashboard analysis, and portal orchestration reach `runPipeline`.
- Edit and follow-up paths do not independently price leads.
- `minimum_profit:` is excluded from generate/verify prompts while remaining visible to the router.
- No files were edited.

