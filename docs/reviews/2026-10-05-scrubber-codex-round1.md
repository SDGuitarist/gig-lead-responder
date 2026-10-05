# Codex round 1 — new contact scrubber approach (`cc96a0e..9b2ac1c`)

**Verdict: NO-GO** (1 P1 + 1 P2; Codex CLI `codex exec -s workspace-write`, run by Claude Code on 2026-10-05 at `9b2ac1c`; tree clean after). Fresh round counter for the new approach Alex chose after the GigSalad cap (`2026-10-05-gigsalad-codex-round3.md`). Verbatim:

---

## Verdict: NO-GO

### P1

- `src/automation/parsers/gigsalad-page.ts:155-158` — Contact data can reach `rawText` through a recognized time line.

  Concrete input:

  ```text
  Event info
  Alice
  Thu, June 17, 2027 View calendar
  10:00 PM – 10:45 PM (45 minutes call 5550100199)
  Springfield, CA 90001, US
  Event type: Wedding
  Block communication
  ```

  Result: `rawText` contains `5550100199`. An email similarly leaks:

  ```text
  10:00 PM – 10:45 PM (45 minutes alice@example.com)
  ```

  Root cause: `TIME` accepts arbitrary text inside its parentheses; `timeText` preserves the entire source line; the final pass explicitly skips `Time:` lines.

  Required fix: ensure the emitted `Time:` line is rebuilt only from captured safe fields, or scrub the complete emitted line before returning it. Add regression tests for phone and email embedded in the recognized time line.

### P2

- `src/gigsalad-page.test.ts:168-176` — The test named “a phone or email riding on the date or time line” does not test the time-line path. Both contaminants are placed on the date line, which is rebuilt from `dateText`; the assertion therefore passes even if time-line scrubbing is removed entirely.

  Required fix: place phone/email contaminants inside the recognized time line and assert they cannot appear in `rawText`.

### Questions checked

1. **Not clean:** fields and `clientFirstName` are scrubbed/null, but recognized `Time:` lines leak phone/email data into `rawText`.
2. **Yes, by the explicitly accepted design:** a valid safe shape such as `12/25/2026` can shield eight digits from counting. Invalid/overbroad shapes are covered by tests such as `$5550100199`, `55/01/0199`, and `2026-55-01 0199`.
3. **Mostly clean under the settled fail-closed policy:** tested prices, guest counts, sizes, dates, and times survive. Known losses such as `1500-2000` are the accepted tradeoff.
4. **Partially:** separator/threshold weakening and several safe-shape-bound weakenings fail tests. The time-line protection assertion is vacuous as described above.

Targeted GigSalad tests passed. The full sandbox run had unrelated environment failures from blocked local server binds; the worktree remained clean.
