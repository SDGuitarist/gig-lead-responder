---
status: done
priority: p2
issue_id: "017"
tags: [code-review, security, follow-up-pipeline]
dependencies: []
---

# Error message leakage via SMS

## Problem Statement

All `.catch()` handlers in the Twilio webhook and the scheduler's outer catch block send raw `err.message` text to Alex via SMS. If an internal error occurs (database path, API key, network timeout), the SMS could contain internal file paths, partial token references, or infrastructure details.

Not exploitable externally (SMS goes only to ALEX_PHONE), but violates least-information-exposure principle.

## Findings

- **Source:** Security sentinel (MEDIUM)
- **Files:** `src/twilio-webhook.ts:255,269,279,289,298` (5 catch handlers), `src/follow-up-scheduler.ts:77-79` (scheduler catch)

## Proposed Solutions

### Option A: Generic SMS + detailed logs (Recommended)

Replace `sendSms(\`Error: ${err.message}\`)` with `sendSms("Error processing command. Check server logs.")` in all catch handlers. Keep `console.error` for full details.

- **Pros:** No internal details in SMS, full details still in Railway logs
- **Cons:** Alex needs to check logs for error details (acceptable — errors are rare)
- **Effort:** Small (10 min)
- **Risk:** None

## Recommended Action

Option A.

## Technical Details

- **Affected files:** `src/twilio-webhook.ts` (5 catch handlers), `src/follow-up-scheduler.ts` (1 catch handler)

## Acceptance Criteria

- [ ] No `.catch()` handler sends `err.message` via SMS
- [ ] All handlers still log full error details via `console.error`
- [ ] SMS messages are generic (e.g., "Error processing follow-up. Check server logs.")

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-26 | Created from code review | Security sentinel flagged as MEDIUM — internal details go to trusted channel but still unnecessary exposure |
