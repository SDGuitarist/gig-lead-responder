---
status: done
priority: p3
issue_id: "006"
tags: [code-review, agent-native, enhancement]
dependencies: ["002"]
---

# Add retry_after_seconds to 429 JSON response body

## Problem Statement

The `Retry-After` header is present (set by express-rate-limit before calling the custom handler), but the JSON body doesn't include retry timing. Naive API consumers (including LLM-based agents) that read response bodies but not headers miss the backoff signal.

## Findings

- **Source:** agent-native-reviewer (optional improvement)
- **File:** `src/rate-limit.ts:9-13`

## Proposed Solutions

```typescript
const handler = (req: Request, res: Response, _next: NextFunction, _options: Options) => {
  console.warn(`Rate limit hit: ${req.method} ${req.path} from ${req.ip}`);
  const retryAfter = res.getHeader('Retry-After');
  res.status(429).json({
    error: "Too many requests. Please wait before trying again.",
    retry_after_seconds: retryAfter ? Number(retryAfter) : null,
  });
};
```

- **Effort:** Small
- **Risk:** None — additive change

## Technical Details

- **Affected files:** `src/rate-limit.ts`

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-26 | Created from code review of cb7e3f3 | Standard headers are present; body enrichment is a nice-to-have for agent consumers |
