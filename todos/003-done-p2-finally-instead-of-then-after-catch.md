---
status: done
priority: p2
issue_id: "003"
tags: [code-review, quality, frontend]
dependencies: []
---

# Use .finally() instead of .then() after .catch() for button cleanup

## Problem Statement

In `runAnalyze()`, the button re-enable logic is a `.then()` after `.catch()`:

```javascript
.catch(function (err) { ... })
.then(function () {
    btn.disabled = false;
    btn.textContent = 'Analyze';
});
```

This works because `.then()` after `.catch()` runs regardless — but if `.catch()` itself throws (e.g., `getElementById` returns null), the `.then()` is skipped and the button stays disabled forever. `.finally()` communicates the intent ("always run this cleanup") and handles that edge case.

## Findings

- **Source:** kieran-typescript-reviewer (Medium)
- **File:** `public/dashboard.html:2079-2086`
- **Evidence:** The `.catch()` handler accesses `document.getElementById('analyzeError')` without a null check. If that element were missing, the `.then()` cleanup would not run.

## Proposed Solutions

### Option A: Replace .then() with .finally() (Recommended)
```javascript
.catch(function (err) {
    var errBox = document.getElementById('analyzeError');
    if (errBox) {
        errBox.textContent = 'Network error: ' + err.message;
        errBox.style.display = 'block';
    }
})
.finally(function () {
    btn.disabled = false;
    btn.textContent = 'Analyze';
});
```

- **Pros:** Semantic match for cleanup, handles catch-throws, supported in all modern browsers
- **Cons:** None
- **Effort:** Small (rename `.then` to `.finally`, add null guard in `.catch`)
- **Risk:** None

## Technical Details

- **Affected files:** `public/dashboard.html`

## Acceptance Criteria

- [ ] Button re-enable uses `.finally()` not `.then()` after `.catch()`
- [ ] `.catch()` handler has null guard on `getElementById`
- [ ] Button always re-enables, even if error display fails

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-26 | Created from code review of cb7e3f3 | .finally() is the semantic match for cleanup blocks in promise chains |

## Resources

- PR commit: cb7e3f3
