---
title: "Shallow Copy for Preview State"
category: ui-bugs
tags: [mutation, shared-state, preview, render, defensive-copy]
module: dashboard
symptoms:
  - UI shows stale or wrong values after an error during render
  - Shared object has unexpected field values after a failed operation
  - "Restore original value" pattern with no try/finally
date_documented: 2026-02-25
---

# Shallow Copy for Preview State

## Problem

The outcome dropdown `change` handler needed to show sub-fields (price input,
loss reason) immediately — before the server save completes. The original code
mutated the shared `lead` object in `currentLeads`, called `renderDetailPanel`
to build the preview HTML, then restored the original value:

```js
var orig = lead.outcome;
lead.outcome = sel.value || null;
lead._pendingOutcome = sel.value || null;
var html = renderDetailPanel(lead);
lead.outcome = orig;
delete lead._pendingOutcome;
```

If `renderDetailPanel` threw an exception, the restore lines never ran and
`lead.outcome` stayed permanently corrupted for the rest of the session. Five
of nine review agents flagged this independently — highest-convergence finding.

## Root Cause

The code treated a shared mutable object as a scratch pad. The mutate-render-
restore pattern assumes the render function is infallible. In JavaScript, any
function can throw (property access on undefined, template literal error, DOM
API exception). The "restore" step is not guaranteed.

## Solution

Create a shallow copy with the preview values. Never touch the original:

```js
var preview = Object.assign({}, lead, { outcome: sel.value || null });
panels[k].innerHTML = renderDetailPanel(preview);
```

The original `lead` object is never modified. If `renderDetailPanel` throws,
the shared state is untouched. The copy is a local variable that gets garbage
collected — no cleanup needed.

## What Was Rejected

- **`try/finally` around the mutation** — The review suggested this as a
  minimum fix. Rejected because it protects against the symptom (missing
  restore) without fixing the cause (mutation of shared state). The shallow
  copy eliminates the problem entirely with fewer lines and no restore logic.

- **Deep clone (`structuredClone`)** — Unnecessary. `renderDetailPanel` only
  reads top-level properties. A shallow copy is sufficient and cheaper.

## Risk Resolution

**Flagged by:** Batch A three questions ("Batch B has the `_pendingOutcome`
shared state fix — touches runtime behavior")

**What happened:** The shallow copy produced identical HTML. The `_pendingOutcome`
property was dead code (set then deleted, never read) and was removed entirely.

**Lesson:** When you need to preview a state change for rendering, always copy
the object. The "mutate, use, restore" pattern is never safe in a language
without deterministic destructors.

## Prevention

- **Review signal:** Any code that modifies an object, calls a function, then
  restores the original value is a mutation-restore pattern. Replace with a
  copy.
- **Grep pattern:** `delete obj._` or `obj.prop = orig` after a function call
  suggests a restore step that should be a copy instead.

## Related

- `docs/solutions/ui-bugs/targeted-dom-toggle-data-attributes.md`
