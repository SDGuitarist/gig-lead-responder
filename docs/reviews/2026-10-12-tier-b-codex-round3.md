# Codex CODE review, round 3: Tier B notes name the draft's price (Revision 6)

**Code:** `feat/hub-phase0` at `f071798` (range `a4efd8e..f071798`; code `1ead7a2`). **Prior Codex verdicts:** round 1
GO on both runs, round 2 GO on both runs. This is the **first code NO-GO**. **Reader and trigger:** Revision 6b fix;
the round-4 prompt.

**Verdict: NO-GO on BOTH runs (P1 + P2, the same two findings).** Both runs: travel, NP2 (nonprofits get no note) and
the call site are right; `tsc` clean.

| # | Runs | Finding | Disposition |
|---|---|---|---|
| 1 | A P1, B P1 | a residency lead's note says "draft uses T2 $700" but the draft quotes the residency rate ($350/night, `q.rate`, `generate.ts:224-230`) or no price | Revision 6b: the Tier B check does not apply to a residency (its own B2B product, already held by its `residency:` note); test |
| 2 | A P2, B P2 | a large budget gap drafts a scoped option first ($650 2h) and then the full set ($895 3h); the note names only $895 | Revision 6b: the note names what the draft offers: "draft offers 2h $650 first, then 3h $895"; no-viable-scope: "draft quotes no set price (budget redirect)"; small gap: the full price as now; tests |

## Run A (Claude Code, `codex exec -s read-only`, 2026-10-12; HEAD `f071798`)

```
NO-GO

P1 — `src/pipeline/price.ts:458`

Residency pricing is mislabeled. Input: Tier B Tom Ham’s Lighthouse, 50 guests, T2, solo, `engagement_type: "residency"`, R2 weekly, `price_asked: true`. The note says `draft uses T2 $895`, but the generated draft uses the residency rate `$450/night` (`src/prompts/generate.ts:224-226`). This can mislead approval.

P2 — `src/pipeline/price.ts:458`

Scoped-budget drafts contain two outgoing prices, but the note names only the full-set price. Input: same venue, 50 guests, T2 solo 3h, `stated_budget: 600`. The note says `draft uses T2 $895`; the draft leads with the scoped `$650` option and also offers `$895` (`src/prompts/generate.ts:463-469`). The note should identify both or the primary scoped price.

Checks:

- Travel: consistent; both paths use `clientTotal`.
- NP2: Tier B notes are suppressed for nonprofit leads, so no mismatch there.
- Call site: passes the final `pricing` object consistently (`src/run-pipeline.ts:222`).
- `tsc --noEmit`: clean.
- Focused tests were blocked by sandbox `EPERM` creating temporary directories/IPC; no test failure was observed.

```

## Run B (Alex, inside Codex, 2026-10-12; HEAD `f071798`)

```
NO-GO

P1 — Residency drafts use a different price than the note claims
- src/pipeline/price.ts:458
- Concrete input: Tier B Tom Ham's lead, 50 guests, solo, 2 hours, engagement_type: "residency", R2 weekly, price asked, T2.
- Observed: note says draft uses T2 $700; residency pricing is $350 per night.
- The generator explicitly uses q.rate for residency drafts at src/prompts/generate.ts:224-230, not pricing.quote_price.
- Root cause: tierBHold assumes the ordinary quote_price is the outbound draft price.

P2 — Scoped-budget drafts contain two prices, but the note names only the full-set price
- src/pipeline/price.ts:458
- Concrete input: Tier B Tom Ham's lead, 50 guests, 3 hours, T2, stated budget $700.
- Observed: note says draft uses T2 $895; the draft is instructed to lead with a scoped 2-hour option at $650, then offer the full 3-hour upgrade at $895 (src/prompts/generate.ts:459-469).
- This is incomplete/misleading if "draft uses" means the primary price offered.

No issue found for: NP2 (nonprofit leads return before creating a tier_b: note); Travel (the probe matched the outbound
travel-inclusive amount ($775) and both candidate totals); Normal private-event pricing.

The branch/worktree gate passed at the expected HEAD and was clean.
```
