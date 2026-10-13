---
title: "Codex CODE review, round 2: T4 reference lead (the three named fixes)"
date: 2026-10-12
plan: docs/plans/2026-10-11-feat-t4-reference-lead-plan.md (Revision 1d)
code_reviewed: 3009cb6..2ae6936 (the prompt pinned HEAD 2ae6936; a docs-only save commit followed)
prior_verdicts: docs/reviews/2026-10-12-t4-reference-code-codex-round1.md (NO-GO)
---

# Round 2 (code): GO, no new defects

**Verdicts recorded:**

| Run | Verdict | Where |
|---|---|---|
| Run 1 (pasted by Alex as "the first round back"; A/B label not confirmed) | **GO** | below, verbatim |
| Run 2 | NOT YET RECEIVED | add here if Alex pastes it; **the stricter verdict wins** |

Review budget as pre-registered: this is round 2 of at most 3. A GO closes the loop for this run; if run 2 returns a
NO-GO, that verdict governs and a 2nd NO-GO stops automatic iteration (round 3 only with
`Round 3 authorized by Alejandro: YES`).

## Claude Code's check (2026-10-12)

- Every file and line Codex cites matches the repo at `2ae6936`: the gate (`buildT4ReferenceSection`), the
  `T4 reference T2` control tests, `T4_ROWS` and its body finder in `src/port-manifest.test.ts`, and the T5 pins.
- The one new observation is in Codex's own sandbox: `src/payment-terms-approve.test.ts` fails there with `EPERM`
  because Node cannot bind `127.0.0.1`. That test passes on Alex's machine (849 pass / 0 fail / 1 skip at `2ae6936`,
  this session) and is not part of the T4 work.
- Codex's stated limit on T5 is the one already known and accepted in the code comment: a lowercase name, or a
  collision with an approved word such as "Dana", is not detectable by a structural check that refuses to embed the
  private values.

## Verdict text (verbatim, run 1)

## Findings

- **P1 — FIXED.** `buildT4ReferenceSection` now suppresses the block for quote-less, large-gap, graceful-decline, and past-date modes at Projects/gig-lead-responder/src/prompts/generate.ts:216. Keeping the block for small gaps is correct: that mode still has one quoted price and intentionally overrides the normal word-count/stealth-premium guidance at Projects/gig-lead-responder/src/prompts/generate.ts:473. `pricing.budget` is required by `PricingResult` at Projects/gig-lead-responder/src/types.ts:202.
- **P1 tests — FIXED.** Large-gap, graceful-decline, past-date, met-budget, small-gap, and normal quoted controls are present at Projects/gig-lead-responder/src/t4-reference.test.ts:254. The focused tests pass; prior mutation evidence confirms each new gate condition is pinned.
- **P2 T7 — FIXED.** `T4_ROWS` maps each manifest row to its marker, named test, and expected body evidence at Projects/gig-lead-responder/src/port-manifest.test.ts:112. The body finder matches this file's layout, and its self-test demonstrates failure for an unmatched title at Projects/gig-lead-responder/src/port-manifest.test.ts:122. The tightened constant check covers the R025 case at lines 142-145.
- **P2 T5 — FIXED.** The structural anonymization boundary is appropriate because embedding private source values would disclose them. Mid-sentence and sentence-initial capitalized words are pinned at Projects/gig-lead-responder/src/t4-reference.test.ts:145. A lowercase name or collision with an approved word such as "Dana" could bypass semantic identity detection, but that is a known limitation of privacy-preserving structural checking, not a defect in this fix.

## New defects

No new defects.

The focused matcher still reports the unrelated sandbox failure in `src/payment-terms-approve.test.ts` because Node cannot bind `127.0.0.1` (`EPERM`); all T4 tests pass.

## Final verdict

**GO**
