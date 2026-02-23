# Batch 1 — Skill Findings

**Date:** 2026-02-22
**Skills applied:** 2

## frontend-design

**Path:** ~/.claude/plugins/cache/every-marketplace/compound-engineering/2.28.0/skills/frontend-design
**Recommendations:**

1. **Replace system font stack with a paired body font.** The plan uses Playfair Display for headings but falls back to `-apple-system, BlinkMacSystemFont...` for body text. Pair with Source Sans 3 (humanist sans, readable at data-table sizes).
   ```html
   <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Source+Sans+3:wght@400;500;600&display=swap" rel="stylesheet">
   ```

2. **Extract CSS variables.** The mockup hardcodes hex values everywhere. Before implementation, pull the palette into `:root` variables:
   ```css
   :root {
     --color-bg: #faf8f5;
     --color-surface: #fff;
     --color-text: #2c2419;
     --color-text-muted: #8a7e6d;
     --color-border: #e8e2d9;
     --color-gold: #cf9145;
     --color-green: #5a8a5e;
     --color-red: #b54a3a;
     --font-display: 'Playfair Display', Georgia, serif;
     --font-body: 'Source Sans 3', -apple-system, sans-serif;
     --shadow-sm: 0 1px 3px rgba(44,36,25,0.08);
   }
   ```

3. **Eliminate desktop/mobile HTML duplication.** The mockup renders every lead twice (table row + mobile card). For dynamic rendering, use CSS grid on table rows at mobile breakpoint instead — one render path, one set of event handlers.
   ```css
   @media (max-width: 768px) {
     .leads-table thead { display: none; }
     .leads-table tbody tr.lead-row {
       display: grid;
       grid-template-columns: 1fr auto;
       gap: 4px 12px;
       padding: 16px;
       border-bottom: 1px solid var(--color-border);
     }
   }
   ```

4. **Use `credentials: 'include'` instead of storing auth in a JS variable.** The browser already sends Basic Auth on page load — `fetch()` with `credentials: 'include'` reuses those credentials automatically. Simpler and more secure.

5. **Add client-side `esc()` function for XSS protection.** Lead data comes from inbound emails (untrusted input). Any user-supplied string going into innerHTML needs escaping:
   ```javascript
   function esc(str) {
     if (!str) return '';
     const div = document.createElement('div');
     div.textContent = str;
     return div.innerHTML;
   }
   ```

6. **Fix detail panel animation.** Replace `max-height: 1200px` hack with measured `scrollHeight` for consistent-feeling accordion open/close regardless of content length.

7. **Add staggered page-load animation.** ~12 lines of CSS, no JS. Stat cards fade in with 50ms stagger, table fades in after:
   ```css
   @keyframes fadeSlideIn {
     from { opacity: 0; transform: translateY(8px); }
     to { opacity: 1; transform: translateY(0); }
   }
   .stat-card { animation: fadeSlideIn 0.35s ease forwards; opacity: 0; }
   .stat-card:nth-child(1) { animation-delay: 0.05s; }
   .stat-card:nth-child(2) { animation-delay: 0.10s; }
   .stat-card:nth-child(3) { animation-delay: 0.15s; }
   .stat-card:nth-child(4) { animation-delay: 0.20s; }
   ```

8. **Wrap API response in an object, not a bare array.** Return `{ leads: [...], total: N }` so pagination can be added later without breaking the frontend.

**Priority summary:**

| Recommendation | Priority |
|---------------|----------|
| CSS variables | High |
| `credentials: 'include'` for auth | High |
| XSS `esc()` function | High |
| Eliminate mobile HTML duplication | High |
| Body font pairing | Medium |
| API response shape `{ leads, total }` | Medium |
| Detail panel animation fix | Low |
| Page load stagger animation | Low |

---

## agent-native-architecture

**Path:** ~/.claude/plugins/cache/every-marketplace/compound-engineering/2.28.0/skills/agent-native-architecture
**Recommendations:**

1. **Add `GET /api/leads/:id` endpoint.** The list endpoint strips `raw_email` for performance, but there's no way to read the full detail of a single lead. This is a parity gap — the expanded row UI shows data the API can't retrieve individually.

2. **Add `POST /api/leads/:id/reject` endpoint (~10 lines).** Without this, the only way to move a lead out of "received" is to approve it. A reject endpoint marks `status = "done"`, `done_reason = "rejected_dashboard"`. Closes the "how do I dismiss a lead?" gap.

3. **Keep the bundled approve endpoint as-is.** The skill flags it as a "workflow-shaped tool" anti-pattern, but for a single-user personal tool, bundling SMS + status update into one atomic action is actually a good safety pattern. Document the trade-off for future reference.

4. **Enrich `GET /api/stats` response.** Add `total`, `failed`, and `done` counts alongside the existing `pending`, `sent`, `avg_score`, `this_month`. Cheap to compute, saves frontend derivation.

5. **Separate auth boundary for `/api/analyze`.** Don't mix authenticated and unauthenticated routes under the same `/api/` prefix. Move the analyze endpoint to `/webhook/analyze` or `/ingest/analyze` to make the boundary clear.

6. **Add a `safeParse()` helper** to avoid repeating try/catch three times per lead:
   ```ts
   function safeParse(json: string | null): Record<string, unknown> | null {
     if (!json) return null;
     try { return JSON.parse(json); }
     catch { return null; }
   }
   ```

7. **Add `LIMIT 500` safety net** to the list query. Prevents serializing thousands of records if duplicates are created.

**Capability map (planned vs. recommended):**

| Action | Planned? | Recommendation |
|--------|----------|---------------|
| View lead list | Yes | Good |
| View single lead | **No** | Add `GET /api/leads/:id` |
| Filter/sort | Yes | Good |
| View stats | Yes | Enrich with total/failed/done |
| Approve lead | Yes | Good (keep bundled) |
| Edit draft | Yes | Good |
| Reject lead | **No** | Add `POST /api/leads/:id/reject` |
