---
status: pending
priority: p3
issue_id: "021"
tags: [code-review, agent-native]
dependencies: []
unblocks: []
sub_priority: 8
---

# Missing Health Endpoint

## Problem

No GET /api/health endpoint. Agents and monitoring tools can't check if service is running.

## Location

- `src/server.ts` (missing)

## Fix

Add one-line `app.get("/api/health", (_, res) => res.json({ status: "ok" }))`.
