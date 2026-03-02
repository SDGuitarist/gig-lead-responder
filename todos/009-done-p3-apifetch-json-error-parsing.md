---
status: done
priority: p3
issue_id: "009"
tags: [code-review, quality, frontend, pre-existing]
dependencies: []
---

# apiFetch doesn't parse JSON error body on non-ok responses

## Problem Statement

Pre-existing issue. `apiFetch` (used for GET requests) shows raw "API error {status}" instead of the server's error message. `apiPost` already parses the JSON body correctly. If rate limiting ever expands to GET endpoints, browser users see an unhelpful error.

## Findings

- **Source:** security-sentinel (Low) + agent-native-reviewer (observation)
- **File:** `public/dashboard.html:1231-1234`

## Proposed Solution

Align `apiFetch` with `apiPost`:
```javascript
if (!res.ok) {
    return res.json().then(function (err) {
        return Promise.reject(new Error(err.error || 'API error ' + res.status));
    }).catch(function () {
        return Promise.reject(new Error('API error ' + res.status));
    });
}
```

- **Effort:** Small
- **Risk:** Low

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-26 | Created from code review of cb7e3f3 | Pre-existing inconsistency — two agents flagged it independently |
