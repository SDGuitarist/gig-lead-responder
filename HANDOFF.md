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
