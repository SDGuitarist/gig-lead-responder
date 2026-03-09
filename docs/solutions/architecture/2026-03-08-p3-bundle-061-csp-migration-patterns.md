---
title: "P3 Bundle 061 — CSP-Compliant Dynamic Styles, Data Migration, and Cache-Busting"
date: 2026-03-08
category: architecture
problem_type: csp-compliance, data-normalization, deploy-safety
components:
  - public/dashboard.html
  - public/dashboard.css
  - src/server.ts
  - src/db/migrate.ts
  - src/db/leads.ts
  - src/db/queries.ts
commits:
  - 3347228
  - f65d371
  - "5120055"
  - c128563
tags:
  - csp
  - data-width-pattern
  - event-type-migration
  - cache-busting
  - inline-style-extraction
  - write-path-hardening
---

# P3 Bundle 061 — CSP, Migration, and Cache-Busting Patterns

## Problem

Three deferred P3 findings from Cycle 15 review:

1. **No Cache-Control on static assets** — every page load re-fetches CSS/JS
2. **Stale `event_type` rows** — legacy data with inconsistent casing, whitespace,
   and empty strings corrupting "Revenue by Event Type" analytics
3. **CSP `unsafe-inline` in `style-src`** — 16 inline `style="..."` attributes
   blocked full CSP compliance

## Root Cause

1. `express.static()` used with no `maxAge` option — defaults to no caching
2. `insertLead` used `?? null` (nullish coalescing) which doesn't catch empty
   strings after `.trim()`. Legacy rows were never normalized.
3. Dashboard HTML mixed static inline styles (14) with dynamic width styles (2)
   built via string concatenation in JS

## Solution

### Pattern 1: data-width + applyDataWidths for CSP-Compliant Dynamic Styles

**When to use:** Any time JS builds HTML strings with computed `style="width:X%"`
values that get assigned via `innerHTML`.

**Why inline `style=` is blocked by CSP:** CSP `style-src` without `unsafe-inline`
blocks all inline style attributes in HTML markup. But JS property assignments
(`element.style.width = ...`) are NOT blocked — they go through the CSSOM, which
CSP does not govern.

**The pattern:**

```js
// 1. In HTML string, use data attribute instead of style
'<div class="bar" data-width="' + pct + '"></div>'

// 2. Shared helper (define once)
function applyDataWidths(container) {
  container.querySelectorAll('[data-width]').forEach(function(el) {
    el.style.width = el.dataset.width + '%';
    el.removeAttribute('data-width');
  });
}

// 3. Call immediately after every innerHTML assignment that produces data-width elements
container.innerHTML = renderDetailPanel(lead);
applyDataWidths(container);
```

**Contract obligation:** Every code path that sets `innerHTML` containing
`data-width` elements MUST call `applyDataWidths()` immediately after. If a
call site is missed, bars render at 0 width with no error. Document this
obligation with a contract comment above the function definition.

**Verification:** Search for all `innerHTML` assignments, confirm each one that
produces `data-width` elements has a matching `applyDataWidths()` call.

### Pattern 2: One-Shot Data Migration + Write-Path Hardening

**When to use:** Fixing legacy data that doesn't match current normalization
rules, where the write path also has a gap.

**The pattern has three steps:**

1. **Guard-check migration** — COUNT first, UPDATE only if stale rows exist.
   Safe to run on every startup (no-op after first normalization):
   ```ts
   const staleCount = db.prepare(`
     SELECT COUNT(*) AS cnt FROM leads
     WHERE event_type IS NOT NULL
       AND (TRIM(event_type) = '' OR event_type != LOWER(TRIM(event_type)))
   `).get() as { cnt: number };

   if (staleCount.cnt > 0) {
     db.prepare(`UPDATE leads SET event_type = CASE ... END WHERE ...`).run();
   }
   ```

2. **Harden write path** — Fix the operator that let invalid data through:
   ```ts
   // BEFORE: ?? doesn't catch empty string
   event_type: input.event_type?.trim().toLowerCase() ?? null,
   // AFTER: || catches empty string too
   event_type: input.event_type?.trim().toLowerCase() || null,
   ```

3. **Remove query-layer workaround** — Once data is clean at rest and writes
   are hardened, remove `LOWER(TRIM())` wrappers from queries. The data layer
   owns the contract, not the query layer.

**Key insight:** `??` (nullish coalescing) only catches `null`/`undefined`.
If `.trim()` produces `""`, `??` keeps it. Use `||` when empty string should
be treated as falsy.

### Pattern 3: Cache-Busting for Coupled CSS + HTML Changes

**When to use:** Adding CSS classes that HTML depends on, when Cache-Control
headers are set on static assets.

**The problem:** If Cache-Control (1h) deploys simultaneously with CSS extraction,
users with cached OLD `dashboard.css` load new HTML that references classes
that don't exist. Broken styles for up to 1 hour.

**The fix:** Add `?v=N` query parameter to the CSS `<link>` tag in the same
commit that adds the new classes:

```html
<link rel="stylesheet" href="/dashboard.css?v=2">
```

**Commit ordering matters:** The cache-bust must be in the same commit as the
style extraction, NOT in a separate commit. SpecFlow analysis identified this
as a cross-fix dependency — the kind of issue that only surfaces when you
think about deploy order, not just code correctness.

## Risk Resolution

**Flagged risk (from plan):** "applyDataWidths hooks might miss a render path"

**What happened:** Security Sentinel independently verified all 4 call sites
(lines 726, 922, 966, 1124) match all `innerHTML` assignments that produce
`data-width` elements. Coverage is complete.

**Lesson:** The data-width pattern is sound but has a maintenance obligation.
A contract comment above the function definition turns "must remember" into
documented obligation. This was filed as P2 todo 062.

## Verification Checklist Used

- `curl -I /dashboard.css` → `Cache-Control: public, max-age=3600`
- `SELECT COUNT(*) FROM leads WHERE event_type = ''` → 0
- `SELECT COUNT(*) FROM leads WHERE event_type IS NOT NULL AND event_type != LOWER(TRIM(event_type))` → 0
- `grep -c 'style=' public/dashboard.html` → 0 for static portion
- CSP header: `style-src 'self' https://fonts.googleapis.com` (no unsafe-inline)
- No CSP violations in browser console
- 62/62 tests pass

## Three Questions

1. **Hardest pattern to extract from the fixes?** The data-width + applyDataWidths
   pattern. It's not just "use data attributes" — the key insight is the contract
   obligation: every innerHTML assignment that produces data-width elements needs
   a matching call. The pattern is simple but the maintenance burden is real.

2. **What did you consider documenting but left out, and why?** The loadMoreWrap
   `display:none` → CSS class conversion. It's a standard pattern (initial hide
   via class, show via inline style override) with no project-specific insight.
   Not worth a named pattern.

3. **What might future sessions miss that this solution doesn't cover?** The `??`
   vs `||` distinction applies to other `insertLead` fields too (client_name,
   venue, budget_note). Those fields don't currently apply `.trim()` so empty
   strings can't be produced, but if normalization is added to those fields later,
   the same `??` bug will reappear. The review noted this as speculative/not
   actionable today.
