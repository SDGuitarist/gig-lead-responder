---
status: pending
priority: p3
issue_id: "057"
tags: [code-review, performance, dashboard]
dependencies: []
unblocks: []
sub_priority: 2
---

# 049: esc() creates DOM element per call -- replace with regex

## Problem Statement

The `esc()` function in `dashboard.html:1365-1369` creates a new DOM element on every call (`document.createElement('div')`). Used ~200-400 times per render. Negligible impact in practice but could be replaced with a regex escaper for ~10x speedup.

**Found by:** Performance Oracle

## Proposed Solutions

```javascript
function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
```

- **Effort:** Trivial (4-line replacement)
- **Risk:** Low -- must verify single-quote handling if needed

## Acceptance Criteria

- [ ] esc() no longer allocates DOM elements
- [ ] All existing escaping behavior preserved

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-05 | Created from review | Absolute time saved is microseconds |
