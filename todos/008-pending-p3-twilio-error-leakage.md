---
status: done
priority: p3
issue_id: "008"
tags: [code-review, security, pre-existing]
dependencies: []
---

# SMS failure path may leak Twilio internals to client

## Problem Statement

Pre-existing issue (not introduced by this PR). The approve endpoint forwards raw Twilio SDK error messages to the client, which may contain account SIDs, partial phone numbers, or internal API URLs.

## Findings

- **Source:** security-sentinel (Low)
- **File:** `src/api.ts:141-146`
- **Evidence:** `res.status(500).json({ error: \`SMS failed: ${message}\` })` passes unfiltered error

## Proposed Solution

Log full error server-side, return generic message:
```typescript
console.error(`SMS failed for lead ${id}:`, err);
res.status(500).json({ error: "SMS delivery failed. Check server logs." });
```

- **Effort:** Small
- **Risk:** None

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-26 | Created from code review of cb7e3f3 | Pre-existing — plan acknowledged this as out of scope |
