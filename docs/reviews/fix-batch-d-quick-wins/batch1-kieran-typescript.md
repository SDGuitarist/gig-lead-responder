# Kieran TypeScript Reviewer — Review Findings

**Agent:** kieran-typescript-reviewer
**Branch:** fix/batch-d-quick-wins
**Date:** 2026-02-25
**Files reviewed:** 2 (`src/server.ts`, `src/api.ts`)

## Findings

### [P1] Helmet middleware registered AFTER express.static — static files get no security headers
**File:** `src/server.ts:21-30`
**Issue:** Express middleware runs top-to-bottom. `express.static` is on line 21, `helmet()` on lines 22-30. When a request matches a static file, `express.static` sends the response and the request never reaches `helmet()`. The HTML files in `public/` (`dashboard.html`, `index.html`, `mockup-hybrid.html`) — the primary targets for XSS/clickjacking protections — are completely unprotected. Helmet is effectively a no-op for the most important attack surface.
**Suggestion:** Move `helmet()` above `express.static`:
```typescript
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: false }));
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        scriptSrc: ["'self'", "'unsafe-inline'"],
      },
    },
  })
);
app.use(express.static(join(import.meta.dirname, "..", "public")));
```

---

### [P3] Inconsistent `catch` annotation: `err` vs `err: unknown`
**File:** `src/api.ts:140` and `src/api.ts:296`
**Issue:** The SMS catch block uses `catch (err)` (line 140) while the analyze catch block uses `catch (err: unknown)` (line 296). With `strict: true` in tsconfig, `useUnknownInCatchVariables` makes both functionally identical. The inconsistency within the same file across two commits suggests a style that was not intentionally chosen.
**Suggestion:** Pick one style and use it consistently. Since `strict: true` already enforces `unknown`, drop the explicit annotation from line 296 (less noise), or add it to line 140 — just be consistent.

---

### [P3] Helmet CSP risk addressed — directive merge verified correct (informational)
**File:** `src/server.ts:22-30`
**Issue:** Not a finding — verification of the flagged risk from the work phase. Helmet v8 merges the provided `scriptSrc` override with all its default directives (`default-src 'self'`, `font-src`, `form-action`, `frame-ancestors`, `img-src`, `object-src`, `script-src-attr`, `style-src`, `upgrade-insecure-requests`). The merge behavior is correct. No action needed on this specific concern.

---

## Summary

| Severity | Count | Summary |
|----------|-------|---------|
| P1 | 1 | Helmet after static middleware — HTML pages get no security headers |
| P3 | 1 | Inconsistent `catch` annotation style |
| P3 | 1 | Flagged risk verified correct (informational) |
