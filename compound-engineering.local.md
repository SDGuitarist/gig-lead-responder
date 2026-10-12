# Review Context -- Gig Lead Responder

## Risk Chain

**Brainstorm risk:** None — **no brainstorm this cycle** (skip gate: Alex gave the exact rule in chat on 2026-10-11:
four sentences by lead time, edges in the shorter band, no terms for GigSalad / The Bash, dated terms for Yelp,
Thumbtack, The Knot, WeddingWire and direct).

**Plan mitigation:** `docs/plans/2026-10-11-fix-payment-terms-by-lead-time-plan.md` (Revisions 1-4). The app picks
the sentence from calendar dates (`civilDay`, no DST) and the intake `platform`; the model copies it; the post-check
confirms it exactly once plus a bounded payment-word list. One `PaymentTerms` per run through retries, edits and the
post-check. Revision 4 (Alex): swap the sentence at approve, refuse when not exactly one. Plan review R1-R3 NO-GO
(hard cap), all fixed.

**Work risk (from Feed-Forward):** "The payment-word list's coverage, and the paraphrase rate." Measured: 5/5 counted
real-model leads, 10/10 drafts with the right sentence once, 0 payment flags
(`docs/reviews/2026-10-11-payment-terms-local-runs.md`). A paraphrase outside the list would still pass.

**Review resolution:** Codex code review R1 NO-GO (A P2, B P1: approve checked only the compressed refresh; a bad
full draft was ignored, and the full draft was refreshed only when the compressed text changed) → `df6b2b0`. R2 NO-GO
(A P1: `full_draft ""` read as absent by a truthiness test) → `53f9f59`. R3 (authorized by Alex) **GO on both runs**.
Route-level test through `createApp()` + temp DB, mutation-checked 4 ways.

## Files to Scrutinize

| File | What changed | Risk area |
|------|-------------|-----------|
| `src/pipeline/payment-terms.ts` | sentences, bands, precedence, post-check words, `refreshPaymentSentence` | money wording; a band edge or a platform rule wrong means a wrong term sent to a client |
| `src/api.ts` (approve) | refresh both drafts, 409 before the claim, save together | any new send path (Module 1) must call the refresh too |
| `src/run-pipeline.ts`, `src/pipeline/generate.ts`, `src/pipeline/verify.ts`, `src/pipeline/post-check.ts` | one `PaymentTerms` per run, passed through | a caller using a different terms value than the run's |
| `src/prompts/generate.ts` | `paymentLine` replaces the fixed deposit line | prompt byte-identity is pinned by the P8 baselines |
| `src/cli-args.ts`, `src/index.ts` | `--platform` for hand-run leads | a hand-run GigSalad lead without the flag gets dated terms |
| `scripts/check-venue-history.ts` | 27 fingerprints for the prompt baselines | never widen an exemption (FC98) |

## Plan Reference

`docs/plans/2026-10-11-fix-payment-terms-by-lead-time-plan.md`
