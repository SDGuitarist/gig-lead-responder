# HANDOFF -- Gig Lead Responder

**Date:** 2026-03-25
**Branch:** `main`
**Phase:** Plan review applied. Ready for Work.

## Current State

Spiral Voice Integration plan revised after Codex-style review. Five
contradictions resolved:

1. **Memorial-lead conflict** -- Specified exactly which rules are exempted
   (scene test, cinematic hook) and which still apply (wedge FORCING RULE,
   word counts). Added rule-by-rule override table and implementation block.
2. **Token-budget contradiction** -- Removed "matched per lead type" fallback.
   Fallback is now static: reduce `active` flag count, no dynamic selection.
   Dynamic selection stays in Deferred Items.
3. **Token-counting path** -- Named the exact method: temporary `console.log`
   of `response.usage` in `src/claude.ts`, read `usage.input_tokens` from
   `npm run demo` output. No new dependency needed.
4. **Prompt-size logging scope** -- Moved permanent logging to Deferred Items.
   Phase 0B temporary logging covers this cycle.
5. **Quality gate** -- Added risk row and acceptance criteria note: manual
   5-lead review is a stopgap, not a replacement for automated voice-regression
   detection. If results are positive, verify gate upgrades become next priority.

## Key Artifacts

| Phase | Location |
|-------|----------|
| Brainstorm | `docs/brainstorms/2026-03-25-spiral-voice-integration-brainstorm.md` |
| Plan (deepened + reviewed) | `docs/plans/2026-03-25-feat-spiral-voice-integration-plan.md` |
| Research | `docs/research/2026-03-22-spiral-methodology-report.md` |

### Previous Cycle (Prompt Injection Hardening)
| Phase | Location |
|-------|----------|
| Brainstorm | `docs/brainstorms/2026-03-15-llm-pipeline-prompt-injection-review-brainstorm.md` |
| Plan | `docs/plans/2026-03-15-fix-llm-pipeline-prompt-injection-plan.md` |
| Solution | `docs/solutions/prompt-engineering/2026-03-15-llm-pipeline-prompt-injection-hardening.md` |

## Deferred Items

- **Verify gate voice upgrades** -- YAGNI for now. When pursued, `buildVerifyPrompt` needs third parameter `voiceContext?`. Follow no-op gut check pattern in `types.ts`.
- **All-8-references mode** -- If context docs trimmed post-validation, re-evaluate all 8 under 12K.
- **Dynamic reference selection by lead type** -- Only build if a future need arises; current scope uses static `active` flags.
- **Permanent prompt size logging** -- Add to `src/pipeline/generate.ts` after this feature ships. Phase 0B temporary logging covers this cycle.
- **full_draft length cap** -- no max length on full_draft
- **Entry-point SMS length limit** -- twilio-webhook.ts has no SMS length guard
- **linked_expectations git diff enforcement** -- plan-time only
- **linked_expectations global registry** -- 15+ real pairs, per-plan only
- **Accessibility review** -- never reviewed
- **External Basic Auth POST client verification** -- rollout risk unverified
- **Helmet security headers** -- never landed (PR #3 closed stale)
- **cookie-parser middleware** -- same PR #3
- **Error sanitization in server.ts/api.ts/twilio-webhook.ts/post-pipeline.ts** -- same PR #3
- **Layer 1 venue lookup integration** -- PF-Intel endpoint deployed, gig-lead-responder side never built

## Three Questions (Plan Review Phase)

1. **Hardest decision in this session?** How much detail to specify for the
   memorial-lead override. Too little and the implementer guesses; too much
   and we're writing code in a plan doc. The rule-by-rule table with "still
   applies / exempt / rewritten" is the right granularity.

2. **What did you reject, and why?** Adding dynamic per-lead-type reference
   selection to resolve the token-budget fallback. This would have been the
   "correct" long-term solution but adds classification-aware logic to
   `buildVoiceExamplesBlock`, changing its signature and adding test surface.
   Static `active` flags are simpler and sufficient for this cycle.

3. **Least confident about going into the next phase?** Memorial-lead
   detection. The plan says "inferred from classification fields" but there
   is no explicit `is_memorial` boolean in the Classification type. The
   implementer must decide how to detect memorial context from `event_type`,
   `flagged_concerns`, and `context_modifiers`. This is the one place where
   a design decision remains in the work phase.

## Prompt for Next Session

```
Read docs/plans/2026-03-25-feat-spiral-voice-integration-plan.md.
Implement Phase 0 (prerequisites). Relevant files:
- src/data/voice-references.ts (new, pure data)
- src/utils/sanitize.ts (add wrapVoiceReference)
- src/claude.ts (temporary logging for token measurement, revert after)

Hard blocker: Alex must provide/approve the 8 reference response texts first.
If references are not yet available, skip to Phase 0B (token measurement with
placeholder text) and Phase 0C (baseline voice quality on current pipeline).

Feed-Forward risk: optimal example count (3-5 vs more) not knowable until
Phase 3 validation. Start with 3-5 active.
```
