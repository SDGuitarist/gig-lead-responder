# Plan: a held lead says it is held, and says why (todo 097)

**Date:** 2026-10-16 | **Branch:** `feat/hub-phase0` | **Phase:** Plan, **Revision 2** (after Codex plan review round 1 NO-GO, four P2, and round 2 NO-GO, two P2 + one P3; at the circuit breaker Alex chose "fix the plan and test it offline first", 2026-10-16) | **Todo:** `todos/097-pending-p2-held-leads-display-as-sent-and-hold-reasons-are-not-stored.md`
**Alex's decision (AskUserQuestion, 2026-10-16):** "Keep 'sent', add a Held badge + reason". Not a new status. Unchanged by this revision.

Counters: plan fix attempts so far 2 (Revision 1, Revision 2); Codex plan reviews 2 (R1 NO-GO `docs/reviews/2026-10-16-held-leads-plan-codex-round1.md`, R2 NO-GO `docs/reviews/2026-10-16-held-leads-plan-codex-round2.md`). Automatic iteration is STOPPED (2nd NO-GO). Round 3 is NOT authorized and no round-3 prompt exists; it needs the literal line `Round 3 authorized by Alejandro: YES`. A 3rd NO-GO is the hard cap, no round 4.

**Executed offline while writing Revision 2** (synthetic text, temp databases, no API, no server, `data/leads.db` never opened): three spike scripts in `docs/spikes/2026-10-16-held-leads/` (`router-fixtures.ts`, `dashboard-harness.mjs`, `migration-scenarios.mjs`), each ending `ALL CHECKS PASS` on 2026-10-16. They are the source the work phase turns into repo tests; they are not repo tests themselves.

## Feed-Forward

- **Hardest decision:** how to keep client words out of the stored reason without touching any routing decision. Chosen: change the one router string that interpolates client text (`router.ts:89`) to fixed wording, so the console message, `logs/leads.jsonl` and the new column all stop carrying it at once.
- **Rejected:** (a) a new `held` status (table-rebuild migration, about 12 read sites); (b) a string-scrubbing filter on stored reasons (a regex over model output is what the project keeps getting wrong, and a cap or HTML escaping does not remove sensitive content); (c) clearing `hold_reason` on re-run (no row can reach that code, see C3); (d) a mirror copy of dashboard functions inside a test (the repo's habit, "keep in sync manually", cannot see the real page change).
- **Least confident about:** the dashboard harness is new code with no history, and its stub `document` is my implementation of browser text escaping (checked against hard-coded expected strings, not against a browser). The spike now runs with controls and two mutation checks, all caught, but a real browser look by Alex is still the one check no test replaces.

### Prior Phase Risk
Round 1 of this plan's review said the display claim was only argued, not shown. This revision adds real-output tests of the table row, mobile card and detail panel, and keeps Alex's own look at the dashboard as the one check no test replaces.

## What round 1 found, and what this revision does

| # | Finding (Codex R1) | Root cause | Evidence | Regression test (fails without the fix) |
|---|---|---|---|---|
| C1 P2 | Column added in the `migrate.ts` loop breaks startup on an old database | The loop at `migrate.ts:85-101` runs BEFORE the legacy rebuild; the rebuild copies every existing column name (`:145`) into a fixed-schema `leads_new` (`:149-188`) with no `hold_reason` | CONFIRMED by reading: `colNames` is read after the loop, `leads_new` is a literal schema. Runtime reproduction deferred: nothing is built yet; the legacy-rebuild test (M3) is the reproduction, and its mutation check puts the column back in the loop | M3 below; mutation: move the `ALTER` into the `migrate.ts` loop, M3 must fail |
| C2 P2 | Router reasons are not all fixed text | `router.ts:89` interpolates `classification.format_requested`, the client's raw words (`types.ts:76` "raw"; `classify.ts:181` only requires a string) | REPRODUCED 2026-10-16, synthetic input, no API: `routeLead` with `format_requested = "mariachi band at 412 Palm St token=abc123"` returns the reason `Cross-family format correction: mariachi band at 412 Palm St token=abc123 → solo` | R1 to R4 below (fixtures F-A to F-G); mutation: restore the interpolation, R2 and R3 must fail |
| C3 P2 | A held row cannot reach the "clear on rerun" update | `orchestrator.ts:75` skips a processed message; `:90` skips an existing row whose status is not `received` or whose `pipeline_completed_at` is set; a held row is `sent` | CONFIRMED by reading. Consequence: clearing is dead code and an unsupported claim; DROPPED | S2, S2b, S3, S4 below |
| C4 P2 | The UI test checked only a helper, not the rendered reason or escaping | Plan tested `statusDisplay` in isolation; the detail panel has no status lookup (`dashboard.html:587`) | CONFIRMED. Feasibility SPIKED (offline, 2026-10-16): the page's inline script runs under `node:vm` with a stub `document`; `buildTableRow`, `buildMobileCard`, `renderDetailPanel` all returned strings | D1 to D6 below; mutation: drop the helper call from each site once, its test must fail |

Also accepted from round 1: the column goes through the numbered migration list; `hold_reason: null` is added to the typed fixture at `src/shape-lead.test.ts:6`; verification names exact commands and `npm run serve`; the low-confidence path (`orchestrator.ts:160`, stores `failed` + `error_message`) is stated as another hold-like path that is out of scope.

## What round 2 found, and what Revision 2 does (`docs/reviews/2026-10-16-held-leads-plan-codex-round2.md`)

| # | Finding (Codex R2) | Root cause | Evidence | Regression test / control |
|---|---|---|---|---|
| E1 P2 | R1's fixture reaches no router branch; R2 "every branch together" is impossible | R1 used `ZZSENTINEL ...` with no format-family word, so `guessFormatFamily` returns null and the router auto-sends; R2 asked for contradictory inputs (a present AND missing `portalUrl`; `action` both `one_question` and `assume_and_quote`, `router.ts:93`, `:98`) | REPRODUCED offline: `guessFormatFamily("ZZSENTINEL 412 Palm St token=abc123")` = null, action `auto-send`, no reason; with `mariachi` in front it holds. Fixtures F-A to F-G below were RUN against the current router and a copy with the one-line change: decisions identical, exact ordered reasons as listed, no sentinel in the new reasons, and the OLD router leaks on F-A, F-B, F-E (`router-fixtures.ts`: ALL CHECKS PASS) | F-A to F-G below; mutation = the OLD router, which fails the sentinel and exact-list checks on F-A, F-B, F-E |
| E2 P2 | The `node:vm` harness is unspecified (escaping stub, globals, startup) | The spike's stub answered every call with an inert proxy and its `fetch` never settled, so startup was inert by accident; its escaping was never checked against known strings | The real script starts three loads (`loadStats()`, `loadLeads()`, `loadFollowUpSummary()`, `dashboard.html:1860-1862`) and reads `window.location.hash` (`:1856`). Harness spec below was RUN: 3 startup fetches counted and none answered; stub and real `esc()` checked against hard-coded strings; D1 to D5 pass on a prototype applied to a TEXT COPY of the page; two mutations caught (`dashboard-harness.mjs`: ALL CHECKS PASS) | harness controls S1 to S3 + startup control; D3 mutation (no `esc()`) is caught |
| E3 P3 | Review table said "D1 to D8" | Prose slip | CONFIRMED | corrected to D1 to D5 |

Also accepted from round 2 and applied: **M3 must use a pre-`'replied'` fixture with DISTINCT message ids** (the only existing rebuild fixture, `src/db-dedupe-guard.test.ts:37`, deliberately uses duplicate ids and fails before the copy, so it cannot be reused); M2 and M4 each need the fixture preparation and the run in SEPARATE processes (`initDb` is a singleton); S3 is evidence about the review-only writer only; and **the focused test command is the protected runner**, not `node --import tsx --test` (my error: that command skips the dead API key, base URL and venue-file protections of `scripts/run-tests.mjs`). Migration scenarios M1 to M4 were RUN against temp databases and temp copies of the code (`migration-scenarios.mjs`: ALL CHECKS PASS), including the rejected placement, which FAILS on the legacy fixture with `table leads_new has no column named hold_reason` (this reproduces round-1 P2-1; it passes on a fresh database, which is why only the legacy fixture catches it).

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
   - `isHeld(l)`: the one shared test (`status === 'sent'` and a non-empty string `hold_reason`) used by `statusDisplay`, `holdNoticeHTML` and the two muted lines below.
   - **No fade for held rows (Alex's addition, 2026-10-16, after a heads-up that held rows would look finished; NOT seen by Codex in rounds 1 or 2):** the two `var muted = (l.status === 'sent' || l.status === 'done') ? ...` lines (`dashboard.html:735` row, `:765` card) become `(!isHeld(l) && (l.status === 'sent' || l.status === 'done')) ? ...`. Today those classes set `opacity: 0.7` (`dashboard.css:301`, `:1196`). Every other status keeps today's exact output.
   - CSS: `.status-badge.held` (amber) and `.hold-notice`; bump the `?v=` on the stylesheet link.

## 2. What must not change

- Stored status stays `sent` for a held lead. Filters, the "Sent" filter pill, stats (`queries.ts:288`, a held lead still counts as sent), `canApprove` (`dashboard.html:669`), follow-up scheduling, `VALID_STATUSES`: untouched.
- No routing decision changes: `routeLead` returns the same `hold` / `auto-send` for every input as before (R1 and fixtures F-F, F-G below). Only one reason string changes.
- No re-run or retry mechanism. No backfill: leads held before this change keep no reason and read "Sent".
- The low-confidence path (`failed` + `error_message`, shown as an error banner) and the review-only path (`sent` + `done_reason`, router allowed it, config suppressed it) stay as they are. Neither sets `hold_reason`.
- No model call added. Poller dry run, server and Gmail untouched.

## 3. Acceptance tests (EARS)

Run: `npm run test:match -- "<test name>"` for focused tests and `npm test` for the whole suite; both go through `scripts/run-tests.mjs`, which sets the API key and base URL to dead values (no test can bill), points the venue file at `/dev/null`, and removes token variables. Do NOT use `node --import tsx --test <file>` for repo tests: it bypasses those protections. (The three spike scripts import no model code and open only temp databases, so they are run with plain `node` / `npx tsx`.) `npm test` reads `src/**/*.test.ts`, `scripts/**/*.test.ts`, `tests/**/*.test.ts` (`scripts/test-files.mjs`), so new files in `src/` need no registry edit. Baseline to compare: record the pass count before the first commit.

**Migration (new file `src/hold-reason-migration.test.ts`; each scenario runs `initDb()` in a child process with `DATABASE_PATH` set to a temp file, because `initDb` is a module-level singleton):**
- M1 (happy) WHEN no database file exists, THE SYSTEM SHALL create `leads` with `hold_reason` and `user_version = 4`.
- M2 (happy) WHEN a real version-3 database holds rows, THE SYSTEM SHALL add the column, keep every row, and leave `hold_reason` NULL. Fixture (executed in the spike): process A runs the code WITHOUT the new migration against a fresh temp file (leaves `user_version = 3`), 2 rows are inserted, then process B (separate process) runs the code WITH it.
- M3 (error case, the C1 reproduction) WHEN a database has the pre-`'replied'` schema (so `needsFollowUpRebuild` is true) and rows, THE SYSTEM SHALL complete the rebuild AND add the column without error, keeping every row. Fixture (executed in the spike, `makeLegacy`): hand-written pre-`'replied'` `leads` table (the baseline columns plus the loop columns, `follow_up_status` with the 4-value CHECK) with 2 rows with DISTINCT `mailgun_message_id`. Do not reuse `src/db-dedupe-guard.test.ts`'s fixture (duplicate ids, fails before the copy). Mutation = the rejected placement, which fails this scenario.
- M4 (error case) WHEN `initDb()` runs on the same file in a second, separate process, THE SYSTEM SHALL not error and keep `user_version = 4` and the row count (two calls in one process only return the singleton and would prove nothing).

**Router and reason text (new file `src/hold-reason.test.ts`):**
- Fixtures (executed in `router-fixtures.ts`; the work phase copies them into the test file). All use sentinels `ZZSENTINEL`, `412 Palm`, `abc123`, `ZZRECOMMENDED`, `9 Elm`, `xyz` in every free-text input (lead `rawText`, `clientName`, `portalUrl` where present; classification `format_requested`, `venue_name`, `client_first_name`, `organization_name`, `flagged_concerns`). Budget threshold 3000. Each asserts the EXACT ordered reason list. `FIXED` = `Cross-family format correction (the client asked for a different kind of act than the one recommended)`:
  - F-A cross-family only: platform gigsalad, portalUrl present, `format_requested = "mariachi ZZSENTINEL 412 Palm St token=abc123"`, recommended `solo` -> `[FIXED]`.
  - F-B many branches at once: platform yelp, parse `low`, not enriched, portalUrl present, gate failed, quote 5000, one flagged concern, F-A's formats, `vagueness = vague` with `action = one_question` -> `["Low parse confidence — manual review required", "Yelp lead not enriched from portal — truncated message", "Yelp portal reply not verified live (todo 094): Alex sends from Yelp", "Verification gate failed after retries", "Quote $5000 exceeds threshold $3000", "1 flagged concern(s)", FIXED, "Vague lead — needs clarifying question"]`.
  - F-C missing portal URL (gigsalad, no `portalUrl`) -> `["Missing portal URL — cannot submit reply"]`.
  - F-D `action = assume_and_quote` with `stealth_premium = true` -> `["High-value assumption (stealth premium + assumed quote)"]`.
  - F-E unconstrained recommended string: `format_recommended = "ZZRECOMMENDED 9 Elm token=xyz"`, requested has `mariachi` -> `[FIXED]`.
  - F-F same family (`solo` requested, `duo` recommended) -> auto-send, no reasons (overshoot control: prior outcome retained).
  - F-G clean lead -> auto-send, no reasons.
- R1 (decision control) For every fixture, the new router's `action` equals the old router's `action`.
- R2 (exact lists) For every fixture, the reasons equal the lists above, in that order.
- R3 (privacy) For every fixture, no reason contains any sentinel; the three fixtures that hold on the cross-family branch (F-A, F-B, F-E) also pass the OLD router through the same check and it FAILS there (the test file keeps the old-wording check as a negative control so the sentinel assertion is shown to be able to fail).
- R4 (positive control) F-B still contains the fixed texts, so a "returns nothing" bug cannot pass R3.
- Mutation: restore the interpolation in the real `router.ts`, R2 and R3 fail on F-A, F-B, F-E.
- H1 to H4 (`holdReasonText`): short input equals the join; exactly 500 characters is unchanged; 501 or more returns length exactly 500, starts with the first 499 characters and ends with `…`; `[]` returns `null`.

**Storage through `processLead` (same file, temporary SQLite database, injected `runPipeline`, the style of `src/yelp-quote-parser.test.ts`):**
- S1 (happy) WHEN a complete Yelp lead is held, THE SYSTEM SHALL store `status = 'sent'` and `hold_reason` equal to the exact joined router reasons.
- S2 (error case) WHEN the same message is ingested twice, THE SYSTEM SHALL skip the second and leave `hold_reason`, `status` and `updated_at` unchanged.
- S2b (ARTIFICIAL, labelled in the test) WHEN the processed-email marker is deleted so the second call reaches `orchestrator.ts:90`, THE SYSTEM SHALL still leave the held row unchanged.
- S3 (happy, narrow) WHEN `handleAutoSendDecision` runs in review-only mode (`autoSendEnabled` false) on an inserted row, THE SYSTEM SHALL store `sent` + the review-only `done_reason` and `hold_reason` NULL. This is evidence about that writer only; it is not an end-to-end `processLead` of a non-held lead.
- S4 (happy) WHEN a `received` row without `pipeline_completed_at` exists for the message id (an eligible unfinished retry) and the lead is then held, THE SYSTEM SHALL resume the SAME row (same id, one row) and store the reason.
- S5 (error case) WHEN a lead parses with low confidence, THE SYSTEM SHALL store `failed` + `error_message` and `hold_reason` NULL (unchanged path, pinned).

**API and shape (existing `src/shape-lead.test.ts`, plus one API test in the style of `src/coi-approve.test.ts`):**
- A1 `shapeLead` returns `hold_reason`, and `null` when the row has none; the typed fixture at `shape-lead.test.ts:6` gets `hold_reason: null`.
- A2 `GET /api/leads` and `GET /api/leads/:id` return `hold_reason` for a held row.

**Dashboard (new file `src/dashboard-hold.test.ts`; spike = `dashboard-harness.mjs`, executed). Harness specification:**
- Extraction: read the REAL `public/dashboard.html`; assert exactly one `<script>\n` block (no `src`) and that the text after the last `})();` is whitespace; take the inline script.
- Injection: before the last `})();` append one line that sets `globalThis.__t = { buildTableRow, buildMobileCard, renderDetailPanel, esc, statusDisplay, holdNoticeHTML }` (the last two are `null` before the change). The page file itself is never modified by the harness. The real `esc()` is used unchanged.
- Context (`node:vm`): `document` = a stub whose `createElement` returns an element with a `textContent` setter and an `innerHTML` getter that serializes a text node the way a browser does (`&` to `&amp;`, `<` to `&lt;`, `>` to `&gt;`, U+00A0 to `&nbsp;`, quotes untouched) and whose every other member is an inert proxy; `window.location.hash = ""`; `fetch` records its URL and returns a promise that never settles; `setTimeout`/`setInterval`/`requestAnimationFrame` are no-ops; plain globals `console`, `Date`, `Math`, `JSON`, `Intl`, `URLSearchParams`, `encodeURIComponent`, `btoa`, `prompt` (returns null).
- Startup control: after load, `fetch` was called exactly 3 times, every URL starting with `/api/` (executed result: `/api/stats`, `/api/leads?status=received&limit=50&offset=0`, `/api/leads?follow_up=active`).
- Stub controls (independent expected strings, not derived from the stub): S1 a text node `<b>&"'` + NBSP serializes to `&lt;b&gt;&amp;"'&nbsp;`; S2 the page's real `esc("<img src=x onerror=1>")` returns `&lt;img src=x onerror=1&gt;`; S3 `esc("")` and `esc(null)` return `""`.
- D1 WHEN `status = 'sent'` and `hold_reason` is a non-empty string, THE SYSTEM SHALL output a badge with class `held` and label `Held` (and no `Sent` label) in `buildTableRow` AND `buildMobileCard`.
- D2 (overshoot control) WHEN the status is `received`, `sending`, `sent` (no reason), `done` or `failed`, THE SYSTEM SHALL return output BYTE-IDENTICAL to the unchanged page for both `buildTableRow` and `buildMobileCard`, with labels `Pending`, `Sending`, `Sent`, `Done`, `Failed`; an unknown status keeps the escaped fallback; a non-`sent` status never shows `Held` even if `hold_reason` is set.
- D3 WHEN `hold_reason` is `ZZREASON <img src=x onerror=1>&"`, THE SYSTEM SHALL render in `renderDetailPanel` exactly `Held for you:</strong> ZZREASON &lt;img src=x onerror=1&gt;&amp;"</div>`, the sentinel once, as element text and never inside an attribute.
- D4 WHEN the lead is not held, THE SYSTEM SHALL return a detail panel byte-identical to the unchanged page, with no `hold-notice`.
- D5 (wiring) THE SYSTEM SHALL read `STATUS_DISPLAY[l.status]` in exactly one place after the change.
- D6 WHEN a lead is held, THE SYSTEM SHALL NOT add `row-muted` to its table row or `mobile-card-muted` to its card; a plain `sent` lead (no reason) and a `done` lead SHALL still carry them (D2 already pins the rest byte-identical).
- Mutations (executed on the prototype, all CAUGHT): `holdNoticeHTML` without `esc()` puts a raw `<img` in the output, so D3 fails; leaving the mobile card unpatched loses its `Held` badge, so D1 fails; leaving the two muted lines unpatched keeps a held row faded, so D6 fails.
- The prototype in the spike patches a TEXT COPY of the page (two `var st = ...` lines, two `var muted = ...` lines, one header insertion point, three helper functions). The real change in the work phase is the same edit applied to `public/dashboard.html`; the test then runs the real file.

**Full gates:** `npm test` (compare the pass count to the baseline plus the new tests), `npm run typecheck`, and `npx tsx scripts/check-venue-history.ts` (must print PASS, exit 0; `HANDOFF.md` line 750).

## 4. Most likely way this plan is wrong

- **The harness.** `node:vm` plus a stub `document` is new in this repo. If the page script changes shape, the extraction assertions or D1 fail loudly; it cannot pass silently, because D2 pins byte-identical output for the unchanged statuses. Remaining risk: the stub's text escaping is my implementation of browser serialization, checked against hard-coded strings, not against a browser. Alex's own look (Execution Path) is the check against a real browser.
- **The no-fade rule was added after both Codex reviews.** It is small and was run offline on the prototype (D6 and MUTATION 3 below), but no reviewer has read it; a round 3, if Alex authorizes one, should cover it. The opacity value is read from the stylesheet, not seen in a browser.
- **Old held leads stay "Sent"**, including lead #20. Accepted and told to Alex.
- **`logs/leads.jsonl` already holds old cross-family lines with client words** (it records `result.reasons`, `orchestrator.ts:258`). The router fix stops new ones; old lines are not scrubbed. The log is gitignored (`.gitignore:10`). Remaining limitation, not fixed here.
- **A second instance of the same failure class (client words entering a stored string)** was checked, bounded to the router: every other reason is fixed text, a count, or a price number (`router.ts:44-115`), so the router has one interpolation of client text, and its three consumers (console hold message, `logs/leads.jsonl`, the new column) all receive the fixed string. The structural fix (change the string at its source) is reversible by one revert. Not expanded to other modules: `error_message` for low confidence carries `parseWarnings` (parser-authored text; Yelp tokens are excluded by the existing parser tests) and is out of scope.
- **`format_recommended` is only checked as a string** at the classifier boundary. Left out of the stored reason, so it does not matter here.

## 5. Execution commands (what a human or Claude runs, in order)

1. Gate: `pwd`, `git branch --show-current`, `git rev-parse feat/hub-phase0`, `git status --short`.
2. Per commit: `npm run test:match -- "<name of the new tests>"` then `npm run typecheck`.
3. Before push: `npm test` and `npx tsx scripts/check-venue-history.ts`.
4. The three spike scripts (re-runnable any time, offline): `npx tsx docs/spikes/2026-10-16-held-leads/router-fixtures.ts`, `node docs/spikes/2026-10-16-held-leads/dashboard-harness.mjs`, `node docs/spikes/2026-10-16-held-leads/migration-scenarios.mjs`; each prints `ALL CHECKS PASS`.

## Execution Path

- **Target:** the dashboard on Alex's MacBook, `http://localhost:3000`, the Leads list (desktop table and mobile card) and the lead detail panel.
- **Mechanism:** Alex stops the running server and starts it again with `npm run serve` (that script is `tsx src/server.ts`, `package.json:12`); the numbered migration adds the column on start, and the poller starts with the server in forced dry run. To see a "Held" badge on a real lead, either wait for the next real lead, or run one dry-run ingest of one message that is NOT yet in the `processed_emails` table (`npx tsx scripts/ingest-one.ts <gmail-id>`; an already-processed id is skipped and shows nothing, so the id must be checked against `processed_emails` first), which makes about 3 to 10 paid model calls (a few cents). Free check that needs no restart: all tests in section 3.
- **Prerequisites:** server on the MacBook: ALREADY HAVE. Gmail login for the poller and the ingest script: ALREADY HAVE. Alex's yes to restart the server: MUST OBTAIN. Alex's yes to one paid ingest (purpose: see the badge on a real lead; about 3 to 10 calls, a few cents; budget: one lead, no retries beyond the pipeline's own), only if he wants the check before the next real lead: MUST OBTAIN. An unprocessed Gmail message id for that ingest: MUST OBTAIN (Claude lists candidates from the private sample manifest and `processed_emails` at that time).
- **Who:** Alex restarts and looks; Claude writes the change and the tests.
- **Trigger:** after the plan is accepted (a GO, or Alex's choice at the circuit breaker) and the Codex code review of this change is recorded, and before the 20-lead review-only ramp.

## Execution order (commits of one concern each)

1. Migration v4 + types + allow-list + M1 to M4.
2. Router string + `holdReasonText` + R1 to R4 (fixtures F-A to F-G), H1 to H4.
3. Orchestrator write + S1 to S5.
4. `shapeLead` + fixture + A1, A2.
5. Dashboard helpers, call sites, no-fade rule, CSS + D1 to D6.
6. Todo 097 marked built; HANDOFF; status doc.

## EXECUTED / UNEXECUTED

**Executed 2026-10-16 (offline, synthetic text or temp databases, no API, no server, `data/leads.db` never opened):** `router-fixtures.ts` (F-A to F-G against the old router and a one-line-changed copy), `dashboard-harness.mjs` (controls S1 to S3, startup control, D1 to D6 on a prototype applied to a text copy, three mutations caught), `migration-scenarios.mjs` (M1 to M4 against `current`, `numbered`, `loop` variants; the rejected placement fails M3 with `table leads_new has no column named hold_reason`). Each ended `ALL CHECKS PASS`.

**UNEXECUTED (reason / owner / trigger):**
- Real-browser look at the badge, the reason text and the mobile layout: no browser run in this plan; owner Alex; trigger: after server restart.
- The legacy-rebuild migration against a COPY of the real `data/leads.db`: the real database was not copied or opened; owner Claude, work step 1, temp COPY only, never the file itself.
- All tests in section 3 as repo tests (the spikes are not repo tests), `npm test`, `npm run typecheck`: not written or run; owner Claude, work phase.
- Storage tests S1 to S5 and API checks A1, A2: not even spiked; owner Claude, work phase.

## Three Questions

1. **Hardest decision in this session?** Whether to scrub reasons or fix the source string (fixed the source string). At the second NO-GO, whether to revise at once or wait: the contract says wait, and Alex chose to fix the specification and settle it by running it.
2. **What did you reject, and why?** A new `held` status; a scrubbing filter; clearing the reason on re-run (dead code, no row reaches it); a copied mirror of dashboard functions in a test; fixing the old log lines.
3. **Least confident about going into the next phase?** That the spikes are not the repo tests: turning them into `node:test` files can still introduce a gap, and S1 to S5 (storage through `processLead`) have not been spiked at all. Also whether the reviewer accepts leaving `error_message` on the low-confidence path out of the privacy inventory.
