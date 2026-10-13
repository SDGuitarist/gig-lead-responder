---
title: "Codex CODE review, round 2: COI sentence owned by the app (the approval-path fix)"
date: 2026-10-13
plan: docs/plans/2026-10-12-feat-coi-sentence-by-request-plan.md (Revision 3c)
reviewed_head: 0cb4ff7
fix_range: 6f646ae..0cb4ff7 (code in 2837845)
prior_verdicts: docs/reviews/2026-10-13-coi-code-codex-round1.md (NO-GO)
---

# Round 2 (code): GO, no new defects. The COI code review loop is CLOSED.

One run. Round 1 NO-GO (1 P1) was fixed in `2837845`; round 2 verified only that fix.

## Verdict text (verbatim)

**FIXED.**

The Round 1 finding is correctly addressed:

- `src/api.ts:108-115` reads stored classification/pricing and computes `coiTermsFor`.
- `src/api.ts:119-139` checks both refreshed drafts with `coiViolations`.
- The refusal occurs before `updateLead` (`:141`), `claimLeadForSending` (`:152`), and sending (`:158`), so no
  partial payment save or claim occurs.
- `newFull` correctly preserves `null` at `:129`.
- None modes and absent `coi_required` are handled by `coiTermsFor` (`src/pipeline/coi.ts:20-26`).

The send-path inventory is complete for first replies. Auto-send uses freshly generated, verified output; other SMS
paths are notifications or follow-ups, not client first-reply sends.

Tests are non-vacuous: refusal tests assert 409, exact error code, no sender call, unchanged status, and unchanged
drafts. Positive controls reach the sender and observe the expected 500 from the intentionally unavailable alert
channel.

The payment test helper change only adds the required COI sentence; payment assertions remain unchanged.

Verification:

- `COI C13`: 8 pass, 0 fail
- `npx tsc --noEmit`: pass
- Diff scope: only the four expected files; pipeline contract untouched
- Worktree remains clean

No new defects.

**Final verdict: GO.**

## Claude Code's check (2026-10-13)

Every line Codex cites matches `0cb4ff7` (the route's order is payment refresh, COI check, `updateLead`, claim, send).
Nothing to fix. One limit stays as recorded in the round 1 record: a real send through the approve route is
UNEXECUTED (the alert channel always throws today).

Review loop summary: plan review R1-R3 NO-GO (cap; two text residues fixed in Revision 3c at Alex's choice); code
review R1 NO-GO (1 P1, fixed), R2 GO. One run per round throughout.
