# Pattern Recognition Specialist — Review Findings

**Agent:** pattern-recognition-specialist
**Branch:** fix/batch-d-quick-wins
**Date:** 2026-02-25
**Files reviewed:** 2 (`src/api.ts`, `src/server.ts`)

## Findings

### [P2] Helmet middleware registered AFTER express.static — static files served without security headers
**File:** `src/server.ts:21-30`
**Issue:** Express middleware runs in registration order. `express.static()` is on line 21, `helmet()` on lines 22-30. Requests for static files (HTML, JS, CSS, images) are returned without Helmet's security headers. Since the dashboard is served as a static HTML file, this defeats the purpose of the CSP directive added in this branch.
**Suggestion:** Move `helmet()` above `express.static()`. Helmet should be the very first middleware so all responses get security headers.

---

### [P2] Unsanitized error messages still sent via SMS in twilio-webhook.ts (3 locations)
**File:** `src/twilio-webhook.ts:197`
**File:** `src/twilio-webhook.ts:210`
**File:** `src/twilio-webhook.ts:219`
**Issue:** This branch sanitized error responses in `src/api.ts`, but `twilio-webhook.ts` still has three catch blocks that send raw error messages directly to the user via SMS:
```typescript
sendSms(`Error approving: ${err instanceof Error ? err.message : String(err)}`)
sendSms(`Error editing lead #${leadId}: ${err instanceof Error ? err.message : String(err)}`)
sendSms(`Error processing edit: ${err instanceof Error ? err.message : String(err)}`)
```
These could leak internal details (database errors, API key references) to the SMS recipient. While currently gated by `ALEX_PHONE` check, this violates the security pattern established by this branch.
**Suggestion:** Apply the same sanitization pattern: log the real error server-side, send a generic SMS message:
```typescript
handleApproval(leadId).catch((err) => {
  console.error("Approval handler error:", err);
  sendSms("Something went wrong approving the lead. Check the dashboard.").catch(console.error);
});
```

---

### [P3] postPipelineError sends truncated but unsanitized error in SMS
**File:** `src/post-pipeline.ts:76-81`
**Issue:** `postPipelineError` truncates the raw error message to 100 characters and sends it via SMS: `Pipeline failed: ${truncated}`. While sent only to the admin phone and truncation limits exposure, it follows the old pattern rather than the sanitized pattern established by this branch.
**Suggestion:** Lower priority — consider as future cleanup. The SMS could say "Pipeline failed — check dashboard" while keeping the full error in the DB record.

---

### [P3] Code duplication: error sanitization pattern repeated without abstraction
**File:** `src/api.ts:140-145` and `src/api.ts:296-298`
**Issue:** The two sanitized catch blocks follow an identical pattern: `console.error(context, err)` then return a generic error message. Combined with unsanitized blocks in `twilio-webhook.ts`, there are 5 catch blocks across 2 files doing variants of the same thing. Not severe enough to refactor now (the blocks are simple), but inconsistency risk grows as more endpoints are added.
**Suggestion:** Not urgent — current two instances in `api.ts` are clear enough. If this pattern appears in more files, consider a small utility.

---

### [P3] CSP allows 'unsafe-inline' scripts (technical debt)
**File:** `src/server.ts:27`
**Issue:** The CSP directive allows `'unsafe-inline'` for scripts, which weakens XSS protection. Necessary because dashboard HTML uses inline `<script>` tags, but worth noting as technical debt.
**Suggestion:** Future session: migrate inline scripts to external `.js` files, then remove `'unsafe-inline'`. Not actionable in this branch.

---

## Summary

| Severity | Count | Description |
|----------|-------|-------------|
| P2 | 2 | Helmet ordering bug; unsanitized SMS errors in twilio-webhook.ts |
| P3 | 3 | postPipelineError SMS leak; minor duplication; CSP unsafe-inline |
