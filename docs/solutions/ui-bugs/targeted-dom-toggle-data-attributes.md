---
title: "Targeted DOM Toggle via Data Attributes"
category: ui-bugs
tags: [dom, data-attributes, accordion, performance, dashboard, vanilla-js]
module: dashboard
symptoms:
  - Full page re-render on every row click
  - Textarea content lost when expanding a different row
  - Scroll position resets on row interaction
  - Input focus lost after clicking expand/collapse
  - Approve button flash animation replays on unrelated row clicks
date_documented: 2026-02-22
---

# Targeted DOM Toggle via Data Attributes

## Problem

The dashboard's expandable row detail used a simple approach: on row click, call
`renderTable()` + `renderMobile()` to rebuild the entire DOM. The render
functions checked `expandedId` to decide which row's panel should be open. This
worked but destroyed all transient state — textarea content being typed, scroll
position, focus on form elements — because every element was recreated from
scratch on every click.

## Root Cause

The toggle function had no way to address individual panels. It only knew how
to rebuild everything:

```js
// BROKEN: full DOM rebuild on every click
function toggleDetail(id) {
  expandedId = (expandedId === id) ? null : id;
  renderTable(currentLeads);   // destroys + recreates all rows
  renderMobile(currentLeads);  // destroys + recreates all cards
}
```

When `renderTable` rebuilds the `<tbody>`, every DOM node — including textareas
with unsaved content, buttons with pending animations, and the scroll position
of overflow containers — is discarded and recreated.

## Solution

Add `data-detail` attributes to detail panels during rendering, then use
`querySelectorAll` to surgically toggle individual panels without touching the
rest of the DOM:

### Step 1: Mark panels during render

```js
// In renderTable() — each detail panel gets a data-detail attribute
row += '<tr class="detail-row" data-detail="' + l.id + '">' +
  '<td colspan="7"><div class="detail-panel' + (isOpen ? ' open' : '') +
  '" data-detail="' + l.id + '">' +
  (isOpen ? renderDetailPanel(l) : '') +
  '</div></td></tr>';

// Same in renderMobile()
'<div class="detail-panel' + (isOpen ? ' open' : '') +
'" data-detail="' + l.id + '">' + ... + '</div>';
```

### Step 2: Toggle by selector, not by re-render

```js
function toggleDetail(id) {
  var prevId = expandedId;
  expandedId = (expandedId === id) ? null : id;

  // Collapse previous — find by data attribute, clear content
  if (prevId !== null) {
    var prevPanels = document.querySelectorAll('[data-detail="' + prevId + '"]');
    for (var i = 0; i < prevPanels.length; i++) {
      prevPanels[i].classList.remove('open');
      prevPanels[i].innerHTML = '';
    }
  }

  // Expand new — find by data attribute, inject content
  if (expandedId !== null) {
    var lead = null;
    for (var j = 0; j < currentLeads.length; j++) {
      if (currentLeads[j].id === expandedId) lead = currentLeads[j];
    }
    if (lead) {
      var panels = document.querySelectorAll('[data-detail="' + expandedId + '"]');
      for (var k = 0; k < panels.length; k++) {
        panels[k].classList.add('open');
        panels[k].innerHTML = renderDetailPanel(lead);
      }
    }
  }
}
```

### Why this works

- **Only 2 DOM operations per click** — collapse old panel, expand new panel.
  Every other row, card, textarea, and scroll container is untouched.
- **Works for both table and mobile** — `querySelectorAll` finds all elements
  with the matching `data-detail` value, regardless of whether they're in the
  desktop table or the mobile card list.
- **Accordion behavior preserved** — `expandedId` still tracks the one open
  panel. The data attribute is just the addressing mechanism.

## What Was Rejected

- **Virtual DOM / framework** — Would solve this elegantly but adding React or
  a similar library to a single static HTML file is massive overkill. The
  dashboard is ~1500 lines of vanilla JS and should stay that way.
- **CSS-only toggle** — Could use `:target` or hidden checkbox hack, but
  the panel content is injected dynamically (gut check bars, pricing grids).
  CSS can show/hide a panel but can't generate its content on demand.
- **Keeping expanded panel content always in the DOM** — Would eliminate the
  innerHTML injection but means rendering every lead's detail panel upfront
  (25+ panels with charts, grids, and buttons). Lazy rendering on expand is
  cheaper.

## Prevention

- **In vanilla JS dashboards, never re-render a parent to update a child.**
  If you need to toggle one element, address it directly. `data-*` attributes
  are the standard way to tag elements for programmatic selection without
  polluting IDs or class names.
- **If `renderX()` is called on every interaction** (not just data changes),
  it's a smell. Render functions should run when data changes; toggle functions
  should run when visibility changes. Keep them separate.
- **Test with a textarea** — before shipping an accordion, type something in a
  textarea inside one row, then click a different row. If the text disappears,
  the toggle is too destructive.

## Related

- No existing related docs/solutions/ files.
