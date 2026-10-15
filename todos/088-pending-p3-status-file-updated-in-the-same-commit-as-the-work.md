---
status: pending
priority: p3
issue_id: "088"
tags: [process, status-file, tracker-drift]
dependencies: []
unblocks: []
sub_priority: 1
---

# 088: Make "update END-TO-END-STATUS.md in the same commit as the work" something that is checked

## Problem Statement

`docs/END-TO-END-STATUS.md` says "Change a row in the SAME commit as the work that changed it". Between 2026-10-12 and
2026-10-14 seven cycles landed (COI, clarification validator, gate opening, draft shape, internal terms, vague-lead
route, lead_words) and the file recorded none of them. It was refreshed on 2026-10-14 only because Alex asked. The rule
is written down and not in the sequence of any session, so it is done late or not at all.

## Options (a decision for Alex, not built here)

1. **Compound step:** add one line to `/workflows:compound` / `update-learnings` ("did a row of END-TO-END-STATUS.md
   change? edit it") so the file is updated where the cycle already closes.
2. **Session-closing handoff:** CLAUDE.md's Session-Closing Handoff gets a fifth item: status file rows touched.
3. **Check:** a small script that fails when a commit touching `src/` for a roadmap item has no change to the status
   file (risk: fires on everything, which makes it a constant, not a signal).

## Acceptance

One of the options is in place, with a named reader and trigger, and the next cycle's close shows a status-file diff.

## Owner and trigger

Alex picks the option. Trigger: the next compound phase.
