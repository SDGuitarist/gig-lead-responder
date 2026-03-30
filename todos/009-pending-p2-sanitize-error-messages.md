---
status: pending
priority: p2
issue_id: "009"
tags: [code-review, security]
dependencies: []
unblocks: []
sub_priority: 5
---

# Sanitize error messages sent to client

## Problem

Raw error messages are forwarded to the client via SSE. Could leak file paths, API details, or raw Claude responses. `claude.ts` line 62 includes raw API response in error.

## Location

- `src/server.ts` lines 95-97
- `src/claude.ts` line 62

## Fix

Log full error server-side, send generic message to client.
