---
title: "Codex PLAN review, round 3: COI sentence owned by the app (the six round 2 fixes)"
date: 2026-10-12
plan: docs/plans/2026-10-12-feat-coi-sentence-by-request-plan.md (Revision 3b)
reviewed_head: 0a8f8f4
prior_verdicts: docs/reviews/2026-10-12-coi-plan-codex-round1.md (NO-GO), docs/reviews/2026-10-12-coi-plan-codex-round2.md (NO-GO)
authorization: "Round 3 authorized by Alejandro: YES" (his "b" to "B. Fix, then round 3", 2026-10-12)
---

# Round 3 (plan): NO-GO, classification (b). THE CAP HAS FIRED. There is no round 4.

One run.

## Verdict text (verbatim)

**FIX 1 — FIXED BUT INTRODUCES a stale contradiction.** The mode matrix correctly keeps COI for platform replies
(lines 117-120, 211), but line 120 still says this is "Open for the reviewer," while line 330 says no questions are
open. P1.

**FIX 2 — FIXED.** Precedence is mechanically clear: wrong count returns only missing/repeated; other-wording
scanning occurs only at count 1 (lines 128-147). C9 covers zero, twice, extra wording, valid required/default
sentences, and full/compressed asymmetry.

**FIX 3 — FIXED.** Optional compatibility and strict `=== true` behavior are specified (lines 149-155, 264-265).

**FIX 4 — FIXED.** The boundary question is explicitly false and observational only (lines 157-163, 319-320).

**FIX 5 — FIXED.** The fixture distinction and two expected COI-line baseline changes are concrete (lines 165-178,
247-248).

**FIX 6 — FIXED BUT INTRODUCES a sequencing defect.** Work step 1 uses `classification.coi_required` before work
step 2 adds that field to `Classification` (lines 291-294). Step 3 also adds the generate-prompt line before step 4
explicitly wires `coiTerms` through `runWithVerification`/`generateResponse` (lines 294-296). A literal
implementation following these steps can fail type-checking or leave generation unwired. P1.

New defects: P1 stale platform decision; P1 work-step dependency ordering. Both findings land in one file: the plan
(`docs/plans/2026-10-12-feat-coi-sentence-by-request-plan.md`).

The precedence cases are otherwise unique and C9 can pin them. Revision 3b correctly states that violations fail
verification, set `finalVerified` false, and never rewrite drafts (lines 73-76, 142-147, 213-215). The venue-policy
restatement is covered by C4 and the post-check contract; lead 5 records how often it occurs (lines 244-246,
321-323). Alex's approved sentences, trigger, text route, and T4 example remain unchanged (lines 21-53).

**NO-GO — (b) SAME finding still unfixed: stale contradictory plan text.** The cap has fired; there is no Round 4.
Alejandro must choose a different approach, revert to the prior state, or accept the original condition.

## Claude Code's check (2026-10-12, read-only; nothing edited after the verdict)

- **Both P1s are REAL, both are plan TEXT, both mine.**
  - Platform: `plan:120` still carries "Open for the reviewer: say if a platform reply should omit it", while
    `plan:330` says none open. Codex's own round 2 answered the question (platform replies keep the sentence); the
    table cell was never updated.
  - Sequencing: work step 1 builds `coiTermsFor`, which reads `classification.coi_required`; the field is added in
    step 2. And step 3 adds the Quote Terms line before step 4 passes `coiTerms` into `generateResponse` and
    `postCheckDrafts`, so after step 3 the line has no source. `Classification` has no `coi_required` today (the one
    in `src/types.ts` is `VenueContext.vendor_policies.coi_required`, the venue's PF-Intel flag, a different thing).
- **Five of six fixes confirmed FIXED by Codex**, including the precedence and the Revision 3b wording.
- **Nature of the residue:** no finding is a design defect. The cause is the same one as round 2's: Revision text
  added without rewriting the older line it supersedes.

## Per the pre-registered budget

The cap has fired: automatic fixing and reviewing STOP, no round 4 prompt. The three options (different approach,
revert, accept) are put to Alex; see HANDOFF.
