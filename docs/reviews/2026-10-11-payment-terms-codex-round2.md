# Codex CODE review, round 2: payment terms by lead time

**Code:** `feat/hub-phase0` at `df6b2b0` (fix range `eaa5120..df6b2b0`). **Plan:**
`docs/plans/2026-10-11-fix-payment-terms-by-lead-time-plan.md` (Revision 4). **Prior Codex verdicts:** round 1 NO-GO
(both runs), `docs/reviews/2026-10-11-payment-terms-codex-round1.md`.
**Reader and trigger:** the fix commit that follows; the round-3 prompt.

**Verdict: NO-GO (run A, P1). This is the 2nd NO-GO: automatic iteration stopped.** Run B was not run: Alex authorized
round 3 directly ("round three yes", 2026-10-11), so the single run stands as the round's verdict.

| # | Runs | Finding | Disposition |
|---|---|---|---|
| 1 | A P1 | `src/api.ts:118` tested `lead.full_draft` for truthiness, so `full_draft: ""` skipped the refresh and reached the claim/send (a present draft with no known sentence) | FIX: `!= null`; test case `""` added to the 409 test (no send, nothing saved); the truthy mutant fails it. Inventory of the route's other truthiness checks: empty compressed -> 400, unreadable classification/pricing -> 409; both refuse |

Round 3 authorized by Alejandro: YES (2026-10-11).

## Run A (Claude Code, `codex exec -s read-only`, 2026-10-11; HEAD `df6b2b0`)

````
NO-GO — one P1 finding.

P1 — empty `full_draft` is treated as absent  
`src/api.ts:118,126`

Concrete input:

- Direct lead with valid `classification_json` and `pricing_json`
- Valid `compressed_draft` containing exactly one known payment sentence
- `full_draft: ""`

Expected: `409 payment_terms_unverifiable`, no claim, no send.  
Actual: the falsy empty string skips `refreshPaymentSentence`; the route proceeds to claim/send. This violates P16’s “no known sentence” rule.

The round-1 defect is otherwise fixed for non-empty drafts. Both drafts are refreshed before claiming, errors fail closed, and both fields are persisted together.

Verification:

- Identity gate passed; worktree clean at `df6b2b07be95ee68880df922d4ad316e69ea9aa9`.
- `npx tsc --noEmit` — exit 0.
- The new test kills M1, M2, and M3 according to the supplied evidence.
- Server-route execution was not repeated because this review explicitly forbids starting a server.
- Round 2 is the second NO-GO; automatic iteration stops. Round 3 requires Alejandro’s explicit authorization.

Fix prompt:

```text
Work in /Users/alejandroguillen/Projects/gig-lead-responder. Branch: feat/hub-phase0
(HEAD = branch tip, verify with `git rev-parse feat/hub-phase0`). Ask: fix the Round 2 payment-terms approve-path finding.

FIRST -- confirm no other session or auto-continue is live here. Run:
  pwd
  git branch --show-current
  git rev-parse feat/hub-phase0
  git status --short

Expected starting HEAD: df6b2b07be95ee68880df922d4ad316e69ea9aa9
If HEAD differs or the worktree is dirty, STOP and ask Alejandro.

Read:
  HANDOFF.md
  CLAUDE.md
  AGENTS.md if present
  docs/plans/2026-10-11-fix-payment-terms-by-lead-time-plan.md
  docs/reviews/2026-10-11-payment-terms-codex-round1.md
  src/api.ts
  src/payment-terms-approve.test.ts
  ~/.claude/docs/mandatory-review-workflow.md

Fix range:
  eaa5120..df6b2b07be95ee68880df922d4ad316e69ea9aa9

Prior Codex verdicts:
  - R1: NO-GO -- recorded in docs/reviews/2026-10-11-payment-terms-codex-round1.md

Finding:
  src/api.ts:118,126 treats an empty full_draft as absent because of truthiness checks.
  A present full_draft of "" has zero known payment sentences but reaches claim/send.

Reproduce:
  Use a direct lead with valid stored classification/pricing, a compressed draft containing exactly one known payment sentence, and full_draft = "".
  Demonstrate that the current route reaches the send attempt instead of returning 409.

Fix:
  Treat full_draft as present whenever it is non-null, including "".
  Refresh and validate it before claimLeadForSending.
  Preserve the existing behavior for null full_draft, platform leads, valid drafts, and stale non-empty drafts.

Regression test:
  Extend the real approve-path test with full_draft = "".
  It must fail without the fix and prove:
  - 409 payment_terms_unverifiable
  - no send attempt
  - status remains received
  - neither draft is saved or partially changed

Fix contract:
  1. Reproduce the failure.
  2. Name the root cause and fix it.
  3. Add the regression test.
  4. Report focused and full-suite results plus remaining risks.
  5. This is the second confirmed instance of the same “present draft skipped by branch condition” class; inventory the bounded approve refresh surface and state whether the smallest structural fix is warranted.
  6. Do not run the real server, poller, database, network, or sends.

Round 2 is the second NO-GO. Automatic iteration stops after this fix. Do not prepare a Round 3 prompt without Alejandro’s explicit:
  Round 3 authorized by Alejandro: YES
```

Would you like me to copy this prompt to the clipboard?
````
