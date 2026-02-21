# Review Summary — main

**Date:** 2026-02-20
**Agents run:** 9 (3 batches of 3)
**Total unique findings:** 34

---

## P1 — Critical (3)

### Dead `src/twilio.ts` with conflicting env var names
**Found by:** pattern-recognition-specialist, architecture-strategist, performance-oracle
**File:** `src/twilio.ts` (entire file)
**Issue:** `src/twilio.ts` is never imported anywhere. It uses **different env var names** than the live `src/sms.ts` (`TWILIO_PHONE_NUMBER` vs `TWILIO_FROM_NUMBER`, `ALEX_PHONE_NUMBER` vs `ALEX_PHONE`). If someone accidentally imports from `./twilio` instead of `./sms`, SMS silently fails because those env vars are never set. The file is a confusion hazard sitting next to the real module.
**Suggestion:** Delete `src/twilio.ts` entirely. It was superseded by `src/sms.ts`.

---

### Validation bypass (DISABLE_MAILGUN_VALIDATION) with no auto-revert
**Found by:** deployment-verification-agent, security-sentinel, data-integrity-guardian, git-history-analyzer
**File:** `src/webhook.ts:63`
**Issue:** When `DISABLE_MAILGUN_VALIDATION=true`, any HTTP client can POST fabricated payloads to `/webhook/mailgun`. Each fake lead triggers the full AI pipeline (burning Anthropic API credits) and sends an SMS to Alex's phone. There is no timer, request counter, or auto-revert mechanism. If set to `true` for debugging and forgotten, the webhook stays open indefinitely. Same pattern exists at `src/twilio-webhook.ts:36`.
**Suggestion:** (1) Add a startup warning in `src/server.ts` that logs once on boot when either `DISABLE_*` flag is active. (2) Consider a time-bounded bypass (`DISABLE_MAILGUN_VALIDATION_UNTIL` timestamp). (3) Add rate limiting to webhook endpoints as defense-in-depth.

---

### Fire-and-forget pipeline has no timeout, no error visibility
**Found by:** performance-oracle, git-history-analyzer, deployment-verification-agent
**File:** `src/webhook.ts:124-133`
**Issue:** The fire-and-forget `runPipeline(...).then(...).catch(...)` has no timeout or cancellation. If the Claude API hangs, the promise holds memory (full prompt context, rate data, classification objects) indefinitely. Multiple leads arriving during an API latency spike cause unbounded memory growth. If both `runPipeline` and `postPipelineError` fail (double fault), the error is only logged to console — the lead stays in `received` status forever with no recovery path. There is no visibility into how many pipelines are in-flight.
**Suggestion:** Add a timeout wrapper (~2 minutes) via `Promise.race`. Add a simple in-memory counter for in-flight pipelines. The stuck-lead recovery (documented in HANDOFF.md but not implemented) would catch double-fault cases.

---

## P2 — Important (17)

### Dead no-op middleware
**Found by:** pattern-recognition-specialist, code-simplicity-reviewer, kieran-typescript-reviewer, architecture-strategist, git-history-analyzer, deployment-verification-agent
**File:** `src/webhook.ts:11-18`
**Issue:** The route-level middleware checks `req.is("application/x-www-form-urlencoded")` but calls `next()` in both branches. It does nothing. `express.urlencoded()` is already applied globally in `server.ts:20`. Leftover scaffolding from Chunk 2 that was never cleaned up. 6 of 9 agents flagged this.
**Suggestion:** Delete lines 11-18 entirely.

---

### Untyped `req.body` with `as` casts, no runtime validation
**Found by:** kieran-typescript-reviewer, architecture-strategist
**File:** `src/webhook.ts:50-55`
**Issue:** `req.body` is typed as `any` by Express. Fields are cast with `as string | undefined` instead of validated at runtime. If Mailgun changes payload format, every access silently becomes `undefined` and `|| ""` fallbacks mask the error. TypeScript provides zero help catching typos like `body.sigature`.
**Suggestion:** Define a `MailgunWebhookBody` interface. Use `String()` coercion or a validation helper for runtime safety.

---

### `EmailFields` not exported, duplicated inline
**Found by:** architecture-strategist, kieran-typescript-reviewer
**File:** `src/email-parser.ts:3-9` / `src/webhook.ts:72-78`
**Issue:** `EmailFields` in `email-parser.ts` is not exported. The webhook handler manually reconstructs a matching object using `as string` casts. If `EmailFields` gains a required field, the webhook handler compiles fine but breaks at runtime.
**Suggestion:** Export `EmailFields` from `email-parser.ts` and use it to type the `fields` object in `webhook.ts`.

---

### Asymmetric validation and escape-hatch patterns
**Found by:** architecture-strategist, pattern-recognition-specialist, code-simplicity-reviewer
**File:** `src/webhook.ts:25` / `src/twilio-webhook.ts:35`
**Issue:** `verifyMailgunSignature` takes 3 string params; `verifyTwilioSignature` takes the full Request. The escape hatch lives inline in the route handler for Mailgun but inside the verify function for Twilio. Disabling Mailgun validation still requires signature fields to be present (usability issue), while disabling Twilio skips everything.
**Suggestion:** Extract Mailgun validation into a standalone function following the Twilio pattern. Move the `DISABLE_MAILGUN_VALIDATION` check before the missing-fields check.

---

### Repeated `gate_passed` boolean conversion (3x)
**Found by:** pattern-recognition-specialist
**File:** `src/leads.ts:120,130,191`
**Issue:** `gate_passed: row.gate_passed === null ? null : Boolean(row.gate_passed)` appears in `getLead()`, `getLeadsByStatus()`, and `listLeads()`. If conversion logic changes, all three must update in lockstep.
**Suggestion:** Extract a `normalizeLeadRow(row)` helper for all SQLite-to-TypeScript conversions.

---

### Repeated error-to-message extraction (5x)
**Found by:** pattern-recognition-specialist
**File:** `src/server.ts:61`, `src/post-pipeline.ts:65`, `src/twilio-webhook.ts:201,214,223`
**Issue:** `err instanceof Error ? err.message : String(err)` appears 5 times across 3 files.
**Suggestion:** Create a shared `errorMessage(err: unknown): string` helper.

---

### SQL injection surface via dynamic column names
**Found by:** security-sentinel, data-integrity-guardian
**File:** `src/leads.ts:150-163`
**Issue:** `updateLead` interpolates column names directly into SQL via `setClauses.push(\`${key} = @${key}\`)`. TypeScript restricts keys at compile time, but this is erased at runtime. If a future API endpoint passes user-controlled keys, this becomes SQL injection.
**Suggestion:** Add a runtime whitelist of allowed column names. Throw if a key is not in the set.

---

### No rate limiting on any endpoint
**Found by:** deployment-verification-agent, security-sentinel
**File:** `src/server.ts`
**Issue:** No rate limiting middleware. `/webhook/mailgun`, `/webhook/twilio`, and `/api/analyze` are public-facing. An attacker can flood webhooks to burn API credits, spam the DB, or brute-force Basic Auth on the dashboard.
**Suggestion:** Install `express-rate-limit` with sensible per-endpoint limits (e.g., 10 req/min on webhooks).

---

### SQLite prepared statements not cached
**Found by:** performance-oracle
**File:** `src/leads.ts:85,115,125,163,173,180,186`
**Issue:** Every call to `insertLead`, `getLead`, etc. calls `initDb().prepare(...)` fresh. JavaScript `Statement` objects are recreated per call.
**Suggestion:** Cache static prepared statements as module-level variables, initialized lazily.

---

### `listLeads()` fetches all rows with no pagination
**Found by:** performance-oracle
**File:** `src/leads.ts:184-193`
**Issue:** `SELECT * FROM leads ORDER BY created_at DESC` with no LIMIT. Fetches all columns including multi-KB text fields. At 1000 leads, this loads 5-10MB per page load.
**Suggestion:** Add LIMIT/OFFSET pagination and select only the columns the dashboard needs.

---

### Context files re-read from disk every pipeline run
**Found by:** performance-oracle
**File:** `src/pipeline/context.ts:10-20`
**Issue:** `selectContext()` reads 3-6 markdown files (~1148 lines) from disk on every pipeline run. Files don't change at runtime.
**Suggestion:** Read files once at startup into a `Map<string, string>` cache.

---

### No explicit request body size limit
**Found by:** performance-oracle
**File:** `src/server.ts:20`
**Issue:** `express.urlencoded({ extended: false })` uses Express default of 100KB. Mailgun email bodies can exceed this with inline attachments, resulting in a 413 and silently lost lead.
**Suggestion:** Set explicit limit: `express.urlencoded({ extended: false, limit: '500kb' })`.

---

### `insertLead` does INSERT then unnecessary SELECT
**Found by:** performance-oracle
**File:** `src/leads.ts:110`
**Issue:** `insertLead` does an INSERT followed by a `getLead` SELECT to return the full record. The SELECT is unnecessary — the result can be constructed from input data + `lastInsertRowid`.
**Suggestion:** Construct the `LeadRecord` directly from input data.

---

### Non-atomic `postPipeline` writes with double `updateLead`
**Found by:** performance-oracle, data-integrity-guardian
**File:** `src/post-pipeline.ts:18-51`
**Issue:** `postPipeline` calls `updateLead` twice (each internally does SELECT + UPDATE + SELECT = 6 SQL ops total). If SMS succeeds but the second `updateLead` fails, the lead has pipeline data and SMS sent but status remains `received`. The Twilio reply handler looks for `status = "sent"`, so the user's YES reply won't find this lead.
**Suggestion:** Wrap the pipeline data write and status update in a single transaction. Only commit after SMS succeeds.

---

### Race condition (TOCTOU) in dedup check
**Found by:** data-integrity-guardian
**File:** `src/webhook.ts:103-110`
**Issue:** `isEmailProcessed` and `markEmailProcessed` + `insertLead` are not in a transaction. Two identical Mailgun retries arriving simultaneously can both pass the dedup check and create duplicate leads. The `processed_emails` table uses `INSERT OR IGNORE` which silently succeeds on the second request.
**Suggestion:** Wrap check-then-insert in a `better-sqlite3` transaction. SQLite's single-writer lock eliminates the TOCTOU window entirely.

---

### Dependency direction violation — twilio-webhook imports pipeline internals
**Found by:** architecture-strategist
**File:** `src/twilio-webhook.ts:6-8`
**Issue:** The Twilio edit handler directly imports pipeline stage functions (`selectContext`, `generateResponse`, `verifyGate`), bypassing orchestration. The Mailgun webhook correctly delegates to `runPipeline()`. This means no progress reporting or confidence scoring on the edit path, and inconsistent error handling.
**Suggestion:** Add a `runEditPipeline(leadId, instructions)` function to `run-pipeline.ts`. Keep the webhook handler as a thin routing layer.

---

### No stuck-lead recovery implemented
**Found by:** deployment-verification-agent
**File:** `src/webhook.ts:124` / `src/leads.ts`
**Issue:** HANDOFF.md documents a planned `setInterval` to transition `received` leads older than 5 minutes to `failed`. This is not implemented anywhere. If the pipeline hangs or the process restarts mid-pipeline, leads remain in `received` forever with no alert.
**Suggestion:** Implement the `setInterval` recovery, or document that it's deferred and add a manual check to the daily monitoring routine.

---

## P3 — Minor (14)

### Emoji in log output inconsistent with codebase
**Found by:** kieran-typescript-reviewer, pattern-recognition-specialist
**File:** `src/webhook.ts:64`
**Issue:** Two log lines use the ⚠ emoji. All other logs use plain text. Emojis can cause encoding issues in log aggregation.
**Suggestion:** Replace with `[WARNING]` or `WARN:` prefix.

---

### SKILL.md subagent types with no fallback
**Found by:** pattern-recognition-specialist, architecture-strategist
**File:** `.claude/skills/review-batched/SKILL.md`
**Issue:** References 9 specific subagent types assumed to exist in the agent registry, with no fallback if unavailable.
**Suggestion:** Add a note to fall back to general-purpose Task agent if a specific type is unavailable.

---

### Escape hatch doesn't fully escape (fields still required)
**Found by:** code-simplicity-reviewer
**File:** `src/webhook.ts:57-69`
**Issue:** When `DISABLE_MAILGUN_VALIDATION=true`, the code still requires `timestamp`, `token`, and `signature` to be present (checked before the disable flag). Manual `curl` tests without these fields return 401 even with validation disabled.
**Suggestion:** Move the `DISABLE_MAILGUN_VALIDATION` check before the missing-fields check.

---

### Unreachable catch-all error branch
**Found by:** code-simplicity-reviewer
**File:** `src/webhook.ts:94-98`
**Issue:** Both `ParseResult` failure reasons (`skip` and `parse_error`) are handled above. This branch is never reached.
**Suggestion:** Use `const _exhaustive: never = result.reason` for compile-time safety if new reasons are added. Low priority.

---

### No timestamp replay protection on Mailgun webhook
**Found by:** security-sentinel, data-integrity-guardian
**File:** `src/webhook.ts:25-47`
**Issue:** HMAC is validated but timestamp is never checked for freshness. Mailgun recommends rejecting requests older than ~5 minutes. Captured valid payloads can be replayed.
**Suggestion:** Add: reject if `Math.abs(Date.now() / 1000 - parseInt(timestamp)) > 300`.

---

### Dashboard auth silently disabled when env vars missing
**Found by:** security-sentinel
**File:** `src/dashboard.ts:13-17`
**Issue:** If `DASHBOARD_USER` or `DASHBOARD_PASS` are not set, the `/leads` dashboard is publicly accessible. Exposes lead records, client names, raw email content, AI drafts, and pricing.
**Suggestion:** Require these vars in production or log a loud startup warning.

---

### No security headers (Helmet)
**Found by:** security-sentinel
**File:** `src/server.ts`
**Issue:** No CSP, X-Frame-Options, X-Content-Type-Options, or HSTS headers. Dashboard renders inline HTML without CSP.
**Suggestion:** Install `helmet` middleware.

---

### innerHTML XSS in dashboard
**Found by:** security-sentinel
**File:** `public/index.html:224,237,249`
**Issue:** `kvHTML` constructs HTML from Claude API output and sets it via `innerHTML` without escaping. Stored XSS vector if Claude returns HTML from prompt injection in lead email. Low risk (only Alex views dashboard).
**Suggestion:** Add `escapeHtml()` sanitization in `kvHTML`.

---

### Timing attack on Basic Auth comparison
**Found by:** security-sentinel
**File:** `src/dashboard.ts:29`
**Issue:** Uses `===` for password comparison, which leaks timing information. Very low practical risk.
**Suggestion:** Use `crypto.timingSafeEqual` for credential comparison.

---

### `callClaude` retry on JSON parse failure doubles API cost
**Found by:** performance-oracle
**File:** `src/claude.ts:44-65`
**Issue:** If Claude returns invalid JSON, a second API call is made with no monitoring of frequency.
**Suggestion:** Add a counter/metric for JSON parse retries.

---

### External ID falsy-chain and cross-platform collision risk
**Found by:** pattern-recognition-specialist, data-integrity-guardian
**File:** `src/webhook.ts:77`
**Issue:** (1) Message-Id header check uses falsy chain — empty string `""` would bypass differently than `undefined`. (2) `processed_emails` table dedup key is only `external_id`, not `(platform, external_id)`. Two platforms using the same ID string would collide.
**Suggestion:** Make `processed_emails` primary key a composite of `(platform, external_id)`.

---

### HANDOFF.md high churn rate
**Found by:** git-history-analyzer
**File:** `docs/HANDOFF.md`
**Issue:** Modified 10 times in one day (by design for session handoff). Now 494 lines with historical baggage.
**Suggestion:** Prune completed chunk status after deployment. Full history is in git.

---

### No test coverage for webhook handler
**Found by:** git-history-analyzer
**File:** `src/webhook.ts`
**Issue:** Zero test-related commits for the webhook handler — the critical entry point that validates signatures, deduplicates, and triggers the pipeline.
**Suggestion:** Add integration tests: valid webhook → lead, duplicate → 200, invalid sig → 401, malformed body → 406.

---

### `.env.example` DISABLE flags documentation
**Found by:** deployment-verification-agent
**File:** `.env.example:36,44`
**Issue:** Shows `DISABLE_*_VALIDATION=false` but these vars don't need to be set (code checks `=== "true"`). Could confuse engineers.
**Suggestion:** Add comment: "Do not set in production. Only set to 'true' temporarily for debugging."

---

## Batch Coverage

| Batch | Agent | Findings |
|-------|-------|----------|
| batch1 | kieran-typescript-reviewer | 5 |
| batch1 | pattern-recognition-specialist | 8 |
| batch1 | code-simplicity-reviewer | 3 |
| batch2 | architecture-strategist | 8 |
| batch2 | security-sentinel | 8 |
| batch2 | performance-oracle | 11 |
| batch3 | data-integrity-guardian | 6 |
| batch3 | git-history-analyzer | 6 |
| batch3 | deployment-verification-agent | 6 |

**Note:** Raw finding counts above include duplicates across agents. After deduplication by file + line number, 34 unique findings remain. The deployment-verification agent also produced a comprehensive **deployment checklist** with pre/post-deploy checks, verification SQL queries, rollback procedures, and a Go/No-Go matrix — see `docs/reviews/main/batch3-deployment.md`.
