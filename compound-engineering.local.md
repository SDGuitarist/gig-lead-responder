# Review Context -- Gig Lead Responder

## Risk Chain

**Brainstorm risk:** "The capabilities unification (P3-4). It's structurally correct but high-touch — if the derived alias map or family guesser diverges from current behavior by even one keyword, it could silently change routing or gating decisions."

**Plan mitigation:** Regression test matrix asserting byte-for-byte equivalence for every existing keyword before and after unification. FAMILY_ONLY_ALIASES introduced to preserve pair/two routing behavior without adding them as capabilities.

**Work risk (from Feed-Forward):** "The SPF/DKIM mandatory-reject tradeoff. If Gmail ever omits the Authentication-Results header for a legitimate inbox message, the lead is silently lost."

**Review resolution:** 4 findings (P0: 0, P1: 2, P2: 1, P3: 1). P1s were missing orchestrator review-only path tests and rejection counter integration test. Fixed by extracting handleAutoSendDecision() with injectable deps. 293 tests passing.

## Files to Scrutinize

| File | What changed | Risk area |
|------|-------------|-----------|
| `src/capabilities.ts` | Unified CAPABILITIES registry, FAMILY_ONLY_ALIASES, builders, singletons | Keyword drift if CAPABILITIES or FAMILY_ONLY_ALIASES modified without updating tests |
| `src/automation/orchestrator.ts` | Review-only path, handleAutoSendDecision extraction | Side-effect correctness (updateLead, sendSms, markProcessed ordering) |
| `src/automation/source-validator.ts` | SPF/DKIM mandatory, rejection counter | Silent lead loss if Gmail omits Authentication-Results |
| `src/pipeline/hard-gate.ts` | ALIAS_MATCHER import, normalize before all checks, drum regex | Regex false positives/negatives, normalization ordering |
| `src/run-pipeline.ts` | sanitizeClassification before hard gate | All downstream consumers see truncated fields |
| `public/index.html` | esc() helper, kvHTML escaping | XSS if new dynamic values bypass esc() |

## Plan Reference

`docs/plans/2026-05-22-feat-p3-batch-gmail-intake-plan.md`
