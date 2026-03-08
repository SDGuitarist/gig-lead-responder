# Review Context — Gig Lead Responder

## Risk Chain

**Brainstorm risk:** "The email-parser regex fix. If the real Bash HTML structure differs from the fixture, the regex fix could be correct but the fixture wrong — and we'd be 'fixing' a test to match a wrong fixture."

**Plan mitigation:** Added ReDoS regression test to lock the security property regardless of fixture accuracy. Fixture tagged with dated comment noting it's unverified.

**Work risk (from Feed-Forward):** "Email-parser fixture accuracy (no live Bash HTML sample). ReDoS regression test protects the security property, but if a real Bash HTML sample shows a different cell structure, the regex and fixture both need updating."

**Review resolution:** Codex review of commits a0a947e and 23ee092 found no code fixes needed. No real Bash HTML sample exists in the project.

**Compound resolution:** Solution doc written. Two prevention patterns documented (tag dependent expectations, regex hardening needs boundary tests). Risk accepted — fixture is assumption-based but ReDoS regression test guards the security property.

## Files to Scrutinize

| File | What changed | Risk area |
|------|-------------|-----------|
| `src/email-parser.ts` | EVENT DATE regex changed to cross `</td><td>` boundary | Fixture accuracy unverified against live email |
| `src/email-parser.test.ts` | ReDoS regression test added (10K `<td` repetitions) | Test locks security property only, not correctness |
| `src/budget-gap.test.ts` | 8 failing tests fixed, 1 boundary test refreshed, 6 comment fixes | Expectations coupled to live `rates.ts` values |

## Remaining Gaps (carried forward)

- Analytics transaction error handling (8 queries, what if one throws?)
- LLM pipeline behavior never reviewed (prompt injection resilience)
- Accessibility never reviewed
- `npm audit` never run
- Pre-existing P1s: XSS unescaped LLM values (023), no input size guard (024), prompt injection chain (025)
- P3 bundle deferred from Cycle 15 (061)
- leads.ts structural split (brainstorm+plan exist)

## Cross-Tool Review Protocol

Codex is an independent second-opinion agent in this workflow. For reviews:
1. Run Codex `review-branch-risks` first (independent findings)
2. Then run Claude Code `/workflows:review` (compound review with learnings researcher)
3. Merge both finding sets, deduplicate, and apply fix ordering per CLAUDE.md rules

## Plan Reference

`docs/plans/2026-03-07-test-failure-fixes.md`
