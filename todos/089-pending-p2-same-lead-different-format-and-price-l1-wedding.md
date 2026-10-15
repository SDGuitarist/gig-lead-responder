---
status: pending
priority: p2
issue_id: "089"
tags: [classifier, price, nondeterminism, regression]
dependencies: []
unblocks: []
sub_priority: 1
---

# 089: Same lead, different format and price: L1 wedding quotes duo $1,495 or flamenco_duo $1,595 depending on the run

## Problem Statement

On the 2026-10-12 regression lead L1_wedding_rich (action quote, clear, T3, 2 hours, stealth premium), the classifier's
`format_recommended` is split with the prompt UNCHANGED: 15 runs on the pre-change tree (worktree of 95f3dda) gave 8 duo
($1,495) and 7 flamenco_duo ($1,595). A client's quote depends on which run they got. Found while rerunning a
measurement stop (docs/reviews/2026-10-14-lead-words-measurement.md); it is independent of the reverted lead_words edit.

## Not shown

Why it splits (the lead's wording, the premium-signal call, the format rule), and whether other rich leads split.

## Proposed approach (a plan to write)

1. Read the classifier's reasons on both values for L1 and name the sentence of the prompt that decides duo vs flamenco_duo.
2. Decide the rule with Alex (money: his call), then move the decision into code where possible (the project pattern:
   `defaultVagueFormat`, the Tier B venue rules) instead of a prompt edit.
3. Verify with the regression gate: `npx tsx scripts/classifier-regression.ts --compare` must exit 0 and L1 must be 10 of 10
   on one value. Use 10 or more runs per side when the baseline is split (5 cannot separate noise from effect).

## Owner and trigger

Alex decides the rule; Claude plans. Trigger: before Module 1's 20-lead ramp (a price must not depend on the run).
