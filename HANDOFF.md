# HANDOFF — Gig Lead Responder

**Date:** 2026-03-15
**Branch:** `main`
**Phase:** Compound complete. Cycle done.

## Current State

LLM pipeline prompt injection hardening cycle complete (brainstorm → plan →
plan review → work → review → compound). PR #17 merged. 84 tests pass.
Solution doc #39 written. All learning surfaces updated.

## Key Artifacts

| Phase | Location |
|-------|----------|
| Brainstorm | `docs/brainstorms/2026-03-15-llm-pipeline-prompt-injection-review-brainstorm.md` |
| Plan | `docs/plans/2026-03-15-fix-llm-pipeline-prompt-injection-plan.md` |
| Solution | `docs/solutions/prompt-engineering/2026-03-15-llm-pipeline-prompt-injection-hardening.md` |

## Next Major Initiative: Spiral Voice Integration

The Spiral Gig Responder system is the most advanced lead response system built to date. 22 knowledge docs, 8 reference responses, 17 tests, 18/18 capabilities at 90%+. It produces higher-quality, more consistent responses than the pipeline's current generate stage. The goal is to integrate Spiral's response quality into this pipeline's automation.

**What Spiral has that the pipeline doesn't:**
- 8 real/verified reference responses that trained voice (pipeline loads RESPONSE_CRAFT.md as context, not trained on actual converted responses)
- Three-layer reinforcement hierarchy: references (voice ceiling), style guide (format + prohibitions), knowledge docs (domain judgment)
- 7 proven patterns for how rules must be structured to fire consistently (mandatory language, control tests, negative examples)
- Differentiation capability pushed to 95% through reference demonstration, not instruction

**Key integration questions (brainstorm these first):**
- How does Spiral's three-layer reinforcement hierarchy map onto the pipeline's prompt architecture (classify/context/generate/verify)?
- Where do the two systems' rules conflict or overlap? (e.g., pricing logic is deterministic code in the pipeline but LLM-interpreted in Spiral)
- Should the 8 reference responses become few-shot examples in the generate prompt, or a separate context document?
- Pattern 4 (style guide controls format, knowledge base controls content) has implications for how generate.ts structures its prompt
- Pattern 2 (mandatory language) means the pipeline's prompt wording for genre correction and stealth premium must match Spiral's proven phrasing

**Reference:** `docs/research/2026-03-22-spiral-methodology-report.md` (full methodology, all 17 tests, 7 patterns)

## Deferred Items

- **full_draft length cap** — no max length on full_draft (deferred from review, add MAX_FULL_DRAFT_LENGTH)
- **Entry-point SMS length limit** — twilio-webhook.ts has no SMS length guard (200-char truncation in generate.ts sufficient)
- **linked_expectations git diff enforcement** — plan-time only, no post-work verification
- **linked_expectations global registry** — 15+ real pairs, per-plan only
- **Accessibility review** — never reviewed
- **External Basic Auth POST client verification** — rollout risk unverified
- **Helmet security headers** — never landed on main (was in PR #3, closed as stale Mar 17)
- **cookie-parser middleware** — same PR #3, never merged
- **Error sanitization in server.ts/api.ts/twilio-webhook.ts/post-pipeline.ts** — same PR #3
- **Layer 1 venue lookup integration** — PF-Intel endpoint deployed, gig-lead-responder side never built. Needs fresh brainstorm.

## Three Questions

1. **Hardest pattern to extract?** The distinction between `wrapUntrustedData`
   (for data) and `wrapEditInstructions` (for actionable input). Both use XML
   delimiters, but the IMPORTANT suffix has different semantics.

2. **What was left out?** A full taxonomy of prompt injection attack types.
   Left out because it would be stale within months. The prevention checklist
   is more durable.

3. **What might future sessions miss?** New pipeline entry points that bypass
   sanitize.ts utilities entirely. A lint rule checking that all `callClaude`
   callers use a wrapper would be stronger than a checklist.

## Prompt for Next Session

```
Read HANDOFF.md for context. This is Gig Lead Responder, an LLM-powered lead
response pipeline for a live music booking business. LLM pipeline injection
hardening cycle just completed (PR #17). 84 tests pass, 39 solution docs.
Pick from deferred items: full_draft length cap, accessibility review,
linked_expectations git diff enforcement, or start a new feature.
```
