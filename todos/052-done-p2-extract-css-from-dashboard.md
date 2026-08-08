---
status: done
priority: p2
issue_id: "052"
tags: [code-review, architecture, dashboard, line-budget]
dependencies: []
unblocks: ["046"]
sub_priority: 7
---

# 052: Extract CSS from dashboard.html to recover line budget

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
| 2026-08-07 | Verified complete; status flipped to done | Landed in 6baf6cd (not 8641f3b); dashboard.html has 0 `<style>` blocks and 0 inline `style=` attrs; CSS served via express.static in src/app.ts:68. Heading said "047", a stale batch artifact; filename/issue_id "052" is authoritative. Note: dashboard.html has since grown back to 1,867 lines (above the ~1,750 target, still inside the 2,800 budget) from later feature work, so the line-budget number is stale but the extraction itself is complete |
