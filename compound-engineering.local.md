# Review Context — Gig Lead Responder

## Risk Chain

**Brainstorm risk:** Skipped (security follow-up — inputs from Codex review with exact files and findings)

**Plan mitigation:** N/A (no formal plan — security fixes driven by review findings)

**Work risk (from Feed-Forward):** "Any external script or curl flow that posts with Basic Auth but without X-Requested-With: dashboard will now get a 403 and needs that header added explicitly."

**Review resolution:** 1 finding (P2 — CLI --verbose diagnostics lost). Fixed in-session by extracting `src/utils/cli-error.ts`. Rollout risk for external Basic Auth POST clients accepted as deployment verification item, not code bug. 75 tests pass.

**Compound resolution:** Solution doc written. Three patterns documented: unconditional CSRF guard, surface inventory before error hardening, generic-by-default + verbose-on-request CLI output.

## Files to Scrutinize

| File | What changed | Risk area |
|------|-------------|-----------|
| `src/auth.ts` | Removed Basic Auth CSRF bypass | Any new auth method could re-introduce a bypass |
| `src/app.ts` | Legacy route redirects before express.static | Redirect must stay before static middleware |
| `src/claude.ts` | Generic parse error (no raw content) | Future debugging may need more detail |
| `src/api.ts` | Generic error logs (`void err`) | Production incident diagnosis may lack detail |
| `src/index.ts` | CLI errors use `logCliPipelineError` | `--verbose` flag must be threaded correctly |
| `src/utils/cli-error.ts` | New — CLI error utility | Single place for CLI error formatting |

## Remaining Gaps (carried forward)

- `linked_expectations` field reserved but not enforced — needs own brainstorm+plan
- LLM pipeline behavior never reviewed (prompt injection resilience)
- Accessibility never reviewed
- `npm audit` never run
- Side-effect-free router constraint has no lint enforcement
- External Basic Auth POST clients unverified — deployment verification needed
- Production log detail sufficiency unverified after genericization

## Plan Reference

N/A (security follow-up driven by review findings, not a formal plan)
