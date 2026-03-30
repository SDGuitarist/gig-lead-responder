---
status: pending
priority: p2
issue_id: "007"
tags: [code-review, simplicity]
dependencies: []
unblocks: []
sub_priority: 3
---

# Delete dead `venues.ts` code

## Problem

`src/data/venues.ts` (82 lines) is never imported anywhere. `VENUE_MAP`, `STEALTH_PREMIUM_ZIPS`, and `findVenue()` are all dead code. Stealth premium detection is handled by the Claude classification prompt. Flagged by Architecture and Simplicity reviewers.

## Location

- `src/data/venues.ts`

## Fix

Delete the entire file.
