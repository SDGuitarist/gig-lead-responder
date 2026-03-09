---
title: "fix: P3 bundle 061 — Cache-Control, event_type migration, CSP unsafe-inline"
type: fix
status: active
date: 2026-03-08
feed_forward:
  risk: "fillMonthlyGaps deferred — single caller, no move needed yet"
  verify_first: false
---

# fix: P3 bundle 061

Three deferred P3 items from Cycle 15 review (PR #10). All mechanical,
low-risk fixes. fillMonthlyGaps relocation deferred (single caller, review
said "not now"). CSS newline already fixed — skipped.

### Prior Phase Risk

> No brainstorm (skipped — clear review findings). No prior "least confident"
> to address.

## What exactly is changing?

1. `src/server.ts` — add `maxAge` to `express.static()` options
2. `src/db/migrate.ts` — add one-shot UPDATE to normalize stale `event_type` rows (includes blank→NULL)
3. `src/db/leads.ts` — harden write path so empty-after-trim becomes NULL, not `''`
4. `src/db/queries.ts` — remove `LOWER(TRIM())` wrapper from Query 6
5. `public/dashboard.html` — extract 14 non-dynamic inline styles to CSS classes, convert 2 dynamic widths to `data-width` + JS assignment
6. `public/dashboard.css` — add CSS classes for extracted styles, add `.mobile-card-muted`
7. `src/server.ts` — remove `'unsafe-inline'` from `style-src` CSP

## What must NOT change?

- Dashboard visual appearance (pixel-identical before/after)
- Pipeline behavior (no LLM prompt or pipeline code touched)
- Auth middleware ordering (healthcheck must stay before session auth)
- Nonce-based script CSP (only touching style-src, not script-src)
- Any passing test (62/62 must stay green)
- `express.static` must still serve from `public/` directory

## How will we know it worked?

- `curl -I /dashboard.css` returns `Cache-Control: public, max-age=3600`
- Three separate SQL checks all return 0:
  - `SELECT COUNT(*) FROM leads WHERE event_type IS NULL` — shows how many NULLs exist (informational, not zero)
  - `SELECT COUNT(*) FROM leads WHERE event_type = ''` — must be 0
  - `SELECT COUNT(*) FROM leads WHERE event_type IS NOT NULL AND event_type != LOWER(TRIM(event_type))` — must be 0
- Query 6 uses plain `event_type` (no LOWER/TRIM wrapper)
- `grep -c 'style=' public/dashboard.html` returns 0 for static HTML portion
- CSP header shows `style-src 'self' https://fonts.googleapis.com` (no unsafe-inline)
- Dashboard renders identically in browser
- No CSP violations in browser console
- 62/62 tests pass

## What is the most likely way this plan is wrong?

The 2 dynamic `style="width:X%"` attributes (gut-check bar line 482, chart bar
line 1241) use string concatenation to build HTML. The `data-width` + post-render
JS approach requires hooking into every place these elements get inserted via
innerHTML. If a render hook is missed, bars render at 0 width.

**Mitigation:** The render hooks are explicitly identified below. The gut-check
bar is only created in `renderDetailPanel`. The chart bar is only created in
the table builder called from `renderInsights`. Both functions set innerHTML on
a known container, so the post-render query runs immediately after that
assignment.

## SpecFlow Analysis Findings

SpecFlow identified these gaps (incorporated into the fixes below):

### Cross-fix dependency: Fix A + Fix C deploy order

If Cache-Control (Fix A) deploys simultaneously with CSS extraction (Fix C),
users with a cached OLD `dashboard.css` load new HTML with no inline styles and
no replacement classes. **Broken styles for up to 1 hour.**

**Resolution:** Add `?v=2` cache-busting param to the CSS `<link>` tag in
`dashboard.html` when adding new classes. This forces immediate re-fetch
regardless of Cache-Control. Commit 3 (style extraction) adds the param.

### Whitespace-only and empty-string event_type values

`LOWER(TRIM('   '))` produces `''` (empty string), not NULL. Empty string is
not a valid event_type. Additionally, the current write path in `insertLead`
uses `?.trim().toLowerCase() ?? null` — if input is `"  "`, this produces `""`
(nullish coalescing doesn't catch empty string).

**Resolution:**
- Migration: CASE expression converts both blank-after-trim and non-normalized
  rows. Blank→NULL (disappears from "Revenue by Event Type" — correct because
  Query 6 already filters `WHERE event_type IS NOT NULL`).
- Write path: change `?? null` to `|| null` in `insertLead` so empty-after-trim
  also becomes NULL, preventing future `''` rows.

### Opacity 0.7 vs 0.65 discrepancy

Line 626 sets `style="opacity:0.7"` but existing `.row-muted` class uses
`opacity: 0.65`. These were probably meant to be the same.

**Resolution:** Update `.row-muted` to `opacity: 0.7` to match current JS
behavior (what users actually see), then use the class for desktop rows.

### Mobile muted state needs its own class

Line 626 applies `style="opacity:0.7"` to mobile cards (`<div class="mobile-card">`).
The existing `.row-muted` selector is `tr.row-muted td { opacity: 0.65; }` —
scoped to table rows, not divs.

**Resolution:** Add `.mobile-card-muted { opacity: 0.7; }` in `dashboard.css`.
At line 626, replace `' style="opacity:0.7"'` with `' mobile-card-muted'`
appended to the class list (the mobile card already has `class="mobile-card"`).

### display:none on load-more wrapper

Line 107 has `style="display:none"` on `#loadMoreWrap`. JS toggles visibility
at lines 442-443 and 452:
- Show: `element.style.display = ''` (sets inline to empty string)
- Hide: `element.style.display = 'none'`

If initial `display:none` moves to a CSS class, the show path
(`element.style.display = ''`) removes the inline override but the CLASS still
hides it.

**Resolution:** Move initial `display:none` to `.load-more-wrap` CSS class.
Change the JS show path from `= ''` to `= 'block'` (the element is a
`<div>` containing a centered button — `block` is correct). The hide path
(`= 'none'`) already works since inline style overrides class.

### Exact inline style count

Full inventory is **16 occurrences** (5 in static HTML, 11 in JS-generated
strings including the 2 dynamic widths). All 16 must be converted — CSP
`unsafe-inline` removal is all-or-nothing.

---

## Fix A: Cache-Control headers

**File:** `src/server.ts:77`

**Current:**
```ts
app.use(express.static(join(import.meta.dirname, "..", "public")));
```

**Change to:**
```ts
app.use(express.static(join(import.meta.dirname, "..", "public"), { maxAge: "1h" }));
```

**Why 1 hour:** Assets aren't versioned (no hash in filenames), so aggressive
caching would serve stale CSS/JS after deploys. 1 hour is a safe default —
reduces 304 round-trips without risking stale content for long.

**Note:** `dashboard.html` is served via the nonce-injection route (lines 71-74),
not by `express.static`, so it won't get cached headers. This is correct —
HTML should not be aggressively cached.

**Commit scope:** ~1 line changed in server.ts.

---

## Fix B: Stale event_type migration + write-path hardening

**Files:** `src/db/migrate.ts`, `src/db/leads.ts:90`, `src/db/queries.ts:179-188`

### What counts as invalid

An event_type row is invalid if any of:
1. `TRIM(event_type) = ''` — blank or whitespace-only
2. `event_type != LOWER(TRIM(event_type))` — not normalized (uppercase, leading/trailing spaces)

Both cases are handled by the same migration UPDATE.

### Product decision: blank event_type → NULL

Blank event_type values become NULL and disappear from "Revenue by Event Type."
This is correct because:
- Query 6 already filters `WHERE event_type IS NOT NULL`
- Empty string is not a meaningful event type
- The write path (`insertLead`) already normalizes, so blanks are legacy data

### Step 1: Add migration in initDb()

Add after existing migrations in `src/db/migrate.ts`:

```ts
// One-shot: normalize legacy event_type values (pre-insertLead normalization)
const staleCount = db.prepare(`
  SELECT COUNT(*) AS cnt FROM leads
  WHERE event_type IS NOT NULL
    AND (TRIM(event_type) = '' OR event_type != LOWER(TRIM(event_type)))
`).get() as { cnt: number };

if (staleCount.cnt > 0) {
  db.prepare(`
    UPDATE leads SET event_type =
      CASE WHEN TRIM(event_type) = '' THEN NULL
           ELSE LOWER(TRIM(event_type))
      END
    WHERE event_type IS NOT NULL
      AND (TRIM(event_type) = '' OR event_type != LOWER(TRIM(event_type)))
  `).run();
}
```

**Guard:** The count check means this is a no-op once all rows are normalized.
Safe to run on every startup (no table rebuild, no constraint changes).

**Why the WHERE includes both conditions:** `event_type != LOWER(TRIM(event_type))`
does NOT catch `''` because `LOWER(TRIM('')) = ''`. We need the explicit
`TRIM(event_type) = ''` check to catch empty strings and whitespace-only values.

### Step 2: Harden write path in insertLead

**File:** `src/db/leads.ts:90`

**Current:**
```ts
event_type: input.event_type?.trim().toLowerCase() ?? null,
```

**Change to:**
```ts
event_type: input.event_type?.trim().toLowerCase() || null,
```

**Why:** `??` only catches `undefined`/`null`. If `input.event_type` is `"  "`,
`?.trim()` produces `""`, `toLowerCase()` produces `""`, and `?? null` keeps
the empty string. Using `||` instead converts `""` to `null`, preventing future
blank rows.

### Step 3: Remove LOWER(TRIM()) from Query 6

**Current** (`src/db/queries.ts:179-188`):
```sql
SELECT LOWER(TRIM(event_type)) AS event_type, ...
GROUP BY LOWER(TRIM(event_type))
```

**Change to:**
```sql
SELECT event_type, ...
GROUP BY event_type
```

Remove the `-- LOWER(TRIM()) kept for legacy rows` comment too.

**Commit scope:** ~12 lines across 3 files.

---

## Fix C: CSP unsafe-inline removal

**Files:** `public/dashboard.html`, `public/dashboard.css`, `src/server.ts:53`

### Step 1: Extract all 14 non-dynamic inline styles to CSS classes

**Full inventory — 16 total inline styles, 14 non-dynamic + 2 dynamic:**

Create these classes in `dashboard.css`:

| # | Old inline style | New class name | Location | Source |
|---|-----------------|---------------|----------|--------|
| 1 | `text-align:center;padding:48px;color:#8a7e6d;` | `.placeholder-text` | Line 97 | Static HTML |
| 2 | `text-align:center;padding:48px;color:#8a7e6d;` | `.placeholder-text` | Line 104 | Static HTML |
| 3 | `display:none;text-align:center;padding:16px 0 24px;` | `.load-more-wrap` | Line 107 | Static HTML |
| 4 | `min-width:160px;` | `.btn-load-more` | Line 108 | Static HTML |
| 5 | `margin-top:10px;` | `.mt-10` | Line 124 | Static HTML |
| 6 | `text-align:center;padding:48px;color:#b54a3a;` | `.error-text` | Line 448 | JS string |
| 7 | `text-align:center;padding:48px;color:#b54a3a;` | `.error-text` | Line 450 | JS string |
| 8 | `color:#8a7e6d` | `.text-muted` | Line 609 | JS string |
| 9 | `opacity:0.7` on mobile card | `.mobile-card-muted` (new) | Line 626 | JS string |
| 10 | `color:#8a7e6d` | `.text-muted` | Line 646 | JS string |
| 11 | `text-align:center;padding:48px 16px;color:#8a7e6d;` | `.placeholder-text-mobile` | Line 661 | JS string |
| 12 | `text-align:center;padding:48px;color:#8a7e6d;` | `.placeholder-text` | Line 680 | JS string |
| 13 | `margin-top:10px;display:flex;gap:8px;` | `.edit-btn-row` | Line 782 | JS string |
| 14 | `color:#8a7e6d;font-style:italic` | `.text-scheduled` | Line 1487 | JS string |

*Dynamic (handled in Step 2):*
- Line 482: `style="width:X%"` — gut-check bar fill (in `renderDetailPanel`)
- Line 1241: `style="width:X%"` — breakdown chart bar (in table builder called from `renderInsights`)

**Opacity fix:** Update existing `.row-muted` from `opacity: 0.65` → `0.7` to
match what users currently see (desktop table rows).

**Mobile muted fix:** Add new `.mobile-card-muted { opacity: 0.7; }` class.
At line 626, change from building `' style="opacity:0.7"'` to appending
`' mobile-card-muted'` to the element's class attribute. The existing code is:
```js
var muted = (l.status === 'sent' || l.status === 'done') ? ' style="opacity:0.7"' : '';
// ...
return '<div class="mobile-card"' + muted + ' data-id="...
```
Change to:
```js
var muted = (l.status === 'sent' || l.status === 'done') ? ' mobile-card-muted' : '';
// ...
return '<div class="mobile-card' + muted + '" data-id="...
```

**loadMoreWrap fix:** Line 107 moves `display:none` to `.load-more-wrap` class.
JS at line 442-443 changes from `= ''` to `= 'block'` to override the class.
Line 452 (`= 'none'`) stays unchanged (inline `display:none` overrides class).

**Cache-busting:** Update CSS `<link>` tag to `/dashboard.css?v=2` in same commit
to prevent stale-cache + no-inline-styles breakage.

In `dashboard.html`, replace each `style="..."` with the corresponding `class="..."`.

### Step 2: Convert 2 dynamic width styles via data-width + JS post-render

**Approach:** Use `data-width` attribute in the HTML string, then apply
`element.style.width` via JS immediately after the innerHTML assignment.

**Line 482** (gut-check bar in `renderDetailPanel`):
```js
// BEFORE:
'<div class="gut-bar-fill ' + barClass + '" style="width:' + pct + '%"></div>'

// AFTER:
'<div class="gut-bar-fill ' + barClass + '" data-width="' + pct + '"></div>'
```

**Line 1241** (chart bar in table builder):
```js
// BEFORE:
'<div class="bar" style="width:' + barWidth + '%"></div>'

// AFTER:
'<div class="bar" data-width="' + barWidth + '"></div>'
```

**Shared post-render helper** (define once near top of script):
```js
function applyDataWidths(container) {
  container.querySelectorAll('[data-width]').forEach(function(el) {
    el.style.width = el.dataset.width + '%';
    el.removeAttribute('data-width');
  });
}
```

**Exact render hooks** — call `applyDataWidths(container)` immediately after
each innerHTML assignment that may contain `data-width` elements:

1. **Detail panel writes** — after `renderDetailPanel` sets innerHTML on the
   detail panel container. This is the only place gut-check bars are created.

2. **renderInsights** — after `renderInsights` sets innerHTML on
   `#insightsContent`. This is the only place chart bars are created (via the
   table builder function).

3. **renderTable / renderMobile** — these do NOT contain dynamic widths, so
   no hook needed. (Confirmed: neither function builds gut-check or chart bars.)

**Note:** JS `.style.width` assignments are NOT blocked by CSP `style-src`.
Only inline `style="..."` attributes in HTML are blocked. So once we move from
HTML string attributes to JS property assignments, CSP is satisfied.

### Step 3: Remove unsafe-inline from CSP

**File:** `src/server.ts:53`

**Current:**
```ts
"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
```

**Change to:**
```ts
"style-src 'self' https://fonts.googleapis.com; " +
```

### Verification

After all changes, open dashboard in browser and verify:
- All sections render correctly
- Gut-check bars show correct widths
- Chart bars render correctly
- No CSP violations in browser console
- Google Fonts still load
- Mobile cards for sent/done leads show muted opacity

**Commit scope:** ~35 lines CSS, ~35 lines HTML/JS changes, 1 line server.ts.

---

## Commit Order

| # | Scope | Files | Lines |
|---|-------|-------|-------|
| 1 | Cache-Control headers | `src/server.ts` | ~1 |
| 2 | event_type migration + write-path hardening + query cleanup | `src/db/migrate.ts`, `src/db/leads.ts`, `src/db/queries.ts` | ~15 |
| 3 | Extract 14 non-dynamic inline styles to CSS + cache-bust | `public/dashboard.html`, `public/dashboard.css` | ~55 |
| 4 | Convert 2 dynamic widths to JS + remove unsafe-inline | `public/dashboard.html`, `src/server.ts` | ~20 |

Commits 3 and 4 are split so the style extraction can be verified independently
before removing the CSP directive. Commit 3 includes the `?v=2` cache-busting
param on the CSS `<link>` tag to prevent stale-cache breakage.

## Acceptance Criteria

- [ ] `express.static` serves with `Cache-Control: public, max-age=3600`
- [ ] `SELECT COUNT(*) FROM leads WHERE event_type = ''` returns 0
- [ ] `SELECT COUNT(*) FROM leads WHERE event_type IS NOT NULL AND event_type != LOWER(TRIM(event_type))` returns 0
- [ ] `SELECT COUNT(*) FROM leads WHERE event_type IS NULL` returns a count (informational — confirms blanks migrated)
- [ ] Write path: `insertLead({event_type: "  "})` stores NULL, not `""`
- [ ] Query 6 uses plain `event_type` (no LOWER/TRIM)
- [ ] All 16 `style="` attributes removed from dashboard.html (14 to classes, 2 to data-width + JS)
- [ ] `.row-muted` opacity updated from 0.65 → 0.7 (desktop table rows)
- [ ] New `.mobile-card-muted` class applies opacity 0.7 to mobile cards
- [ ] `#loadMoreWrap` initial hide via CSS class, JS shows with `display = 'block'`
- [ ] CSS `<link>` has cache-busting param (`?v=2`)
- [ ] Dynamic widths applied via `applyDataWidths()` in exactly 2 render hooks: detail panel + insights
- [ ] CSP `style-src` has no `'unsafe-inline'`
- [ ] Dashboard renders identically in browser (desktop + mobile)
- [ ] No CSP violations in browser console
- [ ] 62/62 tests pass (`npm test`)

## Deferred

- **fillMonthlyGaps relocation** — single caller in queries.ts. Review said
  "extract when a second caller needs it." No second caller exists. Defer.

## Three Questions

1. **Hardest decision in this session?** Blank event_type → NULL vs "Unknown"
   bucket. Chose NULL because Query 6 already filters `WHERE event_type IS NOT
   NULL`, so blanks were already invisible in analytics. Making them explicitly
   NULL is consistent, and the write-path hardening prevents recurrence.

2. **What did you reject, and why?** Considered reusing `.row-muted` for mobile
   cards by broadening the selector from `tr.row-muted td` to
   `.row-muted, .mobile-card.row-muted`. Rejected because it couples two
   independent components (table rows and mobile cards) and the opacity values
   may diverge in the future. A dedicated `.mobile-card-muted` class is cleaner.

3. **Least confident about going into the next phase?** The `loadMoreWrap`
   display toggle. Changing `style.display = ''` to `style.display = 'block'`
   should work since it's a plain `<div>`, but if any CSS applies `display:flex`
   or `display:grid` to `#loadMoreWrap`, overriding with `'block'` would break
   the layout. Verified: the element is a simple centered wrapper — `block` is
   correct.
