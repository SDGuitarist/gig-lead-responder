# Express Middleware Order = Security Order

**Date:** 2026-02-25
**Branch:** `fix/batch-d-quick-wins`
**Files:** `src/server.ts`

## Problem

Helmet (security headers) was registered *after* `express.static`. Express
middleware runs in registration order — when a request matches a static file,
`express.static` sends the response immediately and the request never reaches
Helmet. The dashboard HTML files (the primary XSS/clickjacking targets) were
served with zero security headers.

The plan document said "add Helmet after `express.static`, before routes" which
*sounded* correct but was backwards. 7 of 9 review agents caught it.

## Pattern

**Security middleware must come before the middleware it protects.** In Express,
"before" means "registered first" — not "listed nearby in the file."

Correct order:

```
body parsers → security headers → static files → routes
```

Wrong order (what we had):

```
body parsers → static files → security headers → routes
```

## Why It's Easy to Get Wrong

1. "After static, before routes" reads like a position description, but Express
   doesn't have positions — it has a pipeline. Static *terminates* the pipeline
   for matching requests.
2. If you test with API routes, everything looks fine — Helmet applies to routes
   registered after it. The bug only affects static files.
3. Chrome DevTools shows security headers on API responses, giving false
   confidence.

## Related: CSP `scriptSrcAttr` Default

Helmet v8 defaults `script-src-attr` to `'none'`, which blocks inline event
handlers (`onclick="..."`). If your HTML uses `onclick`, you need:

```typescript
contentSecurityPolicy: {
  directives: {
    scriptSrc: ["'self'", "'unsafe-inline'"],
    scriptSrcAttr: ["'unsafe-inline'"],  // allow onclick handlers
  },
}
```

Chrome currently ignores `script-src-attr` when `script-src` includes
`'unsafe-inline'`, but Firefox enforces it. Always set both explicitly.

## Related: Error Sanitization Boundary

Same branch established a pattern: **raw errors must not leave the server
boundary**, regardless of transport (HTTP response or SMS). Apply to every
catch block that sends output externally:

```typescript
// Bad — raw error in SMS
sendSms(`Failed: ${err.message}`);

// Good — generic message, full error logged server-side
console.error("Pipeline failed:", err);
sendSms("Pipeline failed. Check dashboard for details.");
```

The DB can store the full error (dashboard is behind Basic Auth), but SMS and
HTTP responses get generic messages only.

## Risk Resolution

**Risk flagged (plan phase):** "Least confident about CSP configuration —
`unsafe-inline` is needed but weakens protection."

**What happened:** Review confirmed `unsafe-inline` is acceptable given
single-user Basic Auth dashboard. The *unexpected* risk was middleware
ordering — the plan's own instruction was the source of the bug.

**Lesson:** Review your own instructions, not just the code they produce.
"After X, before Y" is ambiguous in pipeline architectures — use explicit
ordering language like "registered first" or "runs before."

## Three Questions

1. **Hardest pattern to extract from the fixes?** Separating the middleware
   ordering lesson from the CSP config lesson. They're both about Helmet but
   are independent patterns — one is about Express pipeline semantics, the
   other is about browser CSP enforcement differences. Kept them in one doc
   with clear sections rather than splitting into two docs.

2. **What did you consider documenting but left out, and why?** The scattered
   error sanitization pattern (P2 #4 — Express error middleware as single
   enforcement point). Left it out because at ~7 catch blocks, the per-route
   pattern is still manageable and a centralized middleware would be premature
   abstraction. Worth revisiting if endpoints grow past ~15.

3. **What might future sessions miss that this solution doesn't cover?** The
   `unsafe-inline` tech debt (P2 #2). The dashboard works but CSP is largely
   defeated for script injection. Extracting inline scripts to external `.js`
   files would allow removing `unsafe-inline` — that's a full session of work
   not documented here.
