---
status: done
priority: p2
issue_id: "009"
tags: [code-review, architecture, reliability]
dependencies: []
unblocks: []
sub_priority: 2
---

# 009: process.exit(1) in auth middleware instead of startup

## Problem Statement

If `DASHBOARD_USER`/`DASHBOARD_PASS` are unset in production, the auth middleware in `auth.ts:114-127` calls `process.exit(1)` on every request that hits it. This is evaluated at request time, not startup time. If env vars are removed after a deploy, the first authenticated request kills the process.

This should be a startup-time check in `server.ts` (like the existing `ANTHROPIC_API_KEY` check), not a per-request crash.

**Found by:** Architecture Strategist

## Proposed Solutions

### Option A: Move to startup check in server.ts (Recommended)
Add env var validation at startup alongside existing checks. Middleware returns 500 with error message if somehow reached without credentials.
- Effort: Small
- Risk: None

## Technical Details

- **Affected files:** `src/auth.ts`, `src/server.ts`

## Acceptance Criteria

- [ ] Missing `DASHBOARD_USER`/`DASHBOARD_PASS` detected at startup in production
- [ ] Auth middleware returns 500 instead of crashing if credentials are missing

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-04 | Created from review cycle 2 | |
