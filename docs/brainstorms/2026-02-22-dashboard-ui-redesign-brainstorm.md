# Dashboard UI Redesign — Brainstorm

**Date:** 2026-02-22
**Phase:** Brainstorm

## What We're Building

A beautifully designed personal dashboard for managing gig leads. Replaces the
current minimal vanilla HTML frontend (`public/index.html`) and server-rendered
dashboard (`src/dashboard.ts`) with a unified interface.

**Audience:** Alejandro only — personal tool, not client-facing.

**Primary workflow:** Lead comes in → open dashboard → see leads needing action →
review AI-generated draft → approve or edit → send.

## Why This Approach

We explored three design directions via parallel mockup agents:

1. **Dark + Polished** (Linear/Vercel style) — looked great but felt impersonal
2. **Warm Minimal** (Notion/musician notebook) — beautiful palette and personality
   but card-based layout wasn't information-dense enough
3. **Clean SaaS** (TextMagic/Gridle style) — great table layout and data density
   but generic blue SaaS look had no personality

**Chosen: Hybrid of Warm + Clean** — warm colors/fonts with clean table layout.

The winning mockup is at `public/mockup-hybrid.html`.

## Design Specifications

### Color Palette
| Token | Value | Usage |
|-------|-------|-------|
| Background | `#faf8f5` | Page background (warm cream) |
| Surface | `#ffffff` | Cards, table, modals |
| Primary | `#cf9145` | Buttons, active states, accents (warm gold) |
| Success | `#5a8a5e` | Sent status, approve confirmations (sage green) |
| Warning | `#c4873a` | Pending status (warm amber) |
| Error | `#b54a3a` | Failed status (muted red) |
| Text Primary | `#2c2419` | Headings, body text (warm charcoal) |
| Text Secondary | `#8a7e6d` | Labels, subtitles (warm grey) |
| Border | `#e8e2d9` | Dividers, card borders (warm light grey) |

### Typography
- **Headings:** Playfair Display (serif) — logo, page titles, stat numbers, scores
- **Body:** System sans-serif stack (`-apple-system, BlinkMacSystemFont, ...`)
- The serif/sans pairing gives musician personality without sacrificing readability

### Layout Structure
1. **Top bar:** "GigLead" logo (Playfair, "Lead" in gold) + tab nav (Queue / All / Analyze)
2. **Page header:** "3 gigs waiting for you" — warm, personal greeting
3. **Stats cards:** 4 horizontal cards (Pending, Sent, Avg Score, This Month) with warm left-border accents
4. **Filter + Sort:** Status filter pills (gold active) + sort dropdown
5. **Data table:** Columns — Event, Date, Venue, Format, Score, Status, Actions
6. **Expandable rows:** Click to reveal full/compressed drafts, gut checks, pricing, classification

### Key Interactions
- Tab switching between Queue (pending leads), All Leads, and Analyze (paste new lead)
- Filter pills show/hide rows by status
- Sort dropdown reorders by date, score, or event
- Row click expands detail panel (accordion — one at a time)
- Approve button: green checkmark flash → status flips to Sent → counters update
- Mobile responsive: table → card layout below 768px

## Key Decisions

1. **Hybrid design** — warm palette + clean table layout (not pure card-based or pure SaaS)
2. **No frontend framework** — stay with vanilla HTML/CSS/JS, keep it simple
3. **Single unified interface** — replaces both `public/index.html` and `src/dashboard.ts`
4. **Analyze tab** — the current "paste lead" analyzer becomes a tab, not a separate page
5. **Information-dense table** — all key data visible in columns without clicking

## Open Questions

1. Should the Analyze tab (paste + process new lead) use SSE streaming like today, or is a simpler loading state enough?
2. Should "Edit" open an inline textarea or a modal?
3. Do we need the compressed draft visible by default, or only in the expanded detail?
4. Should the dashboard eventually connect to real data via API, or keep server-rendering?

## Three Questions

1. **Hardest decision in this session?** Choosing between card-based (warm mockup) and table-based (clean mockup) layouts. Cards felt more personal but less functional — the table won because "all information up front" matters more for a review workflow.
2. **What did you reject, and why?** Rejected the dark mode direction entirely — it looked impressive but felt like someone else's tool, not a musician's. Also rejected using a frontend framework (React/Svelte) — the current vanilla approach works and adding a build step adds complexity for a single-user tool.
3. **Least confident about going into the next phase?** How to handle the Analyze tab integration. The current analyzer uses a manual SSE stream reader (`fetch` + `getReader`), and merging it into the new tabbed layout without breaking the streaming behavior needs careful planning.
