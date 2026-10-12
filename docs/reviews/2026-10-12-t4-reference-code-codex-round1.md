---
title: "Codex CODE review, round 1: T4 reference lead (narrow)"
date: 2026-10-12
plan: docs/plans/2026-10-11-feat-t4-reference-lead-plan.md (Revision 1d)
code_reviewed: HEAD 3009cb6 (range 1b353f8..3009cb6)
---

# Round 1 (code): NO-GO, 1 P1 + 2 P2

**Verdicts recorded:**

| Run | Verdict | Where |
|---|---|---|
| Run 1 (pasted by Alex; A/B label not confirmed) | **NO-GO** | below, verbatim |
| Run 2 | NOT YET RECEIVED | add here if Alex pastes it; stricter verdict wins |

## Claude Code's check of each finding (2026-10-12, before fixing)

- **P1 REPRODUCED.** Three regression tests written first all failed on `3009cb6`: a T4 lead with a stated budget of
  1000 (large gap, found by probing `budgetGapFor`), with `graceful_decline`, and with `past_date_detected` each
  carried the reference block. Root cause as Codex states: the gate modelled "Quote Terms exists", not "the whole T4
  structure fits the response mode". Fixed in `378b790`: three conditions added; each has a mutation that fails its
  test; positive controls (a met-budget quoted T4 lead; a small-gap lead, which keeps one price) still get the block.
  Decision recorded in the gate's comment: the **small** gap mode is NOT withheld.
- **P2 (T7) CONFIRMED.** The generic manifest tests check a marker and a test title exist somewhere in a file, not
  that the named test body asserts the marker. Fixed in `4d43084`: T7 maps each of R020-R025 to (marker, test title
  prefix, body text), and a body that asserts through a constant requires the constant to be defined as the marker.
  The first version let one mutation survive (the constant renamed); tightened, then 4 of 4 killed.
- **P2 (T5) CONFIRMED, fixed differently from the literal ask.** The source client's real first name and business are
  private, so embedding them in a public test to assert absence would publish them. The boundary is structural
  (`ffbeba0`): the mid-sentence capitalised words of the reply must equal an approved set; a new person, company or
  place name fails and forces a deliberate edit; plus no email, link or handle. 3 mutations killed; a positive
  control proves the finder can find a name.
- **Process note (separate, found while fixing):** Alex's heads-up that the 30-character leak check misses short
  quoted fragments was right. A shingle scan found a few in this branch's runs record (some already pushed); they
  are now plain descriptions (`8f7f5c7`). The pushed history still holds them: Alex's call whether to force-push.

## Verdict text (verbatim, run 1)

The branch identity gate passed: clean `feat/hub-phase0` at `3009cb6`. Process enumeration was unavailable in this sandbox, but no branch-write evidence was present.

Findings

P1 — T4 block is still enabled in contradictory modes

`buildT4ReferenceSection()` suppresses only `quoteTermsOff()` modes: clarification, `no_viable_scope`, and residency (`src/prompts/generate.ts:208-211`; `src/pipeline/payment-terms.ts:54-57`).

Additional contradictory reachable modes remain:

- Large budget gaps require two prices (`src/prompts/generate.ts:471-485`), while the T4 block requires "the price as a single number" (`src/data/t4-reference.ts:57`).
- Graceful-decline mode requires no pitch after the exit line (`src/prompts/generate.ts:21-29`), while the T4 block requires price, payment, and a close (`src/data/t4-reference.ts:57-58`).
- Past-date mode requires confirming the year in the first 2–3 sentences (`src/prompts/generate.ts:44-49`), while the T4 block says to answer the date plainly and follow its T4 sequence (`src/data/t4-reference.ts:52`).

Platform payment terms are not an independent reachable case because classification explicitly says T4 is direct-only and never a platform lead (`src/prompts/classify.ts:113-114`). If malformed classifications are supported, the helper also lacks `paymentTerms`, but normal classifier output prevents this.

Root cause: the gate models only "Quote Terms exists," not whether the complete T4 structure is compatible with the selected response mode.

P2 — T7 does not verify the feature each manifest row claims

The T7 test only checks status strings (`src/port-manifest.test.ts:111-115`). It does not verify:

- R020 actually activates for a quoted T4 lead.
- R021 verifies the seven-step structure.
- R022 verifies the replacement for the fill-in template.
- R023 verifies the no-copy / played-space rules.
- R024 verifies the standing-rule addition.
- R025 verifies urgent versus non-urgent opening behavior.

The generic manifest test checks that a marker and test title exist somewhere, but not that the named test asserts that row's marker or behavior (`src/port-manifest.test.ts:64-75`, `:91-99`). The manifest rows themselves claim those feature-specific tests (`port-manifest.md:36-40`).

P2 — T5 privacy assertions do not prove all claimed removals

The test checks:

- `$` figures, phone-shaped numbers, `50%`, and the literal string "Pacific Flow" (`src/t4-reference.test.ts:117-122`).
- The first line is `Hi Dana,` (`src/t4-reference.test.ts:124-128`).

It does not assert absence of the source client's actual first name, actual business name, or actual deposit amount unless those happen to equal the hardcoded values checked. This is weaker than the plan's T5 acceptance criterion (`docs/plans/...:179-182`).

Other checks

- D6 is non-vacuous: the positive control at `src/t4-reference.test.ts:143-146` proves the word-list helper detects a violation.
- The import-graph test catches a missing `generate.ts` import because it expects exactly `["src/prompts/generate.ts"]` (`src/t4-reference.test.ts:241-251`).
- `VOICE_REFERENCES` is pinned to eight exact name/type/active triples (`src/t4-reference.test.ts:228-239`).
- Non-T4 byte identity is correctly preserved: the helper returns `""`, and the existing newline layout remains equivalent. The baseline assertion is at `src/t4-reference.test.ts:190-196`.
- Manifest counts are correct: 197 ALREADY PRESENT, 171 PORTED, 35 NOT PORTED, 3 TO PORT.
- No remaining obvious private venue sentence or paraphrase was found in the current tracked tree. The supplied real-model document also avoids printing venue claims verbatim.
- I could not independently rerun `tsx` checks because this sandbox blocks the temporary IPC/listen operation. The supplied evidence records the leak check as passing.

(Codex's attached Claude Code fix prompt asked for: gate coverage for large budget gap, graceful decline and past date
with the existing suppressions preserved and no change to payment-terms, price, classify, venue-history,
voice-references or verify.ts; a stronger T7 tied to the feature assertions; a T5 structural assertion if the private
values cannot be embedded; reproduce each finding, name the root cause, regression tests that fail before the fix, a
positive control that a normal quoted T4 lead still gets the block, focused and full results, remaining risks. Round 2
verifies only these named fixes; after a second NO-GO stop; round 3 needs the literal approval. Applied as
`378b790`, `4d43084`, `ffbeba0`.)
