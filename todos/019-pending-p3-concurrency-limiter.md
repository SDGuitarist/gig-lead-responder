---
status: pending
priority: p3
issue_id: "019"
tags: [code-review, performance, security]
dependencies: []
unblocks: []
sub_priority: 6
---

# No Concurrency Limiter on /api/analyze

## Problem

No limit on concurrent /api/analyze requests. 10 simultaneous requests = up to 80 Claude API calls, likely hitting rate limits.

## Location

- `src/server.ts`

## Fix

Simple `activeRequests` counter, reject with 429 if over threshold (e.g., 3).
