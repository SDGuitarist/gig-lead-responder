---
status: pending
priority: p3
issue_id: "093"
tags: [vague-lead, formats, follow-up]
dependencies: []
unblocks: []
sub_priority: 1
---

# 093: assume_and_quote and non-solo/duo formats under the vague-lead rule

## Problem Statement

The vague-lead route and the gate scoping apply only to one_question + vague + solo or duo (`vagueQuoteMode`,
`defaultVagueFormat`). assume_and_quote leads and other formats still follow the older rules. Alex's decision
(2026-10-14, plan docs/plans/2026-10-14-fix-vague-quote-gate-opening-plan.md D3): "Leave them out and measure them as a
follow-up."

## Proposed approach (a plan to write)

1. Measure first: run the existing arm on made-up assume_and_quote and non-solo/duo vague leads and report how they fare
   at the verify gate (opening-false, verified, price present) with the current rules.
2. Only if they fail the same way, plan the extension; a new mode needs its own controls (see 090) and the regression gate.

## Owner and trigger

Claude measures; Alex decides scope. Trigger: after 090.
