# Code Simplicity Reviewer — Review Findings

**Agent:** code-simplicity-reviewer
**Branch:** feat/follow-up-v2-dashboard
**Date:** 2026-03-02
**Files reviewed:** 11

## Findings

### [P2] Follow-up API routes repeat identical ID-parse + lead-lookup boilerplate
**File:** `src/follow-up-api.ts:16-136`
**Issue:** All four route handlers repeat the same ID parsing and lead lookup pattern (~10 lines each, ~40 lines total). The `satisfies FollowUpActionResponse` annotation is also repeated on every single `res.json()` call (12 occurrences).
**Suggestion:** Extract a `parseLeadId(req, res)` helper. Drop the `satisfies` annotations — they add zero runtime safety and visual clutter.

---

### [P2] Table rebuild migration hardcoded with full schema DDL
**File:** `src/leads.ts:87-146`
**Issue:** The migration contains a complete hardcoded copy of the `leads` table DDL (~40 lines). The table schema is now defined in two places in the same file (lines 19-57 and 103-139).
**Suggestion:** Add a comment marking the rebuild DDL as "frozen at the time of migration" so future developers know not to update it. This is a one-time migration that runs once and is then a no-op.

---

### [P2] `skipFollowUp` and `markClientReplied` are nearly identical
**File:** `src/leads.ts:424-476`
**Issue:** The two functions differ only in the target status (`'skipped'` vs `'replied'`). ~25 lines of duplicated logic.
**Suggestion:** Extract a shared `terminateFollowUp(leadId, status)` function:
```typescript
function terminateFollowUp(leadId: number, status: 'skipped' | 'replied'): LeadRecord | undefined {
  const now = new Date().toISOString();
  const result = initDb().prepare(
    `UPDATE leads SET follow_up_status = @status, ` +
    `follow_up_due_at = NULL, follow_up_draft = NULL, snoozed_until = NULL, ` +
    `updated_at = @now WHERE id = @id AND follow_up_status IN ('pending', 'sent')`
  ).run({ id: leadId, status, now });
  if (result.changes === 0) return undefined;
  return getLead(leadId);
}
```

---

### [P3] Duplicated `baseUrl()` helper across two files
**File:** `src/follow-up-scheduler.ts:12` and `src/twilio-webhook.ts:26`
**Issue:** Same 2-line function defined identically in both files.
**Suggestion:** Extract to a shared utility.

---

### [P3] `TERMINAL_CLEAR` constant used only once
**File:** `src/leads.ts:372-376`
**Issue:** Defined as a named object but only spread into one call site (line 404). The other two terminal-state functions duplicate the same cleanup in raw SQL.
**Suggestion:** Use consistently in all three functions, or inline at line 404 and remove the constant.

---

### [P3] `MAX_FOLLOW_UPS` exported but only used internally
**File:** `src/leads.ts:324`
**Issue:** Exported but never imported by any other file.
**Suggestion:** Remove the `export` keyword. (YAGNI)

---

### [P3] `computeFollowUpDelay` exported but only used internally
**File:** `src/leads.ts:333`
**Issue:** Exported but never imported by any other file.
**Suggestion:** Remove the `export` keyword. (YAGNI)

---

### [P3] `satisfies FollowUpActionResponse` used excessively
**File:** `src/follow-up-api.ts` (12+ occurrences)
**Issue:** Every `res.json()` call includes `satisfies FollowUpActionResponse` — a compile-time-only check that adds cognitive load without catching bugs the type system doesn't already catch.
**Suggestion:** Remove all `satisfies` annotations from inline response objects.

---

### [P3] `SnoozeRequestBody` type adds little value
**File:** `src/types.ts:244`
**Issue:** One-field interface used once as a cast. The field is immediately validated manually on the next line anyway.
**Suggestion:** Inline the destructure and remove the type.

---

### [P3] Dashboard HTML follow-up count hardcoded to "/3"
**File:** `public/dashboard.html:2344`
**Issue:** `follow_up_count + '/3'` hardcodes the max, which is `MAX_FOLLOW_UPS = 3` server-side.
**Suggestion:** Add a `// SYNC: MAX_FOLLOW_UPS in src/leads.ts` comment.

---

### [P3] `isStale` references `sms_sent_at` which is not in `LeadApiResponse`
**File:** `public/dashboard.html:1378`
**Issue:** `l.sms_sent_at` is always `undefined` client-side because `shapeLead` doesn't include it. The fallback to `l.updated_at` always fires — the `sms_sent_at` check is dead code.
**Suggestion:** Remove the `l.sms_sent_at ||` fallback.

---

### [P3] `apiFetch` and `apiPost` duplicate auth-retry logic
**File:** `public/dashboard.html:1405-1455`
**Issue:** Both functions contain similar auth-retry logic (~20 lines each).
**Suggestion:** Consider extracting the retry logic into a wrapper if more API methods are added.
