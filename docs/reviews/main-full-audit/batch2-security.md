# Security Sentinel — Review Findings

**Agent:** security-sentinel
**Branch:** main (full codebase audit)
**Date:** 2026-04-07
**Files reviewed:** 63

## Findings

### [P1] Credential file written without restrictive permissions
**File:** `src/automation/poller.ts:25`
**Issue:** `bootstrapCredentialFiles()` writes `credentials.json` (containing OAuth client_id and client_secret) via `writeFileSync` with default permissions (world-readable). The token file on line 29 correctly uses `mode: 0o600`, but the credentials file does not.
**Suggestion:** Add `{ mode: 0o600 }` to the `writeFileSync` call for `credPath` on line 25.

---

### [P1] `listLeadsFiltered` returns unbounded results — DoS risk
**File:** `src/db/queries.ts:55-82`
**Issue:** No LIMIT clause. Single authenticated request could force server to serialize entire leads table. Memory exhaustion kills webhook processing and follow-up scheduler. MEMORY.md says Cycle 12 added pagination but code has none.
**Suggestion:** Add `LIMIT @limit OFFSET @offset` capped at 200. Accept `page`/`per_page` query params.

---

### [P2] Webhook rate limiters defined but never mounted
**File:** `src/rate-limit.ts`, `src/app.ts:69-73`
**Issue:** `POST /webhook/mailgun` and `POST /webhook/twilio` have no rate limiter applied. MEMORY.md says Cycle 12 added rate limiting but code shows neither router is wrapped. Compromised HMAC key could flood pipeline with Claude API calls.
**Suggestion:** Add rate limiter (30 req/15min) to both webhook routes.

---

### [P2] Mailgun webhook token replay within 5-minute window
**File:** `src/webhook.ts:70-75`
**Issue:** Replay protection checks timestamp age but doesn't track which tokens have been seen. Same valid `(timestamp, token, signature)` triple can be replayed within 5-minute window. Email-level dedup catches duplicate leads, but replay can probe timing or consume rate-limit budget.
**Suggestion:** Maintain in-memory TTL cache of seen tokens. Reject duplicates.

---

### [P2] Dedup file grows unbounded with no cleanup
**File:** `src/automation/dedup.ts:1-23`
**Issue:** Every processed Gmail message ID appended to JSON file. No eviction, rotation, or size cap. File read/written in full on every check. Gradual performance degradation and potential OOM on Railway.
**Suggestion:** Migrate to SQLite `processed_emails` table (already exists for webhook path) or cap at 10,000 entries.

---

### [P2] Dashboard HTML served without sessionAuth
**File:** `src/app.ts:56-59`
**Issue:** `app.get("/dashboard.html", ...)` has no auth middleware. Full dashboard UI (JavaScript, endpoint paths, UI structure) is publicly accessible. API calls fail with 401 but implementation details are leaked.
**Suggestion:** Apply `sessionAuth` before dashboard route and static file serving (excluding `/health`).

---

### [P2] Bare `JSON.parse` in Twilio webhook handler
**File:** `src/twilio-webhook.ts:143-144`
**Issue:** `JSON.parse(lead.classification_json)` and `JSON.parse(lead.pricing_json)` with no try-catch. Corrupt stored JSON throws unhandled exception in async handler.
**Suggestion:** Wrap in try-catch with clear error message about corrupt data.

---

### [P2] PF-Intel API key sent over HTTP without URL validation
**File:** `src/venue-lookup.ts:36`
**Issue:** `PF_INTEL_API_URL` defaults to `http://...railway.internal` (plain HTTP). API key sent as `X-API-Key` header. Currently mitigated by Railway WireGuard tunnel, but no check prevents use of plain HTTP for non-internal URLs.
**Suggestion:** Add runtime check: if URL is not `.railway.internal` and not `https://`, warn or refuse.

---

### [P2] No minimum password/secret length enforcement
**File:** `src/auth.ts:77-93`, `src/server.ts:17-20`
**Issue:** `DASHBOARD_PASS` and `COOKIE_SECRET` validated for existence but not length. `DASHBOARD_PASS=x` would pass all checks. Enables brute-force attacks.
**Suggestion:** Enforce `DASHBOARD_PASS` >= 12 chars, `COOKIE_SECRET` >= 32 chars at startup.

---

### [P2] `raw_email` stored in DB without truncation
**File:** `src/db/leads.ts:85`
**Issue:** `insertLead()` stores `raw_email` with no size limit. Body parser accepts up to 1MB. Pipeline truncates to 50K, but DB stores full payload. Gap between 1MB input and 50K processing.
**Suggestion:** Truncate to 50K at `insertLead()` call site.

---

### [P3] Stored `error_message` returned to dashboard without sanitization
**File:** `src/utils/shape-lead.ts:45`
**Issue:** `error_message` from DB (set via `err.message`) may contain stack traces, file paths, or API error details. Returned directly to dashboard users.
**Suggestion:** Truncate or sanitize before returning in API response.

---

### [P3] Gmail OAuth token file written non-atomically
**File:** `src/automation/gmail-watcher.ts:48`
**Issue:** Token refresh uses `writeFileSync()` directly. Process crash mid-write corrupts token file.
**Suggestion:** Write to temp file then atomic rename.

---

### [P3] No HSTS preload directive
**File:** `src/app.ts:44`
**Issue:** HSTS header lacks `preload` directive.
**Suggestion:** Add `; preload` to the HSTS header value.

---

### [P3] Log path configurable via env var without path traversal check
**File:** `src/automation/config.ts:58`, `src/automation/logger.ts:24-25`
**Issue:** `LOG_PATH` env var used directly in `appendFileSync` with `mkdirSync(dirname(...), { recursive: true })`. Requires env var access to exploit (very low risk).
**Suggestion:** Validate logPath is within project directory.

---

### [P3] Browser data directories store persistent session cookies
**File:** `src/automation/portals/yelp-client.ts:38`, `src/automation/portals/gigsalad-client.ts:15`
**Issue:** Playwright persistent context stores live portal session tokens on Railway volume indefinitely. No rotation or expiration.
**Suggestion:** Document risk. Consider weekly cleanup to force re-auth.

---

### [P3] Env var truthiness checks for production guards
**File:** `src/webhook.ts:50`, `src/twilio-webhook.ts:38`
**Issue:** `RAILWAY_ENVIRONMENT` checked for truthiness, not specific value. Extremely low risk — `server.ts` startup guard is primary defense.
**Suggestion:** No action needed.

---

## Notable Security Strengths

1. Timing-safe comparisons throughout auth and webhook validation
2. Layered prompt injection defense (wrapUntrustedData, sanitizeClassification, truncation)
3. Atomic state transitions in follow-up state machine via SQLite WHERE guards
4. runTransaction rejects async callbacks to prevent escaped transaction boundaries
5. Production startup guards blocking validation-bypass env vars
6. Source validation for Gmail automation (exact sender regex + SPF/DKIM)
7. Column whitelist in updateLead preventing key injection into dynamic SQL
