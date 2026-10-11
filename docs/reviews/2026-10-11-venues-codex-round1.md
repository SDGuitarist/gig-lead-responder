# Codex CODE review, round 1: venues Alex has played (private file)

**Code:** `feat/hub-phase0` at `080702c` (work commits `111f47b`, `ae1a30f`, `bc267e0`, `080702c`). **Plan:**
`docs/plans/2026-10-11-feat-venue-history-private-file-plan.md` (Revision 3). Prior Codex verdicts: none for this
code (plan rounds 1-3 are recorded separately and are not code rounds). **Pre-registered stops:** a 2nd NO-GO stops
automatic iteration (round 3 only with Alex's YES); a 3rd NO-GO is the hard cap.
**Reader and trigger:** the fix commit that follows; the round-2 prompt.

**Verdict: NO-GO on BOTH runs; the stricter verdict is run B (P1).** One finding, seen by both runs. Everything else
(matcher, validation, cache, test isolation, context wiring, follow-up exclusion, V15, runner isolation) matched the plan.

| # | Runs | Finding | Disposition |
|---|---|---|---|
| 1 | A P2, B P1 | `KNOWN_PUBLIC` in `scripts/check-venue-history.ts` exempts EVERY window of the Lodge sentence in 4 files (keyed by file + venue), not just the opening clause that was already public; and (B) the per-file `break` lets one exempt match hide a real leak later in the same file | FIX: exemption anchored to the commit where the clause first became public in each file (a window is "known" only if that historical file version already held it); scan every window; regression tests on made-up data + throwaway-repo controls for exits 0/1/2 |

Also raised by Alex on 2026-10-11, separately from the Codex runs: the always-loaded drafting guide
(`docs/RESPONSE_CRAFT.md:87,92`) and voice examples (`src/data/voice-references.ts:39,109`) show "I've performed at..."
lines, so a draft could borrow a venue claim without the venue file. Evidence so far: 3/3 clean on one made-up venue.
Alex's call: test first (about 6 made-up leads after this fix), then decide. The Lomas Santa Fe example was confirmed true
by Alex and added to the private file as a fact only (no sentence).

## Run A (Claude Code, `codex exec -s read-only`, 2026-10-11; HEAD `080702c`)

```
NO-GO — one P2 finding.

P2 — Privacy sentinel exemption is broader than documented

- Location: `scripts/check-venue-history.ts:20-24, 69-71`
- Concrete failure: if any later 30-character fragment of the Lodge claim is copied into one of the four `KNOWN_PUBLIC` files, the script reports it as known and exits 0. The exemption is keyed only by `(file, venue)`, not by the specific already-public opening fragment.
- Root cause: `KNOWN_PUBLIC` exempts every matching claim window in those files, although only the opening clause is known to be public.
- Required fix: restrict exemptions to exact known-public fragments/windows, or otherwise identify the specific public span.
- Regression test: add a controlled sentinel fixture proving an unapproved later Lodge-claim fragment in a known-public file exits 1, while the exact approved opening fragment remains exempt.
- Reproduction was not run against Alex’s private file per instruction; this is directly evident from the exemption logic.

No P1 findings. The matcher’s one-direction rule, validation, cache-by-path, test isolation design, context wiring, follow-up exclusion, and PF-Intel coexistence match the plan. The recorded d1 model additions are the plan’s explicitly accepted prose-detector limitation, not a deterministic code defect.

Verification:

- `npx tsc --noEmit`: passed.
- `npm test`: unable to complete in this sandbox; 33 failures were caused by environment `EPERM` errors creating temporary directories, including the new venue test file. No `~/Data/` or `data/leads.db` was accessed.
- Missing-file check was also blocked by the same `tsx` IPC `EPERM`.
- Branch identity remains clean at `080702c34d85aba73d04073bdffac04ed3b15ae6`.

The compound kickoff surfaced the prior venue-matching lesson: false venue claims are higher-risk than misses. The implementation follows that principle except for the sentinel exemption above.

Fix handoff:

```text
Work in /Users/alejandroguillen/Projects/gig-lead-responder
Branch: feat/hub-phase0
Ask: fix the Round 1 P2 privacy-sentinel finding in scripts/check-venue-history.ts.

FIRST gate:
  pwd
  git branch --show-current
  git rev-parse feat/hub-phase0
  git status --short
Expected HEAD: feat/hub-phase0 branch tip = 080702c34d85aba73d04073bdffac04ed3b15ae6
Stop if the branch, HEAD, or worktree differs, or if another session changed it.

Read:
  HANDOFF.md
  CLAUDE.md
  AGENTS.md if present
  docs/plans/2026-10-11-feat-venue-history-private-file-plan.md
  scripts/check-venue-history.ts
  src/port-manifest-venues.test.ts
  docs/reviews/2026-10-11-venue-history-local-runs.md

Finding:
KNOWN_PUBLIC currently exempts every 30-character window of the Lodge claim in four files based only on file + venue. A later/private fragment copied into one of those files would incorrectly pass the leakage sentinel.

Fix contract:
1. Reproduce the logic with a controlled fixture; do not read ~/Data or run the checker against Alex’s real file.
2. Fix the root cause by restricting the exemption to the exact approved public fragment/window(s).
3. Add a regression test or controlled check that fails without the fix and preserves the approved opening-fragment exemption.
4. Run focused checks, typecheck, and the full suite where the environment permits; report sandbox EPERM limitations.
5. Read the complete staged diff for private text before committing.
6. Commit one focused change and leave the worktree clean.
7. Update HANDOFF.md with the review result and next step.
Stop after this fix; do not start another review round.
```

Round 3 is not applicable yet; this is Round 1. Ask if you want this handoff copied.
```

## Run B (Alex, inside Codex, 2026-10-11; HEAD `080702c`)

```
NO-GO — Code Review Round 1.

The implementation matches the plan’s matcher, validation, cache, test isolation, context wiring, follow-up exclusion, V15 status assertion, and runner isolation. The recorded runtime result is also honest: the unknown-venue control passed 3/3, while “add nothing” passed 2/3; that prose-detector work remains intentionally out of scope.

P1 — `KNOWN_PUBLIC` can hide new Lodge-sentence leaks

File: `scripts/check-venue-history.ts:20-24, 69-85`

The exemption is keyed only by `file + venue`, so every matching 30-character window of the Lodge claim is exempted in those four files—not only the historically public opening clause. The per-file `break` also means an exempt match can prevent later matches in the same file from being checked.

Concrete failing input: add a later 30-character window from the Lodge claim—e.g. a window beginning after the known public opening clause—to `docs/RESPONSE_CRAFT.md`. The checker records it as known and exits 0. A stronger case: put both the known public opening clause and a new 30-character window from another claim in the same tracked file; the first reported match breaks the scan, so the new leak can be missed.

Root cause: the exemption is attached to a venue/file pair instead of the exact known-public window, and scanning stops after the first match per file.

Required fix: exempt only the exact normalized known-public window(s), continue scanning all windows, and retain a positive control proving the historical opening clause passes plus an overshoot control proving a later Lodge window fails.

Fix-contract requirements for Claude Code:

1. Reproduce the two cases above and report the observed exit status.
2. Fix the root cause, not only the listed file.
3. Add regression tests for the known-public positive, later-window negative, and same-file mixed-match negative.
4. Report focused and full-suite results plus remaining risks.
5. Include a positive/overshoot control because narrowing the exemption could reject the already-public opening clause.

No other P1/P2/P3 findings remain. Round-0 runtime evidence must remain recorded as measurement, especially d1’s added details; no new prose claim detector is required by the settled scope.

[Claude Code fix prompt omitted here: gate at 080702c; read list; reproduce both cases; exact-window exemptions;
scan all windows; keep the opening-clause positive control; regression + overshoot controls; read the staged diff;
focused + full suite + tsc; never open data/leads.db.]
```
