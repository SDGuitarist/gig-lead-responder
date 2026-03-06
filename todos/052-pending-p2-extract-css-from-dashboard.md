---
status: pending
priority: p2
issue_id: "052"
tags: [code-review, architecture, dashboard, line-budget]
dependencies: []
unblocks: ["046"]
sub_priority: 7
---

# 047: Extract CSS from dashboard.html to recover line budget

## Problem Statement

`public/dashboard.html` is at 2,694 lines (96% of the 2,800 line budget). ~950 lines are CSS in `<style>` tags. Extracting CSS to a separate file recovers ~950 lines of headroom immediately, with zero logic changes.

**Found by:** Architecture Strategist

## Proposed Solutions

### Option A: Extract to dashboard.css (Recommended)
Move all `<style>` content to `/public/dashboard.css` and add a `<link>` tag.
- **Effort:** Small (cut-and-paste, add link tag)
- **Risk:** None -- pure separation of concerns
- **Recovers:** ~950 lines of headroom

## Recommended Action

Option A. Zero-risk change that unblocks future feature additions.

## Technical Details

- **File:** `public/dashboard.html` (source), `public/dashboard.css` (target, new file)

## Acceptance Criteria

- [ ] All CSS moved to external file
- [ ] Dashboard renders identically
- [ ] dashboard.html drops to ~1,750 lines

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-05 | Created from review | At 96% budget, next feature forces emergency extraction |
