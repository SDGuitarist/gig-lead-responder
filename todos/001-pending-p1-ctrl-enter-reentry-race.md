---
status: done
priority: p1
issue_id: "001"
tags: [code-review, quality, frontend, race-condition]
dependencies: []
---

# Ctrl+Enter keyboard shortcut bypasses in-flight guard

## Problem Statement

The `runAnalyze()` function in `dashboard.html` disables the Analyze button (`btn.disabled = true`) to prevent double-clicks, but the Ctrl+Enter keyboard shortcut listener at line 2091-2093 has **no guard**. A user pressing Ctrl+Enter while an analysis is in-flight fires a second `runAnalyze()`, causing two concurrent SSE `readChunk()` loops fighting over the same DOM nodes — stage indicators flicker, results overwrite each other.

## Findings

- **Source:** julik-frontend-races-reviewer (HIGH severity)
- **File:** `public/dashboard.html:2091-2093`
- **Evidence:** The keyboard shortcut calls `runAnalyze()` directly without checking `btn.disabled`:
  ```javascript
  document.getElementById('analyzeInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) runAnalyze();
  });
  ```
- **Impact:** User-visible UI corruption — flickering stages, interleaved results from two pipeline runs

## Proposed Solutions

### Option A: Guard at top of runAnalyze() (Recommended)
Add `if (btn.disabled) return;` before the disable line, using the existing button state as the in-flight flag.

```javascript
function runAnalyze() {
    var text = document.getElementById('analyzeInput').value.trim();
    if (!text) return;
    var btn = document.getElementById('analyzeBtn');
    if (btn.disabled) return;  // guard against keyboard re-entry
    btn.disabled = true;
    // ...
}
```

- **Pros:** One line, no new variables, uses existing state
- **Cons:** None
- **Effort:** Small (1 line)
- **Risk:** None

### Option B: Guard in the keyboard listener
```javascript
document.getElementById('analyzeInput').addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !document.getElementById('analyzeBtn').disabled) runAnalyze();
});
```

- **Pros:** Prevents even entering the function
- **Cons:** Duplicates the guard logic in two places (button click handler and keyboard listener)
- **Effort:** Small (1 line change)
- **Risk:** Low, but Option A is more defensive

## Recommended Action

Option A — guard at top of `runAnalyze()`.

## Technical Details

- **Affected files:** `public/dashboard.html`
- **Components:** `runAnalyze()` function, keyboard shortcut listener

## Acceptance Criteria

- [ ] Pressing Ctrl+Enter while analysis is in-flight does NOT start a second analysis
- [ ] Button stays disabled until the first analysis completes or errors
- [ ] No interleaved stage/result rendering

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-26 | Created from code review of cb7e3f3 | Frontend races reviewer caught this — keyboard shortcuts need the same guards as button clicks |

## Resources

- PR commit: cb7e3f3
- Plan: docs/plans/2026-02-26-feat-api-rate-limiting-plan.md
