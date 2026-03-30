---
status: pending
priority: p3
issue_id: "018"
tags: [code-review, performance]
dependencies: []
unblocks: []
sub_priority: 5
---

# SSE Client Disconnect Wastes Tokens

## Problem

If client disconnects mid-pipeline, server continues making Claude API calls that nobody reads. Wasted tokens.

## Location

- `src/server.ts`

## Fix

Listen for `req.on("close")`, set abort flag, check before each stage.
