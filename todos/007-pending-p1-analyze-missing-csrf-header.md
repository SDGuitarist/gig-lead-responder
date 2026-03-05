---
status: done
priority: p1
issue_id: "007"
tags: [code-review, security, functional-bug]
dependencies: []
unblocks: []
sub_priority: 2
---

# 007: Analyze endpoint missing X-Requested-With CSRF header

## Problem Statement

The `runAnalyze()` function in `dashboard.html:2234` constructs its own headers object that does NOT include `X-Requested-With: dashboard`, unlike the `apiPost()` helper used by all other POST endpoints. The server applies `csrfGuard` on `/api/analyze` (`api.ts:299`).

This works only because the dashboard currently falls back to Basic Auth headers (which bypass CSRF per `auth.ts:166`). But if a user accesses the dashboard via a bookmarked URL with only a cookie session (no `authHeader` in JS), the Analyze request will fail with 403.

**Found by:** Security Sentinel, Performance Oracle

## Findings

- `dashboard.html:2234` — `analyzeHeaders` object missing `X-Requested-With`
- `api.ts:299` — `csrfGuard` applied to `/api/analyze`
- `auth.ts:165-169` — CSRF skipped for Basic Auth, required for cookie auth
- All other POST endpoints use `apiPost()` which includes the header

## Proposed Solutions

### Option A: Add header to analyzeHeaders (Recommended)
```javascript
var analyzeHeaders = { 'Content-Type': 'application/json', 'X-Requested-With': 'dashboard' };
```
- Pros: One-line fix, matches all other POST calls
- Cons: None
- Effort: Small
- Risk: None

## Recommended Action

Option A — one-line fix.

## Technical Details

- **Affected files:** `public/dashboard.html`

## Acceptance Criteria

- [ ] `runAnalyze()` sends `X-Requested-With: dashboard` header
- [ ] Analyze works for cookie-only authenticated sessions

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-04 | Created from review cycle 2 | |
