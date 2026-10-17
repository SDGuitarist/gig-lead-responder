# Plan: a held lead says it is held, and says why (todo 097)

**Date:** 2026-10-16 | **Branch:** `feat/hub-phase0` | **Phase:** Plan, **Revision 1** (after Codex plan review round 1, NO-GO, four P2) | **Todo:** `todos/097-pending-p2-held-leads-display-as-sent-and-hold-reasons-are-not-stored.md`
**Alex's decision (AskUserQuestion, 2026-10-16):** "Keep 'sent', add a Held badge + reason". Not a new status. Unchanged by this revision.

Counters: plan fix attempts so far 1 (this revision); Codex plan reviews 1 (R1 NO-GO, `docs/reviews/2026-10-16-held-leads-plan-codex-round1.md`). A 2nd NO-GO stops automatic iteration; round 3 needs the literal line `Round 3 authorized by Alejandro: YES`; a 3rd NO-GO is the hard cap.

## Feed-Forward

- **Hardest decision:** how to keep client words out of the stored reason without touching any routing decision. Chosen: change the one router string that interpolates client text (`router.ts:89`) to fixed wording, so the console message, `logs/leads.jsonl` and the new column all stop carrying it at once.
- **Rejected:** (a) a new `held` status (table-rebuild migration, about 12 read sites); (b) a string-scrubbing filter on stored reasons (a regex over model output is what the project keeps getting wrong, and a cap or HTML escaping does not remove sensitive content); (c) clearing `hold_reason` on re-run (no row can reach that code, see C3); (d) a mirror copy of dashboard functions inside a test (the repo's habit, "keep in sync manually", cannot see the real page change).
- **Least confident about:** the dashboard test harness. It runs the page's real inline script under `node:vm` with a stub `document` (spiked once, offline, 2026-10-16: all three real render functions returned output). If a future edit to the page script breaks the stub, tests fail loudly rather than pass, but the harness is new code with no history.

### Prior Phase Risk
Round 1 of this plan's review said the display claim was only argued, not shown. This revision adds real-output tests of the table row, mobile card and detail panel, and keeps Alex's own look at the dashboard as the one check no test replaces.

## What round 1 found, and what this revision does

| # | Finding (Codex R1) | Root cause | Evidence | Regression test (fails without the fix) |
|---|---|---|---|---|
| C1 P2 | Column added in the `migrate.ts` loop breaks startup on an old database | The loop at `migrate.ts:85-101` runs BEFORE the legacy rebuild; the rebuild copies every existing column name (`:145`) into a fixed-schema `leads_new` (`:149-188`) with no `hold_reason` | CONFIRMED by reading: `colNames` is read after the loop, `leads_new` is a literal schema. Runtime reproduction deferred: nothing is built yet; the legacy-rebuild test (M3) is the reproduction, and its mutation check puts the column back in the loop | M3 below; mutation: move the `ALTER` into the `migrate.ts` loop, M3 must fail |
| C2 P2 | Router reasons are not all fixed text | `router.ts:89` interpolates `classification.format_requested`, the client's raw words (`types.ts:76` "raw"; `classify.ts:181` only requires a string) | REPRODUCED 2026-10-16, synthetic input, no API: `routeLead` with `format_requested = "mariachi band at 412 Palm St token=abc123"` returns the reason `Cross-family format correction: mariachi band at 412 Palm St token=abc123 → solo` | R1, R2 below; mutation: restore the interpolation, R1 and R2 must fail |
| C3 P2 | A held row cannot reach the "clear on rerun" update | `orchestrator.ts:75` skips a processed message; `:90` skips an existing row whose status is not `received` or whose `pipeline_completed_at` is set; a held row is `sent` | CONFIRMED by reading. Consequence: clearing is dead code and an unsupported claim; DROPPED | S2, S2b, S3, S4 below |
| C4 P2 | The UI test checked only a helper, not the rendered reason or escaping | Plan tested `statusDisplay` in isolation; the detail panel has no status lookup (`dashboard.html:587`) | CONFIRMED. Feasibility SPIKED (offline, 2026-10-16): the page's inline script runs under `node:vm` with a stub `document`; `buildTableRow`, `buildMobileCard`, `renderDetailPanel` all returned strings | D1 to D8 below; mutation: drop the helper call from each site once, its test must fail |

Also accepted from round 1: the column goes through the numbered migration list; `hold_reason: null` is added to the typed fixture at `src/shape-lead.test.ts:6`; verification names exact commands and `npm run serve`; the low-confidence path (`orchestrator.ts:160`, stores `failed` + `error_message`) is stated as another hold-like path that is out of scope.

## 1. What exactly is changing

1. **`src/db/migrations.ts`**: add `{ version: 4, name: "hold_reason", up: (db) => db.exec("ALTER TABLE leads ADD COLUMN hold_reason TEXT") }` to `MIGRATIONS`, the same list that added `strategic_reserve_json` (v3). This runs after the baseline and after the legacy rebuild in `initDb()` (`migrate.ts:236`). Nothing is added to the `migrate.ts` loop.
2. **`src/types.ts`**: `LeadRecord.hold_reason: string | null` and `LeadApiResponse.hold_reason: string | null`. **`src/db/leads.ts`**: add `"hold_reason"` to `UPDATE_ALLOWED_COLUMNS`. **`src/utils/shape-lead.ts`**: pass it through.
3. **`src/automation/router.ts:89`**: the cross-family reason becomes fixed text with neither the requested nor the recommended value: `"Cross-family format correction (the client asked for a different kind of act than the one recommended)"`. The hold decision, the order of reasons and every other reason are unchanged. (The recommended format is also left out: `classify.ts:150-156` only requires a string, and the card already shows the recommended format.)
4. **`src/utils/hold-reason.ts` (new, pure)**: `holdReasonText(reasons: string[]): string | null`. Empty array returns `null`. Otherwise join with `"; "`; if the result is longer than 500 UTF-16 code units, return the first 499 followed by `"…"` (exactly 500). Router reasons are ASCII plus `—` and `→`, all inside the Basic Multilingual Plane, so a cut cannot split a surrogate pair.
5. **`src/automation/orchestrator.ts:244`** (the hold branch): `updateLead(leadId, { status: "sent", hold_reason: holdReasonText(result.reasons) })`. **No clearing anywhere** (C3). The low-confidence path at `:160`, the review-only path at `:389` and the writers in `post-pipeline.ts` are not touched.
6. **`public/dashboard.html`** (inside the page's IIFE) and **`public/dashboard.css`**:
   - `statusDisplay(l)`: returns `{ label: 'Held', css: 'held' }` when `l.status === 'sent'` and `l.hold_reason` is a non-empty string; otherwise returns exactly what `STATUS_DISPLAY[l.status] || { label: esc(l.status), css: '' }` returns today.
   - `holdNoticeHTML(l)`: `''` without a reason; otherwise `<div class="hold-notice"><strong>Held for you:</strong> ` + `esc(l.hold_reason)` + `</div>`. The reason is only ever inserted as element text, never into an attribute or a tooltip.
   - `buildTableRow` (`:732`) and `buildMobileCard` (`:762`) call `statusDisplay(l)` instead of reading `STATUS_DISPLAY[l.status]`; `renderDetailPanel` calls `holdNoticeHTML(l)` in the review header, directly under the event line. After the change `STATUS_DISPLAY[l.status]` is read in exactly one place (inside `statusDisplay`).
   - CSS: `.status-badge.held` (amber) and `.hold-notice`; bump the `?v=` on the stylesheet link.

## 2. What must not change

- Stored status stays `sent` for a held lead. Filters, the "Sent" filter pill, stats (`queries.ts:288`, a held lead still counts as sent), `canApprove` (`dashboard.html:669`), follow-up scheduling, `VALID_STATUSES`: untouched.
- No routing decision changes: `routeLead` returns the same `hold` / `auto-send` for every input as before (control O1 below). Only one reason string changes.
- No re-run or retry mechanism. No backfill: leads held before this change keep no reason and read "Sent".
- The low-confidence path (`failed` + `error_message`, shown as an error banner) and the review-only path (`sent` + `done_reason`, router allowed it, config suppressed it) stay as they are. Neither sets `hold_reason`.
- No model call added. Poller dry run, server and Gmail untouched.

## 3. Acceptance tests (EARS)

Run: `node --import tsx --test <file>` for one file (checked 2026-10-16 on `src/shape-lead.test.ts`: 4 pass), then `npm test` and `npm run typecheck` for the whole repo. `npm test` reads the globs `src/**/*.test.ts`, `scripts/**/*.test.ts`, `tests/**/*.test.ts` (`scripts/test-files.mjs`), so new files in `src/` need no registry edit. `npm test` also sets the API key to a dead value, so no test can bill. Baseline to compare: record the pass count before the first commit.

**Migration (new file `src/hold-reason-migration.test.ts`; each scenario runs `initDb()` in a child process with `DATABASE_PATH` set to a temp file, because `initDb` is a module-level singleton):**
- M1 (happy) WHEN no database file exists, THE SYSTEM SHALL create `leads` with `hold_reason` and `user_version = 4`.
- M2 (happy) WHEN a database at version 3 holds rows, THE SYSTEM SHALL add the column, keep every row, and leave `hold_reason` NULL. Fixture: a database created by `initDb()`, then `ALTER TABLE leads DROP COLUMN hold_reason; PRAGMA user_version = 3`, with 2 inserted rows.
- M3 (error case, the C1 reproduction) WHEN a database has the pre-`'replied'` schema (so `needsFollowUpRebuild` is true) and rows, THE SYSTEM SHALL complete the rebuild AND add the column without error, keeping every row. Fixture: hand-written pre-`'replied'` `leads` table (the baseline columns with the 4-value `follow_up_status` CHECK) with 2 rows; reuse an existing rebuild fixture if `grep -rn "replied" src/*.test.ts` finds one.
- M4 (error case) WHEN `initDb()` runs twice on the same file, THE SYSTEM SHALL not error and keep `user_version = 4` and the row count.

**Router and reason text (new file `src/hold-reason.test.ts`):**
- R1 WHEN `format_requested` is `"ZZSENTINEL 412 Palm St token=abc123"` and the families differ, THE SYSTEM SHALL still return `hold`, with a reason equal to the fixed cross-family text, containing none of `ZZSENTINEL`, `412 Palm`, `abc123`.
- R2 (structural) WHEN every free-text input carries a sentinel (lead `rawText`, `clientName`, `portalUrl`; classification `format_requested`, `venue_name`, `client_first_name`, `organization_name`, each `flagged_concerns` entry) and the inputs trigger every router branch together, THE SYSTEM SHALL return reasons whose join contains no sentinel. A second case triggers the branches in two smaller groups so a hidden interaction would show.
- R3 (positive control) WHEN the same inputs run, THE SYSTEM SHALL still contain the fixed texts `Yelp portal reply not verified live (todo 094): Alex sends from Yelp` and `Quote $5000 exceeds threshold $3000`, so a "returns nothing" bug cannot pass R1 and R2.
- O1 (overshoot control) WHEN the families are the same (for example solo and duo), THE SYSTEM SHALL NOT hold for that reason; and the existing router tests pass unchanged. Mutation: restore the interpolation, R1 and R2 fail.
- H1 to H4 (`holdReasonText`): short input equals the join; exactly 500 characters is unchanged; 501 or more returns length exactly 500, starts with the first 499 characters and ends with `…`; `[]` returns `null`.

**Storage through `processLead` (same file, temporary SQLite database, injected `runPipeline`, the style of `src/yelp-quote-parser.test.ts`):**
- S1 (happy) WHEN a complete Yelp lead is held, THE SYSTEM SHALL store `status = 'sent'` and `hold_reason` equal to the exact joined router reasons.
- S2 (error case) WHEN the same message is ingested twice, THE SYSTEM SHALL skip the second and leave `hold_reason`, `status` and `updated_at` unchanged.
- S2b (ARTIFICIAL, labelled in the test) WHEN the processed-email marker is deleted so the second call reaches `orchestrator.ts:90`, THE SYSTEM SHALL still leave the held row unchanged.
- S3 (happy) WHEN `handleAutoSendDecision` runs in review-only mode (`autoSendEnabled` false) on an inserted row, THE SYSTEM SHALL store `sent` + the review-only `done_reason` and `hold_reason` NULL.
- S4 (happy) WHEN a `received` row without `pipeline_completed_at` exists for the message id (an eligible unfinished retry) and the lead is then held, THE SYSTEM SHALL resume the SAME row (same id, one row) and store the reason.
- S5 (error case) WHEN a lead parses with low confidence, THE SYSTEM SHALL store `failed` + `error_message` and `hold_reason` NULL (unchanged path, pinned).

**API and shape (existing `src/shape-lead.test.ts`, plus one API test in the style of `src/coi-approve.test.ts`):**
- A1 `shapeLead` returns `hold_reason`, and `null` when the row has none; the typed fixture at `shape-lead.test.ts:6` gets `hold_reason: null`.
- A2 `GET /api/leads` and `GET /api/leads/:id` return `hold_reason` for a held row.

**Dashboard (new file `src/dashboard-hold.test.ts`; the harness reads the REAL `public/dashboard.html`, takes the inline script, adds one line before the IIFE closes that exposes `buildTableRow`, `buildMobileCard`, `renderDetailPanel` and `statusDisplay`, and runs it under `node:vm` with a stub `document`):**
- D1 WHEN `status = 'sent'` and `hold_reason` is set, THE SYSTEM SHALL output a badge with label `Held` and class `held` in the table row AND the mobile card.
- D2 (overshoot control) WHEN the status is `received`, `sending`, `sent` (no reason), `done` or `failed`, THE SYSTEM SHALL output exactly the labels `Pending`, `Sending`, `Sent`, `Done`, `Failed`, with the same classes as today, in both the table row and the mobile card. An unknown status keeps the escaped-status fallback.
- D3 WHEN `hold_reason` is `<img src=x onerror=1>&"`, THE SYSTEM SHALL output it escaped (`&lt;img ...`) in the detail panel, with no raw `<img`, and not inside any attribute.
- D4 WHEN a held lead's detail panel is rendered, THE SYSTEM SHALL include `Held for you:` and the reason; a non-held lead's panel SHALL NOT include `hold-notice`.
- D5 (wiring) THE SYSTEM SHALL read `STATUS_DISPLAY[l.status]` in exactly one place. Mutation: put the old read back into the mobile card, D1 on the mobile card fails; drop `holdNoticeHTML` from the detail header, D4 fails.
- Positive control for the harness itself: before the change, D2's expected labels equal the current page's output (checked against the unmodified page in the first commit).

**Full gates:** `npm test` (compare the pass count to the baseline plus the new tests), `npm run typecheck`, and `npx tsx scripts/check-venue-history.ts` (must print PASS, exit 0; `HANDOFF.md` line 750).

## 4. Most likely way this plan is wrong

- **The harness.** `node:vm` plus a stub `document` is new in this repo. If the page script changes shape, the harness fails loudly (it throws or D1 fails); it cannot pass silently, because D2 pins the unchanged labels. Remaining risk: the stub's `esc` mimics a browser, but is not one. Alex's own look (Execution Path) is the check against a real browser.
- **Old held leads stay "Sent"**, including lead #20. Accepted and told to Alex.
- **`logs/leads.jsonl` already holds old cross-family lines with client words** (it records `result.reasons`, `orchestrator.ts:258`). The router fix stops new ones; old lines are not scrubbed. The log is gitignored (`.gitignore:10`). Remaining limitation, not fixed here.
- **A second instance of the same failure class (client words entering a stored string)** was checked, bounded to the router: every other reason is fixed text, a count, or a price number (`router.ts:44-115`), so the router has one interpolation of client text, and its three consumers (console hold message, `logs/leads.jsonl`, the new column) all receive the fixed string. The structural fix (change the string at its source) is reversible by one revert. Not expanded to other modules: `error_message` for low confidence carries `parseWarnings` (parser-authored text; Yelp tokens are excluded by the existing parser tests) and is out of scope.
- **`format_recommended` is only checked as a string** at the classifier boundary. Left out of the stored reason, so it does not matter here.

## 5. Execution commands (what a human or Claude runs, in order)

1. Gate: `pwd`, `git branch --show-current`, `git rev-parse feat/hub-phase0`, `git status --short`.
2. Per commit: `node --import tsx --test <the new test file>` then `npm run typecheck`.
3. Before push: `npm test` and `npx tsx scripts/check-venue-history.ts`.

## Execution Path

- **Target:** the dashboard on Alex's MacBook, `http://localhost:3000`, the Leads list (desktop table and mobile card) and the lead detail panel.
- **Mechanism:** Alex stops the running server and starts it again with `npm run serve` (that script is `tsx src/server.ts`, `package.json:12`); the numbered migration adds the column on start, and the poller starts with the server in forced dry run. To see a "Held" badge on a real lead, either wait for the next real lead, or run one dry-run ingest of one message that is NOT yet in the `processed_emails` table (`npx tsx scripts/ingest-one.ts <gmail-id>`; an already-processed id is skipped and shows nothing, so the id must be checked against `processed_emails` first), which makes about 3 to 10 paid model calls (a few cents). Free check that needs no restart: all tests in section 3.
- **Prerequisites:** server on the MacBook: ALREADY HAVE. Gmail login for the poller and the ingest script: ALREADY HAVE. Alex's yes to restart the server: MUST OBTAIN. Alex's yes to one paid ingest (purpose: see the badge on a real lead; about 3 to 10 calls, a few cents; budget: one lead, no retries beyond the pipeline's own), only if he wants the check before the next real lead: MUST OBTAIN. An unprocessed Gmail message id for that ingest: MUST OBTAIN (Claude lists candidates from the private sample manifest and `processed_emails` at that time).
- **Who:** Alex restarts and looks; Claude writes the change and the tests.
- **Trigger:** after the Codex plan review (round 2 or later) and the Codex code review of this change are recorded, and before the 20-lead review-only ramp.

## Execution order (commits of one concern each)

1. Migration v4 + types + allow-list + M1 to M4.
2. Router string + `holdReasonText` + R1 to R3, O1, H1 to H4.
3. Orchestrator write + S1 to S5.
4. `shapeLead` + fixture + A1, A2.
5. Dashboard helpers, call sites, CSS + D1 to D5.
6. Todo 097 marked built; HANDOFF; status doc.

## UNEXECUTED (reason / owner / trigger)

- Real-browser look at the badge, the reason text and the mobile layout: no browser run in this plan; owner Alex; trigger: after server restart.
- The legacy-rebuild migration against a copy of the real `data/leads.db`: the real database was not copied or opened in this plan; owner Claude, work step 1, on a temp COPY only, never on the file itself.
- All tests in section 3: not written yet.

## Three Questions

1. **Hardest decision in this session?** Whether to scrub reasons or fix the source string. Scrubbing a model-influenced string by pattern is the repeated failure in this project; changing the one interpolation fixes the console message, the log and the column together, and keeps the hold decision identical.
2. **What did you reject, and why?** A new `held` status; a scrubbing filter; clearing the reason on re-run (dead code, no row reaches it); a copied mirror of dashboard functions in a test; fixing the old log lines.
3. **Least confident about going into the next phase?** The `node:vm` dashboard harness is new and was spiked once; and whether Codex accepts leaving `error_message` on the low-confidence path out of the privacy inventory.
