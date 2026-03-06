---
status: pending
priority: p2
issue_id: "044"
tags: [code-review, security, xss, dashboard]
dependencies: []
unblocks: []
sub_priority: 4
---

# 044: FORMATTERS numeric outputs bypass esc() -- defense-in-depth gap

## Problem Statement

In `public/dashboard.html:2291-2296`, the `currency`, `pct`, `integer`, and `days` formatters output directly into innerHTML without calling `esc()`. They rely on `Number()` coercion to guarantee safe output. Only the `text` formatter calls `esc()`.

Currently safe because all values flowing through are numbers from SQL aggregates. But the pattern is fragile: if a future column definition mistakenly routes a string through a numeric formatter, the input would bypass escaping.

**Found by:** Security Sentinel, noted by TypeScript Reviewer

## Proposed Solutions

### Option A: Wrap formatter outputs with esc() (Recommended)
```javascript
currency: function(v) { return v == null ? '\u2014' : esc('$' + Number(v).toLocaleString()); },
```
- **Effort:** Small (4 lines changed)
- **Risk:** None -- double-escaping a number string is a no-op

### Option B: Validate Number() returned finite before formatting
```javascript
currency: function(v) { var n = Number(v); return v == null || !isFinite(n) ? '\u2014' : '$' + n.toLocaleString(); },
```
- **Effort:** Small
- **Risk:** None

## Recommended Action

Option A -- simpler, defense-in-depth, zero cost.

## Technical Details

- **File:** `public/dashboard.html:2291-2296`

## Acceptance Criteria

- [ ] All FORMATTERS outputs are either escaped or guaranteed safe via type coercion + validation

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-05 | Created from review | Security Sentinel flagged fragile pattern |
