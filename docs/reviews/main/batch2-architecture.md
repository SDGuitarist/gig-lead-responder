# Architecture Strategist — Review Findings

**Agent:** compound-engineering:review:architecture-strategist
**Branch:** main
**Date:** 2026-02-20
**Files reviewed:** 5 (+ surrounding codebase for architectural analysis)

## Findings

### [P2] Dead `src/twilio.ts` file with conflicting env var names
**File:** `src/twilio.ts` (entire file)
**Issue:** `src/twilio.ts` is never imported by any file. It uses different env var names than the live `sms.ts` (`TWILIO_PHONE_NUMBER` vs `TWILIO_FROM_NUMBER`, `ALEX_PHONE_NUMBER` vs `ALEX_PHONE`). If someone reads `twilio.ts` and configures those vars, SMS will fail silently because `sms.ts` reads different names.
**Suggestion:** Delete `src/twilio.ts`. It is fully superseded by `src/sms.ts`.

---

### [P2] Asymmetric escape hatch patterns between Mailgun and Twilio
**File:** `src/webhook.ts:63-69` and `src/twilio-webhook.ts:35-39`
**Issue:** Twilio escape hatch is a standalone function returning a boolean (early return). Mailgun escape hatch is an inline conditional branch in the route handler. The Mailgun version still requires signature fields to be present even when disabled, while Twilio's version skips everything. This asymmetry means reasoning about "what happens when validation is disabled" requires reading two different patterns.
**Suggestion:** Extract Mailgun validation into a standalone function following the Twilio pattern, making both validators self-contained and symmetric.

---

### [P2] `EmailFields` interface not exported, duplicated inline
**File:** `src/email-parser.ts:3-9` and `src/webhook.ts:72-78`
**Issue:** `EmailFields` in `email-parser.ts` is not exported. The webhook handler manually constructs a matching object using inline `as string` casts. If someone adds a required field to `EmailFields`, the webhook handler still compiles — the mismatch only surfaces at runtime.
**Suggestion:** Export `EmailFields` from `email-parser.ts` (or move to `types.ts`) and type the `fields` construction in `webhook.ts` explicitly.

---

### [P2] Dependency direction violation — `twilio-webhook.ts` imports pipeline internals
**File:** `src/twilio-webhook.ts:6-8`
**Issue:** The Twilio webhook handler directly imports pipeline stage functions (`selectContext`, `generateResponse`, `verifyGate`). The Mailgun webhook correctly delegates to `runPipeline()`, but the Twilio edit handler bypasses orchestration and calls stages directly. This means: (1) layering violation, (2) no progress reporting or confidence scoring on edit path, (3) inconsistent error handling between the two paths.
**Suggestion:** Add a `runEditPipeline(leadId, instructions)` function to `run-pipeline.ts` that encapsulates edit-specific logic. Keep the webhook handler as a thin routing layer.

---

### [P3] Dead no-op middleware in webhook.ts
**File:** `src/webhook.ts:11-18`
**Issue:** Route-scoped middleware checks content type and calls `next()` in both branches. Does nothing. `express.urlencoded()` is already applied globally in `server.ts:20`.
**Suggestion:** Remove lines 11-18 entirely.

---

### [P3] Untyped `req.body` operating on `any`
**File:** `src/webhook.ts:50-78`
**Issue:** `req.body` is `any`. All property accesses use `as string` casts with no runtime validation. If Mailgun changes their payload format, every access silently becomes `undefined` and the `|| ""` fallback masks the error.
**Suggestion:** Define a `MailgunWebhookBody` interface in `types.ts` and validate the shape at the top of the handler.

---

### [P3] `.env.example` naming conflict resolves when dead file is removed
**File:** `.env.example:8`
**Issue:** `.env.example` correctly uses `TWILIO_FROM_NUMBER` and `ALEX_PHONE`, matching `sms.ts`. But dead `twilio.ts` uses different names, creating confusion. Resolves automatically when `twilio.ts` is deleted.
**Suggestion:** Delete `src/twilio.ts` (see Finding 1).

---

### [P3] SKILL.md references subagent types that cannot be validated
**File:** `.claude/skills/review-batched/SKILL.md`
**Issue:** The skill references 9 specific subagent types assumed to exist in the Claude Code agent registry, with no fallback if unavailable.
**Suggestion:** Add a provenance comment noting which agent registry these types come from.
