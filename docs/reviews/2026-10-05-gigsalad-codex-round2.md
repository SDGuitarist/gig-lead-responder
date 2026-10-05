# Codex round 2 — GigSalad round-1 fixes (`765fa5b..019696a`)

**Verdict: NO-GO** (1 P1 + 1 P2; Codex CLI `codex exec -s workspace-write`, run by Claude Code on 2026-10-05 at `019696a`; tree clean after). Prior: R1 NO-GO (`2026-10-05-gigsalad-codex-round1.md`). **Second NO-GO: automatic iteration STOPPED.** Round 3 only with `Round 3 authorized by Alejandro: YES`. Verbatim:

---

## Verdict: NO-GO

### P1 — Contact scrub is still incomplete

File: `src/automation/parsers/gigsalad-page.ts:99-104,135,142`

Failing input:

```text
Event info
Alice
Thu, June 17, 2027 contact +44 20 7946 0958
Springfield, CA 90001, US
Event type: Wedding
Block communication
```

The international phone remains in `rawText` through `dateText`. Field values use `scrub()`, but the reconstructed date line does not; the final pass removes emails only, not phones.

Root cause: contact sanitization is applied inconsistently to derived raw-text components.

Required fix: scrub `dateText` and every value interpolated into `rawText`, or apply one final phone-and-email scrub to the complete output. Add a regression test for a phone appended to the date line.

Round-1 contact finding is therefore only partly fixed.

### P2 — Input-bound tests are vacuous

Files: `src/gigsalad-page.test.ts:151-155`, `src/gigsalad-match.test.ts:117-121`

The new size tests only assert that parsing completes within a time threshold. They do not prove the 20,000/2,000-character limits are enforced; an unbounded implementation could still pass on this machine.

Required fix: add sentinel content beyond each bound and assert it cannot affect parsed fields or output.

### Questions checked

1. Round-1 findings: wrong-page validation, send disarming, `not_a_lead_email` holding, collision matching, calendar validation, and declared bounds are implemented. Contact scrubbing is partial as noted above.

2. I found the new contact leak. I found no additional new wrong-lead/account acceptance or hold bypass.

3. The functional regression tests for the named fixes would fail when their fixes are reverted. The size-limit timing assertions are vacuous.

Verification:

- `npm run test:match -- "gigsalad"`: 41 pass, 0 fail.
- `npm test`: 577 pass, 16 sandbox-blocked failures, 1 skip. The failures are environment restrictions on listening to local ports or reading `sysctl`; none are GigSalad failures.
- Worktree remains clean.
