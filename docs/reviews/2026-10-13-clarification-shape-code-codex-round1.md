---
date: 2026-10-13
phase: code review, round 1
subject: feat/hub-phase0, diff 754244c..d03886a (clarification draft-shape change and its measurement tooling)
prior_verdicts: none for this code (plan: ...-clarification-shape-plan-codex-round1.md, ...round2.md)
verdict: NO-GO (2 P1, 1 P2; all in the measurement report path, none in the prompt)
---

# Round 1 (code): NO-GO, 2 P1, 1 P2

One run. Pasted by Alex 2026-10-13; findings verbatim, the appended fix prompt summarized (its three numbered items map
one to one onto the findings). Round 2 verifies only the named fixes.

## Findings (verbatim)

P1 — Manifest failures do not invalidate the comparison.

`scripts/clarification-arm-report.ts:77-80` computes and prints Fisher results even when `compareArms()` returns
`{ok:false}`. The plan requires a failed manifest check to void the comparison and stop. A bad measurement can
therefore still produce an apparently valid result.

P1 — Incomplete arms are accepted, so the fixed 50-run denominator is not enforced.

`scripts/clarification-arm-report.ts:15-17, 37-46` accepts any non-empty number of files and uses whatever result
count exists as the denominator. `compareArms()` only rejects zero manifests at `src/arm-manifest.ts:36-37`; it does
not require five manifests per arm or 50 runs. A missing process/file can silently change the estimand.

P2 — The report does not print all manifests as the plan specifies.

`scripts/clarification-arm-report.ts:69` prints only `a.manifests[0]`, although the plan requires all ten manifests to
be recorded/printed. The comparison does inspect all manifests, so this is auditability rather than comparison
correctness.

No prompt or hash regression found. The prompt is limited to clarification mode, non-clarification hashes remain
pinned, and the Fisher/Wilson arithmetic matches the recorded values. The 100-run result is appropriately described as
exploratory, observational, one-model, and made-up-lead evidence.

Verification: expected diff stats matched; Clarification Shape 22 pass, 0 fail; Arm Manifest 3 pass, 0 fail;
typecheck clean; the venue-history check and direct `tsx` tests were sandbox-blocked by `EPERM` while creating
localhost/IPC listeners; worktree clean at the pinned HEAD.

Verdict: **NO-GO**

## Claude Code's check (2026-10-13)

| Finding | Check | Result |
|---|---|---|
| P1 gate | The script prints `MANIFEST CHECK:` and then, unconditionally, the unusable-run rates and the Fisher p. | **Valid.** The two real comparison records had `ok: true`, so the recorded numbers are not affected; the script is. |
| P1 shape | `load()` reads every `clarification-*.json` in the directory; `compareArms` rejects only an empty arm. Four files or 49 runs would compare. | **Valid.** |
| P2 manifests | The script prints `manifests[0]` only. | **Valid** (auditability). |
| Not raised, found while taking the inventory | a result file without a `manifest` object (an earlier-format JSON) would throw inside `compareArms`; an arm whose `models` is empty (no model call was made) would compare as equal | to be covered by the bounded inventory in the fix |

All three accepted. The two arms recorded in `d03886a` were five files and 50 results each with `ok: true`, so the
measurement itself is not invalidated.
