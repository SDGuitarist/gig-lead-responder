# HANDOFF -- Gig Lead Responder

**Date:** 2026-04-22
**Branch:** `main`
**Phase:** Review COMPLETE -- Capability Hardening (Alias Map + Soft Refusal Detection)

## Current State

Three commits shipped. 176 tests passing (153 existing + 23 new). Review phase found and fixed an alias map ordering bug. No interface changes, no architectural changes.

## What Changed This Session

| Commit | Change | Files |
|--------|--------|-------|
| `aded0a7` | Alias map (ALEX_ALIAS_MAP) + Check 3 in hard gate | `src/pipeline/hard-gate.ts`, `src/hard-gate.test.ts` (new) |
| `e8d4378` | Soft refusal detection (6 patterns, dual-draft) | `src/pipeline/post-check.ts`, `src/post-check.test.ts` (new) |
| `bdc3944` | Review fix: sort alias longest-first + 4 test cases | `src/pipeline/hard-gate.ts`, `src/hard-gate.test.ts`, `src/post-check.test.ts` |

### What the alias map does

- KNOWN capabilities (guitar, ukulele, mariachi, etc.) pass with no flag
- ESCALATE capabilities (latin band, spanish music, etc.) pass with "ambiguous_capability" flag
- Unknown instruments (charango, mandolin, vihuela) pass with "unknown_capability" flag
- Sorted longest-first so "mariachi ensemble" matches before "ensemble"

### What soft refusal detection does

- 6 regex patterns catch AI drafts that undermine Alex's capability
- Checks both full_draft and compressed_draft
- Triggers gate_status: "fail" via existing violations mechanism

### Review findings (3 agents: security, performance, correctness)

| Finding | Severity | Resolution |
|---------|----------|------------|
| Alias map ordering bug (.find() is insertion-dependent) | P2 | Fixed: sort longest-first (commit bdc3944) |
| Missing test: "mariachi ensemble" ordering | P2 | Added (commit bdc3944) |
| Missing test: empty format_requested | P2 | Added (commit bdc3944) |
| Missing test: uppercase input | P2 | Added (commit bdc3944) |
| Missing test: dual violation (banned + soft refusal) | P2 | Added (commit bdc3944) |
| XSS in index.html kvHTML (no escaping) | P2 | Deferred -- pre-existing, not our change |
| "drum" substring in NON_ALEX_FORMATS | P1 | Deferred -- pre-existing Check 1, not our change |
| sanitizeClassification() before hard gate | P2 | Deferred -- architectural, separate session |
| ReDoS in soft refusal patterns | None | All 6 patterns confirmed safe |

## Deferred Items

| Item | Reason |
|------|--------|
| XSS in index.html kvHTML | Pre-existing. dashboard.html already has esc(). Add same to index.html. |
| "drum" substring match in NON_ALEX_FORMATS | Pre-existing. Needs word-boundary regex like RED_FLAG_PATTERNS uses. |
| sanitizeClassification() earlier in pipeline | Pre-existing. Move call before hard gate in run-pipeline.ts. |
| Unify ALEX_ALIAS_MAP with guessFormatFamily() | Overlapping keyword lists, separate purposes. |
| 2 deferred soft refusal patterns | "primarily focus" and "while X isn't my main" -- add from production data. |
| Fuzzy alias matching (Levenshtein) | Start with substring, upgrade if unknown_capability fires too often. |
| makeClassification test helper dedup | Cosmetic. Extract to src/test-helpers.ts when more files need it. |

## Three Questions

1. **Hardest judgment call in this review?** Whether the XSS in index.html kvHTML is in-scope. It's pre-existing and our changes only slightly increase the attack surface (format_requested was already embedded in fail_reasons by Check 1). Deferred because fixing it properly requires handling the Status row's intentional raw HTML separately.
2. **What did you consider flagging but chose not to?** Pattern 4 (`not something I typically do`) has a theoretical false-positive ("there's not something I usually do differently"). In practice, the AI draft follows a strict system prompt and won't produce this construction. Acceptable risk.
3. **What might this review have missed?** Whether the 6 soft refusal patterns are sufficient. They catch obvious hedging, but an LLM could invent new refusal language. Monitoring production drafts is the real safety net.

### Prompt for Next Session

```
Read docs/plans/2026-04-22-feat-capability-hardening-plan.md and HANDOFF.md.
Review phase complete -- 3 commits, 176 tests passing.
Next: Compound phase. Write solution doc in docs/solutions/ capturing:
(1) positive alias map pattern, (2) soft refusal detection pattern,
(3) longest-first sort lesson, (4) review finding about pre-existing XSS.
Then run /update-learnings.
```
