# Codex round 1 — R099 setup space + residency (engagement type, R2/R3 rates, hold, drafting) (`c047b49..17d02de`)

**Verdict: NO-GO** (Codex CLI `codex exec -s workspace-write`, run by Claude Code on 2026-10-04 at `17d02de`; tree clean after the run). Codex sandbox: 536 pass / 16 sandbox-blocked / 1 skip / 1 todo; Mac 552/0/1/1. Prompt: session scratchpad `codex-round1-residency.md`. Verbatim final report below.

---

## Verdict: NO-GO

### P1 — Non-solo residencies can expose private-event prices

**Files:** `src/prompts/generate.ts:37-71`, `src/prompts/verify.ts:89-96`, `src/pipeline/price.ts:157-161`

**Failing input:**

```ts
{
  engagement_type: "residency",
  format_recommended: "duo",
  residency_tier: "R2",
  residency_cadence: "weekly",
  price_asked: false,
  duration_hours: 2
}
```

`lookupPrice()` correctly keeps the normal private-event price for recurring duo/trio/ensemble formats, but it does not attach `pricing.residency`. Generate and verify therefore fall back to the private-event pricing block, exposing `Quote price: $...` even though the venue did not ask for a price.

The same defect occurs after enrichment changes a solo residency to a non-solo format. Retries and compressed drafts reuse the same incorrect prompt.

**Required fix:** Treat every `engagement_type === "residency"` as residency drafting mode. Keep private pricing internally for non-solo recurring formats, but never expose it unless `price_asked === true`. Add regression tests for non-solo residency prompts and enrichment format changes.

The existing residency tests miss this: they assert non-solo pricing has no `residency` field, but never inspect its generate/verify prompts.

### Checked and found clean

- R1, 4-hour, unknown-cadence, and non-asked solo residencies do not receive a residency rate.
- Residency hold notes are added on the main `runPipeline` path, and the router holds any flagged concern.
- Unresolved-format clarification avoids pricing; invalid quote-mode unresolved formats fail before drafting.
- Follow-up prompts do not introduce or repeat prices.
- The approved R2/R3 rate table and duration rounding tests pass.
- No client names, contact data, or source text were added in the reviewed `docs/` or `src/` diff.
- Focused residency run: `LEAF_MATCH {"pass":11,"fail":0,"skip":0}`.
