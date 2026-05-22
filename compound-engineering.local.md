# Review Context -- Gig Lead Responder

## Risk Chain

**Brainstorm risk:** "LR draft quality is now the ceiling for gate-passed responses. No agent voice polish. Monitor for degradation."

**Plan mitigation:** Evaluated 4 options. Chose Option 4 (accept + monitor) with targeted hardening: alias map for unknown capabilities, soft refusal patterns for AI draft quality. Rejected full Stage 1/Stage 2 refactor as wrong target (bug was in expert-pipeline, not LR).

**Work risk (from Feed-Forward):** "Whether the alias map needs fuzzy matching or if substring matches are sufficient."

**Review resolution:** 3 agents (security, performance, correctness). Found and fixed alias map ordering bug (longest-first sort). 4 test cases added from review. Pre-existing XSS in index.html deferred. 176 tests passing.

## Files to Scrutinize

| File | What changed | Risk area |
|------|-------------|-----------|
| `src/pipeline/hard-gate.ts` | ALEX_ALIAS_MAP + Check 3 + longest-first sort | Substring matching order, guessFormatFamily overlap |
| `src/pipeline/post-check.ts` | SOFT_REFUSAL_PATTERNS (6 patterns) + dual-draft check | False positives on valid Alex sentences |
| `src/hard-gate.test.ts` | 14 test cases for alias map | Coverage of edge cases (empty input, case, ordering) |
| `src/post-check.test.ts` | 9 test cases for soft refusal | Dual-violation test, false-positive guards |

## Plan Reference

`docs/plans/2026-04-22-feat-capability-hardening-plan.md`
