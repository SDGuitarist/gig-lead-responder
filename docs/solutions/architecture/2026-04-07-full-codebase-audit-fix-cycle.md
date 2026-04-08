# Full Codebase Audit — 9-Agent Review + 5-Session Fix Cycle

**Date:** 2026-04-07
**Trigger:** Production had been running without 21 previously-reviewed fixes (stranded on unmerged branches). A full codebase audit revealed 32 findings across 6 P1, 17 P2, and 9 P3 issues.

## What Happened

After deploying Gmail lead persistence, a crash investigation revealed the body-parser limit was too low and the Gmail poller wasn't stopping on auth failure. While fixing those, we discovered that two branches (`fix/review-cycle-12-fixes` and `fix/batch-d-quick-wins`) with 21 reviewed fixes had never been merged to main. This triggered a full 9-agent codebase audit.

## Methodology: 9-Agent Batched Review

Ran 9 specialized agents across 3 batches of 3 (to stay within context limits):

| Batch | Agents | Focus |
|-------|--------|-------|
| 1 | kieran-typescript, pattern-recognition, code-simplicity | Code quality, type safety, duplication |
| 2 | architecture-strategist, security-sentinel, performance-oracle | Design, security, performance |
| 3 | data-integrity-guardian, git-history-analyzer, deployment-verification | Data safety, history, deploy readiness |

**Cross-agent consensus** was the strongest signal: findings flagged by 3+ agents independently were always real issues (e.g., `listLeadsFiltered` no LIMIT flagged by 4 agents, triplicated stmt cache by 4 agents).

**Attrition rate:** 32 unique findings after dedup from ~130 raw findings (~75% attrition). Most duplicates were the same issue described differently by different agents.

## New Patterns (not documented elsewhere)

### 1. Orphan Table Recovery for SQLite Rebuilds

SQLite table rebuilds (CREATE new → INSERT → DROP old → RENAME new) are wrapped in transactions, but WAL corruption or filesystem issues could leave `leads_new` orphaned. Added startup detection:

```typescript
// If leads_new exists: either leads was dropped (rename it) or both exist (drop orphan)
const orphan = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='leads_new'").get();
if (orphan) {
  const leadsExists = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='leads'").get();
  if (leadsExists) db.exec("DROP TABLE leads_new");  // incomplete rebuild
  else db.exec("ALTER TABLE leads_new RENAME TO leads");  // crash after DROP
}
```

**When to use:** Any SQLite table rebuild migration. Run before the rebuild check, not inside it.

### 2. Platform Type Unification Across Subsystems

Three separate platform type definitions had drifted: `Classification.platform` (3 values), automation `Platform` (3 values), DB `source_platform` (no constraint). Gmail-polled GigSalad leads didn't get `platform` set, bypassing contact suppression policies.

**Fix:** Single `Platform` union in `src/types.ts` covering all sources. Subsystems that need a narrower type (e.g., `GmailPlatform` for email validation) export their own subset.

**Pattern:** Define the broad union at the shared types layer. Subsystems import and narrow, never define their own broad type. This prevents drift because adding a new platform to the shared type triggers compile errors in subsystems that need updating.

**Tradeoff:** `GmailPlatform` is a separate literal union, not `Extract<Platform, ...>`. This means adding a new platform to `Platform` won't automatically update `GmailPlatform`. Accepted because both types are small and explicit, and email platform validation requires conscious opt-in (adding sender regex patterns).

### 3. Draft-Before-Claim for Async Pipelines

Follow-up scheduler claimed status (`pending` → `sent`) before generating the draft. During the LLM call, the dashboard showed "sent" with no draft — confusing for the user.

**Fix:** Generate draft first (async), then claim (sync). If generation fails, lead stays `pending` for retry. The claim's WHERE guard handles races (user skips during generation).

**Pattern:** In async-then-sync pipelines, do the expensive async work before the state transition. The state transition should only happen after you have everything needed to fulfill the new state's contract.

**See also:** `docs/solutions/database-issues/async-sqlite-transaction-boundary.md` for the underlying constraint.

### 4. SMS Module Consolidation

Two Twilio implementations existed: `src/sms.ts` (server, throws on failure) and `automation/senders/twilio-sms.ts` (automation, config-based, returns `{success, error}`). Different interfaces for the same operation.

**Fix:** Added `sendSmsSafe()` to `src/sms.ts` — config-based, dry-run aware, never throws. Automation imports the safe variant; server callers keep using the throwing `sendSms()`.

**Pattern:** When consolidating modules with different error-handling contracts, don't force one interface. Export both variants from a single module — the throwing version for callers that want exceptions, the safe version for callers that handle errors locally.

## Patterns Already Documented (referenced, not repeated)

- **Atomic claims:** `atomic-claim-for-concurrent-state-transitions.md` — used for `claimLeadForSending` double-claim fix (narrowed WHERE from `IN ('received', 'sent')` to `= 'received'`)
- **Environment-aware guards:** `environment-aware-fatal-guards.md` — used for min secret length enforcement (COOKIE_SECRET >= 16, DASHBOARD_PASS >= 8)
- **Startup recovery:** `review-fix-cycle-12-full-codebase-hardening.md` — `recoverStuckLeads()` confirmed to already handle `postPipeline` non-atomic write
- **Runtime validation:** `2026-03-05-dashboard-runtime-validation-and-atomic-ops.md` — used for JSON.parse shape validation in twilio-webhook

## Risk Resolution

| Risk flagged | Phase | Resolution |
|---|---|---|
| "GmailPlatform vs Platform split could drift" | Session 2 | Accepted — both types are small, email platforms need conscious opt-in |
| "postPipeline non-atomic write needs startup recovery" | Session 3 | Already handled by `recoverStuckLeads()` — no new code needed |
| "Table rebuild crash-safety" | Session 4 | Defense-in-depth orphan recovery added, though SQLite WAL transactions are already atomic |
| "3 remaining P2s need brainstorm" | Session 5 | Accepted as deferred — dual parsers, data lifecycle, portal boilerplate |

## Fix Summary (29/32 resolved)

| Session | Commits | Key fixes |
|---------|---------|-----------|
| 1 | 4 | 16 unmerged fixes applied, Gmail persistence, dedup → SQLite, dead code deleted |
| 2 | 5 | Platform unification, main.ts deleted, SMS consolidated, double-claim, P3 batch |
| 3 | 2 | JSON.parse validation, scheduler draft-before-claim |
| 4 | 1 | Orphan table recovery for migration crash-safety |
| 5 | 1 | shapeLead type, followup delay bounds, min secret length, default branch → main |

## Three Questions

1. **Hardest pattern to extract from the fixes?** The draft-before-claim pattern. It seems obvious in hindsight, but the original ordering (claim first, then generate) was defensible — it prevented two schedulers from generating drafts for the same lead. The fix works because the claim's WHERE guard handles the race: if another process claims between our generate and claim, our claim fails gracefully.

2. **What did you consider documenting but left out, and why?** The 9-agent batching methodology (which agents in which batch, optimal batch size). Left it out because the specific agent mix depends on the codebase and what you're looking for — there's no universal recipe. The useful insight (cross-agent consensus as signal) is documented.

3. **What might future sessions miss that this solution doesn't cover?** The interaction between `GmailPlatform` and `Platform` types. If someone adds a new platform to `Platform` in types.ts, nothing will remind them to also update `GmailPlatform` in source-validator.ts and add the sender regex. A compile-time link (like `Extract<Platform, ...>`) would catch drift but would also auto-include platforms that shouldn't be in the email validator. This is a conscious tradeoff documented here but easy to forget.
