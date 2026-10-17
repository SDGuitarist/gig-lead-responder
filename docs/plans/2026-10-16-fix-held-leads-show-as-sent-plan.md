# Plan: a held lead says it is held, and says why (todo 097)

**Date:** 2026-10-16 | **Branch:** `feat/hub-phase0` | **Phase:** Plan | **Todo:** `todos/097-pending-p2-held-leads-display-as-sent-and-hold-reasons-are-not-stored.md`
**Alex's decision (AskUserQuestion, 2026-10-16):** "Keep 'sent', add a Held badge + reason". Not a new status.

## Feed-Forward

- **Hardest decision:** keep the stored status `sent` and add a reason column, instead of a new `held` status.
- **Rejected:** a new `held` status. The `leads.status` column has a CHECK rule (`migrate.ts:48`, rebuilt at `:161`), so it needs a table-rebuild migration, and `status === 'sent'` is read in about 8 dashboard places plus `api.ts:44` (VALID_STATUSES), `queries.ts:288` (stats) and the approve route.
- **Least confident about:** whether `hold_reason` alone is the right "is held" signal. Leads held before this change have no reason and will still read "Sent". Accepted: the ramp starts after this ships.

### Prior Phase Risk
The previous work (Yelp parser loop) listed this exact gap as todo 097, "found by Codex plan review round 1, read from the code only, not verified on a running dashboard". This plan treats that as unverified until the check in Acceptance 5 is done.

## 1. What exactly is changing

1. `src/db/migrate.ts`: add column `hold_reason TEXT` to the `migrations` list (the simple `ALTER TABLE ... ADD COLUMN` loop at line 85 to 101; no table rebuild).
2. `src/types.ts`: `LeadRecord.hold_reason: string | null`; `LeadApiResponse.hold_reason: string | null`.
3. `src/db/leads.ts`: add `"hold_reason"` to `UPDATE_ALLOWED_COLUMNS`.
4. `src/automation/orchestrator.ts` hold branch (line 244): `updateLead(leadId, { status: "sent", hold_reason: <reasons joined with "; ", capped at 500 chars> })`. The pipeline-result update in step 6 also sets `hold_reason: null`, so a re-run of a lead that is no longer held clears the old reason.
5. `src/utils/shape-lead.ts`: pass `hold_reason` through.
6. `public/dashboard.html`: one helper `statusDisplay(l)` that returns the label `Held` (amber class) when `l.status === 'sent' && l.hold_reason`, else the existing `STATUS_DISPLAY` entry. Used where `STATUS_DISPLAY[l.status]` is read (table row, mobile card, detail). The detail view shows the reason text under the header.

## 2. What must not change

- Stored status stays `sent` for a held lead. Filters, stats (`queries.ts:288`), `canApprove` (`dashboard.html:669`), follow-up scheduling, `VALID_STATUSES`: untouched.
- `routeLead` and its reasons: untouched. Hold decisions: untouched. Poller dry run: untouched.
- The review-only path (`orchestrator.ts:389`, lead stored `sent` with a review-only note) is a different state. Not touched here.
- No model calls added. No change to how a held lead is sent (it is not).

## 3. Acceptance tests (EARS)

1. WHEN a lead routes to `hold`, THE SYSTEM SHALL store `status = 'sent'` AND `hold_reason` equal to the joined router reasons. Verify: new test in the style of the `processLead` storage tests in `src/yelp-quote-parser.test.ts` (temporary SQLite database); a Yelp lead is always held, so no price fixture needed.
2. WHEN a lead does not hold, THE SYSTEM SHALL store `hold_reason = NULL`, including a re-run of a lead that was held before. Verify: same test file, two cases.
3. WHEN the database predates the column, THE SYSTEM SHALL add `hold_reason` on startup without losing rows. Verify: migration test on an old-shape database (existing migrate tests show the pattern).
4. THE SYSTEM SHALL return `hold_reason` from `shapeLead`. Verify: unit test.
5. WHEN `status = 'sent'` AND `hold_reason` is set, THE DASHBOARD SHALL show "Held" with the reason, otherwise "Sent". Verify: the dashboard has no browser test; check `statusDisplay` as a pure function in a test that loads the function text from `dashboard.html`, plus Alex's look (see Execution Path).
6. Mutation checks: revert the orchestrator write once, test 1 must fail; revert the `statusDisplay` branch once, test 5 must fail.
7. Full suite and `tsc` pass.

## 4. Most likely way this plan is wrong

- **Old held leads stay "Sent".** Lead #20 and every earlier hold has no reason. Accepted, stated to Alex; no backfill (a backfill would invent reasons).
- **A hold reason can contain lead text.** Router reasons are short fixed strings plus some numbers; Codex plan review should confirm none echoes raw email text. The dashboard escapes with `esc()` regardless.
- **A hidden reader of `status`** I missed. The inventory grep covered `src` and `public` for `'sent'` and `"sent"`; Codex plan review is asked to look for a miss.

## Execution Path

- **Target:** the dashboard on Alex's MacBook, `http://localhost:3000`, the Leads list and the lead detail view.
- **Mechanism:** the column is added when the server starts, so Alex restarts the server (`npm run dev`-style start he already uses; the poller starts with it, forced dry run). Only leads held AFTER the restart show "Held". Free check: the tests in section 3, no API calls. Visual check: wait for the next real lead, or run one dry-run ingest of one lead (`npx tsx scripts/ingest-one.ts <gmail-id>`), which makes about 3 to 10 paid model calls (a few cents) and needs Alex's explicit yes under the API-spend rule.
- **Prerequisites:** server running on the MacBook: ALREADY HAVE. Gmail login for the poller and the ingest script: ALREADY HAVE. Alex's yes to restart the server: MUST OBTAIN. Alex's yes to one paid ingest, only if he wants the visual check before a real lead arrives: MUST OBTAIN.
- **Who:** Alex restarts and looks; Claude writes the change and the tests.
- **Trigger:** before the 20-lead review-only ramp, and after the Codex plan review and code review of this change are recorded.

## Execution order (commits of one concern each)

1. Column + types + `updateLead` allow-list + migration test.
2. Orchestrator write/clear + storage tests (+ mutation check).
3. `shapeLead` + dashboard helper + tests.
4. Todo 097 marked built; HANDOFF update.

## Three Questions

1. **Hardest decision in this session?** Choosing the badge design over a new status; the status route is cleaner in meaning but touches money-adjacent reads (approve, stats) for a display problem.
2. **What did you reject, and why?** A new `held` status (migration rebuild plus about 12 read sites); a backfill of reasons for old holds (would invent data).
3. **Least confident about going into the next phase?** That the inventory grep found every reader of `status`; and that `hold_reason` non-null is a reliable "held" marker for all future hold paths (only one hold branch exists today).
