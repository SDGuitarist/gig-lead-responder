---
status: done
priority: p3
issue_id: "010"
tags: [code-review, security, documentation]
dependencies: []
---

# Document trust proxy = 1 Railway infrastructure assumption

## Problem Statement

`app.set("trust proxy", 1)` is correct for Railway (single proxy hop), but fragile if infrastructure changes. Moving to Cloudflare + Railway (2 hops) or direct exposure (0 hops) would break IP resolution for rate limiting.

## Findings

- **Source:** security-sentinel (Medium — downgraded to P3 because the code comment already explains it and infra change is hypothetical)
- **File:** `src/server.ts:28`

## Proposed Solution

The existing inline comment is good. Optionally add a more explicit note:
```typescript
// Railway = 1 proxy hop. If adding Cloudflare, change to 2.
// If exposed directly (no proxy), set to false.
app.set("trust proxy", 1);
```

- **Effort:** Small
- **Risk:** None

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-26 | Created from code review of cb7e3f3 | Infrastructure assumptions should be documented where they're used |
