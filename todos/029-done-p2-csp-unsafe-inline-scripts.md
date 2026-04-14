---
status: done
priority: p2
issue_id: "029"
tags: [code-review, security, xss]
dependencies: ["023"]
unblocks: []
sub_priority: 4
---

# 029: CSP allows unsafe-inline for scripts -- weakens XSS defense-in-depth

## Problem Statement

The Content Security Policy at `server.ts:47` includes `script-src 'self' 'unsafe-inline'`. This disables CSP's XSS protection for inline scripts. If any XSS vector bypasses `esc()` (see 023), CSP will not block it. The dashboard uses inline `<script>` blocks, requiring `unsafe-inline`.

**Found by:** Security Sentinel

## Findings

- `src/server.ts:47` -- `script-src 'self' 'unsafe-inline'`
- `public/dashboard.html` -- all JS is inline in `<script>` tags

## Proposed Solutions

### Solution A: Extract JS to external file + remove unsafe-inline (Recommended)
**Effort:** Medium | **Risk:** Low
Move inline JS to `/public/dashboard.js`, update CSP to `script-src 'self'`.

### Solution B: Nonce-based CSP
**Effort:** Medium | **Risk:** Low
Generate a random nonce per request, set `script-src 'nonce-<random>'`, add nonce to script tags.

## Acceptance Criteria

- [ ] CSP no longer includes `unsafe-inline` for scripts
- [ ] Dashboard functions correctly with external JS or nonce
- [ ] CSP blocks injected inline scripts (manual test)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-05 | Created from final verification review | Defense-in-depth for 023 XSS fix |
