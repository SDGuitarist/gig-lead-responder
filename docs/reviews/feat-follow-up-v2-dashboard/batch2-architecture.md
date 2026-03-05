# Architecture Strategist — Review Findings

**Agent:** architecture-strategist
**Branch:** feat/follow-up-v2-dashboard
**Date:** 2026-03-02
**Files reviewed:** 12 (server.ts, api.ts, auth.ts, follow-up-api.ts, follow-up-scheduler.ts, leads.ts, rate-limit.ts, twilio-webhook.ts, types.ts, dashboard.html, package.json, HANDOFF.md)

## Architecture Overview

The system is a single-process Express application backed by SQLite. It follows a clean layered architecture:

- **Types layer** (`src/types.ts`) — shared type definitions, enums, constants
- **Data layer** (`src/leads.ts`) — database access, migrations, atomic state transitions
- **API layer** (`src/api.ts`, `src/follow-up-api.ts`) — HTTP route handlers
- **Scheduler layer** (`src/follow-up-scheduler.ts`) — background job processing
- **Webhook layer** (`src/twilio-webhook.ts`) — inbound SMS command parsing
- **Auth layer** (`src/auth.ts`) — session cookies, CSRF guard
- **Presentation** (`public/dashboard.html`) — single-page dashboard

The follow-up v2 feature adds a new follow-up state machine to leads, a dedicated API router, a background scheduler, dashboard tab, and CSRF protection. The changes are architecturally well-organized overall.

## Findings

### [P1] CSRF guard missing on existing API POST endpoints

**File:** `src/api.ts:11`
**Issue:** The new `follow-up-api.ts` correctly applies `csrfGuard` middleware to all its POST routes, but the original `api.ts` router — which handles `/api/leads/:id/approve`, `/api/leads/:id/edit`, `/api/leads/:id/outcome`, and `/api/analyze` — does not use `csrfGuard` at all. This creates an inconsistent security posture where the new follow-up endpoints are CSRF-protected but the original approval and edit endpoints are not. A cross-site attacker could forge a POST to `/api/leads/:id/approve` that would send an SMS on behalf of the user, since cookie-based sessions are auto-attached by the browser.
**Suggestion:** Apply `csrfGuard` to the existing `api.ts` router, either at the router level (`router.use(csrfGuard)`) or on each POST handler individually, matching the pattern already established in `follow-up-api.ts`.

---

### [P2] Duplicated `baseUrl()` utility in two modules

**File:** `src/follow-up-scheduler.ts:12` and `src/twilio-webhook.ts:26`
**Issue:** The `baseUrl()` helper function is defined identically in both `follow-up-scheduler.ts` and `twilio-webhook.ts`. If `BASE_URL` formatting logic changes, both must be updated in lockstep. The risk of drift is real since they live in modules maintained at different cadences.
**Suggestion:** Extract `baseUrl()` to a shared utility module (e.g., `src/config.ts` or `src/env.ts`) and import it in both files.

---

### [P2] `follow-up-api.ts` imports `shapeLead` from `api.ts` — peer-module coupling

**File:** `src/follow-up-api.ts:4`
**Issue:** `follow-up-api.ts` imports `shapeLead` from `api.ts`, creating a dependency between two peer route modules. If `api.ts` were refactored, split, or lazy-loaded independently, this import would break. It violates the pattern that route modules should be independent and share utilities through the data or types layer.
**Suggestion:** Move `shapeLead()` to `src/leads.ts` (since it shapes `LeadRecord` into `LeadApiResponse`) or a new `src/presenters.ts` module. Both `api.ts` and `follow-up-api.ts` would then import from a shared lower-level module.

---

### [P2] `leads.ts` has grown to 700+ lines spanning 4 responsibilities

**File:** `src/leads.ts:1-708`
**Issue:** `leads.ts` now handles: (1) database initialization and schema migrations, (2) basic CRUD operations, (3) the entire follow-up state machine with 7+ atomic transition functions, and (4) analytics queries. At 700+ lines it is the largest source file. The follow-up state machine alone (lines 311-509) is a distinct domain concept with its own invariants.
**Suggestion:** Not urgent but should be addressed before the next feature. Consider splitting into `src/db.ts`, `src/leads.ts` (CRUD), `src/follow-up-state.ts` (state machine), and `src/analytics.ts`.

---

### [P2] Monolithic HTML file with inline CSS and JS (2,475 lines)

**File:** `public/dashboard.html:1-2475`
**Issue:** The dashboard is a single 2,475-line HTML file containing all CSS, HTML structure, and JavaScript inline. The Follow-Ups tab added ~375 lines. There is no ability to unit-test the JavaScript logic independently.
**Suggestion:** For now acceptable for a single-user dashboard, but as the file approaches 3,000 lines, consider extracting JavaScript into `dashboard.js` and CSS into `dashboard.css`. No build tooling required.

---

### [P2] Follow-up scheduler error notification uses same SMS channel as user-facing messages

**File:** `src/follow-up-scheduler.ts:62-63`
**Issue:** When a follow-up fails 3 times, the scheduler sends an error notification SMS via the same `sendSms()` function used for user-facing messages. Similarly, the general scheduler error handler at line 86 sends error SMS. This mixes operational alerts with user-facing communication. If there is a systemic issue (e.g., API key expiry), this could flood the user's phone with error messages.
**Suggestion:** Add a rate limit or de-duplication for error SMS notifications (e.g., suppress further error notifications within a 1-hour window). Alternatively, consider a separate notification channel for operational alerts.

---

### [P3] Follow-up dashboard hardcodes max follow-up count as `3`

**File:** `public/dashboard.html:2344`
**Issue:** The follow-up card rendering hardcodes `'/3'` for the maximum follow-up count. Meanwhile, the server defines this as `MAX_FOLLOW_UPS = 3` in `leads.ts` line 324. If the max is changed server-side, the dashboard will still display `/3`.
**Suggestion:** Expose `MAX_FOLLOW_UPS` through the `/api/stats` endpoint or include it in the `LeadApiResponse`.

---

### [P3] `completeApproval` return value unchecked in Twilio webhook handler

**File:** `src/twilio-webhook.ts:98`
**Issue:** The Twilio webhook calls `completeApproval(lead.id, "approved")` but does not check the return value. In contrast, the dashboard API handler checks and returns a 500 on failure. The SMS handler sends a success confirmation regardless of whether the database update succeeded.
**Suggestion:** Check the return value and send an error SMS if `completeApproval` returns `undefined`.

---

### [P3] In-memory `retryFailures` map in scheduler not bounded

**File:** `src/follow-up-scheduler.ts:9`
**Issue:** The `retryFailures` Map tracks consecutive failure counts per lead but entries are only cleaned up on success or max retries. If a lead keeps failing at count 2 then stops appearing in due queries, its entry remains indefinitely. Negligible at current scale.
**Suggestion:** At current scale, no action needed. If scaling to hundreds of leads, add periodic cleanup.

---

## Summary

| # | Issue | Priority | Why this order | Unblocks |
|---|-------|----------|---------------|----------|
| 1 | CSRF guard missing on existing API POST endpoints | P1 | Security gap — inconsistent protection | — |
| 2 | Duplicated `baseUrl()` utility | P2 | DRY violation across active modules | — |
| 3 | `follow-up-api.ts` imports `shapeLead` from peer `api.ts` | P2 | Peer coupling — extract to shared module | — |
| 4 | `leads.ts` SRP violation (700+ lines) | P2 | Structural debt worsening with each feature | — |
| 5 | Monolithic dashboard HTML (2,475 lines) | P2 | Maintenance burden approaching limits | — |
| 6 | Scheduler error SMS lacks rate limiting | P2 | Operational risk during systemic failures | — |
| 7 | Hardcoded max follow-up count in dashboard | P3 | Client/server sync point | — |
| 8 | `completeApproval` return unchecked in webhook | P3 | Silent failure sends false confirmation | — |
| 9 | Unbounded in-memory retry map | P3 | Negligible at current scale | — |

**Severity counts:** P1: 1 | P2: 5 | P3: 3
