---
status: done
priority: p3
issue_id: "011"
tags: [code-review, quality, frontend, cosmetic]
dependencies: ["003"]
---

# Hide empty stage rows after 429 error

## Problem Statement

Cosmetic issue. `resetAnalyze()` makes the stages panel visible before the fetch. If a 429 fires immediately, the stages panel shows empty rows alongside the error message. Not broken, just untidy.

## Findings

- **Source:** julik-frontend-races-reviewer (Low)
- **File:** `public/dashboard.html` — `.catch()` handler in `runAnalyze()`

## Proposed Solution

Hide stages panel in the error handler:
```javascript
.catch(function (err) {
    document.getElementById('analyzeStages').style.display = 'none';
    var errBox = document.getElementById('analyzeError');
    // ...
})
```

- **Effort:** Small (1 line)
- **Risk:** None

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-26 | Created from code review of cb7e3f3 | Cosmetic polish — empty progress indicators alongside error messages look broken |
