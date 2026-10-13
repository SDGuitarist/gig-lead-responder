---
title: "Codex CODE review, round 1: COI sentence owned by the app"
date: 2026-10-13
plan: docs/plans/2026-10-12-feat-coi-sentence-by-request-plan.md (Revision 3c)
reviewed_head: 6f646ae
code_range: 47fae60..6f646ae
---

# Round 1 (code): NO-GO, 1 P1

One run. The review budget as pre-registered: round 2 verifies only the named fix; a 2nd NO-GO stops automatic
iteration; round 3 needs the literal approval; a 3rd NO-GO is the hard cap.

## Verdict text (verbatim)

**P1**

- `src/api.ts:104-128` — The approve/send path refreshes and validates only payment terms. It never computes
  `coiTermsFor(...)` or runs `coiViolations(...)` before sending at `src/api.ts:143-145`.
- Reproduction: a stored quoted draft without the COI sentence reaches approval, passes payment validation, and can
  be sent. This bypasses the branch's "every first reply carries the exact COI sentence" invariant.
- The pipeline and edit paths are wired correctly; this is specifically the dashboard approval/send path.

**NO-GO**

Focused COI/T4 tests passed: 81/81. Typecheck passed. The broad COI command had one unrelated sandbox failure:
`payment-terms-approve.test.ts` could not bind localhost (`EPERM`). Leak-check execution was similarly blocked by
`tsx` IPC permissions.

(Codex attached a Claude Code fix prompt: reproduce with an approval-path regression test; name the root cause
(approval validates payment terms but does not apply the COI post-check contract); the smallest safe fix, for quoted
modes compute `coiTermsFor(storedClassification, storedPricing)` and reject approval when either present draft
violates `coiViolations`, preserving none-mode; positive controls for the default and required sentences and a
none-mode control; a bounded sweep of other send/approval surfaces with an inventory; focused, typecheck and full
results with sandbox failures separate; remaining risks; no second self-review.)

## Claude Code's check (2026-10-13, read-only; nothing edited yet)

- **The finding is REAL as stated.** `POST /api/leads/:id/approve` (`src/api.ts:89-160`) parses the stored
  classification and pricing, refreshes the payment sentence in both drafts, then sends `lead.compressed_draft`.
  Nothing in it computes `coiTermsFor` or runs `coiViolations`. A stored draft with no COI sentence (a draft made
  before this branch, or one whose post-check failed) is sent.
- **Inventory of send paths** (grep of `sendSms(`, `completeApproval(`, `dispatchReply` outside tests):

  | Path | Sends a first-reply draft? | COI protection today |
  |---|---|---|
  | `POST /api/leads/:id/approve` (`src/api.ts`) | yes | **none** (the finding) |
  | `handleAutoSendDecision` (`src/automation/orchestrator.ts:336-395`), `AUTO_SEND_ENABLED` false in prod | yes, when enabled | `routeLead` holds when `!verified` (`src/automation/router.ts:61`), and a COI violation sets `verified` false |
  | `POST /api/leads/:id/edit` (`src/api.ts:165`) | no: it nulls `compressed_draft`, so approve is blocked until a re-analyze, which runs the edit pipeline and its post-check | covered |
  | follow-up scheduler, post-pipeline SMS, orchestrator SMS | no: notifications to Alex and follow-ups, not first replies | n/a |

- **What the approve path does NOT check today for ANY post-check rule:** it never reads `gate_passed` or the stored
  `verified`. A draft with voice-kill or banned-phrase violations is approvable from the dashboard (Alex sees the
  failed gate and the reasons). Payment terms are the one rule enforced at send time, because the date moves between
  drafting and sending (a swap), and it refuses with `409 payment_terms_unverifiable`.
- **So the fix is a POLICY choice, not only a code gap:** making COI a hard refusal at approval makes it the second
  rule enforced at send, with no override. Put to Alex before changing user-visible approval behaviour.
