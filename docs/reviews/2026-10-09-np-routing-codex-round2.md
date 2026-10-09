# Codex round 2 — NP routing fixes (`b8b2bb5`, `1067d1a`)

**Verdict: NO-GO** (1 P2; Codex CLI `codex exec -s workspace-write`, run by Claude Code on 2026-10-09 at `1067d1a`; tree clean after). All three round 1 findings confirmed closed (gala/auction corporate leads stay held by the backup; foundation cases behave as intended). The new P2 is a FALSE-HOLD only ("PTO" = paid time off). **Second NO-GO: automatic iteration STOPPED; round 3 only with `Round 3 authorized by Alejandro: YES`.**

Both runs agree (run B by Alex below). Verbatim (run A, Claude Code):

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


## Run B (Alex re-ran round 2 with the same prompt), verbatim

## Verdict: NO-GO

### P2 — Bare PTO still creates false nonprofit holds

src/pipeline/classify-verify.ts:22

The backup regex treats every standalone PTO as a nonprofit signal. A corporate or ordinary lead such as “PTO accrued” or “PTO policy” is therefore held as nonprofit, even when PTO means paid time off rather than Parent Teacher Organization.

Root cause: PTO is matched without school/parent-organization context.

Required fix: require contextual wording for PTO, or otherwise distinguish paid-time-off usage. Add regression tests for both school PTO and paid-time-off PTO.

The original P1 venue-premium override, P1 backup vocabulary coverage, and P2 foundation false holds are closed. Gala/auction corporate leads still receive the backup hold, so they cannot escape Tier A review.

Checked clean:

- npm run test:match -- "port manifest R403" — passed
- npm run test:match -- "tier A venue hold" — passed
- npx tsc --noEmit — passed
- Worktree remains clean
- No files edited
