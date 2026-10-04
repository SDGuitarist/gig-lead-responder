# Codex round 2 — residency fix (`d0a8ed2..fbb00f6`, re-checking `c047b49..17d02de`)

**Verdict: GO — the residency review is CLOSED** (Codex CLI `codex exec -s workspace-write`, run by Claude Code on 2026-10-04 at `fbb00f6`; tree clean after). Prior: round 1 NO-GO (`2026-10-04-residency-codex-round1.md`), fixed in `fbb00f6`. Codex sandbox 539 pass / 16 sandbox-blocked; Mac 555/0/1/1. Prompt: session scratchpad `codex-round2-residency.md`. Verbatim:

---

## Verdict: GO

No P1/P2/P3 findings.

1. **P1 fixed on every checked path:** generation, verification, rewrite/retry, compressed drafts, and enrichment re-pricing all use residency mode. The budget block is suppressed whenever residency pricing exists.

2. **No new wrong-number path found:** series pricing correctly uses the private-event `quote_price`; travel custom, included, and outside-SD cases reuse the established travel wording and totals. Competition positioning remains intentional per the settled decision.

3. **Regression tests are effective:** reverting the fix would fail the new non-solo prompt, asked-price, and enrichment re-pricing tests. No vacuous assertion identified; the negative number check is scoped to the residency pricing block.

Verification:

- Residency-focused: `LEAF_MATCH {"pass":14,"fail":0,"skip":0}`
- Full suite: `LEAF_MATCH {"pass":539,"fail":16,"skip":1,"todo":1}` — the 16 failures are sandbox-blocked server/sysctl tests; residency tests pass.
- Real-model residency output remains **UNEXECUTED**, as declared.
exit=0
