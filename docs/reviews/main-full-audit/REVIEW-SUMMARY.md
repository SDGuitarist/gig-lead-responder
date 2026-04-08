# Review Summary — main (Full Codebase Audit)

**Date:** 2026-04-07
**Agents run:** 9 (3 batches of 3)
**Total unique findings:** 32

**Severity snapshot:** 6 P1 | 17 P2 | 9 P3

---

## Recommended Fix Order

| # | Issue | Priority | Why this order | Unblocks |
|---|-------|----------|---------------|----------|
| 1 | 21 unmerged fixes on 2 branches (`fix/review-cycle-12-fixes` + `fix/batch-d-quick-wins`) | P1 | Production missing rate limiting, pagination, auth coverage, Helmet, error sanitization. Fixes already written and reviewed. Merge resolves findings 2-8 automatically. | 2, 3, 4, 5, 6, 7, 8 |
| 2 | `listLeadsFiltered` unbounded query (no LIMIT) | P1 | DoS risk — single request exhausts memory. **Resolved by merging #1** (commit `dd1fa7b`). | — |
| 3 | Dashboard HTML served without sessionAuth | P2 | UI structure publicly accessible. **Resolved by merging #1** (commit `7c4a958`). | — |
| 4 | Webhook rate limiters not mounted | P2 | Pipeline flooding risk. **Resolved by merging #1** (commit `b6489e6`). | — |
| 5 | SSE heartbeat missing on /api/analyze | P2 | Proxy drops long connections. **Resolved by merging #1** (commit `94d9198`). | — |
| 6 | Bare JSON.parse in twilio-webhook | P2 | Unhandled crash on corrupt data. **Resolved by merging #1** (commit `f4615af`). | — |
| 7 | Shared stmt-cache.ts (triplicated cache) | P2 | 3-file maintenance burden. **Resolved by merging #1** (commit `e542826`). | — |
| 8 | COOKIE_SECRET process.exit → throw | P1 | Kills process from middleware. **Resolved by merging #1** (commit `87bc69d`). | — |
| 9 | Gmail-polled leads NOT persisted to SQLite | P1 | ~1/3 of leads invisible to dashboard, analytics, follow-ups. Data loss on crash. Root cause of dedup split. | 10, 11 |
| 10 | File-based dedup race condition + unbounded growth | P1 | Read-write race, no pruning, separate from SQLite dedup. Depends on #9. | — |
| 11 | Platform type unification across systems | P2 | Root cause of contact policy bypass for Gmail-polled GigSalad leads. Needed before #9. | 9 |
| 12 | Credential file written without 0o600 permissions | P1 | One-line fix. OAuth client secret world-readable. | — |
| 13 | Sourced format T1 tier gap — pipeline crash risk | P2 | Latest commit created a code path that throws if LLM assigns T1 to sourced formats. No runtime fallback. | — |
| 14 | `callClaude` validate parameter is optional | P1 | Future caller can skip validation on LLM output. Make required. | — |
| 15 | Unsafe `as` casts on JSON.parse in twilio-webhook | P2 | `JSON.parse(lead.classification_json)` cast to `Classification` with no runtime validation. | — |
| 16 | `void err` swallows error context in api.ts | P2 | Actual error discarded, generic message logged. Lost diagnostics. | — |
| 17 | `any` usage in error handler | P2 | `(err as any).status` — no type guard. | — |
| 18 | Dual parser systems (webhook vs automation) | P2 | `ParsedLead` name collision, different regex for same email format. | — |
| 19 | Dual SMS sender modules | P2 | Two Twilio implementations with different interfaces. | — |
| 20 | Duplicate poll loop (main.ts vs poller.ts) | P2 | ~100 lines duplicated. `main.ts` lacks Railway credential bootstrapping. | — |
| 21 | Portal client boilerplate (~80 lines shared) | P2 | Duplicated constructor, login flow, context management. | — |
| 22 | Table rebuild migration not crash-safe | P2 | Crash between DROP and RENAME loses data. No startup recovery. | — |
| 23 | Follow-up scheduler claim-then-generate gap | P2 | Dashboard shows "sent" with no draft during LLM call. | — |
| 24 | `postPipeline` non-atomic two-step write | P2 | Crash between saving results and marking sent — lead stuck. | — |
| 25 | No data lifecycle management | P2 | Tables, dedup file, JSONL log grow forever. No archival. | — |
| 26 | `stale feat/gig-lead-pipeline` as GitHub default branch | P2 | 370 commits behind main. Confuses new clones. | — |
| 27 | Dead code `src/data/venues.ts` (83 lines) | P3 | Zero imports. Superseded by PF-Intel API. | — |
| 28 | `SCOPES` constant never used in gmail-watcher.ts | P3 | Dead code, 4 lines. | — |
| 29 | Commented-out guardrail in router.ts | P3 | Comment says safe to remove. | — |
| 30 | `baseUrl()` helper duplicated in 2 files | P3 | Trivial dedup. | — |
| 31 | FORMAT_FAMILIES missing sourced cultural formats | P3 | Leads with new formats return "unknown" from getFormatFamily. | — |
| 32 | No minimum password/secret length enforcement | P3 | `DASHBOARD_PASS=x` passes all checks. | — |

---

## P1 — Critical (6)

### 1. 21 unmerged security/reliability fixes across 2 branches
**Found by:** git-history-analyzer
**File:** `origin/fix/review-cycle-12-fixes` (16 commits), `origin/fix/batch-d-quick-wins` (5 commits)
**Issue:** Production is running without fixes that were written, reviewed, and documented as complete. Includes: webhook rate limiting, query pagination, dashboard auth, SSE heartbeat, Helmet headers, error sanitization, stmt-cache dedup, COOKIE_SECRET throw, JSON.parse try-catch, phone number redaction. MEMORY.md claims these are done — they are not.
**Suggestion:** Merge both branches to main. This single action resolves findings #2-8.

---

### 2. Gmail-polled leads NOT persisted to SQLite
**Found by:** architecture-strategist, data-integrity-guardian
**File:** `src/automation/orchestrator.ts:28-176`
**Issue:** Gmail pipeline logs results to JSONL only. Leads invisible to dashboard, analytics, follow-ups, outcome tracking. Data loss on crash. Two parallel data stores with no reconciliation.
**Suggestion:** Call `insertLead()` + `updateLead()` in `processLead()`.

---

### 3. File-based dedup race condition + unbounded growth
**Found by:** kieran-typescript-reviewer, code-simplicity-reviewer, data-integrity-guardian, performance-oracle
**File:** `src/automation/dedup.ts:1-23`
**Issue:** Full file read/write per check, race between check and mark (minutes apart), no pruning, separate from SQLite dedup. Crash after reply but before mark = duplicate send on restart.
**Suggestion:** Use existing `processed_emails` SQLite table.

---

### 4. `listLeadsFiltered` unbounded query
**Found by:** kieran-typescript-reviewer, security-sentinel, performance-oracle, data-integrity-guardian
**File:** `src/db/queries.ts:55-82`
**Issue:** No LIMIT clause. DoS risk — single request exhausts memory. 4 agents flagged this independently.
**Suggestion:** Merge `fix/review-cycle-12-fixes` (commit `dd1fa7b`) or add LIMIT 50 manually.

---

### 5. Credential file written without 0o600 permissions
**Found by:** security-sentinel, data-integrity-guardian
**File:** `src/automation/poller.ts:25`
**Issue:** OAuth `credentials.json` written world-readable. Token file correctly uses 0o600 but credentials file doesn't.
**Suggestion:** Add `{ mode: 0o600 }` to `writeFileSync` call.

---

### 6. `callClaude` validate parameter is optional
**Found by:** kieran-typescript-reviewer
**File:** `src/claude.ts:73`
**Issue:** Omitting `validate` returns `parsed as T` with zero runtime checks. Currently all callers pass validators but nothing enforces this.
**Suggestion:** Make `validate` required.

---

## P2 — Important (17)

### 7. Sourced format T1 tier gap
**Found by:** git-history-analyzer
**File:** `src/data/rates.ts`, `src/pipeline/price.ts`
**Issue:** New sourced rate tables have no T1 entry. If LLM assigns T1 to sourced format, price.ts throws. Guard is prompt-only (fragile).
**Suggestion:** Add runtime fallback or T1 entries.

---

### 8. Platform type not unified across systems
**Found by:** architecture-strategist, pattern-recognition-specialist
**File:** `src/types.ts`, `src/automation/types.ts`
**Issue:** `Classification.platform` vs automation `Platform` vs DB `source_platform`. No shared type. Gmail GigSalad leads bypass contact policies.
**Suggestion:** Unify platform types.

---

### 9. Unsafe `as` casts on JSON.parse in twilio-webhook
**Found by:** kieran-typescript-reviewer, security-sentinel
**File:** `src/twilio-webhook.ts:143-146`
**Issue:** `JSON.parse(lead.classification_json)` cast to `Classification` with no validation. Corrupt data = unhandled crash.
**Suggestion:** Add try-catch + runtime validation.

---

### 10. `void err` swallows error context
**Found by:** kieran-typescript-reviewer
**File:** `src/api.ts:85,252`
**Issue:** Error discarded with `void err`, generic message logged. Production diagnostics lost.
**Suggestion:** Log error details.

---

### 11. `any` usage in error handler
**Found by:** kieran-typescript-reviewer
**File:** `src/utils/error-handler.ts:19-28`
**Issue:** `(err as any).status` repeated 3 times. No type guard.
**Suggestion:** Define HttpError type guard.

---

### 12. Dual parser systems
**Found by:** pattern-recognition-specialist, architecture-strategist
**File:** `src/email-parser.ts` vs `src/automation/parsers/`
**Issue:** Two codepaths parse GigSalad emails. Different types, regex, `ParsedLead` collision. Fixes in one path don't reach the other.
**Suggestion:** Unify or share parsing logic.

---

### 13. Dual SMS sender modules
**Found by:** kieran-typescript-reviewer, pattern-recognition-specialist, code-simplicity-reviewer
**File:** `src/sms.ts` vs `src/automation/senders/twilio-sms.ts`
**Issue:** Two Twilio implementations, different interfaces. 3 agents flagged independently.
**Suggestion:** Consolidate.

---

### 14. Duplicate poll loop
**Found by:** pattern-recognition-specialist, code-simplicity-reviewer
**File:** `src/automation/main.ts` vs `src/automation/poller.ts`
**Issue:** ~100 lines duplicated. main.ts lacks Railway credential bootstrapping.
**Suggestion:** Delete main.ts or refactor to delegate to poller.ts.

---

### 15. Portal client boilerplate
**Found by:** pattern-recognition-specialist
**File:** `src/automation/portals/gigsalad-client.ts` vs `yelp-client.ts`
**Issue:** ~80 lines shared (constructor, login, context management).
**Suggestion:** Extract BasePortalClient class.

---

### 16. Table rebuild migration not crash-safe
**Found by:** data-integrity-guardian
**File:** `src/db/migrate.ts:98-148`
**Issue:** Crash between DROP and RENAME loses data. No startup check for orphaned `leads_new` table.
**Suggestion:** Add startup recovery for `leads_new`.

---

### 17. Follow-up scheduler claim-then-generate gap
**Found by:** data-integrity-guardian
**File:** `src/follow-up-scheduler.ts:43-62`
**Issue:** Claims follow-up (sets "sent"), then generates draft async. Dashboard shows "sent" with no draft during LLM call.
**Suggestion:** Generate draft before claiming.

---

### 18. `postPipeline` non-atomic write
**Found by:** data-integrity-guardian
**File:** `src/post-pipeline.ts:11-53`
**Issue:** Crash between saving results and marking sent = lead stuck in "received" with completed pipeline.
**Suggestion:** Add startup recovery for stuck leads.

---

### 19. No data lifecycle management
**Found by:** data-integrity-guardian, performance-oracle
**File:** `src/db/migrate.ts`
**Issue:** No cleanup for leads, processed_emails, venue_misses, dedup file, JSONL log. Unbounded growth.
**Suggestion:** Add retention policy.

---

### 20. `feat/gig-lead-pipeline` stale as GitHub default branch
**Found by:** git-history-analyzer
**File:** GitHub settings
**Issue:** 370 commits behind main. Confuses new clones.
**Suggestion:** Change default to main.

---

### 21. `claimLeadForSending` allows double-claim from 'sent'
**Found by:** data-integrity-guardian
**File:** `src/db/leads.ts:171-176`
**Issue:** WHERE clause `status IN ('received', 'sent')` allows concurrent approvals. Double SMS sends.
**Suggestion:** Split into separate claim functions.

---

### 22. `computeFollowUpDelay` called with unsafe cast
**Found by:** kieran-typescript-reviewer
**File:** `src/db/follow-ups.ts:116`
**Issue:** `newCount as 0 | 1 | 2` bypasses bounds check. Out-of-bounds index returns undefined.
**Suggestion:** Use `Math.min` for safe indexing.

---

### 23. No minimum password/secret length enforcement
**Found by:** security-sentinel
**File:** `src/auth.ts`, `src/server.ts`
**Issue:** `DASHBOARD_PASS=x` passes all checks.
**Suggestion:** Enforce minimum lengths at startup.

---

## P3 — Minor (9)

### 24. Dead code `src/data/venues.ts`
**Found by:** code-simplicity-reviewer, pattern-recognition-specialist, git-history-analyzer
**File:** `src/data/venues.ts:1-83`
**Issue:** Zero imports. Superseded by PF-Intel API. 3 agents flagged.
**Suggestion:** Delete.

---

### 25. `SCOPES` constant unused in gmail-watcher.ts
**Found by:** kieran-typescript-reviewer, code-simplicity-reviewer
**File:** `src/automation/gmail-watcher.ts:12-15`
**Issue:** Dead code.
**Suggestion:** Delete.

---

### 26. Commented-out guardrail in router.ts
**Found by:** code-simplicity-reviewer
**File:** `src/automation/router.ts:70-74`
**Issue:** Comment says "can now be removed."
**Suggestion:** Delete.

---

### 27. `baseUrl()` helper duplicated
**Found by:** kieran-typescript-reviewer, pattern-recognition-specialist, code-simplicity-reviewer
**File:** `src/twilio-webhook.ts:27`, `src/follow-up-scheduler.ts:14`
**Issue:** Same function in two files. 3 agents flagged.
**Suggestion:** Extract to shared utility.

---

### 28. FORMAT_FAMILIES missing sourced cultural formats
**Found by:** kieran-typescript-reviewer, pattern-recognition-specialist
**File:** `src/automation/router.ts:8-13`
**Issue:** New formats return "unknown" from getFormatFamily.
**Suggestion:** Add missing formats.

---

### 29. `plan-gate.ts` is devtool in src/
**Found by:** code-simplicity-reviewer, pattern-recognition-specialist
**File:** `src/plan-gate.ts`
**Issue:** Not part of application runtime. Lives alongside production code.
**Suggestion:** Move to scripts/.

---

### 30. Error message extraction pattern repeated 8+ times
**Found by:** pattern-recognition-specialist
**File:** Throughout codebase
**Issue:** `err instanceof Error ? err.message : String(err)` repeated everywhere.
**Suggestion:** Extract `getErrorMessage()` utility.

---

### 31. "No venue intelligence" placeholder wastes LLM tokens
**Found by:** code-simplicity-reviewer
**File:** `src/pipeline/context.ts:67-69`
**Issue:** Tells LLM about absence of data. Unnecessary tokens.
**Suggestion:** Remove placeholder.

---

### 32. `shapeLead` accepts undefined but callers never pass it
**Found by:** kieran-typescript-reviewer, data-integrity-guardian
**File:** `src/utils/shape-lead.ts:12`
**Issue:** Dead null path. Type signature misleads callers.
**Suggestion:** Accept `LeadRecord` only.

---

## Batch Coverage

| Batch | Agent | Findings |
|-------|-------|----------|
| batch1 | kieran-typescript-reviewer | 14 (4 P1, 10 P2, 9 P3 raw — 12 unique after dedup) |
| batch1 | pattern-recognition-specialist | 16 (0 P1, 6 P2, 10 P3 raw — 8 unique after dedup) |
| batch1 | code-simplicity-reviewer | 15 (2 P1, 7 P2, 6 P3 raw — 5 unique after dedup) |
| batch2 | architecture-strategist | 19 (2 P1, 11 P2, 6 P3 raw — 4 unique after dedup) |
| batch2 | security-sentinel | 16 (2 P1, 8 P2, 6 P3 raw — 5 unique after dedup) |
| batch2 | performance-oracle | 15 (2 P1, 8 P2, 5 P3 raw — 3 unique after dedup) |
| batch3 | data-integrity-guardian | 20 (3 P1, 9 P2, 8 P3 raw — 6 unique after dedup) |
| batch3 | git-history-analyzer | 7 (2 P1, 2 P2, 3 P3 raw — 4 unique after dedup) |
| batch3 | deployment-verification-agent | 6 (0 P1, 4 P2, 2 P3 raw — 0 unique after dedup) |

**Cross-agent consensus highlights:**
- `listLeadsFiltered` no LIMIT: flagged by **4 agents** (kieran-ts, security, performance, data-integrity)
- Triplicated stmt() cache: flagged by **4 agents** (kieran-ts, pattern-rec, simplicity, data-integrity)
- Dual SMS senders: flagged by **3 agents** (kieran-ts, pattern-rec, simplicity)
- Dead venues.ts: flagged by **3 agents** (simplicity, pattern-rec, git-history)
- File-based dedup issues: flagged by **4 agents** (kieran-ts, simplicity, data-integrity, performance)

---

## Three Questions

### 1. Hardest judgment call in this review?

Deciding whether the 21 unmerged fixes should be one P1 finding or 21 separate findings. Chose to present them as **one P1 action** ("merge the branches") since that single action resolves 7 other findings in the list. The individual fixes within those branches were already reviewed and committed — the gap is merge process, not code quality.

### 2. What did you consider flagging but chose not to, and why?

- **Dashboard HTML at 1,596 lines:** Multiple agents noted this as large, but CSS was already extracted (Cycle 15) and the JS extraction threshold (2,500 lines) hasn't been reached. It's a known item being managed, not a new finding.
- **`readonly` on AutomationConfig fields:** Technically unnecessary noise, but harmless and arguably defensive. Not worth a P3.
- **`readFileSync` for dashboard.html at startup:** Performance agent initially flagged as P1 then self-downgraded to P3. For a single-user dashboard, this is negligible.

### 3. What might this review have missed?

- **Accessibility:** No agent checked dashboard HTML for WCAG compliance.
- **Prompt correctness:** Agents checked prompt injection defense but not whether prompts produce correct business logic (e.g., does the T1 guard actually work in the LLM prompt?).
- **End-to-end integration:** No agent tested the full webhook → pipeline → SMS → dashboard flow. State machine gaps (findings #17, #18) were found by code reading, but runtime edge cases may remain.
- **Dependency vulnerabilities:** `npm audit` not run. The build logs show "1 high severity vulnerability."
- **Browser automation selectors:** All Playwright selectors are marked `[VERIFY LIVE]` — no agent checked if they still match the real GigSalad/Yelp portal HTML.
