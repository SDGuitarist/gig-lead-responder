---
title: "Codex CODE review, round 2: T4 reference lead (the three named fixes)"
date: 2026-10-12
plan: docs/plans/2026-10-11-feat-t4-reference-lead-plan.md (Revision 1d)
code_reviewed: 3009cb6..2ae6936 (the prompt pinned HEAD 2ae6936; a docs-only save commit followed)
prior_verdicts: docs/reviews/2026-10-12-t4-reference-code-codex-round1.md (NO-GO)
---

# Round 2 (code): run 1 GO, run 2 NO-GO (1 P2); the stricter verdict governs: NO-GO

**Verdicts recorded:**

| Run | Verdict | Where |
|---|---|---|
| Run 1 (pasted by Alex as "the first round back"; A/B label not confirmed) | **GO** | below, verbatim |
| Run 2 (pasted by Alex, HEAD `c2f9aba`) | **NO-GO** (P1 FIXED, P2 T7 NOT FIXED, P2 T5 FIXED) | section "Run 2" at the end |
| **Governing** | **NO-GO**, the 2nd NO-GO on this change | automatic iteration STOPS; round 3 only with the literal approval |

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

## Run 2 (run B): NO-GO, verbatim

Round 2 verdict: **NO-GO**.

1. **P1 — FIXED.** `src/prompts/generate.ts:216-220` suppresses the T4 block for quote-off, large-gap, graceful-decline
   and past-date modes. The small-gap decision is correct (one normal price plus one validation sentence; its
   `100-125 words` constraint at `generate.ts:473-479` does not contradict the block). `PricingResult.budget` is
   required (`src/types.ts:202-218`). Tests at `src/t4-reference.test.ts:254-284` cover the four suppressions plus the
   met-budget and small-gap positive controls.
2. **P2 T7 — NOT FIXED.** Mapping at `src/port-manifest.test.ts:112-120`, body matching at `:122-126`. Mappings use
   prefixes, not unique titles. R020 maps to `T4 reference T1`, which matches four bodies. Removing the R020 assertion
   from its first test still leaves another matching body containing `REFERENCE LEAD: T4 CORPORATE`, so the T7 test
   stays green. The self-test at `:153-157` proves a missing title fails, not this duplicate-prefix false positive.
3. **P2 T5 — FIXED.** `src/t4-reference.test.ts:145-160` checks the approved set and every capitalised word; positive
   control at `:162-165`. Known limits (a lowercase proper noun; a name inside the approved set such as "Dana") are
   inherent to a structural check, not a new defect.

New defects: **P2** the T7 test can falsely pass for R020 (the same defect). No separate production defects.

Verification: direct focused run 43 pass / 0 fail; `npx tsc --noEmit` clean; `npm run test:match -- "T4 reference"`
passed all T4 tests but reported one unrelated `src/payment-terms-approve.test.ts` failure (sandbox `listen EPERM`);
worktree clean at `c2f9abab3a257e45bcc4f218d936e6d1a95858f8`; real-model verification after these gates remains
unexecuted. Codex's attached fix prompt: reproduce the false green, name the root cause (prefix matching permits
unrelated same-prefix bodies), smallest safe fix (exact unique titles or bind to the exact body), a regression test that
fails without the fix, keep the positive control, change no generate/pricing/payment/venue/verify code, run focused,
`test:match`, tsc and the full suite, and start no further review without
`Round 3 authorized by Alejandro: YES`.

## Claude Code's check of run 2 (2026-10-12, read-only; nothing edited)

- **P2 T7 REPRODUCED by counting, not by editing.** For each T4 row, the number of same-prefix test bodies and how
  many of them contain the row's body text (script over `src/t4-reference.test.ts`):

  | Row | Prefix | Bodies with prefix | Bodies containing the text |
  |---|---|---|---|
  | R020 | `T4 reference T1` | 4 | **2** (the section-header test and the prompt-level test) |
  | R021 | `T4 reference T1` | 4 | 1 |
  | R022 | `T4 reference T4` | 6 | 1 |
  | R023 | `T4 reference T4` | 6 | 1 |
  | R024 | `T4 reference T4` | 6 | 1 |
  | R025 | `T4 reference T3` | 2 | **2** (urgent and short) |

  So Codex is right about R020, and **R025 is the same class** (two bodies hold `OPEN_AVAILABILITY`; deleting it from
  one leaves the check green). R021-R024 have exactly one matching body, so a deletion from it does fail.
- The P1 and T5 findings match the repo at `c2f9aba`; nothing else new.
- This is a test-only gap in a manifest-wiring check. It does not change a prompt byte, a price, or any customer
  text. It is the 2nd NO-GO on this change, so I changed no code and wrote no round-3 prompt.
