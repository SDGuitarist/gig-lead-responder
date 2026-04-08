# Review Context — Gig Lead Responder

## Risk Chain

**Audit trigger:** 21 reviewed fixes stranded on unmerged branches + Gmail persistence crash investigation

**Audit methodology:** 9 agents across 3 batches. Cross-agent consensus (3+ agents) = always real.

**Work risk (from Feed-Forward):** "GmailPlatform vs Platform split could drift if new platforms added"

**Review resolution:** 32 findings (6 P1, 17 P2, 9 P3). 29 resolved. 3 deferred P2s need brainstorm (dual parsers, data lifecycle, portal boilerplate).

## Files to Scrutinize

| File | What changed | Risk area |
|------|-------------|-----------|
| `src/types.ts` | Added shared `Platform` union type | Type drift if `GmailPlatform` not updated when new platform added |
| `src/sms.ts` | Added `sendSmsSafe()` for automation | Two interfaces in one module — callers must pick correct one |
| `src/db/migrate.ts` | Orphan table recovery at startup | Runs before rebuild check — ordering matters |
| `src/db/leads.ts` | `claimLeadForSending` narrowed to `= 'received'` | Any caller expecting claim from 'sent' would silently fail |
| `src/follow-up-scheduler.ts` | Draft generation moved before claim | Race: user could skip lead during LLM call |
| `src/server.ts` | Min secret length enforcement | Only in production — dev can still use short secrets |

## Plan Reference

No plan doc — executed directly from `docs/reviews/main-full-audit/REVIEW-SUMMARY.md`
