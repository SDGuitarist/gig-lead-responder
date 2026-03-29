# HANDOFF -- Gig Lead Responder

**Date:** 2026-03-29
**Branch:** `main`
**Phase:** Work in progress. Phase 3 validation outputs collected, awaiting Alex's voice quality ratings.

## Current State

Spiral Voice Integration work phase nearly complete. Phases 0-2 done, Phase 3
validation outputs generated. All 5 test leads pass gates, prices match exactly,
no regressions. Waiting on Alex to rate before/after drafts 1-5 on voice quality.

generate.ts has been modified since last session (evaluator checklist section
added, GUT_CHECK imports from types.ts). This change is committed.

### What's Done
- Phase 0A: 8 voice references curated in `src/data/voice-references.ts` (5 active)
- Phase 0B: Token measurement (14,967 baseline, 12K threshold moot)
- Phase 0C: 5 baseline leads in `tests/voice-baseline/`
- Phase 1: `wrapVoiceReference()` in `src/utils/sanitize.ts`
- Phase 2: Prompt restructured (VOICE RULES / VOICE EXAMPLES / STYLE RULES)
- Phase 3 outputs: 5 "after" leads in `tests/voice-after/`
- Readable comparison: `tests/voice-comparison.txt`

### What Remains
1. Alex rates before/after drafts 1-5 (voice quality 1-5 scale)
2. If no regressions: commit comparison file, update plan as complete
3. Close work phase: update HANDOFF, generate Codex review handoff
4. Next phase: Review (Codex first, then Claude Code)

## Key Artifacts

| Phase | Location |
|-------|----------|
| Brainstorm | `docs/brainstorms/2026-03-25-spiral-voice-integration-brainstorm.md` |
| Plan (deepened + reviewed) | `docs/plans/2026-03-25-feat-spiral-voice-integration-plan.md` |
| Research | `docs/research/2026-03-22-spiral-methodology-report.md` |
| Voice references | `src/data/voice-references.ts` |
| Baseline outputs | `tests/voice-baseline/` |
| After outputs | `tests/voice-after/` |
| Comparison (readable) | `tests/voice-comparison.txt` |

## Deferred Items

- **Verify gate voice upgrades** -- YAGNI for now. When pursued, `buildVerifyPrompt` needs third parameter `voiceContext?`. Follow no-op gut check pattern in `types.ts`.
- **All-8-references mode** -- If context docs trimmed post-validation, re-evaluate all 8 under 12K.
- **Dynamic reference selection by lead type** -- Only build if a future need arises; current scope uses static `active` flags.
- **Permanent prompt size logging** -- Add to `src/pipeline/generate.ts` after this feature ships.
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

## Three Questions (Work Phase)

1. **Hardest implementation decision in this session?** How to handle the
   evaluator checklist addition to generate.ts that appeared between sessions.
   It adds GUT_CHECK imports and a new section. Kept it as-is since it was
   intentional and committed.

2. **What did you consider changing but left alone, and why?** The Dang
   reference (corporate, vendor-speak voice). Considered rewriting it in
   Alex's voice but decided inactive status is sufficient. If corporate
   coverage is needed later, generate a new reference.

3. **Least confident about going into review?** Whether the memorial lead
   calibration override is robust enough. It fires correctly on the test
   lead, but detection relies on keywords in classification fields rather
   than an explicit `is_memorial` boolean. Edge cases (tributes that don't
   use the word "memorial") could slip through.

## Active Leads

### Heather Thomas — Birthday Party (GigSalad, received Mar 20)
- **Event:** Birthday Party, April 25, 2026, 1-5 PM, Temecula, CA
- **Status:** Response drafted (Mar 29), ready to send via GigSalad
- **Key detail:** She asked "Can you extend videos of the duo?" — buying signal, wants more footage
- **Conflict:** April 25 = Amplify workshop. Alex contracting via PFE, not performing himself.
- **Response:** Copy-paste ready (in Alex's clipboard). Acknowledges delay, offers duo videos, asks 4 follow-up questions, no pricing yet.
- **Pricing (internal):** $1,100-$1,400 range. Duo base $800-1,200 + travel $100-150 + PFE 15% commission.
- **Next:** Send response ASAP. Identify duo + get their videos ready before Heather replies.
- **Venue intel:** Wilson Creek Winery and Danza del Sol Winery found in PF-Intel for Temecula area.

### Cyrus — Wedding Cocktail Hour (GigSalad, received Mar 26)
- **Event:** Wedding Cocktail Hour, July 25, 2026, 6-7:30 PM, San Diego, CA
- **Status:** Alex already replied

## Railway Production Issue (Mar 29)

Two "Deploy Crashed" emails from Railway for gig-lead-responder (1:32 AM and 6:03 AM on Mar 29). App is crashing in the `industrious-elegance` environment. **Not yet investigated.** Priority: check Railway deploy logs and restart.

## Prompt for Next Session

```
Read docs/plans/2026-03-25-feat-spiral-voice-integration-plan.md.
Review the voice quality comparison at tests/voice-comparison.txt.
Rate each of the 5 lead pairs (before/after) 1-5 on voice quality.
If no regressions, close the work phase and generate the Codex review
handoff prompt. If regressions found, identify which leads and what
specifically degraded.

Key files changed: src/prompts/generate.ts, src/data/voice-references.ts,
src/utils/sanitize.ts
Plan doc: docs/plans/2026-03-25-feat-spiral-voice-integration-plan.md
```
