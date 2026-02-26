# Data Integrity Guardian — Review Findings

**Agent:** data-integrity-guardian
**Branch:** fix/batch-d-quick-wins
**Date:** 2026-02-25
**Files reviewed:** 4 (package.json, src/server.ts, src/api.ts, package-lock.json)

## Summary

The changes on this branch are narrowly scoped: (1) add Helmet security headers, (2) sanitize two error response paths so internal error details are no longer leaked to API consumers. The data layer (`leads.ts`) is untouched. No new database operations were introduced. The changes are safe from a data integrity perspective, with two minor observations noted below.

## Findings

### [P3] Helmet middleware runs after `express.static` — security headers may not apply to static assets
**File:** `src/server.ts:21-30`
**Issue:** In Express, middleware is applied in registration order. The `express.static` middleware is registered on line 21, and Helmet is registered on lines 22-30. When a static file is served, `express.static` sends the response and short-circuits the middleware chain, so Helmet's headers (X-Content-Type-Options, Strict-Transport-Security, etc.) will NOT be set on responses for static assets (HTML, CSS, JS in `/public`). This is a defense-in-depth gap — if the dashboard HTML is served without `X-Content-Type-Options: nosniff`, a browser MIME-sniffing attack against static files becomes possible.
**Suggestion:** Move the `helmet()` middleware registration above `express.static`:
```typescript
// server.ts — move helmet before static
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

### [P3] SMS failure rollback restores pre-claim status — correct but not documented
**File:** `src/api.ts:141-143`
**Issue:** This is a pre-existing pattern, not introduced by this branch, but the diff touches this block. When SMS fails on line 140, line 142 restores `lead.status` (captured on line 116, before `claimLeadForSending` atomically set it to `'sending'`). The rollback is correct: it restores the original status (`'received'` or `'sent'`), making the lead approvable again. However, the restored status is the value from before the claim, and there is a subtle window: if another request somehow changed the lead's status between the `getLead` read (line 116) and the `claimLeadForSending` call (line 133), the rollback would restore a stale value. In practice this cannot happen because `claimLeadForSending` uses `WHERE status IN ('received','sent')` which would fail if the status had changed, and SQLite's WAL mode serializes writes. No code change needed, but a comment explaining the rollback rationale would help future maintainers.
**Suggestion:** Add a brief comment above line 142:
```typescript
// Rollback: restore the status captured before claimLeadForSending()
// set it to 'sending'. Safe because claimLeadForSending's WHERE clause
// guarantees no intervening status change occurred.
updateLead(id, { status: lead.status });
```

---

### [P3] Error messages in SMS-based flows (twilio-webhook.ts) still include raw error details
**File:** `src/twilio-webhook.ts:197,210,219`
**Issue:** This branch sanitized error responses in `api.ts` (the HTTP API), but the SMS error handlers in `twilio-webhook.ts` still send raw `err.message` content via SMS to the user's phone (lines 197, 210, 219). While SMS is a private channel (only sent to `ALEX_PHONE`), this is an inconsistency with the sanitization goal. If an internal error contains a database path, API key fragment, or stack trace line, it would be sent as SMS text. This was not introduced by the branch — it is pre-existing — but it is the same category of issue the branch aims to fix.
**Suggestion:** Consider sanitizing SMS error messages in a future batch to match the API sanitization pattern:
```typescript
// Instead of:
sendSms(`Error approving: ${err instanceof Error ? err.message : String(err)}`)
// Consider:
console.error("Approval handler error:", err);
sendSms(`Error approving lead. Check server logs.`)
```

## Non-Findings (Verified Safe)

- **Data validation at API boundaries**: All endpoints validate input types, check required fields, and use whitelisted enum sets before touching the database. No new validation gaps introduced.
- **Transaction boundaries**: The `claimLeadForSending` atomic claim pattern correctly prevents double-SMS.
- **Referential integrity**: No foreign key relationships modified. SQLite CHECK constraints remain consistent.
- **JSON body size limit**: `express.json({ limit: "100kb" })` remains in effect.
- **No data loss risk**: Changes only modify error response formatting and add HTTP headers. No database writes, schema changes, or data transformations were altered.
