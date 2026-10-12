# Tier B venue holds: real-model runs (B13)

**Code:** `62929e0` (plan `docs/plans/2026-10-12-fix-tier-b-venue-rule-conflict-hold-plan.md`, Revision 3). **Inputs:**
`docs/reviews/2026-10-12-tier-b-leads/` (committed before any run). Scratch DBs; nothing sent; real model; PF-Intel
lookups are live reads. **Reader and trigger:** the Codex code-review prompt; Alex.

**Expected (pre-registered, plan B13):**
- tb1 (Tom Ham's, 50 guests, 5 PM, Sunday) x5: `guest_count` 50, `event_start_hour` 17, and a `tier_b:` note with
  "waterfront 50+ buyout rule may apply" and both prices ($895 / $1,200 if the model keeps solo 3h) on EVERY run,
  whatever tier the model picks.
- tb2 (Tom Ham's, 120 guests, Wednesday 6 PM) x2 and tb3 (Coasterra, Saturday, 40 guests, noon) x2: T3, or held with
  both prices; never an unflagged T2.
- Stop and report to Alex on any miss.
