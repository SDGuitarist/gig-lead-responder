---
status: pending
priority: p1
issue_id: "003"
tags: [code-review, security]
dependencies: []
unblocks: []
sub_priority: 3
---

# Add input length limit to POST /api/analyze

## Problem

No max length on POST `/api/analyze` text input. An attacker can send megabytes, burning API credits (`max_tokens` only limits the response, not the input).

## Location

- `src/server.ts` line 26

## Fix

Add `if (text.length > 10_000)` check after existing validation. One line.
