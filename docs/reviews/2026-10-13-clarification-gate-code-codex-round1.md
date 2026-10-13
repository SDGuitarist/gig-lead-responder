---
date: 2026-10-13
phase: code review, round 1
subject: feat/hub-phase0, diff 1e9a8e6..e5662c7 (clarification gate opening rule)
prior_verdicts: none for this code (plan: ...-clarification-gate-plan-codex-round1.md, ...round2.md)
verdict: NO-GO (2 P2)
---

# Round 1 (code): NO-GO, 2 P2

One run. Pasted by Alex 2026-10-13; findings verbatim, the appended fix prompt summarized (its two numbered items map
onto the two findings). Round 2 verifies only the named fixes.

## Findings (verbatim)

### P2 — Snapshot tests do not actually prove byte equality

`src/clarification-gate-prompt.test.ts:40` calls `snapshotForm()` before every comparison. `snapshotForm()` removes
the entire voice-reference block (`src/verify-prompt-cases.ts:57-67`), so an edit inside that block would pass G2/G4
unnoticed.

The existing test only checks that `Patterson` and `Sparse Cocktail` appear; it does not detect changed reference
text. The test title and plan claim "byte-equal," but the assertion is only byte-equal after normalization.

### P2 — `opening` extraction mishandles same-line salutations

`scripts/clarification-measure.ts:112-115` skips a salutation only when the whole first non-empty line ends with a
comma. Existing project fixtures contain valid drafts such as:

```
Hi Sarah, a good night. Solo guitar, $650, 2 hours.
```

That line is retained as the opening, so the recorded `opening` includes `"Hi Sarah,"` and is not the draft's first
content sentence. This can misclassify the rerun evidence. There is no regression test for either same-line or
separate-line salutations.

## Verification (Codex)

Identity gate passed (HEAD `e5662c7`, clean). Scoped diff: 19 files. Focused clarification test: 20 pass, 0 fail.
Typecheck clean. The venue-history command was blocked by the sandbox's local IPC/listen restriction, not by a
reported code assertion. No production consumer of `rule_implied_pass` was found.

## Verdict

NO-GO. Worktree remains unchanged.

## Claude Code's check (2026-10-13)

| Finding | Check | Result |
|---|---|---|
| P2-1 masked block | `snapshotForm` replaces the block (`## VOICE CALIBRATION REFERENCES` to `## EVALUATION CRITERIA`); the block also holds the template's own instruction lines. I flagged this limit in the review prompt myself. Reproduction in the fix commit. | **Valid.** |
| P2-2 salutations | The runner shifts line 0 only if it ends in `,` and is at most 40 characters; `Hi Sarah, a good night.` is one line and is kept. In the 18-run re-run no draft carried a salutation, so the recorded openings there are unaffected; the defect is latent. | **Valid, latent.** |

Both accepted.
