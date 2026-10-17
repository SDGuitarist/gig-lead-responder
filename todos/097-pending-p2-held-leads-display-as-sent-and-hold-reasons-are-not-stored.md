---
status: pending
priority: p2
issue_id: "097"
tags: [dashboard, router, hold, module-1, phase-0]
dependencies: []
unblocks: []
sub_priority: 1
---

# 097: a held lead is stored as status "sent", the dashboard labels it "Sent", and the hold reasons are only in the log

## Problem Statement

In `src/automation/orchestrator.ts` (the `result.action === "hold"` branch, step 7) a held lead gets `updateLead(leadId, { status: "sent" })`, and the
reasons from `routeLead` go to the console and `logs/leads.jsonl` (`edgeCaseReasons`), not to the lead row. `public/dashboard.html:245`
maps `sent` to the label "Sent". So in review-only mode a lead that was HELD for Alex reads "Sent" on the dashboard and shows no reason.
Found by Codex plan review round 1 of the Yelp parser plan (`docs/reviews/2026-10-16-yelp-parser-plan-codex-round1.md`, P2-3). Not verified by me
on a running dashboard: read from the code only.

## Proposed approach (a plan to write; Alex decides the wording he wants to see)

1. Decide what a held lead should look like (a status "held", or "sent" kept with a visible hold badge and the reasons text).
2. Persist the reasons on the row (a column or an existing text field) and show them on the card.
3. Cover with a test that routes a hold and reads the stored reason and the label. Beware: other code reads `status === "sent"`
   (follow-up scheduling, approve routes); changing the value needs an inventory first.

## Plan status (2026-10-16)

Alex chose: keep stored status `sent`, add a `hold_reason` column, show a Held badge plus the reason. Plan:
`docs/plans/2026-10-16-fix-held-leads-show-as-sent-plan.md` (Revision 1). Codex plan review round 1: NO-GO, four P2, all confirmed
(`docs/reviews/2026-10-16-held-leads-plan-codex-round1.md`). Revision 1 written. Round 2: NO-GO, 2 P2 + 1 P3, all confirmed
(`docs/reviews/2026-10-16-held-leads-plan-codex-round2.md`); automatic iteration STOPPED; Alex chose "fix the plan and test it offline first"; plan Revision 2 written with three offline spikes (`docs/spikes/2026-10-16-held-leads/`, all pass). Round 3 (authorized by Alex): GO, plan-review loop closed (`docs/reviews/2026-10-16-held-leads-plan-codex-round3.md`). Next: build under Revision 2, then Codex code review. Not built.

## Owner and trigger

Claude plans; Alex decides the display. Trigger: before the 20-lead review-only ramp, since the ramp is Alex reading held drafts.
