---
status: done
priority: p2
issue_id: "004"
tags: [code-review, quality, frontend, yagni]
dependencies: []
---

# Remove content-type sniffing dead code in runAnalyze() 429 handler

## Problem Statement

The `response.ok` check in `runAnalyze()` sniffs `Content-Type` to decide whether to parse the 429 response as JSON or text. But the custom rate limit handler **always** returns `application/json`. The text fallback branch is dead code.

```javascript
var contentType = response.headers.get('content-type') || '';
if (contentType.includes('application/json')) {
    return response.json().then(function (err) { ... });
}
// This branch can never execute against our own server:
return response.text().then(function (text) { ... });
```

## Findings

- **Source:** code-simplicity-reviewer
- **File:** `public/dashboard.html:2030-2040`
- **Evidence:** `createLimitHandler` always calls `res.status(429).json(...)`. The text fallback handles a scenario that does not exist. 11 lines can become 4.

## Proposed Solutions

### Option A: Direct .json() parse matching apiPost pattern (Recommended)
```javascript
if (!response.ok) {
    return response.json().then(function (body) {
        throw new Error(body.error || 'API error ' + response.status);
    });
}
```

- **Pros:** 4 lines instead of 11, matches existing `apiPost` pattern, removes dead code
- **Cons:** If a reverse proxy ever sends a non-JSON 429, `.json()` rejects — but the downstream `.catch()` still shows an error
- **Effort:** Small
- **Risk:** None

## Technical Details

- **Affected files:** `public/dashboard.html`

## Acceptance Criteria

- [ ] Content-type sniffing removed
- [ ] 429 response parsed as JSON directly
- [ ] Error still displays correctly in UI on rate limit

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-26 | Created from code review of cb7e3f3 | Dead code from belt-and-suspenders thinking — the handler always returns JSON |

## Resources

- PR commit: cb7e3f3
