---
status: done
priority: p2
issue_id: "002"
tags: [code-review, quality, typescript, yagni]
dependencies: []
---

# Rate limit handler: replace factory with shared handler + fix type signature

## Problem Statement

Two issues in `src/rate-limit.ts` that overlap in the same code:

1. **YAGNI factory:** `createLimitHandler(msg)` is a higher-order function, but both call sites pass the identical message string. The `msg` parameter is a generalization with zero current use cases.

2. **Type mismatch:** The handler returns `(req: Request, res: Response) => void` but express-rate-limit v8 expects `(req: Request, res: Response, next: NextFunction, options: Options) => void`. Works at runtime (JS ignores extra args) but would fail strict TypeScript checking.

## Findings

- **Source:** kieran-typescript-reviewer (Medium) + code-simplicity-reviewer
- **File:** `src/rate-limit.ts:9-14`
- **Evidence:** Both limiters pass identical `"Too many requests. Please wait before trying again."` — the factory adds indirection for zero benefit

## Proposed Solutions

### Option A: Single shared handler with correct types (Recommended)
```typescript
import rateLimit, { type Options } from "express-rate-limit";
import type { Request, Response, NextFunction } from "express";

const WINDOW_MS = 15 * 60 * 1000;

const handler = (req: Request, res: Response, _next: NextFunction, _options: Options) => {
  console.warn(`Rate limit hit: ${req.method} ${req.path} from ${req.ip}`);
  res.status(429).json({ error: "Too many requests. Please wait before trying again." });
};

export const analyzeLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: 5,
  handler,
  standardHeaders: true,
  legacyHeaders: false,
});

export const approveLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: 10,
  handler,
  standardHeaders: true,
  legacyHeaders: false,
});
```

- **Pros:** Removes factory, fixes types, 4 fewer lines, flatter code
- **Cons:** If messages need to diverge later, split into two plain functions
- **Effort:** Small
- **Risk:** None

## Recommended Action

Option A.

## Technical Details

- **Affected files:** `src/rate-limit.ts`

## Acceptance Criteria

- [ ] No `createLimitHandler` factory function
- [ ] Handler signature matches express-rate-limit v8's `RateLimitExceededEventHandler` type
- [ ] Both limiters share a single handler reference
- [ ] `tsc` compiles without errors

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-26 | Created from code review of cb7e3f3 | Two agents independently flagged the same function — factory YAGNI + type mismatch |

## Resources

- PR commit: cb7e3f3
