---
status: pending
priority: p2
issue_id: "010"
tags: [code-review, agent-native]
dependencies: ["005"]
unblocks: []
sub_priority: 6
---

# Add JSON response mode to POST /api/analyze

## Problem

POST `/api/analyze` only returns SSE -- agents and standard HTTP clients can't easily consume it. Agent-Native reviewer flagged this as the single most important change for agent accessibility.

## Location

- `src/server.ts`

## Fix

Add `Accept` header check or `?format=json` query param. When requested, return single JSON response instead of SSE stream. ~15 lines.
