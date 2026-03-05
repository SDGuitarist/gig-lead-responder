---
status: pending
priority: p1
issue_id: "023"
tags: [code-review, security, xss, dashboard]
dependencies: []
unblocks: ["029"]
sub_priority: 1
---

# 023: XSS via unescaped LLM values in dashboard innerHTML

## Problem Statement

Three functions in `public/dashboard.html` inject untrusted data into innerHTML without escaping. The most critical is `analyzeKvHTML`, which receives LLM-generated values (classification, pricing, gate data) and passes them raw into HTML. Since LLM output is attacker-influenced (via crafted lead emails), this is an active stored XSS vector. Combined with Basic Auth credentials stored in a JS closure (`authHeader`), successful XSS leads to credential theft.

**Found by:** Dashboard XSS Agent, corroborated by Learnings Researcher (escape-at-interpolation-site.md pattern)

## Findings

### analyzeKvHTML (P1 - primary vector)
- `dashboard.html:2155-2161` -- `p[1]` (value) is NOT escaped; only `p[0]` (label) uses `esc()`
- Call sites at lines 2171-2218 pass LLM-derived numbers/strings: `competition_quote_count`, `duration_hours`, `anchor`, `floor`, `quote_price`
- These values come from `/api/analyze` SSE endpoint -> LLM JSON output -> directly into innerHTML
- Violates `docs/solutions/architecture/escape-at-interpolation-site.md` spirit: the last function touching a string before innerHTML should escape it

### fmtDate / fmtTimestamp (P2 - secondary vector)
- `dashboard.html:1360-1365` -- returns raw input `str` when date is invalid (`isNaN(d.getTime())`)
- Used in innerHTML at lines 1666, 1712, 2324, 2326, 2356, 2368
- `event_date` comes from LLM classification of untrusted lead emails
- A date field containing `<img src=x onerror=alert(1)>` would pass the NaN check and render as HTML

### STATUS_DISPLAY fallback (P2 - tertiary vector)
- `dashboard.html:1655` -- `STATUS_DISPLAY[l.status] || { label: l.status, css: '' }` uses raw status as label
- Injected into innerHTML at lines 1672, 1709
- Requires unexpected status value in DB (migration artifact, manual edit)

## Proposed Solutions

### Solution A: Escape at interpolation site (Recommended)
**Pros:** Minimal change, follows existing solution doc pattern
**Cons:** Must identify all interpolation sites
**Effort:** Small
**Risk:** Low

1. In `analyzeKvHTML`: wrap all non-HTML values in `esc()`. For intentionally-HTML values (gate status spans), use a flag or separate code path:
```js
function analyzeKvHTML(pairs) {
  return pairs.map(function (p) {
    var val = p[2] ? p[1] : esc(String(p[1])); // p[2] = isHTML flag
    return '<div class="analyze-kv"><span class="analyze-kv-label">' +
      esc(p[0]) + '</span><span class="analyze-kv-value">' + val + '</span></div>';
  }).join('');
}
```

2. In `fmtDate` and `fmtTimestamp`: escape the fallback return:
```js
if (isNaN(d.getTime())) return esc(str);
```

3. In STATUS_DISPLAY fallback: escape the label:
```js
var st = STATUS_DISPLAY[l.status] || { label: esc(l.status), css: '' };
```

### Solution B: Switch to textContent/DOM API
**Pros:** Eliminates HTML injection by construction
**Cons:** Major refactor of rendering code
**Effort:** Large
**Risk:** Medium (regression risk in 2,474-line file)

## Acceptance Criteria

- [ ] All `analyzeKvHTML` call sites pass escaped values (or use isHTML flag for intentional HTML)
- [ ] `fmtDate` and `fmtTimestamp` escape their fallback returns
- [ ] `STATUS_DISPLAY` fallback escapes the label
- [ ] Manual test: inject `<img src=x onerror=alert(1)>` as event_date in a test lead, verify it renders as text not HTML
- [ ] No visual regression in analyze panel, lead table, follow-up cards

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-05 | Created from final verification review | Three separate vectors, all on innerHTML paths |
