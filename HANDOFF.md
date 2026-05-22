# HANDOFF -- Gig Lead Responder

**Date:** 2026-04-22
**Branch:** `main`
**Phase:** Compound COMPLETE -- Capability Hardening Cycle Done

## Current State

Full compound cycle complete (brainstorm -> plan -> plan review -> work -> review -> compound). 4 commits shipped. 176 tests passing. Solution doc written and learnings propagated.

## Key Artifacts

| Phase | Location |
|-------|----------|
| Brainstorm | `~/Projects/expert-pipeline/docs/brainstorms/2026-04-22-voice-enrichment-without-agent-authority.md` |
| Plan | `docs/plans/2026-04-22-feat-capability-hardening-plan.md` |
| Review | In-session (3 agents: security, performance, correctness) |
| Solution | `docs/solutions/architecture/2026-04-22-capability-hardening-alias-map-soft-refusal.md` |

## Deferred Items

| Item | Reason |
|------|--------|
| XSS in index.html kvHTML | Pre-existing. dashboard.html already has esc(). Add same to index.html. |
| "drum" substring match in NON_ALEX_FORMATS | Pre-existing. Needs word-boundary regex like RED_FLAG_PATTERNS uses. |
| sanitizeClassification() earlier in pipeline | Pre-existing. Move call before hard gate in run-pipeline.ts. |
| Unify ALEX_ALIAS_MAP with guessFormatFamily() | Overlapping keyword lists, separate purposes. |
| 2 deferred soft refusal patterns | "primarily focus" and "while X isn't my main" -- add from production data. |
| Fuzzy alias matching (Levenshtein) | Start with substring, upgrade if unknown_capability fires too often. |

## Three Questions

1. **Hardest decision?** The "defense-in-depth, not load-bearing" distinction. Soft refusal patterns feel like a solution, but the structural bypass and alias map are the real guarantees.
2. **What was rejected?** Full CAPABILITIES data structure (YAGNI -- 3 agents agreed), full Stage 1/Stage 2 refactor (wrong target -- bug was in expert-pipeline), 2 broad regex patterns (false-positive risk).
3. **Least confident about?** guessFormatFamily() in router.ts overlaps with ALEX_ALIAS_MAP. Two sources of truth for "what terms Alex recognizes." Cross-reference comments exist, but unification would be better.

## Prompt for Next Session

```
Read HANDOFF.md for context. This is gig-lead-responder, a live music lead
response pipeline. Capability hardening cycle complete (176 tests passing).
Pick next work from deferred items or start a new initiative.
```
