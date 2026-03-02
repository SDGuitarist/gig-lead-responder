---
title: "feat: Follow-Up Pipeline V2 — Dashboard-First"
type: feat
status: active
date: 2026-03-01
origin: docs/brainstorms/2026-03-01-follow-up-pipeline-v2-brainstorm.md
feed_forward:
  risk: "Mobile UX for the dashboard — tap targets, card layout, snooze date picker, 5-tab overflow"
  verify_first: true
---

# feat: Follow-Up Pipeline V2 — Dashboard-First

## Enhancement Summary

**Deepened on:** 2026-03-02
**Agents used:** 8 (TypeScript, Security, Frontend Races, Architecture, Performance,
Data Integrity, Simplicity, Best Practices Research)

### Key Improvements from Deepening

1. **CRITICAL: SameSite=Lax, not Strict** — Strict breaks iOS Safari home-screen
   bookmarks and SMS deep links. All 3 relevant agents (Architecture, Security,
   Best Practices) independently flagged this.
2. **CRITICAL: SQLite CHECK constraint table rebuild** — Cannot ALTER existing
   CHECK constraints. Production database needs a table rebuild migration to
   add `replied` status.
3. **Simplified scope (~250 lines cut)** — Removed 4-filter system (flat list
   instead), date picker (presets only), daily digest SMS, desktop table layout,
   and "Show more" toggle. Core value unchanged.
4. **Frontend race protection** — Per-lead operation locks (not per-button),
   snooze dropdown DOM protection, generation counters for stale fetches.
5. **Security hardening** — CSRF guard via custom header, rate limits on new
   endpoints, snooze date validation, security headers.
6. **Data integrity** — Terminal states clear all related fields, scheduler
   gets atomic claim for pending→sent, snoozed_until cleared on transitions.

### Scope Change: 4 Phases → 3 Phases

Daily digest SMS removed entirely (per-draft notifications already cover 1-5
leads). Phase 4 eliminated. Phases 1-3 are leaner.

---

## Prior Phase Risk

> **From brainstorm (2026-03-01):** "Least confident about mobile UX design for
> the dashboard — needs wireframes or component breakdown in the plan phase."

This plan addresses mobile UX by defining component layouts per breakpoint,
specifying tap target sizes, and solving the 5-tab overflow with scrollable
navigation. Simplified to cards-only layout (no separate desktop table).

## Overview

Add a mobile-responsive "Follow-Ups" tab to the existing dashboard that gives
Alex full visibility and control over the follow-up pipeline from his phone.
The dashboard replaces SMS as the primary control surface. Includes long-lived
auth for frictionless mobile access, per-lead action buttons (approve, skip,
snooze, client replied), and SMS notifications that point to the dashboard.

## Problem Statement / Motivation

V1 follow-up pipeline is working but has four friction points after real usage:

1. **Copy-pasting** — drafts arrive via SMS, must be manually pasted into platforms
2. **No visibility** — can't see which leads have pending follow-ups without the database
3. **Can't tell if they replied** — follow-ups might fire after a client already responded
4. **Timing is off** — fixed schedule doesn't match real conversation pace

The dashboard solves visibility + control. Manual "Client Replied" button
prevents embarrassing double-contacts without needing email parsing (deferred).
Snooze fixes timing. Long-lived auth makes the phone bookmark usable.

## Proposed Solution

### Updated State Machine

```
NULL ──completeApproval()──> pending
pending ──scheduler──> sent           (draft generated, notification SMS sent)
sent ──APPROVE (dashboard/SMS)──> pending   (count++, schedule next if count < 3)
sent ──APPROVE (dashboard/SMS)──> exhausted (3rd follow-up, terminal)
sent ──SNOOZE──> pending              (clear draft, set snoozed_until, push due_at)
pending ──SKIP──> skipped             (cancel all, clear due_at/draft/snoozed_until)
sent ──SKIP──> skipped                (cancel all, clear due_at/draft/snoozed_until)
pending ──CLIENT REPLIED──> replied   (new terminal, clear due_at/draft/snoozed_until)
sent ──CLIENT REPLIED──> replied      (new terminal, clear due_at/draft/snoozed_until)
```

New elements vs V1:
- `replied` status (new) — distinct from `skipped`, preserves signal for analytics
- `snoozed_until` column (new) — nullable timestamp, snooze is a virtual filter
  on `pending` leads where `snoozed_until > now()`
- SNOOZE transition from `sent` → `pending` — clears existing draft, pushes due_at
- **Terminal states (`replied`, `skipped`, `exhausted`) clear all related fields**
  (`follow_up_due_at`, `follow_up_draft`, `snoozed_until` → NULL)

### Schema Changes

```sql
-- New column (safe: nullable, no default needed)
ALTER TABLE leads ADD COLUMN snoozed_until TEXT;
```

**CRITICAL: SQLite CHECK constraint rebuild required.**

SQLite cannot ALTER existing CHECK constraints. The production database has
`follow_up_status CHECK(IN 'pending','sent','skipped','exhausted')` baked into
the schema. Adding `'replied'` requires a table rebuild migration:

```sql
-- Inside a transaction:
-- 1. CREATE TABLE leads_new (...) with updated CHECK including 'replied'
-- 2. INSERT INTO leads_new SELECT * FROM leads
-- 3. DROP TABLE leads
-- 4. ALTER TABLE leads_new RENAME TO leads
-- 5. Recreate all indexes
```

This is safe for a single-user system with a small table (<100 rows). Back up
the database file before running. Add a version marker so it runs only once.

### Dashboard Layout

**Simplified: flat list, no filters, cards only.**

At 1-5 active follow-ups, Alex can see everything on one screen. No filter
pills needed — leads are sorted by status (action-needed first, then scheduled,
then snoozed) with a subtle status label on each card.

Add filters later when volume justifies it (the `follow_up_status` column
already supports client-side filtering trivially).

**Single query to load all follow-up leads:**

```sql
SELECT * FROM leads
WHERE follow_up_status IS NOT NULL
  AND follow_up_status NOT IN ('skipped', 'exhausted', 'replied')
ORDER BY
  CASE follow_up_status WHEN 'sent' THEN 0 ELSE 1 END,
  follow_up_due_at ASC
```

**Card layout (all screen sizes):**

```
┌─────────────────────────────┐
│ Client Name          #2/3   │  ← name + follow-up count
│ Wedding · Mar 22 · Hilton   │  ← event type · date · venue
│ ● Action Needed             │  ← status label (color-coded)
│                             │
│ "I'd love to suggest a..."  │  ← full draft text (follow-ups are short)
│                             │
│ [Approve] [Skip] [Snooze ▾] │  ← action buttons (44px tall min)
│ [Client Replied]            │  ← secondary action
└─────────────────────────────┘
```

- Tap targets: minimum 44×44px (Apple HIG)
- **Snooze: inline preset buttons (1d, 3d, 1w) — no date picker, no dropdown**
  (follow-ups are short; Alex can re-snooze if needed)
- Show full draft text — follow-up messages are SMS-length (~160 chars), no
  truncation needed. For `pending` leads (no draft yet), show "Scheduled for
  [date]" instead.
- Empty state: "No follow-ups pending. Follow-ups are scheduled automatically
  when you approve an initial response."
- Cards work on both mobile and desktop (just get wider on larger screens)

**5-tab overflow solution:** Scrollable horizontal tab nav:

```css
.tab-nav {
  display: flex;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none; /* Firefox */
}
.tab-nav::-webkit-scrollbar { display: none; } /* Safari/Chrome */
.tab-btn { flex: 0 0 auto; white-space: nowrap; }
```

Auto-scroll active tab into view on load:

```js
document.querySelector('.tab-btn.active')
  ?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
```

### New API Endpoints

| Endpoint | Method | Body | Valid Source States | Effect |
|----------|--------|------|--------------------|--------|
| `/api/leads/:id/follow-up/approve` | POST | `{}` | `sent` | count++, schedule next or exhaust, clear snoozed_until |
| `/api/leads/:id/follow-up/skip` | POST | `{}` | `pending`, `sent` | → `skipped`, clear due_at/draft/snoozed_until |
| `/api/leads/:id/follow-up/snooze` | POST | `{ until: "ISO date" }` | `sent`, `pending` | → `pending`, set snoozed_until + due_at atomically |
| `/api/leads/:id/follow-up/replied` | POST | `{}` | `pending`, `sent` | → `replied`, clear due_at/draft/snoozed_until |

All endpoints:
- Protected by `sessionAuth` middleware (cookie-first, Basic Auth fallback)
- Protected by `followUpActionLimiter` (20 req/15min)
- Protected by `csrfGuard` (custom header `X-Requested-With: dashboard`)
- Return `{ success: true, lead: LeadApiResponse }` on success
- Return `409 Conflict` if lead is not in a valid source state (atomic claim)
- Use `UPDATE ... WHERE id = ? AND follow_up_status IN (?)` for atomic transitions

**Typed request/response** (in `src/types.ts`):

```typescript
export interface SnoozeRequestBody { until: string; }
export interface FollowUpActionSuccess { success: true; lead: LeadApiResponse; }
export interface FollowUpActionError { error: string; }
export type FollowUpActionResponse = FollowUpActionSuccess | FollowUpActionError;
```

**Snooze validation** (in endpoint handler):
- Must be valid ISO date string
- Must be in the future
- Must be within 90 days
- Return 400 with specific error message on failure

### Auth Changes

After successful Basic Auth, set a signed cookie:

```
Set-Cookie: session=<signed-value>;
  HttpOnly; Secure (production only); SameSite=Lax; Max-Age=7776000; Path=/
```

**`SameSite=Lax`** (not Strict). Strict breaks iOS Safari home-screen bookmarks
and SMS deep links — the browser treats both as cross-site navigations and
withholds the cookie. Lax sends the cookie on top-level GET navigations
(bookmark taps, SMS links) but blocks cross-origin POST (CSRF protection on
POST comes from the `csrfGuard` middleware instead).

**CSRF protection:** Custom header check on all POST endpoints:

```typescript
// csrfGuard middleware:
// Skip if authenticated via Basic Auth header (not auto-attached by browsers)
// For cookie-authenticated POSTs: require X-Requested-With: dashboard
// Dashboard JS adds this header to all apiPost() calls
```

**Cookie signing:** Use `COOKIE_SECRET` environment variable (set on Railway).
Falls back to random bytes in dev (sessions don't survive restarts in dev —
acceptable). HMAC-SHA256 via `crypto.createHmac`. Include issued-at timestamp
in payload for server-side expiry check.

**New dependency:** `cookie-parser` (for `req.signedCookies` or manual cookie
parsing). Install: `npm install cookie-parser && npm install -D @types/cookie-parser`

**Rename:** `basicAuth` → `sessionAuth` in `src/auth.ts` and update import in
`src/api.ts`. Clearer name for the new dual-mode middleware.

### SMS Notification Changes

**Scheduler behavior (unchanged):** Generate draft → transition to `sent` →
store `follow_up_draft` in DB.

**SMS change:** Instead of sending the full draft text, send a notification:

```
Follow-up #2 draft ready for [Client Name] ([Event Type]).
Review: BASE_URL/dashboard.html#follow-ups
```

**Daily digest: REMOVED.** Per-draft SMS notifications already cover the 1-5
lead volume. Each follow-up generates its own notification when the draft is
ready. A daily digest would add timezone logic, in-memory tracking, and a
known deploy-double-send bug — all for redundant information.

**V1 SMS commands (SEND/SKIP) kept as fallback.** Refactor `handleFollowUpSend()`
and `handleFollowUpSkip()` in `twilio-webhook.ts` to call the new shared atomic
claim functions (`approveFollowUp`, `skipFollowUp`) instead of doing direct
`updateLead()` calls. This unifies both control surfaces through the same code
path — fulfilling the "no divergence" goal.

### Security Hardening

**Security headers** (in `src/server.ts`, before routes):

```typescript
app.use((_req, res, next) => {
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'; " +
    "style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'");
  next();
});
```

Note: `'unsafe-inline'` needed because dashboard uses inline `<script>` and
`<style>` blocks.

**Rate limiting:** Add `followUpActionLimiter` (20 req/15min) in
`src/rate-limit.ts`, applied to all 4 new endpoints.

### Frontend Race Condition Mitigations

**1. Per-lead operation lock (not per-button):**

When any action fires on a lead, disable ALL action buttons for that lead.
Prevents cross-button races (e.g., tapping Approve then Skip on same lead).

```js
var leadInFlight = {}; // keyed by lead ID

function followUpAction(leadId, action, btn, body) {
  if (leadInFlight[leadId]) return;
  leadInFlight[leadId] = true;
  // Disable ALL buttons for this lead via data-attributes
  // Re-enable on .finally() via re-render
}
```

**2. Protect snooze UI from re-renders:**

Check `hasActiveInteraction()` before re-rendering. If a snooze popover is
open or date input focused, defer the re-render until the interaction completes.

**3. Separate data arrays:**

```js
var currentLeads = [];    // Leads tab data
var followUpLeads = [];   // Follow-Ups tab data
```

Prevents tab-switching from overwriting data.

**4. Generation counter for stale fetches:**

```js
var followUpRequestGeneration = 0;
function loadFollowUps() {
  var gen = ++followUpRequestGeneration;
  apiFetch('/api/leads?follow_up=active').then(function(leads) {
    if (gen !== followUpRequestGeneration) return; // stale, discard
    followUpLeads = leads;
    renderFollowUpCards(leads);
  });
}
```

**5. Handle 409 as "refresh needed" (not error alert):**

```js
.catch(function(err) {
  if (err.message.indexOf('409') !== -1) {
    loadFollowUps(); // silently refresh
  } else {
    alert(action + ' failed: ' + err.message);
  }
})
```

**6. Re-fetch on tab visibility return:**

Add rate-limited refetch (30s minimum interval) in `visibilitychange` handler
so Alex sees fresh data when returning to the dashboard.

**7. Flash timeout cancellation:**

Clear previous `setTimeout` before re-showing success flash to prevent flicker
on rapid actions.

### Institutional Learnings Applied

| Pattern | Where Applied |
|---------|---------------|
| #1 Atomic claim | All 4 follow-up endpoints + scheduler pending→sent + refactored SMS handlers |
| #5 Reentrancy guard | Per-lead operation lock (elevates per-button to per-lead) |
| #4 Targeted DOM toggle | `data-detail="leadId"` on expandable cards, no full re-render |
| #10 `today` as parameter | Snooze date calculations, server-side cookie expiry check |

### Concurrency: Scheduler vs Dashboard

**Risk:** Scheduler processes a lead while Alex acts on it from the dashboard.
Window is 5-10 seconds during Claude API call.

**Mitigation (strengthened from original plan):**

1. **Scheduler gets its own atomic claim** for pending→sent:
   ```sql
   UPDATE leads SET follow_up_status = 'sent', ...
   WHERE id = ? AND follow_up_status = 'pending'
     AND (snoozed_until IS NULL OR snoozed_until <= datetime('now'))
   ```
   If Alex snoozed the lead mid-flight, the scheduler's claim fails silently
   because `snoozed_until > now()`. No snooze-lost race.

2. **All state transitions use atomic claims** — dashboard, SMS, and scheduler
   all go through the same claim functions in `leads.ts`.

3. **Dashboard handles 409 as silent refresh** — not an error alert.

**Accepted risk at current volume (1-5 active leads).** Console warning when
scheduler detects a mid-flight status change. Re-evaluate if volume grows.

## Technical Considerations

- **Architecture:** New file `src/follow-up-api.ts` for the 4 follow-up endpoints
  (keeps `api.ts` from growing past 400 lines). Export `shapeLead` from `api.ts`.
  Everything else extends existing files.
- **Performance:** No new indexes needed. All queries finish in <1ms at current
  volume. Single `updateLead()` call for multi-field updates (atomic).
- **Security:** Cookie auth with `HttpOnly; Secure; SameSite=Lax` + CSRF guard
  via custom header. Rate limits on all new endpoints. Security headers.

## System-Wide Impact

- **Interaction graph:** Dashboard approve → `approveFollowUp()` in `leads.ts` →
  `scheduleFollowUp()` → scheduler picks up next cycle. SMS SEND → same
  `approveFollowUp()` function. Both paths converge on the same atomic claim.
- **Error propagation:** API errors return JSON `{ error: "..." }`. Dashboard
  shows inline flash for success, silent refresh for 409, alert for real errors.
- **State lifecycle risks:** Terminal states (`replied`, `skipped`, `exhausted`)
  atomically clear `follow_up_due_at`, `follow_up_draft`, and `snoozed_until`.
  No orphaned scheduling fields.
- **API surface parity:** Dashboard and SMS both call the same atomic claim
  functions. Refactor SMS handlers in Phase 2 to enforce this.

## Acceptance Criteria

- [ ] Long-lived cookie auth — phone bookmark opens without re-login
- [ ] `SameSite=Lax` cookie works on iOS Safari home-screen bookmark
- [ ] CSRF guard blocks cross-origin POSTs
- [ ] "Follow-Ups" tab visible on dashboard with flat lead list
- [ ] Mobile-responsive cards with 44px+ tap targets
- [ ] Approve button: increments count, schedules next or exhausts
- [ ] Skip button: cancels all remaining follow-ups, clears related fields
- [ ] Snooze: inline preset buttons (1d/3d/1w), pushes `due_at`
- [ ] Snooze validation: future date, max 90 days
- [ ] "Client Replied" button: transitions to `replied`, clears related fields
- [ ] All actions use atomic claims (no double-sends on concurrent access)
- [ ] Per-lead operation locks on all button handlers
- [ ] SMS notifications point to dashboard URL (not full draft text)
- [ ] V1 SMS SEND/SKIP commands still work (refactored through shared functions)
- [ ] Empty state message when no follow-ups pending
- [ ] 5-tab nav scrollable on 375px mobile screen
- [ ] Rate limits on all new endpoints
- [ ] Security headers set (CSP, X-Frame-Options, X-Content-Type-Options)
- [ ] SQLite CHECK constraint rebuilt for `replied` status

## Success Metrics

- Alex manages follow-ups from phone (not SMS-only)
- Zero embarrassing double-contacts (Client Replied prevents them)
- Follow-up timing matches conversation pace (snooze enables this)

## Dependencies & Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| iOS Safari cookie quirks with Lax | Low | High | Test on real iPhone in Phase 1 before building UI |
| SQLite table rebuild migration | Low | Critical | Back up DB file first, wrap in transaction, test on copy |
| Scheduler race with dashboard | Low (5-10s window) | Medium | Atomic claims on ALL transitions including scheduler |
| snoozed_until / due_at drift | Low | Medium | Single `snoozeFollowUp()` sets both atomically, never separately |

## Implementation Phases

### Phase 1: Auth + Schema + Types (foundation)

**Files:** `src/auth.ts`, `src/types.ts`, `src/leads.ts`, `src/api.ts`,
`src/server.ts`, `src/rate-limit.ts`

1. ~~Add `replied` to `FOLLOW_UP_STATUSES` in `src/types.ts`~~ ✅
2. ~~Add `snoozed_until: string | null` to `LeadRecord` and `LeadApiResponse`~~ ✅
3. ~~Add `SnoozeRequestBody` and `FollowUpActionResponse` types~~ ✅
4. ~~**Table rebuild migration** in `src/leads.ts` — recreate leads table with
   updated CHECK constraint including `replied` (wrap in transaction, run once)~~ ✅
5. ~~Add `snoozed_until TEXT` column migration (standard ALTER TABLE ADD COLUMN)~~ ✅
6. ~~Add `snoozed_until` to `UPDATE_ALLOWED_COLUMNS` and `shapeLead()`~~ ✅
7. ~~Install `cookie-parser`, implement `sessionAuth` in `src/auth.ts`~~ ✅
   - HMAC-SHA256 signed cookie with `COOKIE_SECRET` env var
   - Cookie: HttpOnly, Secure (prod only), SameSite=Lax, 90-day maxAge
   - Middleware: check cookie first → fallback to Basic Auth
   - `csrfGuard` middleware for POST endpoints
8. ~~Rename `basicAuth` → `sessionAuth`, update import in `src/api.ts`~~ ✅
9. ~~Add security headers middleware in `src/server.ts`~~ ✅
10. ~~Add `followUpActionLimiter` in `src/rate-limit.ts`~~ ✅
11. **Test cookie on real iPhone** (home-screen bookmark + SMS link) — deferred to after deploy

### Phase 2: Follow-Up API Endpoints + SMS Refactor

**Files:** `src/follow-up-api.ts` (new), `src/leads.ts`, `src/api.ts`,
`src/twilio-webhook.ts`, `src/follow-up-scheduler.ts`

1. Add atomic claim functions in `src/leads.ts`:
   - `approveFollowUp(leadId)` — in `runTransaction`: read count, UPDATE WHERE
     status='sent', count++, clear snoozed_until, schedule next or exhaust
   - `skipFollowUp(leadId)` — UPDATE WHERE status IN ('pending','sent'),
     clear due_at/draft/snoozed_until
   - `snoozeFollowUp(leadId, until)` — UPDATE WHERE status IN ('sent','pending'),
     set BOTH snoozed_until AND due_at atomically (enforce invariant:
     snoozed_until ≤ due_at)
   - `markClientReplied(leadId)` — UPDATE WHERE status IN ('pending','sent'),
     clear due_at/draft/snoozed_until
   - `claimFollowUpForSending(leadId)` — scheduler's atomic claim for
     pending→sent, with `snoozed_until IS NULL OR snoozed_until <= now` guard
   - All return `LeadRecord | undefined` (undefined = claim failed)
2. Create `src/follow-up-api.ts` with 4 POST endpoints
   - Export `shapeLead` from `src/api.ts` for use here
   - Wire rate limiter + CSRF guard to each endpoint
   - Snooze endpoint: validate ISO date, future, max 90 days
3. **Refactor SMS handlers** in `src/twilio-webhook.ts`:
   - `handleFollowUpSend()` → call `approveFollowUp(lead.id)`
   - `handleFollowUpSkip()` → call `skipFollowUp(lead.id)`
4. **Update scheduler** in `src/follow-up-scheduler.ts`:
   - Use `claimFollowUpForSending()` instead of direct `updateLead()`
   - Clear `snoozed_until` when processing a lead
   - Change SMS from full draft to notification with dashboard link
5. Mount follow-up router in `src/server.ts`

### Phase 3: Dashboard Follow-Ups Tab

**Files:** `public/dashboard.html`

1. Add "Follow-Ups" tab to `.tab-nav` (5th tab)
2. Scrollable horizontal nav CSS (overflow-x: auto, flex-shrink: 0)
3. Auto-scroll active tab into view
4. Add follow-up tab panel with flat card list (no filters)
5. Render follow-up cards — status label, full draft, action buttons
6. **Per-lead operation locks** via `leadInFlight` object
7. `hasActiveInteraction()` guard to protect snooze UI from re-renders
8. Separate `followUpLeads` array from `currentLeads`
9. Generation counter for stale fetch responses
10. Snooze: inline preset buttons (1d, 3d, 1w) — no dropdown, no date picker
11. Handle 409 as silent refresh
12. Re-fetch on `visibilitychange` with 30s rate limit
13. Flash timeout cancellation for rapid actions
14. Action buttons: `X-Requested-With: dashboard` header on all POST fetches
15. Empty state message
16. Register tab in `ALL_PANELS` and `showTab()`

## Sources & References

### Origin

- **Brainstorm:** [docs/brainstorms/2026-03-01-follow-up-pipeline-v2-brainstorm.md](docs/brainstorms/2026-03-01-follow-up-pipeline-v2-brainstorm.md)
  — Dashboard-First approach chosen over Reply Detection First and Full V2

### Internal References

- V1 architecture: `docs/solutions/architecture/follow-up-pipeline-human-in-the-loop-lifecycle.md`
- Atomic claims: `docs/solutions/architecture/atomic-claim-for-concurrent-state-transitions.md`
- Reentrancy guards: `docs/solutions/logic-errors/rate-limiting-race-condition-and-cleanup.md`
- DOM toggle pattern: `docs/solutions/ui-bugs/targeted-dom-toggle-data-attributes.md`
- Follow-up state machine: `src/leads.ts:251-260`
- Dashboard UI: `public/dashboard.html`
- Auth middleware: `src/auth.ts`
- Scheduler: `src/follow-up-scheduler.ts`

### Deepening Agents Applied

| Agent | Key Finding |
|-------|-------------|
| Architecture Strategist | SameSite=Lax, unify SMS handlers through shared functions, persist digest state |
| Data Integrity Guardian | CHECK constraint rebuild, snoozed_until clearing, terminal state cleanup |
| TypeScript Reviewer | Typed request/response, function signatures, extract follow-up-api.ts |
| Frontend Races Reviewer | Per-lead locks, snooze DOM protection, generation counters, separate arrays |
| Security Sentinel | CSRF guard, rate limits, snooze validation, security headers |
| Code Simplicity Reviewer | Cut filters, date picker, daily digest, desktop table (~250 LOC saved) |
| Performance Oracle | No perf concerns at scale, single updateLead() for atomicity |
| Best Practices Researcher | SameSite=Lax for PWA, cookie-parser signed cookies, native date input, scrollable tabs |

## Three Questions

1. **Hardest decision in this session?** Balancing the simplicity reviewer's
   cuts against the other agents' hardening recommendations. The simplicity
   reviewer wanted to cut filters, date picker, digest, and desktop table
   (~250 lines). The security reviewer wanted to ADD CSRF guards, rate limits,
   and validation. The right answer: cut UI complexity (simplicity wins) but
   keep backend hardening (security wins). The plan is now simpler on the
   surface but more robust underneath.

2. **What did you reject, and why?** Rejected keeping `SameSite=Strict` —
   3 independent agents flagged that it breaks iOS Safari home-screen bookmarks
   and SMS deep links. Also rejected the daily digest SMS — the simplicity
   reviewer correctly identified that per-draft notifications already cover
   the 1-5 lead volume, and the digest added timezone logic + deploy bugs for
   redundant information.

3. **Least confident about going into the next phase?** The SQLite table
   rebuild migration for the CHECK constraint. It's a known safe pattern for
   small tables, but it's the only destructive database operation in the plan.
   Must back up the DB file and test on a copy before running in production.

## Feed-Forward

- **Hardest decision:** Balancing simplicity cuts with security hardening
- **Rejected alternatives:** SameSite=Strict (breaks iOS), daily digest (redundant)
- **Least confident:** SQLite table rebuild migration for CHECK constraint — test on DB copy first
