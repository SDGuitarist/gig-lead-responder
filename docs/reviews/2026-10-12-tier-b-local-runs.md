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

**Amendment before the tb3 runs (Alex, plan Revision 4):** Coasterra is premium only with 100+ guests or corporate.
tb3 (Coasterra, Saturday, 40 guests, noon) is now expected **standard with no Tier B note**, or held with "own rule
says standard; priced premium" if the model prices it T3. tb1 x5 and tb2-1 ran on `62929e0` before this change
(Tom Ham's logic unchanged); tb2-2 and tb3 x2 run on the Revision 4 code.

## Results (2026-10-12)

| Run | Code | guest_count | event_start_hour | Tier | Quote | Tier B note |
|---|---|---|---|---|---|---|
| tb1-1 | `62929e0` | 50 | 17 | T2 | $895 (solo 3h) | "own rule says standard; waterfront 50+ buyout rule may apply; T2 $895 / T3 $1200" |
| tb1-2 | `62929e0` | 50 | 17 | T2 | $895 | same |
| tb1-3 | `62929e0` | 50 | 17 | T2 | $895 | same |
| tb1-4 | `62929e0` | 50 | 17 | T2 | $895 | same |
| tb1-5 | `62929e0` | 50 | 17 | T2 | $895 | same |
| tb2-1 | `62929e0` | 120 | 18 | T3 | $1,200 | none (own rule met, priced premium) |
| tb2-2 | `69ae3ae` | 120 | 18 | T3 | $1,200 | none |
| tb3-1 | `69ae3ae` | 40 | 12 | T2 | $700 (solo 2h) | none (own rule not met, under 50) |
| tb3-2 | `69ae3ae` | 40 | 12 | T2 | $700 | none |

**B13: PASSES, 9 of 9.** Extraction exact on every run (guests and start hour). The measured Tom Ham's lead, which
flipped $895/$1,200 across 7 runs on 2026-10-11, priced T2 on all 5 runs and was held with both prices every time.
No unflagged T2 where a rule said premium. All runs exit 0. Note: tb3 priced 2 hours (the lead says 12-2pm); the
earlier test leads were 3 hours.

## Revision 5/5b runs (code `61e60a6`; expected results written before the runs)

Rule (Alex): Coasterra, Tom Ham's, Marina Village, Brick: 100+ guests is premium; under 100 or unknown is held with
both prices (the AI's corporate call appears only in the note).
- tb1 (Tom Ham's, 50 guests, 5 PM) x2: held "under 100 guests (...; waterfront 50+ buyout rule may apply)", both prices.
- tb4 (Tom Ham's, 120 guests, noon) x2: T3 with no note, or held "own rule says premium (100+ guests)"; never an
  unflagged T2.
- tb5 (Brick, corporate dinner, 40 guests, 6 PM) x2: held "under 100 guests (marked corporate ...)" both times (if the
  AI marks it corporate; "marked not corporate" is also a correct hold), both prices.
