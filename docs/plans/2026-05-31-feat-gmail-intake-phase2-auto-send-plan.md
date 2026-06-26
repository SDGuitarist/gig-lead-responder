---
title: "Gmail Intake Phase 2: Enable Auto-Send + Dashboard done_reason"
type: feat
status: completed
date: 2026-05-31
predecessor: docs/plans/2026-05-22-feat-p3-batch-gmail-intake-plan.md
feed_forward:
  risk: "Flipping AUTO_SEND_ENABLED=true is a one-way operational change.
         If auto-sent replies have quality issues, leads receive bad responses
         before Alex sees them. The review-only monitoring period should
         confirm draft quality before flipping."
  verify_first: false
---

# Gmail Intake Phase 2: Enable Auto-Send + Dashboard done_reason

**Baseline:** 293 tests passing, branch `main`, Phase 1 deployed

## Enhancement Summary

**Deepened on:** 2026-05-31
**Research agents used:** 6 (Security sentinel, Spec flow analyzer, Code
verifier, Follow-up scheduler, Dashboard renderer, Deploy safety) + Codex
plan review (9 findings: 4 P1, 4 P2, 1 P3 — all resolved)

### Key Improvements Found

1. **P0: Auto-sent leads skip follow-up scheduling.** The orchestrator's
   auto-send path calls `updateLead()` directly instead of `completeApproval()`,
   which atomically schedules follow-ups. Auto-sent leads get no follow-ups
   unless explicitly added. (Spec flow analyzer)
2. **P1: Mobile card rendering missing.** Plan only covered desktop table row
   and detail panel. `buildMobileCard()` (line 642) also needs done_reason
   label — Alex checks the dashboard from his phone after SMS notifications.
   (Spec flow analyzer)
3. **P1: No startup log for AUTO_SEND_ENABLED.** Railway env var staleness is a
   documented pitfall. Without a startup log, a stale env var silently keeps
   the system in review-only mode. (Spec flow analyzer + MEMORY.md)
4. **P2: CSS needs overflow protection.** `.done-reason` has no `overflow-wrap`
   — unknown future done_reason values could break layout. (Spec flow analyzer)
5. **P2: Guard done_reason display on terminal statuses.** A bug could produce
   done_reason on a "received" lead — rendering should guard against this.
   (Spec flow analyzer)
6. **P3 (resolved by Codex review): formatDoneReason() escaping contract.**
   Initial plan put esc() inside the function; Codex flagged double-escaping
   risk. Fixed: escape at interpolation site per project convention.

### Confirmed Safe

- done_reason is server-generated (no user input) — safe to expose in API
- XSS mitigated by existing esc() pattern
- Auto-send path protected by SPF/DKIM + 7 router hold checks + dryRun default
- All plan assumptions verified against codebase (line numbers confirmed)

---

### Prior Phase Risk

> "The SPF/DKIM mandatory-reject tradeoff. If Gmail ever omits the
> Authentication-Results header for a legitimate inbox message, the lead is
> silently lost."

**How this plan addresses it:** Phase 2 does not change SPF/DKIM behavior.
The `/health` rejection counter has been at 0 since deploy — no legitimate
emails rejected. Risk accepted and monitored.

---

## What is changing

1. **`src/types.ts`** — add `done_reason: string | null` to `LeadApiResponse`
2. **`src/utils/shape-lead.ts`** — add `done_reason: lead.done_reason` to
   `shapeLead()` return object
3. **`public/dashboard.html`** — render `done_reason` as a subtle label on
   lead cards (detail panel + table row + mobile card)
4. **`src/automation/orchestrator.ts`** — use `completeApproval()` for auto-send
   (transactional status + follow-up scheduling)
5. **`src/automation/poller.ts`** — add `autoSendEnabled` to existing startup log
6. **Railway env var** — set `AUTO_SEND_ENABLED=true` (deployment config,
   not code change — done AFTER code deploys)

## What must NOT change

- Existing 293 tests all pass
- Lead status values (`received`, `sending`, `sent`, `done`, `failed`)
- Dashboard filter model (pending/sent/done/failed tabs)
- Follow-up scheduler behavior (auto-sent leads enter the existing lifecycle
  via `completeApproval()` — the scheduler itself is not modified)
- SMS notification behavior
- Hold path logic in orchestrator (flagged_concerns, cross-family, etc.)
- `dispatchReply()` behavior (already tested in Phase 1)
- `completeApproval()` behavior for manual approvals (unchanged)
- No new npm dependencies
- No schema/migration changes (column already exists)

---

## Implementation Steps

### Step 1: Add done_reason to API response

**`src/types.ts`** — add to `LeadApiResponse` (after `snoozed_until` at line 337):
```ts
done_reason: string | null;
```

**`src/utils/shape-lead.ts`** — add to `shapeLead()` return (after `snoozed_until` at line 70):
```ts
done_reason: lead.done_reason ?? null,
```

**Test:** Add a test in the appropriate test file verifying `shapeLead()` returns
`done_reason` when set and `null` when unset.

### Step 2: Render done_reason on dashboard

**`public/dashboard.html`** — four changes:

**2a. Detail panel** (in `renderDetailPanel`, line 478):
Show full raw `done_reason` after the gut check bar (line ~512), before the
draft grid. Use the shared `shouldShowDoneReason(l)` guard. The detail panel
shows full provenance (e.g., "review-only: would-auto-send via gigsalad") —
the table/mobile rows show the abbreviated label.

Note: `renderDetailPanel` has an early return for error-state leads at
line 480. The done_reason rendering goes AFTER that check, so error leads
show their error banner instead. This is correct — the error_message is
more informative than done_reason "pipeline_error".

```js
if (shouldShowDoneReason(l)) {
  html += '<div class="done-reason-detail">' + esc(l.done_reason) + '</div>';
}
```

**2b. Shared guard helper** — extract a `shouldShowDoneReason(l)` function
used by all three rendering locations (detail, table, mobile):

```js
function shouldShowDoneReason(l) {
  return l.done_reason && (l.status === 'done' || l.status === 'failed' || l.status === 'sent');
}
```

**2c. Desktop table row** (in `buildTableRow`, line 612):
At line 630, after `outcomeBadgeHTML(l)`, append the done_reason label
only when the guard passes:

```js
var reasonLabel = shouldShowDoneReason(l) ? formatDoneReason(l.done_reason) : '';
// ... in the template:
'<td><span class="status-badge ' + st.css + '">' + st.label + '</span>'
  + outcomeBadgeHTML(l)
  + (reasonLabel ? '<span class="done-reason-badge">' + esc(reasonLabel) + '</span>' : '')
  + '</td>' +
```

**2d. Mobile card** (in `buildMobileCard`, line 642):
At line 655, after `outcomeBadgeHTML(l)`, same pattern with same guard:

```js
var reasonLabel = shouldShowDoneReason(l) ? formatDoneReason(l.done_reason) : '';
// ... in the template:
+ outcomeBadgeHTML(l)
+ (reasonLabel ? '<span class="done-reason-badge">' + esc(reasonLabel) + '</span>' : '')
```

Alex checks the dashboard from his phone after SMS notifications — mobile
must show the distinction between auto-sent and approved leads.

**2d. CSS** (in `public/dashboard.css`):
Follow the existing `.nudge-badge` pattern (lines 762-772) for consistency:

```css
.done-reason-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 600;
  background: #f0ece5;
  color: #8a7e6d;
  margin-left: 6px;
  white-space: nowrap;
  overflow-wrap: break-word;
}
```

For the detail panel's full raw string, use a simpler block style:
```css
.done-reason-detail {
  font-size: 0.75rem;
  color: #8a7e6d;
  margin-top: 0.25rem;
  overflow-wrap: break-word;
  max-width: 100%;
}
```

**Display mapping** (derive label from done_reason value):

| done_reason value | Display label |
|-------------------|---------------|
| `"auto-sent via gigsalad"` | auto-sent |
| `"review-only: would-auto-send via gigsalad"` | review-only |
| `"approved"` | approved (SMS) |
| `"approved_dashboard"` | approved |
| `"max_edits"` | max edits |
| `"pipeline_error"` | error |
| `null` | _(nothing)_ |

Implementation: a small `formatDoneReason()` helper that extracts the short
label from the full done_reason string. Returns **raw text** (not HTML) —
callers wrap in `esc()` at interpolation per
`docs/solutions/architecture/escape-at-interpolation-site.md`:

```js
function formatDoneReason(reason) {
  if (!reason) return '';
  if (reason.startsWith('auto-sent')) return 'auto-sent';
  if (reason.startsWith('review-only')) return 'review-only';
  if (reason === 'approved_dashboard') return 'approved';
  if (reason === 'approved') return 'approved (SMS)';
  if (reason === 'max_edits') return 'max edits';
  if (reason === 'pipeline_error') return 'error';
  return reason; // fallback: raw string — caller escapes via esc()
}
```

**Escaping contract:** `formatDoneReason()` returns raw text. Every
interpolation site wraps in `esc()`: `esc(reasonLabel)`. This follows the
project's escape-at-interpolation-site pattern and avoids double-escaping.

### Step 3: Use completeApproval() for auto-sent leads

**`src/automation/orchestrator.ts`** — in `handleAutoSendDecision()`, replace
the `updateLead()` call on successful auto-send with `completeApproval()`.
This gives auto-sent leads the same transactional treatment as manually
approved leads: atomic status + done_reason + follow-up scheduling.

`completeApproval()` (`src/db/follow-ups.ts:187-202`) wraps `updateLead` +
`scheduleFollowUp` in `runTransaction()`. No atomicity gap, no crash window.

**Add `completeApproval` to `AutoSendDeps`:**

```ts
// In AutoSendDeps interface:
completeApproval: (leadId: number, doneReason: string, smsSentAt?: string) => LeadRecord | undefined;
```

**Replace the auto-send success block:**

```ts
// OLD:
if (sendResult.status === "sent") {
  deps.updateLead(leadId, { status: "done", done_reason: `auto-sent via ${platform}`, sms_sent_at: new Date().toISOString() });
}

// NEW:
if (sendResult.status === "sent") {
  deps.completeApproval(leadId, `auto-sent via ${platform}`, new Date().toISOString());
}
```

Import `completeApproval` from `../db/follow-ups.js` and add it to the
default `deps` object.

**Update orchestrator tests:** Assert `completeApproval` is called with
`"auto-sent via gigsalad"` and a timestamp when auto-send succeeds.

**Why `completeApproval` not separate calls:** `computeFollowUpDelay` is not
exported from `follow-ups.ts`, and even if it were, calling `updateLead` +
`scheduleFollowUp` separately creates an atomicity gap that `completeApproval`
already solves via `runTransaction()`.

**Follow-up scheduler behavior unchanged:** The scheduler
(`src/follow-up-scheduler.ts`) queries `follow_up_status = 'pending'` leads.
Auto-sent leads now enter the existing follow-up lifecycle — the scheduler
itself is not modified.

### Step 4: Add autoSendEnabled to poller startup log

**`src/automation/poller.ts`** — at line 125, the poller already logs:
```ts
console.log(`[gmail-poller] Started (${mode}, every ${config.pollIntervalMs / 1000}s)`);
```

Extend this to include auto-send mode:
```ts
const mode = config.dryRun ? "DRY RUN" : "LIVE";
const sendMode = config.autoSendEnabled ? "auto-send ENABLED" : "review-only";
console.log(`[gmail-poller] Started (${mode}, ${sendMode}, every ${config.pollIntervalMs / 1000}s)`);
```

This uses the `config` variable that already exists in `startGmailPoller()`
(loaded at line 39 via `loadConfig()`). No new imports needed.

**Railway env var staleness pitfall** (MEMORY.md): After deploy, check
Railway deploy logs for this line. If it says "review-only" when you set
`AUTO_SEND_ENABLED=true`, the var is stale — delete and re-add it.

### Step 5: Deploy code + flip env var

1. Push code changes (steps 1-2)
2. Wait for Railway deploy to succeed + healthcheck passing
3. Set `AUTO_SEND_ENABLED=true` on Railway dashboard
4. Trigger a redeploy (Railway picks up env var changes on next deploy)
5. Monitor first few auto-sent leads via SMS notifications + dashboard

**Step 3 is NOT a code change** — it's an operational action after deploy.
The code deploys with `autoSendEnabled` still defaulting to `false` until
the env var is explicitly set.

---

## Acceptance Tests

### API Response

```
WHEN the /api/leads endpoint returns a lead with done_reason set
THE SYSTEM SHALL include done_reason in the LeadApiResponse JSON

WHEN a lead has no done_reason (null in DB)
THE SYSTEM SHALL return done_reason: null in the API response
```

### Dashboard Rendering

```
WHEN a lead card has done_reason "auto-sent via gigsalad"
THE SYSTEM SHALL display "auto-sent" as a subtle label on desktop row,
  mobile card, AND full raw value in the detail panel

WHEN a lead card has done_reason "review-only: would-auto-send via gigsalad"
THE SYSTEM SHALL display "review-only" as a subtle label

WHEN a lead card has done_reason null
THE SYSTEM SHALL display no done_reason label

WHEN a lead has done_reason set but status is "received"
THE SYSTEM SHALL NOT display the done_reason label (terminal status guard)

WHEN done_reason contains XSS payload like "<script>alert(1)</script>"
THE SYSTEM SHALL escape it via esc() at the interpolation site
```

### Auto-Send Behavior (already implemented in Phase 1)

```
WHEN AUTO_SEND_ENABLED=true AND the router returns action "auto-send"
THE SYSTEM SHALL call dispatchReply() and store status "done"
  with done_reason "auto-sent via {platform}"

WHEN AUTO_SEND_ENABLED=true AND the router returns action "auto-send"
  AND dispatchReply succeeds
THE SYSTEM SHALL schedule a follow-up for the lead (same as manual approval)

WHEN AUTO_SEND_ENABLED=true AND the router returns action "hold"
THE SYSTEM SHALL store status "sent" with no done_reason (unchanged)

WHEN AUTO_SEND_ENABLED=false (default)
THE SYSTEM SHALL behave as Phase 1 review-only mode (unchanged)
```

### Startup / Operational

```
WHEN the server starts
THE SYSTEM SHALL log the actual AUTO_SEND_ENABLED value to console
  so deploy logs confirm the config
```

### Transition

```
WHEN AUTO_SEND_ENABLED is flipped from false to true
THE SYSTEM SHALL only affect NEW leads processed after the flip

WHEN existing leads have done_reason "review-only: would-auto-send"
THE SYSTEM SHALL continue showing them as "Sent" status on the dashboard
  until manually approved
```

**Test strategy:**

1. **`shapeLead()` test:** Verify `done_reason` is returned when set, `null` when unset
2. **`formatDoneReason()` test:** Mirror the browser helper in TypeScript (same
   pattern as `xss-escape.test.ts`). Test all 6 known values + null + unknown fallback.
3. **`shouldShowDoneReason()` test:** Verify guard returns false for "received" status
   with done_reason set, true for "done"/"failed"/"sent" with done_reason set.
4. **Orchestrator test:** Update `handleAutoSendDecision` tests to assert
   `completeApproval` is called with `"auto-sent via gigsalad"` and a timestamp
   when auto-send succeeds (via injected `deps.completeApproval` spy).
5. **XSS test:** Add a case for done_reason with `<script>` payload → escaped output.

**Verification:**
- `npm test` — all tests pass
- Manual: load dashboard, verify done_reason labels render on existing leads
- Manual: after env var flip, check Railway logs + dashboard for first auto-sent lead

---

## How we will know it worked

- All 293+ existing tests pass
- New tests verify `shapeLead()` includes `done_reason`
- Dashboard shows done_reason labels on lead cards (visual verification)
- After `AUTO_SEND_ENABLED=true`: first auto-sent lead appears with
  status "done" and done_reason "auto-sent via {platform}"
- Railway deploy logs show `[gmail-poller] Started (LIVE, auto-send ENABLED, ...)`
- Successful auto-sends do NOT trigger SMS (only failures do) — verify
  via dashboard/API state, not SMS

## The most likely way this plan is wrong

**Dashboard rendering of unknown done_reason values.** The
`formatDoneReason()` helper uses prefix matching on free-text values. If a
new done_reason is added without updating the helper, the fallback shows
the raw string (escaped at interpolation). This is safe but could look odd.
The real fix would be an enum, but done_reason is already free-text in the
DB and changing it is a separate migration concern.

**Secondary risk:** The env var flip is irreversible in practice — once
auto-send is on, leads get dispatched immediately. If draft quality is
poor, Alex receives complaints before seeing the draft. The rollback
procedure (set `AUTO_SEND_ENABLED=false` + redeploy) has a 30-60 second
window during which 1-2 more leads could auto-send. The mitigation is
monitoring the first 5-10 auto-sent leads before walking away.

---

## Feed-Forward

- **Hardest decision:** Whether to normalize done_reason into an enum or
  keep it as free text. Kept as free text because the column already exists
  as TEXT, 6 different values are already written across the codebase, and
  an enum migration would be a separate concern with no immediate benefit.
- **Rejected alternatives:** (1) Adding a `done_reason` column to the
  dashboard filter tabs — unnecessary complexity, the existing tabs cover
  the primary workflow. (2) A "transition mode" that auto-sends some leads
  and holds others — overengineered, the review-only period serves this
  purpose.
- **Least confident:** The env var flip timing. How many review-only leads
  should Alex monitor before flipping? The plan says "after monitoring"
  but doesn't define a threshold. This is an operational judgment call,
  not a code decision.

## Three Questions

1. **Hardest decision in this session?** Whether `formatDoneReason()` should
   live in dashboard.html or in a shared utility. Chose dashboard.html because
   it's a display-only concern — the API returns the raw value, the dashboard
   formats it. No other consumer needs formatted done_reason labels.

2. **What did you reject, and why?** Adding done_reason to the filter model
   (a new tab or filter pill for "auto-sent" vs "review-only"). The existing
   tabs (Sent, Done) already cover the primary workflow. A new filter adds
   UI complexity for a distinction that only matters during the transition
   period.

3. **Least confident about going into the next phase?** The env var flip is
   operationally irreversible — once leads auto-send, they're sent. The code
   is correct (tested in Phase 1), but draft quality in production hasn't
   been validated at scale. Recommend: flip, monitor 5-10 auto-sent leads,
   then walk away.
