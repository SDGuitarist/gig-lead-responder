---
status: pending
priority: p3
issue_id: "017"
tags: [code-review, typescript]
dependencies: ["007"]
unblocks: []
sub_priority: 4
---

# Venue Map Returns Mutable Reference

## Problem

`findVenue()` in venues.ts returns a direct reference to VENUE_MAP objects. Callers could mutate shared state. Low risk since venues.ts is dead code (see 007), but worth noting if it's ever revived.

## Location

- `src/data/venues.ts` line 74

## Fix

Moot if 007 (delete venues.ts) is done. Otherwise add `as const` or return spread copy.
