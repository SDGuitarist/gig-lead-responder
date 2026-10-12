---
title: "Payment terms by lead time: the app picks the sentence, the model copies it, and approve swaps it when the band changed"
category: architecture
tags: [payment-terms, deposit, lead-time, platform, post-check, send-time, approve, truthiness, fail-closed, codex-review]
module: src/pipeline/payment-terms.ts, src/prompts/generate.ts, src/pipeline/post-check.ts, src/run-pipeline.ts, src/api.ts, src/cli-args.ts
symptom: "Every quote said 'A 50% deposit holds the date.' whatever the lead time, and GigSalad / The Bash drafts claimed deposit terms although the client pays the platform. A draft written 16 days out still said 'balance due two weeks before' when Alex approved it 3 days later. At approve, a full draft with no sentence, two sentences, or the empty string reached the send."
root_cause: "The payment line was fixed prompt prose, with no date input and no platform input. At approve, the check covered only the draft that is sent and treated the second draft as optional: first by ignoring its refresh result, then by testing it for truthiness, which read \"\" as absent."
date: 2026-10-11
model: claude-opus-5-5
predecessor: architecture/2026-10-11-private-venue-claims-and-an-exact-leak-sentinel.md
related:
  - docs/plans/2026-10-11-fix-payment-terms-by-lead-time-plan.md
  - docs/reviews/2026-10-11-payment-terms-plan-codex-round1.md
  - docs/reviews/2026-10-11-payment-terms-plan-codex-round2.md
  - docs/reviews/2026-10-11-payment-terms-plan-codex-round3.md
  - docs/reviews/2026-10-11-payment-terms-local-runs.md
  - docs/reviews/2026-10-11-payment-terms-codex-round1.md
  - docs/reviews/2026-10-11-payment-terms-codex-round2.md
  - docs/reviews/2026-10-11-payment-terms-codex-round3.md
  - docs/solutions/architecture/2026-10-09-app-writes-fixed-lines-model-writes-a-marker.md
---

# Payment terms by lead time, and the swap at send

## Prior Phase Risk

> "The payment-word list's coverage, and the paraphrase rate." (plan, Three Questions 3)

Measured, not closed. Real-model runs: 5/5 counted leads, 10/10 drafts with the right sentence exactly once, 0 payment
flags (`docs/reviews/2026-10-11-payment-terms-local-runs.md`). The word list is bounded on purpose (musician prose like
"I balance the sound" stays allowed), so a paraphrase outside it would pass. No paraphrase was seen in 10 drafts.

## Problem

Alex's terms depend on how far away the event is and on who collects the money (2026-10-11, his exact words):

| Lead time (calendar days, Pacific) | Sentence |
|---|---|
| more than 2 months | A 50% deposit holds the date, and the balance is due two months before the event. |
| more than 14 days, up to 2 months | A 50% deposit holds the date, and the balance is due two weeks before the event. |
| 14 days or less | Full payment holds the date. |
| no usable date | A 50% deposit holds the date. |

Edges fall in the shorter band. GigSalad and The Bash leads (the intake `platform`) get no payment sentence: the client
pays the platform. Yelp, Thumbtack, The Knot, WeddingWire and direct leads pay Alex, so they get the dated sentence. The
prompt had one fixed line for all of them.

## Solution

Same shape as the price block (`2026-10-09-app-writes-fixed-lines-model-writes-a-marker.md`): **the app decides the words, the model copies
them, a check confirms the exact text.**

1. **One `PaymentTerms` value per run** (`paymentTermsFor` in `src/pipeline/payment-terms.ts`), computed once with an
   injected `today` and passed to every generate attempt, every retry, the edit path and the post-check. Precedence:
   no quote terms (clarification, no viable scope, residency) → platform (gigsalad/thebash) → a hand-run lead the model
   marks "P" with no intake platform (`unknown_platform`: no terms, flag for Alex) → the dated sentence.
2. **Dates are calendar days** (`civilDay`: strict YYYY-MM-DD, UTC round-trip, so DST cannot shift a band). Two months
   clamps to the month end (Dec 31 + 2 months = Feb 28/29).
3. **Post-check** (`paymentViolations`): the exact sentence once in each draft, and no other payment wording from a
   bounded list. Platform drafts: no payment wording at all.
4. **CLI `--platform`** for hand-run leads, validated before the API-key check.
5. **Swap at send** (Revision 4, Alex: "swap it automatically"). Drafts wait for review, so the band can change between
   drafting and approving. `refreshPaymentSentence` replaces the one known sentence with today's. If there are zero or
   several, it returns an error and never guesses.

### The approve route took three code rounds

| Round | Finding | Fix |
|---|---|---|
| 1 (A P2, B P1) | only the compressed refresh result was checked; a bad `full_draft` was ignored, and the full draft was refreshed only when the compressed text changed | refresh every present draft; 409 before `claimLeadForSending` if either fails; save both together whenever either changed |
| 2 (A P1) | `lead.full_draft ? ...` read `""` as absent, so an empty full draft skipped the check | `!= null`: only null is absent |
| 3 | GO on both runs | — |

The current code (`src/api.ts`):

```ts
const compressed = refreshPaymentSentence(lead.compressed_draft, terms);
const full = lead.full_draft != null ? refreshPaymentSentence(lead.full_draft, terms) : null;
for (const r of [compressed, full]) {
  if (r && "error" in r) { sendError(res, 409, "payment_terms_unverifiable", r.error); return; }
}
// ...both texts saved together only when either changed, then the claim, then the send
```

**The test drives the real route**, not the helper: `createApp()`, a temp `DATABASE_PATH`, Basic Auth. "No send" is
observable because `alertAlex` always throws today and logs `[ALERT NOT DELIVERED]`. The test counts those lines: no new
line on a 409, one more on the success path (which ends 500 until Module 1 adds a channel). Mutation-checked four ways:
the full draft left out of the error loop, saving only on a compressed change, not saving `full_draft`, and truthiness
instead of `!= null`. Each one fails the test.

## What this does NOT fix

- **A paraphrase outside the word list** passes the post-check. The list is bounded on purpose; widening it flags
  musician prose.
- **A hand-run GigSalad lead without `--platform`** that the model marks "D" gets dated terms (lead f in the local runs).
  Stated limit; `--platform` is the fix.
- **The success path (200)** cannot run until Module 1. `docs/END-TO-END-STATUS.md` says every Module 1 send path must
  call `refreshPaymentSentence`. The auto-send path uses the same run's terms, so it is not stale.
- **A test run across Pacific midnight** could see a different band (the test reads today at import and the route reads
  it again per request). Flake risk only.

## Prevention

- **Every draft the record holds is part of the check, not only the one that is sent.** The full draft is what Alex
  edits and what a later send could use.
- **Never decide "present" with truthiness when "" is a value.** `x != null` is "present"; `x ?` reads `""` as absent.
  Round 2 found this one round after round 1's fix created the code.
- **Test the route that sends, not only the helper it calls.** P15/P16 tested `refreshPaymentSentence` well, but the
  bug was in how the route used its result. An existing harness (`auth.test.ts`: `createApp()` + Basic Auth;
  `resolveDbPath` forces a temp DB under node:test) made a route test cheap. Look for one before calling it impractical.
- **When the effect cannot be observed (no channel), find its trace.** The undelivered-alert log line is the send
  attempt.

## Feed-Forward

- **Hardest decision:** where the payment rule is enforced. Prompt alone cannot hold an exact sentence; the app owns it,
  and the send step must re-own it because time passes between draft and send.
- **Rejected:** letting the model choose the band from the date (it would infer prose again; the price-block lesson);
  keying platform on the model's `lead_source_column` (wrong for Yelp and Thumbtack, which pay Alex).
- **Least confident:** that Module 1 will call `refreshPaymentSentence` on every send path. It is written in
  END-TO-END-STATUS, and nothing enforces it yet.

## Three Questions

1. **Hardest pattern to extract from the fixes?** That rounds 1 and 2 were one class ("a present draft skipped"), found
   in two forms: an ignored result, then a truthiness test. Fixing the first form did not reveal the second.
2. **What did you consider documenting but left out, and why?** The plan-review history (three NO-GO plan rounds). It
   is in the plan revisions and review records; this doc covers the code.
3. **What might future sessions miss that this solution doesn't cover?** A new send path in Module 1 (iMessage
   approve, follow-up send) that sends a stored draft without the refresh. Grep for `claimLeadForSending` and every
   sender call when Module 1 lands.
