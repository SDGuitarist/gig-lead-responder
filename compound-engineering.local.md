# Review Context -- Gig Lead Responder

## Risk Chain

**Brainstorm risk:** None — **no brainstorm this cycle** (skip gate: the input was the port manifest's 9 venue rows,
R081-R089 and R405, with exact ids; Alex chose "venues first" and "a private file in ~/Data").

**Plan mitigation:** `docs/plans/2026-10-11-feat-venue-history-private-file-plan.md` (Revision 3). A private
`~/Data/gig-lead-responder/venue-history.json`; a one-direction matcher (equal name/alias, or the canonical 2+-word
name inside the lead's venue; never the reverse); claims only with a real `confirmed` date and Alex's yes in chat;
`selectContext` placement so both pipeline paths get it; a by-hand check script with a bounded leak sentinel. Plan
review: R1 and R2 NO-GO (both runs), R3 authorized and NO-GO (hard cap), all findings fixed in Revision 3.

**Work risk (from Feed-Forward):** "whether the model already invents venue experience for unknown venues." Measured:
baseline u0 plus u1, u2 and 6 borrowed-claim runs (unknown, near-miss, no venue): 0 false claims
(`docs/reviews/2026-10-11-venue-history-local-runs.md`). "Add nothing" slipped twice (d1, b5): recorded, not fixed.

**Review resolution:** Codex code review R1 NO-GO (P1: the leak-check exemption covered every window of a venue's
sentence in 4 files, and a per-file `break` hid later matches); R2 NO-GO (P2: test env override bypassed the check on
the real repo; P2: "known" meant anything in the historical file); R3 (authorized) **GO on both runs**. Final shape:
67 fixed, file-bound fingerprints of already-public windows; no env override; control-repo runs apply no exemptions.
Records: `docs/reviews/2026-10-11-venues-codex-round{1,2,3}.md`. Pattern: FC98.

## Files to Scrutinize

| File | What changed | Risk area |
|------|-------------|-----------|
| `src/venue-history.ts` | loader (ok/missing/invalid, cached per path), one-direction matcher, section formatter | a false match is a false claim to a client; claims without a real date must drop |
| `src/pipeline/context.ts` | adds the venue section after PF-Intel | must reach both `runPipeline` and `runEditPipeline`; follow-ups excluded |
| `scripts/check-venue-history.ts` | by-hand real-file check; 67-fingerprint exemption | any widening of the exemption is a privacy bypass (FC98) |
| `scripts/venue-leak-scan.ts` (+ test) | pure scan: every window, no break, file-bound keys | stopping early or keying wider re-opens R1/R2 |
| `scripts/run-tests.mjs` | `VENUE_HISTORY_PATH` points tests at a path that cannot exist | tests must never read `~/Data` |

## Plan Reference

`docs/plans/2026-10-11-feat-venue-history-private-file-plan.md`
Solution: `docs/solutions/architecture/2026-10-11-private-venue-claims-and-an-exact-leak-sentinel.md`
