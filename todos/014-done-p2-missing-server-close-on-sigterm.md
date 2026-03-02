---
status: done
priority: p2
issue_id: "014"
tags: [code-review, operations, follow-up-pipeline]
dependencies: []
---

# Missing server.close() on SIGTERM

## Problem Statement

The SIGTERM handler stops the scheduler but does not call `server.close()`. On Railway (container platform), SIGTERM signals the process to drain connections and exit. Without closing the HTTP server, in-flight requests may be dropped and the process may hang until Railway sends SIGKILL (10 seconds later).

## Findings

- **Source:** TypeScript reviewer (HIGH)
- **File:** `src/server.ts:60-63`
- **Evidence:** `process.on("SIGTERM")` calls `stopFollowUpScheduler()` but not `server.close()`

## Proposed Solutions

### Option A: Store server reference and close on SIGTERM (Recommended)

```typescript
const server = app.listen(PORT, () => {
  console.log(`Gig Lead Responder running at http://localhost:${PORT}`);
  startFollowUpScheduler();
});

process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down...");
  stopFollowUpScheduler();
  server.close(() => {
    console.log("HTTP server closed");
    process.exit(0);
  });
});
```

- **Pros:** Clean shutdown, drains in-flight requests
- **Cons:** Slightly more code
- **Effort:** Small (5 min)
- **Risk:** Low

## Recommended Action

Option A.

## Technical Details

- **Affected files:** `src/server.ts`

## Acceptance Criteria

- [ ] `app.listen()` return value stored in `server` const
- [ ] SIGTERM handler calls `server.close()` with callback that calls `process.exit(0)`
- [ ] `tsc --noEmit` passes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-26 | Created from code review | TypeScript reviewer flagged as HIGH — Railway will SIGKILL after 10s if process doesn't exit |
