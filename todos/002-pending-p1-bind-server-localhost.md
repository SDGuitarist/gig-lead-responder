---
status: pending
priority: p1
issue_id: "002"
tags: [code-review, security]
dependencies: []
unblocks: []
sub_priority: 2
---

# Bind Express server to localhost

## Problem

Express binds to `0.0.0.0` by default — anyone on the network can hit `/api/analyze` and burn API credits. Combined with no rate limiting and no auth, this is the easiest attack vector.

## Location

- `src/server.ts` line 104

## Fix

`app.listen(PORT, "127.0.0.1", () => { ... })` — one-line fix.
