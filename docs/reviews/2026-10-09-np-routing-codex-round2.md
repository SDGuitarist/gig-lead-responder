# Codex round 2 — NP routing fixes (`b8b2bb5`, `1067d1a`)

**Verdict: NO-GO** (1 P2; Codex CLI `codex exec -s workspace-write`, run by Claude Code on 2026-10-09 at `1067d1a`; tree clean after). All three round 1 findings confirmed closed (gala/auction corporate leads stay held by the backup; foundation cases behave as intended). The new P2 is a FALSE-HOLD only ("PTO" = paid time off). **Second NO-GO: automatic iteration STOPPED; round 3 only with `Round 3 authorized by Alejandro: YES`.**

Verbatim (run A, Claude Code):

---

## Verdict: NO-GO

### P2 — `PTO` falsely holds paid-time-off language

- `src/pipeline/classify-verify.ts:22`
- Concrete failure: any lead mentioning “PTO” is treated as nonprofit, including “corporate PTO policy” where PTO means paid time off.
- Root cause: `PTO` is an unconditional case-insensitive nonprofit token.
- Required fix: require school/organization context for PTO, while preserving valid “school PTO” detection. Add a regression test for paid-time-off usage.

Checked clean:

- R403 tests: 127 passed.
- Tier A venue tests: 121 passed.
- `npx tsc --noEmit`: passed.
- Gala/auction corporate leads remain held by the backup warning.
- Foundation sentence-start, possessive, brand-name, and venue-name cases behave as intended.
- No files were edited; worktree remains clean.

