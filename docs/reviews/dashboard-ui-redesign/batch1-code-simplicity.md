# Code Simplicity Reviewer — Review Findings

**Agent:** code-simplicity-reviewer
**Branch:** main (commits ddb515d..d5b34fe)
**Date:** 2026-02-22
**Files reviewed:** 6

## Findings

### [P1] Old dashboard (`src/dashboard.ts`) is dead weight — 185 lines serving a superseded UI

**File:** `src/dashboard.ts` (all 185 lines)
**Issue:** The old server-rendered HTML dashboard at `/leads` is still mounted in `server.ts`, still imported, and still fully functional. But the root URL now redirects to `/dashboard.html`. The new dashboard does everything the old one did plus more. This means: 185 lines of dead rendering code, duplicate helpers (`esc()`, `statusBadge()`, `formatDate()`, `layout()`), confusing dual routes, and two code paths for the same data.
**Suggestion:** Delete `src/dashboard.ts` entirely and remove its import/mount from `server.ts`. It is in git history if needed.

---

### [P1] 728 lines of inline CSS in a single HTML file

**File:** `public/dashboard.html:8-735`
**Issue:** The `<style>` block is 728 lines — almost half the file. Much is polish for a single-user tool: hover transitions, cubic-bezier animations for the approve flash, three responsive breakpoints, pulse keyframes, embedded SVG data URIs. The CSS alone has more lines than `api.ts` + `auth.ts` + `server.ts` combined.
**Suggestion:** Two options: (1) Move to `public/dashboard.css` for readability and caching. (2) Cut ~150-200 lines of polish CSS (mobile cards, approve flash animation, hover transitions).

---

### [P2] `shapeLead()` manually maps 25+ fields instead of passing rows through

**File:** `src/api.ts:22-72`
**Issue:** This 50-line function manually picks 20 fields and extracts 9 derived fields from parsed JSON. The only client is `dashboard.html`, which Alex controls. The function also duplicates gut-check counting logic that the dashboard JS already has for the Analyze tab.
**Suggestion:** Simplify to pass the raw lead record plus parsed JSON (`...lead, classification: safeJsonParse(...), pricing: safeJsonParse(...), gate: safeJsonParse(...)`). Cuts from 50 to ~8 lines.

---

### [P2] Duplicate `esc()` function — two independent implementations

**File:** `src/dashboard.ts:12-15` vs `public/dashboard.html:942-947`
**Issue:** Server-side regex-based `esc()` and client-side DOM-based `esc()`. Different implementations for the same thing.
**Suggestion:** Deleting `src/dashboard.ts` (P1 above) fixes this.

---

### [P2] `listLeads()` in `leads.ts` is now unused by the new dashboard

**File:** `src/leads.ts:210-219`
**Issue:** The original `listLeads()` (no filters, no sort) is only called by the old `dashboard.ts`. The new dashboard uses `listLeadsFiltered()`. If the old dashboard is removed, `listLeads()` may become dead code.
**Suggestion:** After removing old dashboard, grep for remaining callers. If none, delete it.

---

### [P2] `getLeadsByStatus()` in `leads.ts` appears unused

**File:** `src/leads.ts:126-135`
**Issue:** `getLeadsByStatus()` is superseded by `listLeadsFiltered()` which does the same filtering plus sorting.
**Suggestion:** Check if anything imports it. If not, delete it. Saves 10 lines.

---

### [P2] Auth applied piecemeal across two files instead of once

**File:** `src/api.ts:8-9`, `src/dashboard.ts:8`
**Issue:** Auth is applied per-path with separate `router.use()` calls. Meanwhile `/api/analyze` has no auth at all — anyone can trigger Anthropic API calls.
**Suggestion:** Apply auth once in `server.ts`: `app.use("/api", basicAuth);`

---

### [P2] `/api/analyze` endpoint has no authentication

**File:** `src/server.ts:51`
**Issue:** Triggers the full AI pipeline (real Anthropic API costs) with no auth. All other API routes are protected.
**Suggestion:** Add `basicAuth` middleware to the route or move it into `api.ts`.

---

### [P3] Approve flash animation is 34 lines of CSS for a 1.2-second effect

**File:** `public/dashboard.html:423-457`
**Issue:** Full-screen green checkmark animation with SVG, stroke-dasharray animation, and cubic-bezier transition. Used a few times per week by one person.
**Suggestion:** Replace with a simple button color change. Saves ~34 lines CSS + 3 lines HTML.

---

### [P3] Mobile card view is a complete second rendering path (~140 lines)

**File:** `public/dashboard.html:474-531` (CSS), `1195-1236` (JS), `827-831` (HTML)
**Issue:** Entirely separate rendering pipeline from the desktop table with its own CSS classes, render function, and click handler. Every action must call both `renderTable()` and `renderMobile()`. This is a single-user tool used on a laptop.
**Suggestion:** Remove mobile card view. Use horizontal scroll on the table for small screens. Saves ~140 lines.

---

### [P3] `CHECK_NAMES` map has 14 entries for a display-only label

**File:** `public/dashboard.html:913-928`
**Issue:** Translates snake_case check names to Title Case, but the fallback on line 1091 already does `c.replace(/_/g, ' ')` which produces nearly the same result.
**Suggestion:** Remove `CHECK_NAMES` and use the fallback. Add a 2-line `titleCase` helper if needed.

---

### [P3] `FORMAT_NAMES` duplicates TypeScript-side constants

**File:** `public/dashboard.html:896-904`
**Issue:** Presentation map that converts DB enum values to human-readable names. If `shapeLead()` were simplified, the API could include the human-readable name server-side.
**Suggestion:** Low priority. Leave as-is or move server-side.

---

### [P3] `safeJsonParse` helper could be inlined

**File:** `src/api.ts:13-20`
**Issue:** 8-line function called exactly 3 times, all inside `shapeLead()`. If `shapeLead` is simplified, these calls go away.
**Suggestion:** Low priority. Resolves if `shapeLead` is simplified.

---

## Summary

| Severity | Count | Estimated LOC Reduction |
|----------|-------|------------------------|
| P1 | 2 | ~385 (old dashboard + CSS extraction/cut) |
| P2 | 5 | ~80 (shapeLead, dead functions, auth) |
| P3 | 4 | ~190 (mobile cards, flash, CHECK_NAMES) |
| **Total** | **11** | **~650 lines removable** out of ~2010 total |

### YAGNI Violations
- Mobile card layout (~140 lines for a laptop-only user)
- Three responsive breakpoints (900px, 768px, 480px)
- Approve flash animation (34 lines of CSS)
- `FORMAT_NAMES` and `CHECK_NAMES` hand-maintained maps with adequate automatic fallbacks
