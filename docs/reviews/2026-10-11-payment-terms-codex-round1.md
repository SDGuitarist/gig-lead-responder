# Codex CODE review, round 1: payment terms by lead time

**Code:** `feat/hub-phase0` at `eaa5120` (work commits `0f97ff4`, `6021ca2`, `ebc0c78`, `38e850a`, `00cbcba`, `1145da9`,
`0fb78c2`, `b3286a8`, `eaa5120`). **Plan:** `docs/plans/2026-10-11-fix-payment-terms-by-lead-time-plan.md` (Revision 4).
Prior Codex verdicts: none for this code (plan rounds 1-3 are recorded separately and are not code rounds).
**Pre-registered stops:** a 2nd NO-GO stops automatic iteration (round 3 only with Alex's YES); a 3rd NO-GO is the hard cap.
**Reader and trigger:** the fix commit that follows; the round-2 prompt.

**Verdict: NO-GO on BOTH runs; the stricter verdict is run B (P1).** One finding, seen by both runs. Both runs judged the
27 new venue-leak fingerprints exact (file-bound, no overshoot).

| # | Runs | Finding | Disposition |
|---|---|---|---|
| 1 | A P2, B P1 | `src/api.ts` approve checks only the `compressed_draft` refresh. A `full_draft` with zero or two known payment sentences is ignored, and the full draft is refreshed only when the compressed text changed | FIX: refresh every present draft, 409 `payment_terms_unverifiable` before the claim if either fails, save both only when both succeed; route-level test through `createApp()` proving no send |

## Run A (Claude Code, `codex exec -s read-only`, 2026-10-11; HEAD `eaa5120`)

````
NO-GO — one P2 finding.

P2 — approve ignores an invalid `full_draft` refresh

`src/api.ts:121-124`

Concrete input:

- Direct lead, event `2026-10-25`
- Approval date `2026-10-12`
- `compressed_draft` contains exactly the old two-weeks sentence
- `full_draft` contains no known payment sentence, or contains two

The compressed draft refresh succeeds, so the endpoint sends it. The full-draft refresh returns `{ error }`, but the code silently ignores that result and leaves the stored full draft stale or unverifiable. The plan requires refreshing both drafts when present and returning 409 on any refresh error.

This also explains the test gap: P15/P16 test `refreshPaymentSentence` directly, not the HTTP approve path. There is no regression test proving that an invalid existing `full_draft` causes 409 and no send.

The 27 venue-history fingerprints are file-bound and exact: the exemption applies only to the three named baseline files and their listed window keys. I found no overshoot in that exemption.

Verification:

- `npx tsc --noEmit`: clean.
- Focused pure payment/date/prompt/refresh tests: 18 passed.
- Full `npm test`: sandbox-limited by known `EPERM` temp-directory/IPC failures; Round 0’s reported 788/0/1 remains the authoritative clean-environment result.
- Worktree remains clean at `eaa5120a6a09e4414d2fe1f613ee518974d4f778`.

Fix contract for Claude Code:

```text
Work in /Users/alejandroguillen/Projects/gig-lead-responder
Branch: feat/hub-phase0
Ask: fix the Round 1 payment-terms approve-path finding.
HEAD: branch tip eaa5120a6a09e4414d2fe1f613ee518974d4f778

FIRST gate:
  pwd
  git branch --show-current
  git rev-parse feat/hub-phase0
  git status --short
Expected HEAD: eaa5120a6a09e4414d2fe1f613ee518974d4f778
Stop if the repo, branch, HEAD, or worktree differs.

Read:
  HANDOFF.md
  CLAUDE.md
  AGENTS.md
  docs/plans/2026-10-11-fix-payment-terms-by-lead-time-plan.md
  docs/reviews/2026-10-11-payment-terms-local-runs.md
  ~/.claude/docs/mandatory-review-workflow.md

Finding:
  src/api.ts:121-124 ignores a refresh error for full_draft when compressed_draft refresh succeeds.

Reproduce:
  Use a direct lead dated 2026-10-25, approval date 2026-10-12, valid compressed draft with one known sentence, and full draft with zero or multiple known sentences. Demonstrate that the current endpoint sends instead of returning 409.

Fix:
  Treat a refresh error in either present draft as payment_terms_unverifiable; update both drafts only after both refreshes succeed, before claimLeadForSending.

Regression test:
  Add an approve-path test, or explain why an endpoint harness is impractical and add the narrowest deterministic seam test covering both-draft behavior. The test must fail without the fix and prove the SMS sender is not called.

Also test the positive control:
  both drafts valid and stale → both are refreshed and the compressed refreshed text is what would be sent;
  GigSalad/platform lead → drafts remain unchanged.

Report:
  - observed reproduction
  - root cause
  - focused test result
  - full-suite result
  - remaining risks
  - whether any high-risk “safe because” claim remains unexecuted

Do not change prices, platforms, sentence wording, venue fingerprints, or unrelated files. Do not run the server, poller, real database, network, or sends.
```

This is the first code-review NO-GO; automatic iteration may continue once. A second NO-GO stops automatic iteration, and round 3 requires Alejandro’s explicit authorization.
````

## Run B (Alex, inside Codex, 2026-10-11; HEAD `eaa5120`)

```
NO-GO — Code Review Round 1

P1 — Approve ignores an invalid `full_draft` refresh

`src/api.ts:121-124`

The endpoint validates only `compressed_draft`. If `full_draft` contains zero or multiple known payment sentences, its refresh returns `{ error }`, but that error is silently ignored. The endpoint still updates/claims/sends instead of returning the required 409.

Concrete input:

- Direct lead, event `2026-10-25`, approved on `2026-10-12`.
- `compressed_draft` contains the valid two-weeks sentence.
- `full_draft` contains no known sentence, such as `A deposit secures your date.`

Expected: `409 payment_terms_unverifiable`, no claim, no send.
Actual: compressed draft proceeds; invalid full draft is silently retained.

Root cause: only the compressed refresh result is checked before sending.

Fix contract:

- Reproduce with a route-level or extracted approve-flow test.
- Validate `full_draft` whenever present and fail closed on its refresh error.
- Add a regression test that fails against the current implementation.
- Report focused and full-suite results plus remaining risks.

Fingerprint exemption

No finding. The 27 new exemptions are file-bound hashes of exact 30-character windows, not whole-file exemptions. A different window or changed copied text still fails. The exemption appears exact for the stated nine public windows per baseline.

Verified clean

- `PaymentTerms` remains shared across initial generation, retries, edits, and post-checks.
- Unknown-platform precedence and wording are correct.
- CLI validation occurs before the API-key check.
- P10's mutation crosses a payment band.
- Approve refreshes compressed drafts before claiming.
- Auto-send uses the same-run output, so it does not introduce an additional stale-term path.

The required starting identity passed; `ps` remained unavailable due macOS permissions. No database, server, poller, network, or send was used.

[Claude Code fix prompt omitted here: gate at eaa5120; read HANDOFF, CLAUDE.md, the plan, src/api.ts:121-124;
reproduce (compressed has one known sentence, full has zero or two); refresh full_draft before claim/send; 409 on either
error, no claim, no send; keep the successful refresh; regression test that fails without the fix; report focused,
full npm test and tsc, remaining risks including the lack of a live HTTP/SMS harness. Stop after this fix.]
```
