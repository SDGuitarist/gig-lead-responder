# Review Context — Gig Lead Responder

## Risk Chain

**Brainstorm risk:** "Least confident about mobile UX design for the dashboard — needs wireframes or component breakdown in the plan phase."

**Plan mitigation:** Defined component layouts per breakpoint, tap target sizes (44px min), scrollable tab nav for 5-tab overflow. Simplified to cards-only layout.

**Work risk (from Feed-Forward):** Whether `sanitizeClassification` covers all free-text fields that could be attacker-influenced. Enum-constrained fields accepted as low risk.

**Review resolution (Cycle 11 → 12):** 17 unique findings (3 P1, 9 P2, 5 P3) from 9 agents. Cycle 11 fixed 3 P1s + 9 P2s. Cycle 12 fixed 2 P1s + 5 P2s introduced by Cycle 11 fixes. 4/8 Cycle 12 fixes corrected Cycle 11 code — validates review-after-every-fix-batch.

**Compound resolution (Cycle 12):** Solution doc written. Security-sentinel reviewed — no misrepresentations. Escalated: email-parser.ts never reviewed (pre-auth surface), index.html/mockup-hybrid.html CSP gap, stmt() stale connection risk.

## Files to Scrutinize

| File | What changed | Risk area |
|------|-------------|-----------|
| `src/server.ts` | CSP nonce regex broadened, /logout changed to POST | Regex lookahead doesn't match `<script\n`; verify all HTML files get nonce injection |
| `src/auth.ts` | Logout returns JSON, csrfGuard + sessionAuth added | Basic Auth bypass path in csrfGuard undocumented |
| `src/webhook.ts` | Replay protection one-sided timestamp check | 60s future tolerance — verify Mailgun clock skew is within bounds |
| `src/pipeline/classify.ts` | typeof object guard added to validator | Verify guard catches all non-object JSON shapes |
| `src/pipeline/generate.ts` | typeof object guard added to validator | Same pattern as classify.ts |
| `src/pipeline/verify.ts` | typeof object guard added to validator | Same pattern as classify.ts |
| `src/leads.ts` | listLeadsFiltered uses initDb().prepare() instead of stmt() | stmt() cache still used in 20+ static-SQL call sites — stale connection risk after redeploy |
| `src/claude.ts` | JsonValidator<T> inlined | No risk — pure type cleanup |
| `src/types.ts` | Dead FollowUpAction* types deleted | No risk — dead code removal |
| `src/api.ts` | Dead shapeLead re-export removed | No risk — dead code removal |

## Remaining Security Gaps

- `email-parser.ts` never security-reviewed (pre-auth surface if DISABLE_MAILGUN_VALIDATION=true)
- `index.html` and `mockup-hybrid.html` not covered by CSP nonce injection
- `verify.ts` flagged_concerns injected outside XML delimiters
- `follow-up.ts` classification fields skip `sanitizeClassification()`
- `compressed_draft` has no independent length limit
- `csrfGuard` Basic Auth bypass path undocumented
- `callClaude` has no sanitization contract — direct callers bypass XML wrapping
- `stmt()` cache stale connection risk after Railway redeploy (20+ call sites)

## Plan Reference

`docs/plans/2026-03-01-feat-follow-up-pipeline-v2-dashboard-plan.md`
