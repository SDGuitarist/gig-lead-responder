# Pattern Recognition Specialist — Review Findings

**Agent:** compound-engineering:review:pattern-recognition-specialist
**Branch:** main
**Date:** 2026-02-20
**Files reviewed:** 5 (+ surrounding codebase for pattern analysis)

## Findings

### [P1] Dead code file with conflicting env var names
**File:** `src/twilio.ts` (entire file)
**Issue:** `src/twilio.ts` is dead code — never imported by any other file. It also uses **different env var names** than the active code: `TWILIO_PHONE_NUMBER` vs `TWILIO_FROM_NUMBER`, `ALEX_PHONE_NUMBER` vs `ALEX_PHONE`. If someone accidentally imports from `./twilio.js` instead of `./sms.js`, the app silently fails at runtime because those env vars are never set.
**Suggestion:** Delete `src/twilio.ts` entirely. It was superseded by `src/sms.ts`.

---

### [P2] No-op middleware in webhook.ts
**File:** `src/webhook.ts:11-18`
**Issue:** The route-level middleware checks `req.is("application/x-www-form-urlencoded")` but calls `next()` in both branches. It does absolutely nothing. The comment suggests body parsing was intended but never wired in.
**Suggestion:** Remove lines 11-18. The global urlencoded parser in `server.ts` already handles this.

---

### [P2] Repeated `gate_passed` boolean conversion pattern (3x)
**File:** `src/leads.ts:120, 130, 191`
**Issue:** The expression `gate_passed: row.gate_passed === null ? null : Boolean(row.gate_passed)` appears three times across `getLead()`, `getLeadsByStatus()`, and `listLeads()`. If conversion logic changes, all three must be updated in lockstep.
**Suggestion:** Extract a `normalizeLeadRow(row)` helper function that handles all SQLite-to-TypeScript type conversions, call it from all three query functions.

---

### [P2] Repeated error-to-message extraction pattern (5x)
**File:** `src/server.ts:61`, `src/post-pipeline.ts:65`, `src/twilio-webhook.ts:201,214,223`
**Issue:** The pattern `err instanceof Error ? err.message : String(err)` appears 5 times across three files. This is a common utility that should live in one place.
**Suggestion:** Create an `errorMessage(err: unknown): string` helper function and use it everywhere.

---

### [P3] Asymmetric validation function signatures and escape-hatch placement
**File:** `src/webhook.ts:25` and `src/twilio-webhook.ts:35`
**Issue:** `verifyMailgunSignature` takes 3 separate string params while `verifyTwilioSignature` takes the full Express Request. The escape hatch lives in different places too — in the route handler for Mailgun, inside the verify function for Twilio. This means disabling Mailgun validation still requires signature fields to be present, while disabling Twilio validation skips everything.
**Suggestion:** Consider putting the escape hatch inside `verifyMailgunSignature` to match the Twilio pattern, making both validators self-contained.

---

### [P3] Emoji in log output inconsistent with rest of codebase
**File:** `src/webhook.ts:64` and `src/twilio-webhook.ts:37`
**Issue:** Two log lines use the ⚠ emoji. All other `console.warn` and `console.error` lines in the project use plain text.
**Suggestion:** Replace emoji with `[WARNING]` or `WARN:` prefix, or keep if Railway log viewer handles it correctly.

---

### [P3] Fragile falsy-chain for Message-Id header
**File:** `src/webhook.ts:77`
**Issue:** The code checks both `Message-Id` (title case) and `message-id` (lower case) with a falsy chain. An empty string `""` would bypass the `undefined` check in `email-parser.ts` (line 33: `if (!externalId)`), but still works because `""` is falsy. This is a subtle chain of truthy/falsy reliance across two files.
**Suggestion:** No code change strictly needed — current behavior is correct. Note that distinguishing "header present but empty" from "header missing" would require refactoring.

---

### [P3] SKILL.md references subagent types with no fallback
**File:** `.claude/skills/review-batched/SKILL.md:72-86`
**Issue:** The skill references 9 specific subagent types assumed to exist in the Claude Code agent registry, with no fallback if unavailable.
**Suggestion:** Add a note that if a specific subagent type is unavailable, the batch should use a general-purpose Task agent with the same prompt.
