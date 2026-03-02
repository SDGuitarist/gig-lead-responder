# Gig Lead Responder — Session Handoff

**Last updated:** 2026-03-02
**Current phase:** Work (Phase 3 complete, all 3 phases done)
**Branch:** `feat/follow-up-v2-dashboard`
**Next session:** Review phase

### Prior Phase Risk

> "Least confident about going into review? The scheduler's error handling after
> claimFollowUpForSending — if the claim succeeds but generateFollowUpDraft fails,
> the lead is stuck in sent status with no draft."

Phase 3 (dashboard) doesn't address this directly — it's a scheduler-level concern.
The dashboard does show `sent` leads with no draft as "Waiting to be scheduled" with
italic text, so Alex can see stuck leads and manually skip them. The review phase
should scrutinize whether the scheduler needs a recovery path for this edge case.

### Follow-Up Pipeline V2 — Phase 3 Work (2026-03-02)

**What was done:**

- Added `listFollowUpLeads()` in `src/leads.ts` — SQL query for active follow-ups sorted by action-needed first
- Wired `GET /api/leads?follow_up=active` in `src/api.ts`
- Added `X-Requested-With: dashboard` CSRF header to `apiPost()` in dashboard
- Made tab-nav scrollable for 5-tab mobile overflow (CSS)
- Added ~160 lines of follow-up card CSS: status labels, 44px tap targets, snooze presets, flash
- Added 5th "Follow-Ups" tab button and panel HTML
- Registered `panel-followups` in `ALL_PANELS` and `showTab()`
- Auto-scroll active tab into view on mobile
- Hash routing: `#follow-ups` opens the tab directly (for SMS notification links)
- Added `fmtTimestamp()` helper for ISO timestamp display
- Added ~180 lines of follow-up JS:
  - `loadFollowUps()` with generation counter for stale fetch discarding
  - `renderFollowUpCards()` with status labels, full draft display, empty state
  - Per-lead operation locks (`leadInFlight`) — disables ALL buttons per card
  - Event-delegated handlers for approve, skip, replied, snooze presets (1d/3d/1w)
  - 409 silent refresh (no error alert on conflict)
  - Flash timeout cancellation for rapid actions
  - Rate-limited visibilitychange refetch (30s minimum)
- Skipped `hasActiveInteraction()` guard — not needed with inline preset buttons (no dropdown to protect)
- Updated plan checkboxes: all 16 Phase 3 items marked complete

**Commits:**
1. `f7d9688` — feat(api): add follow_up=active filter for dashboard follow-ups tab
2. `99820b2` — feat(dashboard): add X-Requested-With CSRF header to apiPost
3. `269a339` — feat(dashboard): add scrollable tab-nav and follow-up card CSS
4. `7debb7d` — feat(dashboard): add Follow-Ups tab button, panel, and tab routing
5. `4bdb88e` — feat(dashboard): add Follow-Ups tab JavaScript
6. `456fb89` — docs: update plan checkboxes for Phase 3 complete

## Three Questions

1. **Hardest implementation decision in this session?** How to handle the `fmtDate` vs `fmtTimestamp` distinction. `fmtDate` appends `T12:00:00` to parse date-only strings — but `follow_up_due_at` and `snoozed_until` are full ISO timestamps. Using `fmtDate` on them would create invalid date strings. Added `fmtTimestamp()` that parses ISO directly. Small detail, but would have caused every status label to show raw ISO strings.

2. **What did you consider changing but left alone, and why?** Considered adding the `hasActiveInteraction()` guard from the plan. Left it out because the plan's simplified snooze UI uses inline preset buttons (1d/3d/1w), not a dropdown or date picker — there's no "open" interaction state to protect from re-renders. The per-lead lock already handles the button-disabling concern.

3. **Least confident about going into review?** The follow-up card rendering for edge cases: (a) a lead in `pending` status with no `follow_up_due_at` — shows "Waiting to be scheduled" which may be wrong if it's newly snoozed, and (b) whether the `follow_up_count` value is correct at display time (it's set during approve, so a `sent` lead shows the count *before* the pending approve increments it). The `#2/3` display might be off-by-one.

### Prompt for Next Session

```
Read docs/HANDOFF.md. Run /workflows:review for the feat/follow-up-v2-dashboard branch. Key risks: (1) scheduler stuck-in-sent recovery, (2) follow_up_count off-by-one in card display, (3) fmtTimestamp edge cases. Branch has 8 commits across 3 work phases.
```
