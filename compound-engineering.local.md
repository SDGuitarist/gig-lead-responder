# Review Context — Gig Lead Responder

## Risk Chain

**Brainstorm risk:** "Whether the `wrapUntrustedData()` XML delimiter defense is sufficient against sophisticated prompt injection."

**Plan mitigation:** Analyzed each injection vector individually. Plan review caught that `wrapUntrustedData` was semantically wrong for edit instructions — created `wrapEditInstructions()` with edit-appropriate semantics. Also caught truncation ordering issue (before vs after contact block).

**Work risk (from Feed-Forward):** "Whether `wrapEditInstructions` wording will behave correctly with Claude in production. The XML delimiter defense is best-effort — no guarantee Claude won't follow injected instructions."

**Review resolution:** 0 P1, 2 P2 (both documentation/deferred), 3 P3 (all accepted) from 3 agents. No code changes required. `wrapEditInstructions` semantic weakness documented as inherent LLM limitation. `full_draft` length cap deferred to follow-up.

**Compound resolution:** Solution doc written. Key lesson: wrapper function semantics must match content type (data vs actionable input). Prevention checklist added for future LLM entry points.

## Files to Scrutinize

| File | What changed | Risk area |
|------|-------------|-----------|
| `src/utils/sanitize.ts` | Added `wrapEditInstructions()` | Semantic correctness — must say "apply edits" not "ignore instructions" |
| `src/pipeline/generate.ts` | 200-char truncation + wrapping + 2000-char compressed_draft cap | Truncation ordering — must be before `ensureContactBlock()` |
| `src/email-parser.test.ts` | 5 ReDoS regression tests | Tests pass trivially (patterns safe by construction) — value is as regression guards |

## Remaining Gaps (carried forward)

- `full_draft` has no length cap (deferred — add MAX_FULL_DRAFT_LENGTH in follow-up)
- Entry-point SMS length limit in `twilio-webhook.ts` (deferred — 200-char truncation sufficient)
- `linked_expectations` git diff enforcement — plan-time only
- `linked_expectations` global registry — 15+ real pairs, per-plan only
- Accessibility never reviewed
- External Basic Auth POST clients unverified

## Plan Reference

`docs/plans/2026-03-15-fix-llm-pipeline-prompt-injection-plan.md`
