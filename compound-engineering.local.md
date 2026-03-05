# Review Context — Gig Lead Responder

## Risk Chain

**Brainstorm risk:** "Least confident about mobile UX design for the dashboard — needs wireframes or component breakdown in the plan phase."

**Plan mitigation:** Defined component layouts per breakpoint, tap target sizes (44px min), scrollable tab nav for 5-tab overflow. Simplified to cards-only layout.

**Work risk (from Feed-Forward):** Whether `sanitizeClassification` covers all free-text fields that could be attacker-influenced. Enum-constrained fields (`cultural_tradition`, `event_energy`) not truncated — accepted as low risk.

**Review resolution (Cycle 11):** 17 unique findings (3 P1, 9 P2, 5 P3) from 9 agents (including 2 NEW: LLM Pipeline Security, Dashboard XSS). All 3 P1s fixed. Two new agents found all P1s — validating the "add agents for blind spots" lesson from Cycle 10.

**Fix resolution:** 3 P1 fixed (XSS default-escape, input size guard, prompt injection XML delimiters). 9 P2 + 5 P3 deferred. Security-sentinel reviewed solution doc — noted 3 low-severity inconsistencies (verify.ts flagged_concerns outside XML, follow-up.ts skipping sanitizeClassification, compressed_draft lacking truncation).

## Files to Scrutinize

| File | What changed | Risk area |
|------|-------------|-----------|
| `public/dashboard.html` | `analyzeKvHTML` default-escape refactor | Verify no double-escaping on `p[2]=true` raw HTML paths |
| `src/run-pipeline.ts` | 50K char truncation guard at pipeline entry | Truncation at char boundary could split multi-byte UTF-8 |
| `src/utils/sanitize.ts` | NEW — `sanitizeClassification()` + `wrapUntrustedData()` | Coverage gap: only 4 classification fields sanitized |
| `src/prompts/generate.ts` | XML-wrapped classification data | Verify XML tags don't conflict with other prompt structure |
| `src/prompts/verify.ts` | XML-wrapped classification + standalone flagged_concerns line | Inconsistency: flagged_concerns injected inline without XML wrapper |
| `src/prompts/follow-up.ts` | XML-wrapped lead_context + original_response | Classification fields extracted without `sanitizeClassification()` |

## Remaining Security Gaps (from Security Sentinel Review)

- `verify.ts` flagged_concerns injected outside XML delimiters (truncated but unwrapped)
- `follow-up.ts` classification fields rely on XML wrapping alone, no `sanitizeClassification()`
- `compressed_draft` passed to follow-up prompt without independent length limit
- `callClaude` has no sanitization contract — direct callers bypass XML wrapping

## Plan Reference

`docs/plans/2026-03-01-feat-follow-up-pipeline-v2-dashboard-plan.md`
