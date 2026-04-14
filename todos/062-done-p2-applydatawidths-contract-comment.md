---
status: done
priority: p2
issue_id: "062"
tags: [code-review, architecture, dashboard, maintainability]
dependencies: []
unblocks: []
sub_priority: 1
---

# 062 — Add contract comment to applyDataWidths

## Problem Statement

The `applyDataWidths()` function in `public/dashboard.html` must be called after
every `innerHTML` assignment that may produce elements with `data-width`
attributes. If a future code path forgets this call, bars render at 0 width with
no error — a silent rendering failure.

Currently 2 producer functions and 4 call sites. All are correctly hooked today,
but the obligation is undocumented.

## Findings

- **Architecture Strategist (P2):** "This is the 'shotgun surgery' smell — a
  single concern requires coordinated changes in multiple locations."
- **Security Sentinel:** Independently verified all 4 call sites are covered.
- **Code Simplicity Reviewer:** Confirmed the pattern is the simplest
  CSP-compliant approach (alternatives like CSS custom properties or nonces
  don't work here).

## Proposed Solutions

### Option A: Contract comment (Recommended)

Add a JSDoc-style comment above the `applyDataWidths` function listing producers
and the call obligation.

```js
/**
 * Apply data-width attributes as inline style.width via JS (CSP-compliant).
 * IMPORTANT: Call this after any innerHTML assignment that may contain
 * data-width elements. Current producers:
 *   - renderDetailPanel (gut-check bar, line ~489)
 *   - table builder in renderInsights (chart bar, line ~1252)
 * Call sites: detail expand (726), outcome preview (922), outcome save (966),
 * renderInsights (1124).
 */
```

- **Effort:** Small (1 comment block)
- **Risk:** None
- **Pros:** Zero code change, turns implicit contract into explicit docs
- **Cons:** Comments can go stale (but line numbers are approximate, function names are stable)

## Recommended Action

Option A. Add the comment.

## Technical Details

- **File:** `public/dashboard.html`, around line 198
- **Components:** applyDataWidths function + 4 call sites

## Acceptance Criteria

- [ ] Contract comment exists above `applyDataWidths` listing producers and call obligation
- [ ] No functional changes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-08 | Created from P3 bundle 061 review | Architecture Strategist flagged, Security Sentinel verified coverage |

## Resources

- Review: `docs/reviews/p3-bundle-061/REVIEW-SUMMARY.md`
- Plan: `docs/plans/2026-03-08-fix-p3-bundle-061-plan.md`
