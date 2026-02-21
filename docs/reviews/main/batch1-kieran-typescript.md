# Kieran TypeScript Reviewer — Review Findings

**Agent:** compound-engineering:review:kieran-typescript-reviewer
**Branch:** main
**Date:** 2026-02-20
**Files reviewed:** 5

## Findings

### [P2] `as` casts on `req.body` fields provide no runtime safety
**File:** `src/webhook.ts:53-55`
**Issue:** `req.body` fields are cast with `as string | undefined` instead of validated at runtime. If Mailgun sends `timestamp` as a number, JS coercion would silently allow it through. The HMAC computation would still "work" but is brittle and misleading.
**Suggestion:** Use `String()` coercion or a runtime check. Create a small validation helper like `asOptionalString(value: unknown): string | undefined` that returns `undefined` for null/undefined and `String(value)` otherwise.

---

### [P2] Entire handler operates on untyped `any` from `req.body`
**File:** `src/webhook.ts:50`
**Issue:** `req.body` is typed as `any` by Express. Assigning it to `body` without a type annotation means TypeScript gives zero help catching typos like `body.sigature`. With `strict: true` in tsconfig, this is a missed opportunity.
**Suggestion:** Define a `MailgunWebhookBody` interface for the expected payload shape and use it to type the body variable. This gives IntelliSense, catches typos at compile time, and documents the expected shape.

---

### [P3] Dead middleware — both branches call `next()` with no effect
**File:** `src/webhook.ts:11-18`
**Issue:** The route-level middleware on lines 11-18 does nothing. Both branches of the `if` call `next()` with no side effects. The comment says "express.urlencoded() for this route only" but the middleware does not actually apply any parsing. `express.urlencoded()` is already applied globally in `server.ts:20`.
**Suggestion:** Delete the entire middleware block (lines 11-18).

---

### [P3] Emoji in log message inconsistent with other escape hatch logging
**File:** `src/webhook.ts:64`
**Issue:** Uses ⚠ emoji in the warning log. Emojis can cause encoding issues in some log aggregation systems and make grep-based searching harder.
**Suggestion:** Use a plain-text prefix like `[WARN]` or `WARNING:` instead, and ensure both escape hatches (Twilio and Mailgun) use an identical log format.

---

### [P3] `EmailFields` not exported; contract duplicated with casts
**File:** `src/webhook.ts:72-78`
**Issue:** The `EmailFields` interface is defined in `email-parser.ts` but not exported. The webhook handler reconstructs the same shape inline using `as string` casts. If `EmailFields` gains a new required field, the webhook handler will silently omit it with no compiler error.
**Suggestion:** Export `EmailFields` from `email-parser.ts` and use it to type the `fields` object in `webhook.ts`, so the compiler flags missing fields.

---

### No issues found in `.env.example`
**File:** `.env.example:37-44`
**Issue:** No issue. The comments explaining the common Mailgun key mistake are genuinely useful documentation. No changes needed.
