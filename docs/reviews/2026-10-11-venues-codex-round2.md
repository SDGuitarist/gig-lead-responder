# Codex CODE review, round 2: venues Alex has played (private file)

**Code:** `feat/hub-phase0` at `f4dcef7` (fix `233eb1e`; docs `240dd77`, `f4dcef7`). Prior Codex verdicts: round 1
NO-GO both runs (`docs/reviews/2026-10-11-venues-codex-round1.md`). **Reader and trigger:** the fix commit that
follows; the round-3 prompt.

**Verdict: NO-GO on BOTH runs; this is the 2nd NO-GO, so automatic iteration stopped.** Both runs: the round-1 finding
is closed (exact windows from the historical commit, every window scanned, unreadable commit fails). Each run found a
different P2 in the same exemption:

| # | Runs | Finding | Disposition |
|---|---|---|---|
| 1 | B P2 | `CHECK_KNOWN_PUBLIC` (added for throwaway-repo controls) also works against the real repo: pointing a file at `HEAD` exempts a fragment committed there | FIX: override removed; nothing in the environment can widen the exemption |
| 2 | A P2 | "Known" means "anywhere in the file at that commit", not the approved public span: unrelated text in the historical file is exempt too | FIX: exemption is an explicit list of fingerprints (SHA-256, file-bound) of the exact 30-character windows that were public before this work; no commit lookup at run time |

**Round 3 authorized by Alejandro: YES** (2026-10-11, after the 2nd NO-GO, on Claude Code's recommendation to run: the
remaining finding sits in executable privacy logic, where only an independent bypass hunt can show no other way round
the check). Asked when only run B was in; run A's finding is in the same exemption and is fixed in the same commit.
A 3rd NO-GO is the hard cap: no round 4; anything left goes to HANDOFF as a known limit.

## Run A (Claude Code, `codex exec -s read-only`, 2026-10-11; HEAD `f4dcef7`)

```
NO-GO — Round 2.

P2 — Historical exemption is still content-wide, not span-bound

- Location: [scripts/venue-leak-scan.ts:27](/Users/alejandroguillen/Projects/gig-lead-responder/scripts/venue-leak-scan.ts:27), [scripts/check-venue-history.ts:73](/Users/alejandroguillen/Projects/gig-lead-responder/scripts/check-venue-history.ts:73)
- Concrete failing input:
  - Claim: `Private venue sentence that must never be copied.`
  - Historical file: `Unrelated public note: Private venue sentence that must never be copied.`
  - Current tracked file: `Drafting guide: Private venue sentence that must never be copied.`
- `publicText.includes(w)` marks the current copy as known because the same 30-character window appeared somewhere in the historical snapshot, even if it belonged to unrelated text rather than the approved public sentence.
- Root cause: the exemption records only `file -> commit`; it does not identify the approved public span or sentence.

Required fix contract:

1. Reproduce the unrelated-historical-text case with made-up data.
2. Restrict exemptions to explicitly approved public windows/spans.
3. Add a regression test that fails before the fix while preserving the opening-clause positive case.
4. Run focused tests, typecheck, and the full suite; report sandbox `EPERM` failures.
5. Report remaining risk: paraphrases and copies shorter than 30 characters remain intentionally undetected.

The `CHECK_KNOWN_PUBLIC` override is acceptable only as an explicitly announced local throwaway-repo control; it is not independently trustworthy if pointed at a real repository. I do not classify that as a separate finding because it is not used by the default real-file check.

Verification:

- Focused venue tests: all 6 venue-leak tests passed.
- Typecheck: passed.
- Broader test execution was blocked by known sandbox `EPERM` failures creating temporary directories.
- Worktree remained clean.
- No private data or `data/leads.db` was accessed.

The round-2 NO-GO stops automatic iteration. I am not generating a round-3 review prompt; that requires Alejandro’s explicit authorization.

Fix handoff:

```text
Work in /Users/alejandroguillen/Projects/gig-lead-responder. Branch: feat/hub-phase0 (HEAD = branch tip, verify with git rev-parse feat/hub-phase0). Ask: fix Round 2 P2 in the venue leakage sentinel.

FIRST -- confirm no other session or auto-continue is live here. Run:
  pwd
  git branch --show-current
  git rev-parse feat/hub-phase0
  git status --short
Expected starting HEAD: f4dcef7fd7c7fbd00c131fba464fa7604a73b560
If HEAD differs or the worktree is dirty, STOP and ask Alejandro.

Read:
  HANDOFF.md
  CLAUDE.md
  AGENTS.md if present
  docs/plans/2026-10-11-feat-venue-history-private-file-plan.md
  docs/reviews/2026-10-11-venues-codex-round1.md
  scripts/check-venue-history.ts
  scripts/venue-leak-scan.ts
  scripts/venue-leak-scan.test.ts

Finding:
The historical exemption uses publicText.includes(window). A copied 30-character window is exempted whenever it appears anywhere in the historical file, even if that occurrence was unrelated to the approved public sentence.

Concrete reproduction:
Use made-up text only:
  claim = "Private venue sentence that must never be copied."
  historical = "Unrelated public note: Private venue sentence that must never be copied."
  current = "Drafting guide: Private venue sentence that must never be copied."
The current match must be reported as a leak, not known-public.

Fix contract:
1. Reproduce the failure before editing.
2. Fix the root cause by restricting known-public exemptions to explicitly approved public windows/spans.
3. Preserve the existing approved opening-clause positive case.
4. Add a regression test for the unrelated historical occurrence.
5. Run the focused venue tests, typecheck, and full suite where the environment permits.
6. Do not read ~/Data/ or data/leads.db, and do not run the checker against Alex’s real file.
7. Leave the worktree clean and report remaining risks.
Stop after applying this fix; do not start another Codex review round.
```

```

## Run B (Alex, inside Codex, 2026-10-11; HEAD `f4dcef7`)

```
NO-GO — Code Review Round 2.

The round-1 finding is closed. The scanner now:

- Anchors exemptions to exact windows present in the historical commit.
- Scans every window without `break`.
- Fails unreadable historical commits.
- Preserves the known-public positive control.
- Has mutation-backed tests and the recorded controls pass.

P2 — `CHECK_KNOWN_PUBLIC` can bypass the real local privacy gate

Files: `scripts/check-venue-history.ts:23-25, 64-65`

The environment override is intended for throwaway-repository controls, but the code does not require `CHECK_REPO_ROOT` or otherwise prevent its use against the real repository.

Concrete failing input: after a claim fragment is committed to `docs/RESPONSE_CRAFT.md`, run the checker with:

    CHECK_KNOWN_PUBLIC='{"docs/RESPONSE_CRAFT.md":"HEAD"}' \
    npx tsx scripts/check-venue-history.ts

Because `git show HEAD:docs/RESPONSE_CRAFT.md` contains the fragment, the checker treats it as historically public and can pass.

Root cause: test-control configuration is accepted by the production/local gate without a throwaway-repository guard.

Required fix: reject `CHECK_KNOWN_PUBLIC` unless an explicit throwaway `CHECK_REPO_ROOT` is supplied and differs from the real repository, or remove the override from the wrapper and test `scanText` directly.

Required regression controls:

- Override without throwaway root → fails closed.
- Override with throwaway root → controls still pass.
- Normal real-repository invocation remains unchanged.

No other findings remain. The borrowed-claim runs are correctly recorded as measurement, not a deterministic guarantee.

[Claude Code fix prompt omitted here: gate at f4dcef7; read list; reproduce; fail closed unless paired with a
throwaway CHECK_REPO_ROOT, or remove the override and test scanText directly; preserve throwaway controls and
real-file behavior; regression tests for rejected and accepted override; positive/overshoot control.]
```
