# Brainstorm: Lead Conversion Tracking

**Date:** 2026-02-25
**Status:** Complete
**Next:** Plan phase

## What We're Building

A feedback loop that tracks what happens after the pipeline sends a response to a lead. The dashboard gets a way to mark outcomes (Booked / Lost / No Reply) on each lead, and the existing Analyze tab gets populated with conversion analytics.

This is the foundation for Follow-Up Sequences (next feature cycle) — you can't automate follow-ups without knowing which leads are still open.

## Why This Matters

Right now the pipeline lifecycle ends at "done" (draft approved and sent). There's no record of whether that $800 wedding quote turned into a booking or vanished into the void. Without this data:

- You can't calculate your conversion rate
- You can't see which platforms (GigSalad vs The Bash) are worth your time
- You can't tell if your pricing strategy is working (quoted vs actual)
- You can't spot patterns in why you lose gigs
- Follow-Up Sequences (next feature) won't know which leads need follow-ups

## Key Decisions

### 1. Input method: Dashboard only
Start with dashboard buttons/dropdowns on each lead card. No CLI, no SMS input. Revisit SMS input when we build Follow-Up Sequences (Twilio A2P should be approved by then).

### 2. Outcome set: Detailed + revenue
- **Booked** — with optional `actual_price` field (number input)
- **Lost** — with optional reason: `price` | `competitor` | `cancelled` | `other`
- **No Reply** — no sub-fields

Loss reason is optional — never force a guess. Actual price is optional — but captures the most valuable data point (are you closing at your quote or discounting?).

### 3. Architecture: New columns on leads table
Add directly to the existing `leads` table:
- `outcome TEXT CHECK(outcome IN ('booked', 'lost', 'no_reply'))`
- `outcome_reason TEXT` — nullable, for loss sub-reasons
- `actual_price REAL` — nullable, for booked leads
- `outcome_at TEXT` — ISO timestamp of when outcome was recorded

No new tables. Single-user SQLite app — extra columns are cheap and queryable.

### 6. Outcomes are editable
Outcomes can be changed after they're set. A lead marked "No Reply" can later become "Booked" if the client comes back. `outcome_at` tracks the most recent change. This is essential for Follow-Up Sequences — the whole point of follow-ups is converting "No Reply" into bookings.

### 4. Analytics: Populate the Analyze tab
The dashboard already has an empty Analyze tab with placeholder text. Fill it with:
- **Overall conversion rate** (booked / total with outcomes)
- **Revenue** (sum of actual_price for booked leads)
- **Average discount** (quoted price vs actual price)
- **Conversion by platform** (GigSalad vs The Bash)
- **Conversion by format** (solo vs duo vs trio etc.)
- **Conversion by competition level**
- **Response speed vs conversion** (average hours-to-respond for booked vs lost leads)

### 5. Visual nudge for stale leads
Leads in `sent` or `done` status for 7+ days with no outcome get a visual indicator on the dashboard (badge, highlight, or icon). No notifications — just a gentle "this needs your attention" cue.

## What's Already in Place

These existing fields power analytics with zero re-work:
- `quote_price` (from `pricing_json`) — what was quoted
- `format_recommended` — solo, duo, trio, etc.
- `competition_level` — how competitive the lead was
- `source_platform` — gigsalad, thebash, or direct
- `confidence_score` — pipeline quality metric
- `pipeline_completed_at` / `sms_sent_at` — response speed

The `LeadStatus` type (`received | sending | sent | done | failed`) stays unchanged. Outcome is a separate concept from pipeline status — a lead can be `done` (pipeline finished) and `booked` (business outcome).

## Scope Boundaries

**In scope:**
- Database migration (4 new columns)
- API endpoint to set outcome (`PATCH /api/leads/:id/outcome`)
- Dashboard UI: outcome controls on lead cards
- Dashboard UI: Analyze tab with conversion stats
- Visual nudge for leads needing outcomes (7+ day threshold)
- Update `LeadApiResponse` type to include outcome fields

**Out of scope (future cycles):**
- SMS-based outcome input (Follow-Up Sequences cycle)
- Automated "No Reply" detection (Follow-Up Sequences cycle)
- Calendar/availability awareness (tabled)
- Export or reporting beyond the dashboard
- Historical backfill of past leads

## Open Questions

_None — all questions resolved during brainstorm dialogue._

## Feed-Forward

- **Hardest decision:** Whether to use a separate outcomes table vs columns on the existing leads table. A separate table would be cleaner architecturally and could track outcome changes over time, but for a single-user SQLite app the join overhead and complexity aren't worth it. Columns win on simplicity and queryability.
- **Rejected alternatives:** (1) SMS/CLI input methods — deferred because dashboard is available now and SMS depends on blocked Twilio A2P. (2) Simple 3-outcome set — rejected because loss reasons and actual price are the highest-value data points and cost almost nothing extra to add. (3) JSON blob storage — rejected because SQL aggregations are the whole point of this feature.
- **Least confident:** Whether the Analyze tab analytics will be useful with a small dataset. With only a handful of leads so far, conversion rates and breakdowns by platform/format might be noisy or misleading. The plan phase should consider what minimum sample size makes each metric meaningful, and whether to show "not enough data" warnings.
