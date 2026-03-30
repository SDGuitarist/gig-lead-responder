---
status: pending
priority: p3
issue_id: "020"
tags: [code-review, security]
dependencies: []
unblocks: []
sub_priority: 7
---

# XSS Risk in kvHTML Function

## Problem

`kvHTML` function in index.html interpolates Claude response values directly into innerHTML without escaping. Exploitable only if prompt injection succeeds first.

## Location

- `public/index.html` lines 217-219

## Fix

Add an `esc()` helper that uses `textContent` for escaping.
