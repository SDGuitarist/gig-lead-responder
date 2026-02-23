---
title: "feat: Dashboard UI Redesign"
type: feat
date: 2026-02-22
---

# Dashboard UI Redesign

### Prior Phase Risk

> **Brainstorm "Least confident about":** How to handle the Analyze tab
> integration. The current analyzer uses a manual SSE stream reader (`fetch` +
> `getReader`), and merging it into the new tabbed layout without breaking the
> streaming behavior needs careful planning.

This plan addresses that risk by making the Analyze tab the **last chunk** —
built only after the core table and API are working. The SSE reader code from
`public/index.html` is carried over as-is into the new tab panel, minimizing
risk of breaking the streaming behavior.

## Overview

Replace the current two disconnected surfaces (`public/index.html` analyzer +
`src/dashboard.ts` server-rendered leads list) with a single, unified dashboard.

**Design:** Hybrid warm+clean — warm cream/gold color palette with Playfair
Display headings (personality) combined with an information-dense data table
layout (utility). Reference mockup: `public/mockup-hybrid.html`.

**Audience:** Alejandro only (single-user, personal tool).

**Primary workflow:** Open dashboard → see pending leads → expand a row → review
AI draft → Approve & Send or Edit → move to next lead.

## Design Decisions (from spec-flow analysis)

These defaults resolve the open questions from the brainstorm. Each is marked
so a future session can revisit if needed.

| # | Question | Decision | Rationale |
|---|----------|----------|-----------|
| 1 | "Approve & Send" sends to whom? | Sends compressed draft to `ALEX_PHONE` (Alex's own number) | System never has client contact info — GigSalad/Bash prohibit direct contact. This is Alex's "approved" copy. |
| 2 | Which statuses allow approval? | `received` or `sent`, when `full_draft` is not null | A lead with a completed draft should be approvable regardless of whether the SMS notification reached Alex's phone. |
| 3 | Does "Edit" re-run AI or save manual text? | **Phase 1: Direct text edit** (textarea, saves to DB). AI re-gen is a future feature. | Simpler to build, immediately useful. The SMS edit path (`runEditPipeline`) can be wired up later. |
| 4 | Auth on new `/api/*` routes? | Yes — same Basic Auth as `/leads`. Extract middleware to shared file. | Lead data + approval actions must be protected. `/api/analyze` stays unprotected (matches current behavior). |
| 5 | Analyze tab saves to DB? | No — stays ephemeral. | Matches current behavior. A "Save & Queue" button is a future feature. |
| 6 | Polling / real-time updates? | No polling. Manual "Refresh" button in top bar. | Single user, low volume. Keeps it simple. |
| 7 | "Date" sort means what? | `event_date` ascending (soonest first), nulls at bottom. Secondary: `created_at`. | Operationally, upcoming events matter most. |
| 8 | Filter: single-select or multi? | Single-select. Click active pill to deselect (show all). | Simpler DB query, matches mockup behavior. |
| 9 | Queue tab behavior? | Filters to `received` status only (pending leads). "All Leads" shows everything. | Clear separation between "needs action" and "history". |
| 10 | "This Month" stat definition? | Calendar month, based on `created_at`. | More intuitive for tracking gig seasonality. |
| 11 | Expanded row for mid-pipeline lead? | Show "Pipeline running..." notice when `status=received` and `full_draft=null`. Show error if `error_message` present. | Prevents confusing blank expanded panels. |
| 12 | Gut check display? | Show pass count (e.g., "12/14") + only the failed check names. | Actionable without being verbose. |
| 13 | Format column source? | API parses `classification_json` and returns `format_recommended` as top-level field. | Frontend stays simple — no JSON parsing in the browser. |

## Proposed Solution

### New Files
- `public/dashboard.html` — the new unified dashboard (static HTML/CSS/JS)
- `src/api.ts` — new Express router with JSON API endpoints

### Modified Files
- `src/leads.ts` — add filtered list query + stats aggregation query
- `src/server.ts` — mount new API router, redirect `/` to dashboard
- `src/dashboard.ts` — extract Basic Auth middleware to reusable function

### Deleted / Deprecated
- `public/index.html` — replaced by Analyze tab in new dashboard (keep as backup until verified)
- Old `/leads` and `/leads/:id` routes stay functional but are superseded

## Implementation Phases

### Chunk 1: Database Layer (~60 lines)

**File:** `src/leads.ts`

Add two new functions (do not modify existing `listLeads()`):

```ts
// New: filtered + sorted lead listing
function listLeadsFiltered(opts: {
  status?: string,       // "received" | "sent" | "done" | "failed"
  sort?: string           // "date" | "score" | "event"
}): LeadRecord[]

// New: stats for the dashboard cards
function getLeadStats(): {
  pending: number,        // COUNT WHERE status = "received"
  sent: number,           // COUNT WHERE status = "sent"
  avg_score: number,      // AVG(confidence_score) WHERE confidence_score IS NOT NULL
  this_month: number      // COUNT WHERE created_at >= first of current month
}
```

`listLeadsFiltered` SQL:
- Default: `ORDER BY created_at DESC`
- `sort=date`: `ORDER BY event_date ASC NULLS LAST, created_at DESC`
- `sort=score`: `ORDER BY confidence_score DESC NULLS LAST`
- `sort=event`: `ORDER BY event_type ASC NULLS LAST`
- `status` filter: `WHERE status = ?`

**Acceptance criteria:**
- [ ] `listLeadsFiltered()` with no args returns all leads (same as `listLeads()`)
- [ ] `listLeadsFiltered({ status: "received" })` returns only received leads
- [ ] `listLeadsFiltered({ sort: "score" })` returns leads sorted by confidence
- [ ] `getLeadStats()` returns correct counts + average
- [ ] Null `confidence_score` excluded from average, not counted as 0

---

### Chunk 2: API Router (~80 lines)

**New file:** `src/api.ts`

Extract Basic Auth middleware from `src/dashboard.ts` into a shared helper
(either top of `api.ts` or a small `src/auth.ts`). Apply to all routes in this
router.

Three endpoints:

**`GET /api/leads`**
- Query params: `?status=received|sent|done|failed` and `?sort=date|score|event`
- Calls `listLeadsFiltered()`
- For each lead: parse `classification_json`, `pricing_json`, `gate_json`
- Return slimmed JSON shape per lead:

```ts
{
  id, status, event_type, event_date, venue, client_name,
  confidence_score, edit_round, created_at, updated_at,
  full_draft, compressed_draft, error_message,
  // Parsed from classification_json:
  format_recommended, duration_hours, tier, competition_level,
  // Parsed from pricing_json:
  quote_price, anchor, floor,
  // Parsed from gate_json:
  gate_passed, gut_check_passed, gut_check_total, fail_reasons
}
```

- Exclude `raw_email` (too large for list view)
- Wrap `JSON.parse()` in try/catch per lead — return nulls on parse failure

**`GET /api/stats`**
- Calls `getLeadStats()`
- Returns `{ pending, sent, avg_score, this_month }`

**`POST /api/leads/:id/approve`**
- Validate lead exists, has `full_draft`, status is `received` or `sent`
- Send compressed draft to `ALEX_PHONE` via `sendSms()`
- Update lead: `status = "done"`, `done_reason = "approved_dashboard"`, `sms_sent_at = now`
- Return updated lead JSON
- On Twilio error: return 500 with error message (don't update status)

**Mount in `src/server.ts`:**
```ts
import { apiRouter } from "./api.js";
app.use(apiRouter);
```

**Acceptance criteria:**
- [ ] `GET /api/leads` returns JSON array of leads with parsed sub-fields
- [ ] `GET /api/leads?status=received` filters correctly
- [ ] `GET /api/leads?sort=score` sorts correctly
- [ ] `GET /api/stats` returns correct counts
- [ ] `POST /api/leads/:id/approve` sends SMS and updates status
- [ ] `POST /api/leads/:id/approve` returns 400 if lead has no draft
- [ ] `POST /api/leads/:id/approve` returns 500 on Twilio failure (status unchanged)
- [ ] All endpoints require Basic Auth (return 401 without credentials)

---

### Chunk 3: Dashboard HTML — Layout + Stats + Table (~200 lines)

**New file:** `public/dashboard.html`

Start from `public/mockup-hybrid.html` as the template. Strip out hardcoded
sample data and replace with dynamic rendering from the API.

**This chunk builds:**
1. Top bar with GigLead logo + tab navigation (Queue / All Leads / Analyze)
2. Page header with dynamic greeting ("N gigs waiting for you")
3. Stats cards row — fetch from `GET /api/stats` on load
4. Filter pills + sort dropdown (wired to re-fetch)
5. Data table with column headers
6. `fetchLeads()` function that calls `GET /api/leads` and renders `<tr>` rows
7. Tab switching JS (Queue filters to received, All shows all)

**Key implementation notes:**
- Carry over all CSS from the mockup (warm palette, Playfair Display, etc.)
- Include Basic Auth credentials in `fetch()` calls via `Authorization` header
  (credentials stored in a JS variable — acceptable for single-user tool)
- Status mapping: DB `received` → UI shows "Pending"
- Score color thresholds: >= 85 gold, >= 70 amber, < 70 red
- Format display names: `{ solo: "Solo Guitar", flamenco_duo: "Flamenco Duo", ... }`
- Empty state: "No leads yet — paste one in the Analyze tab" centered message

**Acceptance criteria:**
- [ ] Dashboard loads at `/dashboard.html` and shows real lead data
- [ ] Stats cards show correct numbers from the API
- [ ] Filter pills filter the table (client-side after fetch, or re-fetch with param)
- [ ] Sort dropdown reorders the table
- [ ] Tab switching works (Queue → only pending, All → everything)
- [ ] Empty state renders gracefully when no leads exist
- [ ] Mobile responsive: table → cards below 768px

---

### Chunk 4: Expandable Row Detail + Approve Action (~120 lines)

**File:** `public/dashboard.html` (continued)

Add to the dashboard:
1. Click-to-expand row detail panel (accordion behavior)
2. Full draft + compressed draft display (two-column grid)
3. Gut check summary bar (pass count + failed check names)
4. Classification + pricing breakdown grid
5. "Approve & Send" button → calls `POST /api/leads/:id/approve`
6. "Edit Draft" button → opens inline textarea for the full_draft
7. Approve flash animation (green checkmark overlay)
8. Error state: show `error_message` for failed leads
9. Mid-pipeline state: "Pipeline running..." for received leads with no draft

**Edit Draft behavior (Phase 1 — simple):**
- Click "Edit Draft" → draft text becomes an editable `<textarea>`
- Click "Save" → `PATCH`-style call to `POST /api/leads/:id/edit` (new endpoint)
- Backend: update `full_draft` in DB, increment `edit_round`
- No AI re-generation — just a manual text save

**New endpoint needed in `src/api.ts`:**
```ts
POST /api/leads/:id/edit
Body: { full_draft: string }
→ updateLead(id, { full_draft, edit_round: current + 1 })
```

**Acceptance criteria:**
- [ ] Clicking a row expands the detail panel, clicking again collapses
- [ ] Only one row expanded at a time (accordion)
- [ ] Full draft and compressed draft render correctly
- [ ] Gut check bar shows "X/14 passed" with correct color
- [ ] Failed check names listed below the bar
- [ ] "Approve & Send" calls API, shows flash, updates row status
- [ ] "Approve & Send" disabled for already-done leads
- [ ] "Edit Draft" opens textarea, "Save" persists changes
- [ ] Failed leads show error message instead of draft
- [ ] Mid-pipeline leads show "Processing..." notice

---

### Chunk 5: Analyze Tab + SSE Streaming (~100 lines)

**File:** `public/dashboard.html` (continued)

Port the Analyze tab from `public/index.html`:
1. Textarea for pasting lead text
2. "Analyze" button
3. 5-stage progress indicator with pulse animation
4. SSE stream reader (copy the existing `fetch` + `getReader` + manual parse
   logic from `index.html` — it works, don't rewrite)
5. Results display: classification key-values, pricing, drafts grid, gate status

**Carry over from `index.html`:**
- The `analyzeBtn.onclick` handler
- The SSE manual parser (`buffer.split("\n")` loop)
- Stage row rendering with `data-stage` attributes
- Result section rendering (`kvHTML()` helper)

**Adapt to new design:**
- Apply warm palette CSS to all result elements
- Use Playfair Display for section headings
- Match the table/card visual language for results

**Acceptance criteria:**
- [ ] Analyze tab shows textarea + analyze button
- [ ] Pasting lead text and clicking Analyze triggers SSE stream
- [ ] 5 pipeline stages animate correctly (running → done)
- [ ] Complete results render with classification, pricing, drafts, gate
- [ ] Error handling: network failure shows error message
- [ ] Mid-stream failure: stages that didn't complete show error state

---

### Chunk 6: Route Cleanup + Polish (~40 lines)

**Files:** `src/server.ts`, `src/dashboard.ts`

1. Redirect `/` to `/dashboard.html` (the new dashboard becomes the homepage)
2. Add a "Refresh" button to the dashboard top bar (re-fetches leads + stats)
3. Keep old `/leads` routes working (backwards compatibility during transition)
4. Clean up: remove mockup files from `public/` (mockup-dark, mockup-warm,
   mockup-clean — keep mockup-hybrid as reference)
5. Update `HANDOFF.md` with new dashboard architecture

**Acceptance criteria:**
- [ ] Visiting `/` redirects to the new dashboard
- [ ] Refresh button works
- [ ] Old `/leads` route still functions
- [ ] Mockup files cleaned up
- [ ] HANDOFF.md updated

## Technical Considerations

**Performance:** All leads loaded in one fetch (no pagination). Fine for a
single musician's volume (likely <100 leads/month). Add pagination if volume
grows past ~500 leads.

**Security:** Basic Auth on all `/api/*` routes except `/api/analyze`. Credentials
in JS is acceptable for single-user — no multi-tenant concerns.

**Error handling:** Every API call wrapped in try/catch. Errors shown inline on
the relevant row/section, not as page-level alerts.

**No build step:** Everything stays vanilla HTML/CSS/JS. No bundler, no
TypeScript in the browser, no npm packages for the frontend.

## Success Metrics

- Dashboard loads with real data from SQLite
- Full lead review workflow works: view → expand → read draft → approve/edit
- Analyze tab streams pipeline results identically to current `index.html`
- Looks like the approved mockup (`mockup-hybrid.html`)

## Dependencies & Risks

| Risk | Mitigation |
|------|------------|
| SSE streaming breaks when ported to new tab | Copy code exactly from index.html, test before modifying |
| Twilio SMS fails on approve | Return 500, don't update status, show error in UI |
| JSON parse failures on malformed gate/classification blobs | Try/catch per field, return nulls, UI shows "—" |
| Mobile layout breaks with table → card switch | Test at 768px breakpoint, use mockup's responsive CSS |

## References

- Brainstorm: `docs/brainstorms/2026-02-22-dashboard-ui-redesign-brainstorm.md`
- Target mockup: `public/mockup-hybrid.html`
- Current analyzer: `public/index.html`
- Current dashboard: `src/dashboard.ts`
- Database layer: `src/leads.ts`
- Server routes: `src/server.ts`
- Types: `src/types.ts`
- SMS sender: `src/sms.ts`
- Pipeline runner: `src/run-pipeline.ts`

## Three Questions

1. **Hardest decision in this session?** Whether "Edit Draft" should re-run the
   AI pipeline or just save manual text. Chose manual text edit for Phase 1
   because it's simpler to build and immediately useful — the AI re-gen path
   (`runEditPipeline`) involves async processing, loading states, and polling
   that would double the complexity of Chunk 4.

2. **What did you reject, and why?** Rejected real-time polling/WebSocket updates.
   For a single user processing ~2-5 leads per day, a manual refresh button is
   sufficient. Adding polling introduces reconnection logic, stale state
   management, and race conditions between the UI and background pipeline runs
   — all unnecessary complexity at this volume.

3. **Least confident about going into the next phase?** The `listLeadsFiltered`
   SQL for `ORDER BY event_date ASC NULLS LAST`. SQLite doesn't support `NULLS
   LAST` syntax directly — it requires a workaround like
   `ORDER BY event_date IS NULL, event_date ASC`. If this doesn't sort cleanly
   across all edge cases (null dates, mixed formats), it may need iteration
   during the Work phase.
