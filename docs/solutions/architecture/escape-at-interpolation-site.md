---
title: "Escape at the Interpolation Site"
category: architecture
tags: [xss, escaping, innerHTML, defense-in-depth, security]
module: dashboard
symptoms:
  - Some template interpolations use esc() and others don't
  - Helper function accepts arbitrary strings but only escapes some parameters
  - innerHTML built from mixed trusted/untrusted sources
date_documented: 2026-02-25
---

# Escape at the Interpolation Site

## Problem

The `analyzeKvHTML` helper builds key-value table rows for the analyze panel.
It accepts `[label, value]` pairs and inserts them into `innerHTML`. The value
was escaped by some callers but not all, and the label was never escaped:

```js
function analyzeKvHTML(pairs) {
  return pairs.map(function(p) {
    return '<tr><td>' + p[0] + '</td><td>' + p[1] + '</td></tr>';
  }).join('');
}

// Caller 1: value escaped by caller
analyzeKvHTML([["Status", esc(g.gate_status).toUpperCase()]])

// Caller 2: value NOT escaped — XSS vector
analyzeKvHTML([["Status", g.gate_status.toUpperCase()]])
```

The `gate_status` field comes from LLM JSON output. If the model produces
malformed output containing HTML, it executes as DOM content. Combined with
Basic Auth credentials stored in a JS closure, this XSS could extract
credentials.

## Root Cause

Escaping responsibility was split between the helper and its callers, with no
consistent rule about who does what. When the escaping burden is on the caller,
every new call site is a potential miss.

## Solution

Escape inside the function that interpolates into HTML, not at the call site:

```js
// Label escaped inside the function (C-14)
function analyzeKvHTML(pairs) {
  return pairs.map(function(p) {
    return '<tr><td>' + esc(p[0]) + '</td><td>' + p[1] + '</td></tr>';
  }).join('');
}

// Value escaped at the interpolation site (B-2)
analyzeKvHTML([["Status", esc(g.gate_status).toUpperCase()]])
```

The rule: **the last function to touch a string before it enters `innerHTML`
is responsible for escaping it.** If the helper builds the HTML, the helper
escapes. If the caller builds the string and passes it as already-formatted
HTML, the caller escapes before passing.

For `gate_status` specifically: `esc()` was added at the call site (B-2) and
the label parameter was escaped inside the helper (C-14).

## What Was Rejected

- **Escaping both label and value inside the helper** — Would double-escape
  values that callers already escaped. The helper can't know if the value was
  pre-escaped.
- **Switching to `textContent` assignment** — Would require restructuring from
  string concatenation to DOM API calls. Correct long-term but too large a
  change for a targeted fix batch.

## Risk Resolution

**Flagged by:** Review P1 #2 (security-sentinel) and P3 #33

**What happened:** Two separate fixes (B-2 for the value, C-14 for the label)
closed both vectors. All `analyzeKvHTML` interpolation paths now go through
`esc()`.

**Lesson:** When building HTML from strings, the escaping rule must be
unambiguous: escape at the point of interpolation, not at the point of origin.
If a function signature accepts `string` and outputs `innerHTML`, it must
either escape internally or document that callers must pre-escape.

## Prevention

- **Review signal:** Any function that concatenates parameters into HTML strings
  (`innerHTML`, template literals with `.join('')`) must escape every dynamic
  parameter.
- **Grep pattern:** Search for `innerHTML` assignments and verify every
  interpolated variable passes through `esc()` or equivalent.
- **Long-term:** Migrate to a template system (tagged templates, DOM API, or
  framework components) that escapes by default.

## Related

- No existing related docs/solutions/ files.
