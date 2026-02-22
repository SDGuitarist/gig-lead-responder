# Silent Failure Escape Hatches

**Category:** Deployment debugging
**Tags:** webhooks, signature-validation, escape-hatch, first-deploy

## Problem

Webhook signature validation (HMAC, Twilio request signing) is pass/fail with
no error body — a mismatch returns 401 silently. On first deploy you often have
the wrong key, wrong URL, or wrong header. You can't debug what you can't see.

## What Was Tried

1. **Logging the mismatch details** — Helps, but you still can't receive real
   webhooks to test the rest of the pipeline.
2. **Removing validation entirely** — Works for debugging but you forget to
   re-enable it, leaving the endpoint open forever.

## What Worked

A `DISABLE_*_VALIDATION` env var pattern with three guardrails:

```ts
// 1. Check the bypass BEFORE checking for missing fields
if (process.env.DISABLE_MAILGUN_VALIDATION === "true") {
  console.warn("[WARN] Mailgun validation disabled");
  return; // skip validation, proceed to handler
}
// 2. Missing fields still rejected (partial security)
if (!timestamp || !token || !signature) return res.status(401).end();
// 3. Normal HMAC check
```

**Key detail:** The bypass skips cryptographic verification but does NOT skip
the handler's business logic (dedup, parsing, DB write). You're testing the
real path, just without the signature gate.

**Startup warning:** Log once on boot when any `DISABLE_*` flag is active so
it's visible in deployment logs, not buried in request-level output.

## Reusable Pattern

1. Name: `DISABLE_{SERVICE}_VALIDATION` — obvious what it does
2. Check bypass before field-presence checks (otherwise bypass doesn't bypass)
3. Only check `=== "true"` (not truthy — avoid accidental activation)
4. Log a warning on every bypassed request AND once at startup
5. Don't set the var in `.env.example` production defaults
6. Consider `DISABLE_UNTIL` timestamp variant for auto-revert:
   ```ts
   const until = process.env.DISABLE_MAILGUN_VALIDATION_UNTIL;
   if (until && Date.now() < new Date(until).getTime()) { /* bypass */ }
   ```

## When NOT to Use

Don't use for auth endpoints (login, API keys). A bypass on an auth endpoint
is a backdoor. This pattern is for third-party webhook signature validation
where the only risk is fabricated inbound payloads, not unauthorized access.
