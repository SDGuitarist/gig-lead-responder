# Review Summary — feat/follow-up-v2-dashboard

**Date:** 2026-03-02
**Agents run:** 9 (3 batches of 3)
**Total unique findings:** 38 (after dedup)

**Severity snapshot:** P1: 6 | P2: 17 | P3: 15

---

## P1 — Critical (6)

### 1. COOKIE_SECRET env var missing causes immediate production crash
**Found by:** deployment-verification-agent
**File:** `src/auth.ts:13-15`
**Issue:** `getCookieSecret()` calls `process.exit(1)` when `COOKIE_SECRET` is unset in production. Deploying to Railway without setting this env var crashes the server on the first authenticated request. Also missing from `.env.example`.
**Suggestion:** Set `COOKIE_SECRET` in Railway **before deploying** (`openssl rand -hex 32`). Add to `.env.example` with a generation comment.

---

### 2. Table rebuild migration — destructive DDL, indexes dropped, column order unverified
**Found by:** deployment-verification-agent, data-integrity-guardian, kieran-typescript-reviewer, code-simplicity-reviewer
**File:** `src/leads.ts:87-152`
**Issue:** Four overlapping concerns in the same migration block: (a) `DROP TABLE leads` inside a transaction could lose data if the process crashes mid-migration; (b) the original `idx_leads_status` and `idx_leads_event_date` indexes are dropped and never recreated — the `CREATE INDEX IF NOT EXISTS` at lines 49-50 runs *before* the rebuild; (c) `INSERT INTO ... SELECT` uses positional columns with no order safety check; (d) hardcoded DDL duplicates the schema definition.
**Suggestion:** Back up the production database before deploying. Move all `CREATE INDEX` statements to after the migration block. Add a comment marking the rebuild DDL as frozen at time of migration. Verify post-deploy that all indexes exist.

---

### 3. CSRF guard missing on api.ts POST routes
**Found by:** kieran-typescript-reviewer, security-sentinel, architecture-strategist, data-integrity-guardian
**File:** `src/api.ts:123,175,218,296`
**Issue:** All four POST routes in `api.ts` (`/approve`, `/edit`, `/outcome`, `/analyze`) lack `csrfGuard` middleware. The new `follow-up-api.ts` correctly applies it — creating an inconsistent security posture. With cookie-based auth, a malicious page could forge a POST to `/api/leads/:id/approve` and trigger an SMS send on behalf of the user.
**Suggestion:** Apply `csrfGuard` to all POST routes in `api.ts`:
```typescript
router.post("/api/leads/:id/approve", approveLimiter, csrfGuard, async (req, res) => { ... });
router.post("/api/leads/:id/edit", csrfGuard, async (req, res) => { ... });
router.post("/api/leads/:id/outcome", csrfGuard, (req, res) => { ... });
router.post("/api/analyze", analyzeLimiter, csrfGuard, async (req, res) => { ... });
```

---

### 4. Scheduler leaves failed follow-ups stuck in "sent" status
**Found by:** data-integrity-guardian, performance-oracle
**File:** `src/follow-up-scheduler.ts:42-65`
**Issue:** When the scheduler claims a follow-up (atomically transitions `pending` → `sent`), then draft generation or SMS fails, the catch block does **not** revert the status back to `pending`. The lead stays permanently stuck in `sent` — invisible to `getLeadsDueForFollowUp()` which only queries `pending`. Additionally, the `retryFailures` Map is in-memory, so process restarts reset the retry counter while the lead remains stuck.
**Suggestion:** On failure (before max-retry skip), revert status to `pending`. Persist retry count in the database (e.g., `follow_up_retry_count` column) so it survives restarts.

---

### 5. Non-atomic approve-then-send flow risks stuck state
**Found by:** data-integrity-guardian
**File:** `src/api.ts:146-170`
**Issue:** The approval flow performs three separate database writes without a single transaction: (1) `claimLeadForSending` → `sending`, (2) `updateLead` stamps `sms_sent_at`, (3) `completeApproval` → `done` + schedules follow-up. If the process crashes between steps 2 and 3, the lead is stuck in `sending` with `sms_sent_at` set but never transitions to `done`. No recovery path exists.
**Suggestion:** Fold the `sms_sent_at` update into `completeApproval`'s existing `runTransaction`. Or add a startup recovery check that finds leads stuck in `sending`.

---

### 6. Non-null assertion on `shapeLead()` masks potential null responses
**Found by:** kieran-typescript-reviewer
**File:** `src/follow-up-api.ts:35,59,111,135`
**Issue:** Every success response uses `shapeLead(updated)!` with a non-null assertion. `shapeLead` returns `null` when given falsy input. The `!` operator hides a potential `null` in a JSON response — the client would receive `{ success: true, lead: null }` without any error.
**Suggestion:** Replace `!` with an explicit null guard:
```typescript
const shaped = shapeLead(updated);
if (!shaped) {
  res.status(500).json({ error: "Failed to shape lead response" });
  return;
}
res.json({ success: true, lead: shaped });
```

---

## P2 — Important (17)

### 7. `approveFollowUp` flow ambiguity — approved draft may never be sent
**Found by:** kieran-typescript-reviewer
**File:** `src/leads.ts:382-418`
**Issue:** `approveFollowUp()` transitions `follow_up_status = 'pending'`, then **clears the draft** and schedules the next follow-up. The draft visible on the dashboard is discarded and a new one is generated by the scheduler. If "Approve" means "send this exact draft," the SMS send is missing from the approve handler.
**Suggestion:** Clarify the intended behavior. If "Approve" means "send this draft," add the SMS send. If it means "proceed with the cycle," rename the button or add a clarifying comment.

---

### 8. CSP blocks Google Fonts — dashboard broken in production
**Found by:** security-sentinel
**File:** `src/server.ts:42-44`
**Issue:** CSP header is `style-src 'self' 'unsafe-inline'` with no allowance for `fonts.googleapis.com`, and no `font-src` directive. The dashboard loads Playfair Display from Google Fonts, which will silently fail to load in any CSP-enforcing browser.
**Suggestion:** Add Google Fonts domains to CSP, or self-host the font files.

---

### 9. Pipeline error messages forwarded to client via SSE
**Found by:** security-sentinel
**File:** `src/api.ts:313-315`
**Issue:** When the pipeline throws, the full `err.message` is sent to the browser. If the Anthropic SDK throws an error containing internal details (API keys in URLs, file paths), those would be exposed.
**Suggestion:** Send a generic error message to the client; log the full error server-side.

---

### 10. No input length limits on `/api/leads/:id/edit` and `/api/analyze`
**Found by:** security-sentinel
**File:** `src/api.ts:175-211` and `src/api.ts:296-319`
**Issue:** The `full_draft` field (edit) and `text` field (analyze) have no max-length validation. The 100KB Express body limit is the only cap. For `/api/analyze`, large text means high token usage and API costs.
**Suggestion:** Add `if (full_draft.length > 5000)` and `if (text.length > 10000)` guards.

---

### 11. Unsafe cast of `req.body` in snooze handler
**Found by:** kieran-typescript-reviewer
**File:** `src/follow-up-api.ts:71`
**Issue:** `const { until } = req.body as SnoozeRequestBody` casts without validation. If `req.body` is null or non-object, destructuring throws an unhandled error.
**Suggestion:** Add a body-shape guard before destructuring.

---

### 12. Duplicated `baseUrl()` utility across two files
**Found by:** kieran-typescript-reviewer, pattern-recognition-specialist, architecture-strategist, code-simplicity-reviewer
**File:** `src/follow-up-scheduler.ts:12-14` and `src/twilio-webhook.ts:26-28`
**Issue:** Identical 2-line function defined in both files. If formatting logic changes, both must be updated.
**Suggestion:** Extract to a shared utility (e.g., `src/config.ts`) and import from both consumers.

---

### 13. `leads.ts` is 700+ lines spanning 4+ responsibilities
**Found by:** pattern-recognition-specialist, architecture-strategist
**File:** `src/leads.ts:1-708`
**Issue:** Handles database init, CRUD, follow-up state machine, and analytics queries — all in one file. The follow-up state machine alone is 200 lines with distinct invariants.
**Suggestion:** Future incremental split: `src/db.ts`, `src/leads.ts` (CRUD), `src/follow-up-state.ts`, `src/analytics.ts`. Not urgent but should be addressed before the next feature adds more lines.

---

### 14. Repeated ID-parse + lead-lookup boilerplate across 7 route handlers
**Found by:** kieran-typescript-reviewer, pattern-recognition-specialist, code-simplicity-reviewer
**File:** `src/follow-up-api.ts:16-136` and `src/api.ts:124-127,176-179,219-222`
**Issue:** Same ~10-line pattern repeated 7 times across both API files. `satisfies FollowUpActionResponse` also repeated 12 times.
**Suggestion:** Extract a `parseLeadId(req, res)` helper. Remove redundant `satisfies` annotations.

---

### 15. Terminal-state functions inconsistent and nearly identical
**Found by:** kieran-typescript-reviewer, pattern-recognition-specialist, code-simplicity-reviewer
**File:** `src/leads.ts:372-376,424-476`
**Issue:** `TERMINAL_CLEAR` is used in `approveFollowUp` but not in `skipFollowUp` or `markClientReplied`, which duplicate the same field clears. The latter two functions are nearly identical (~25 lines each), differing only in the target status string.
**Suggestion:** Extract a shared `terminateFollowUp(leadId, status)` function using `TERMINAL_CLEAR`.

---

### 16. Dashboard HTML monolith (2,474 lines)
**Found by:** pattern-recognition-specialist, architecture-strategist, git-history-analyzer
**File:** `public/dashboard.html:1-2474`
**Issue:** CSS (~1,081 lines), HTML (~180 lines), and JavaScript (~1,200 lines) in one file. Changes to any layer require editing the same file. Growing by ~375 lines per feature.
**Suggestion:** Acceptable for now. Extract into separate files when it reaches 3,000 lines.

---

### 17. `apiFetch`/`apiPost` duplicate auth-retry logic with inconsistency
**Found by:** pattern-recognition-specialist, code-simplicity-reviewer
**File:** `public/dashboard.html:1405-1455`
**Issue:** Both implement retry-on-401, but `apiFetch` only retries when `authHeader === null`, while `apiPost` retries unconditionally. This inconsistency could cause confusing auth behavior.
**Suggestion:** Extract shared 401-handling into a wrapper function.

---

### 18. `shapeLead` imported from peer `api.ts` — coupling violation
**Found by:** architecture-strategist
**File:** `src/follow-up-api.ts:4`
**Issue:** `follow-up-api.ts` imports `shapeLead` from peer route module `api.ts`. Route modules should be independent and share utilities through the data layer.
**Suggestion:** Move `shapeLead()` to `src/leads.ts` or a new `src/presenters.ts`.

---

### 19. Scheduler error SMS lacks rate limiting
**Found by:** architecture-strategist
**File:** `src/follow-up-scheduler.ts:62-63`
**Issue:** Error notification SMS uses the same `sendSms()` as user-facing messages. A systemic failure (API key expiry) could flood the user's phone.
**Suggestion:** Add de-duplication (e.g., suppress error SMS within a 1-hour window).

---

### 20. Double database read in `updateLead` — 4+ SELECTs per transaction
**Found by:** performance-oracle
**File:** `src/leads.ts:239-278`
**Issue:** `updateLead()` calls `getLead(id)` for existence check + `getLead(id)` for return value = 2 SELECTs per update. In transactional contexts like `approveFollowUp`, this chains to 4 SELECTs + 2 UPDATEs for a single operation.
**Suggestion:** Use `RETURNING *` clause (SQLite 3.35+) to eliminate final `getLead`. Rely on `result.changes === 0` for existence check.

---

### 21. `listLeadsFiltered`/`listFollowUpLeads` use `SELECT *` with no pagination
**Found by:** performance-oracle
**File:** `src/leads.ts:518-561`
**Issue:** No `LIMIT` clause. Each lead includes raw email, JSON blobs, and drafts. At 100 leads, payloads reach hundreds of KB with 150+ `JSON.parse` calls per page load.
**Suggestion:** Use a column list excluding heavy columns for list queries. Add `LIMIT 100` safety cap.

---

### 22. Scheduler draft-store races with user skip/reply actions
**Found by:** data-integrity-guardian
**File:** `src/follow-up-scheduler.ts:48-50`
**Issue:** Between claim (status → `sent`) and draft storage, if the user calls `skipFollowUp`, the skip succeeds (checks `IN ('pending', 'sent')`), clears the draft, then the scheduler writes it back. Result: `follow_up_status = 'skipped'` but `follow_up_draft` populated — inconsistent state.
**Suggestion:** Re-check follow-up status after storing draft before sending SMS. Or wrap draft-store + notification in a transaction with a WHERE guard on status.

---

### 23. Twilio validation bypass not production-guarded at function level
**Found by:** security-sentinel
**File:** `src/twilio-webhook.ts:38-41`
**Issue:** `verifyTwilioSignature()` trusts the `DISABLE_TWILIO_VALIDATION` env var without checking `NODE_ENV`. The startup check in `server.ts` catches this, but if the startup check is ever bypassed or refactored, anyone could POST forged bodies to `/webhook/twilio`.
**Suggestion:** Add a production guard inside `verifyTwilioSignature`:
```typescript
if (process.env.DISABLE_TWILIO_VALIDATION === "true") {
  if (process.env.NODE_ENV === "production" || process.env.RAILWAY_ENVIRONMENT) {
    console.error("FATAL: DISABLE_TWILIO_VALIDATION cannot be used in production");
    return false;
  }
  return true;
}
```

---

## P3 — Minor (15)

| # | Title | File | Found by |
|---|-------|------|----------|
| 24 | `_req` prefixed as unused but actually used | `src/api.ts:96-98` | kieran-ts, pattern-recognition |
| 25 | Scheduler heartbeat log noisy (96 lines/day) | `src/follow-up-scheduler.ts:81` | kieran-ts |
| 26 | Follow-up status comment says "4 states" but there are 5 | `src/leads.ts:313` | kieran-ts |
| 27 | Duplicate comment header "Outcome tracking types" | `src/types.ts:159-166` | kieran-ts |
| 28 | Magic number `3` in dashboard follow-up count | `public/dashboard.html:2344` | kieran-ts, architecture, code-simplicity |
| 29 | `var` used throughout dashboard JS instead of `const`/`let` | `public/dashboard.html:1264-2471` | pattern-recognition |
| 30 | `MAX_FOLLOW_UPS` and `computeFollowUpDelay` exported but never imported | `src/leads.ts:324,333` | code-simplicity |
| 31 | `satisfies FollowUpActionResponse` used 12+ times (visual clutter) | `src/follow-up-api.ts` | code-simplicity |
| 32 | `SnoozeRequestBody` one-field type adds little value | `src/types.ts:244` | code-simplicity |
| 33 | `isStale` references `sms_sent_at` which is never in API response (dead code) | `public/dashboard.html:1378` | code-simplicity |
| 34 | `analyzeKvHTML` passes raw HTML as value parameter (fragile pattern) | `public/dashboard.html:2149-2155` | security-sentinel |
| 35 | Cookie session has no revocation mechanism (90-day TTL) | `src/auth.ts:5,95-105` | security-sentinel, deployment |
| 36 | `retryFailures` map entries not bounded/cleaned up | `src/follow-up-scheduler.ts:9` | architecture, performance |
| 37 | SSE connection for `/api/analyze` has no timeout or abort handler | `src/api.ts:296-319` | performance |
| 38 | `COOKIE_MAX_AGE_S` declared but never used (dead code) | `src/auth.ts:7` | kieran-ts |

---

## Recommended Fix Order

Ordering rules applied: cascade fixes first, blast radius within priority, root causes before symptoms, prerequisites before dependents.

| # | Issue | Priority | Why this order | Unblocks |
|---|-------|----------|---------------|----------|
| 1 | **COOKIE_SECRET env var** (#1) | P1 | Deploy blocker — server crashes without it | #2, all deploy |
| 2 | **Table rebuild migration safety** (#2) | P1 | Data loss risk — must back up + verify indexes before deploy | — |
| 3 | **CSRF guard on api.ts POST routes** (#3) | P1 | Root cause — 4 endpoints vulnerable, 1-line fix per route | — |
| 4 | **Scheduler stuck in "sent" status** (#4) | P1 | Data integrity — affects every automatic follow-up send | — |
| 5 | **Non-atomic approve flow** (#5) | P1 | Data integrity — crash between writes leaves stuck state | — |
| 6 | **Non-null assertion on shapeLead** (#6) | P1 | Breaking bug potential — 4 occurrences, quick fix | — |
| 7 | **CSP blocks Google Fonts** (#8) | P2 | Functional bug — fonts broken in production right now | — |
| 8 | **Error messages forwarded to client** (#9) | P2 | Info leak — quick 2-line fix | — |
| 9 | **approveFollowUp flow ambiguity** (#7) | P2 | Behavior correctness — clarify before users interact | — |
| 10 | **Unsafe req.body cast in snooze** (#11) | P2 | Input validation — could throw on malformed request | — |
| 11 | **Input length limits** (#10) | P2 | Defense-in-depth + cost protection — trivial guards | — |
| 12 | **Scheduler draft-store race** (#22) | P2 | Data integrity — inconsistent state possible | — |
| 13 | **Twilio validation bypass** (#23) | P2 | Defense-in-depth — 3-line addition | — |
| 14 | **Duplicated baseUrl()** (#12) | P2 | DRY — extract to shared utility | #18 |
| 15 | **shapeLead peer import** (#18) | P2 | Coupling — move to data layer | #14 |
| 16 | **Terminal-state functions** (#15) | P2 | Code consolidation — extract shared function | — |
| 17 | **Repeated ID-parse boilerplate** (#14) | P2 | DRY — extract helper across 7 handlers | — |
| 18 | **Double database read** (#20) | P2 | Performance — affects every write operation | — |
| 19 | **Scheduler error SMS rate limit** (#19) | P2 | Operational safety — prevent SMS flood | — |
| 20 | **apiFetch/apiPost inconsistency** (#17) | P2 | Behavior consistency — auth retry mismatch | — |
| 21 | **SELECT * with no pagination** (#21) | P2 | Performance — grows with lead count | — |
| 22 | **leads.ts SRP split** (#13) | P2 | Structural debt — do before next feature | — |
| 23 | **Dashboard monolith** (#16) | P2 | Maintenance — extract at 3,000 lines | — |
| 24-38 | P3 findings (see table above) | P3 | Low urgency — address opportunistically | — |

---

## Batch Coverage

| Batch | Agent | Findings |
|-------|-------|----------|
| batch1 | kieran-typescript-reviewer | 14 |
| batch1 | pattern-recognition-specialist | 11 |
| batch1 | code-simplicity-reviewer | 11 |
| batch2 | architecture-strategist | 9 |
| batch2 | security-sentinel | 10 |
| batch2 | performance-oracle | 10 |
| batch3 | data-integrity-guardian | 8 |
| batch3 | git-history-analyzer | 6 |
| batch3 | deployment-verification-agent | 10 |

**Note:** Raw findings total 89. After dedup (merging same file:line across agents), 38 unique findings remain. git-history-analyzer's commit granularity findings (2 P2, 4 P3) are process observations, not code fixes — they inform future commit discipline.

---

## Three Questions

### 1. Hardest judgment call in this review?

Severity assignment for the `approveFollowUp` flow ambiguity (#7). One agent rated it P1 ("approved draft may never be sent" — a breaking bug if the intent is to send that specific draft). I downgraded to P2 because it's a **design ambiguity**, not a confirmed bug — the scheduler may be intentionally generating fresh drafts. The correct fix depends on the user's intent, not on a code change. If "Approve" is supposed to mean "send this exact draft," then it's a P1 behavioral bug. If it means "proceed with the follow-up cycle," it's a P2 documentation/naming issue.

### 2. What did you consider flagging but chose not to, and why?

- **`var` → `const`/`let` in dashboard JS** — Considered upgrading to P2 because `var` hoisting can cause subtle bugs, but the dashboard JS is straightforward procedural code with no closures in loops or block-scoping traps. Kept at P3.
- **In-memory rate limiter resets on deploy** — Both data-integrity and deployment agents flagged this but acknowledged it's acceptable for single-user. Not worth a fix.
- **`/health` endpoint not behind auth** — Intentional for Railway health checks. No sensitive data exposed.

### 3. What might this review have missed?

- **Accessibility** — No agent checked the dashboard for a11y (keyboard navigation, screen reader support, color contrast). The follow-up cards use color-coded status badges that may fail contrast checks.
- **Timezone handling** — Follow-up scheduling uses `new Date().toISOString()` (UTC) but the dashboard renders dates without timezone context. Snooze "until" dates from the client may be interpreted differently.
- **SMS content validation** — No agent checked whether the follow-up draft content is sanitized or length-limited before being sent via Twilio. SMS has a 1,600-character limit for concatenated messages.
- **Logging consistency** — No agent audited logging patterns (what's logged at what level, whether PII is logged, log rotation).
- **Browser compatibility** — The dashboard uses `fetch`, `async/await`, `??`, and `?.` without checking if all target browsers support them.
