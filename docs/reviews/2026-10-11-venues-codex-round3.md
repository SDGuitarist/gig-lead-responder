# Codex CODE review, round 3: venues Alex has played (private file)

**Code:** `feat/hub-phase0` at `dca2aab` (fix `dca2aab`; docs `9899eb3`). **Round 3 authorized by Alejandro: YES**
(2026-10-11, after the 2nd NO-GO). Prior Codex verdicts: round 1 NO-GO both runs; round 2 NO-GO both runs.
**Reader and trigger:** the compound phase (solution doc) and HANDOFF.

**Verdict: GO on BOTH runs. No P1/P2/P3. The review loop for the venue-history work is CLOSED.** Both round-2
bypasses are closed (env override gone; only the 67 fixed fingerprints can exempt text); control-repo mode cannot pass
for this repo; run B checked all 67 fingerprints against their historical commits.

**Known limits (intentional, unchanged):** the leak sentinel misses paraphrases and copies shorter than 30 characters;
the gate for those is Claude Code reading every staged diff before a commit. The "add nothing" rule held 2/3 in d1-k1
and b5 added one detail: recorded as measurement, not fixed (a prose claim detector was rejected in the plan).

## Run A (Claude Code, `codex exec -s read-only`, 2026-10-11; HEAD `dca2aab`)

```
GO — Round 2 fix verified. No P1/P2/P3 findings.

Evidence:

- `feat/hub-phase0` remains clean at `dca2aab6f470c1f1ce2945106b522d0258accb8f`.
- Focused scanner tests: 7/7 passed.
- TypeScript check passed.
- The environment override is gone; only the fixed in-code fingerprints can exempt text.
- Control-repo mode applies no exemptions and explicitly says the real repo was not checked.
- A different 30-character window cannot become known without editing the list, barring an impractical targeted 64-bit hash collision.
- Mutation coverage recorded in the fix commit covers file binding, “everything known,” early break, whitespace collapse, and short-window handling.

Known limits remain intentional: paraphrases and copies shorter than 30 characters are not detected. Full-suite failures were unrelated sandbox `EPERM` errors creating temporary directories; the venue tests were unaffected.

The process-list check itself was denied by macOS permissions, but the worktree stayed clean and the pinned branch/HEAD did not move.```

## Run B (Alex, inside Codex, 2026-10-11; HEAD `dca2aab`)

```
GO — Round 3.

No P1/P2/P3 findings.

- Both Round-2 bypasses are closed:
  - `CHECK_KNOWN_PUBLIC` is gone.
  - Only the fixed 67 fingerprints can grant exemptions (`scripts/check-venue-history.ts:21-48`).
- All 67 fingerprints match their intended historical commits.
- File binding and exact-window behavior are covered by tests (`scripts/venue-leak-scan.test.ts:20-52`).
- Focused venue tests: 7 passed.
- Typecheck: passed.
- Full suite: venue tests passed; unrelated sandbox `EPERM` listener/sysctl failures remain.
- 16-hex fingerprints are safe to publish; accidental collision with 67 entries is approximately 1 in 2⁵⁸ per arbitrary window, and deliberate second-preimage collision is infeasible.

Known limits, intentionally unchanged: paraphrases and copies shorter than 30 characters can evade detection. The real private file was not rerun, per instruction; prior Round-0 evidence recorded it passing.

The worktree remained clean at `dca2aab6…`. No round 4 is proposed.
```
