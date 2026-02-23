# Batch 1 — Deletes and Removals Results

**Branch:** main
**Date:** 2026-02-22
**Commit:** 4e5902f

### Prior Phase Risk

> "What might this review have missed? — Accessibility, logging/observability, environment parity, Twilio integration failure modes, error UX, Anthropic API resilience."

This batch (deletions only) does not interact with any of these areas. Risk accepted — no mitigation needed for a delete-only batch.

## Changes Made

### #6 — Old `src/dashboard.ts` is dead code (185 lines)
**File:** `src/dashboard.ts` (deleted), `src/server.ts:8,31` (import + mount removed)
**What changed:** Deleted the entire server-rendered dashboard file and removed its import/mount from `server.ts`. The old `/leads` route no longer exists.
**Review finding:** P2 — The server-rendered HTML dashboard at `/leads` was fully superseded by `dashboard.html`. Keeping it alive preserved duplicate helpers, a dependency on `listLeads()`, and an alternate view that could drift from the API.

---

### #18 (partial) — Dead query function `listLeads()` removed
**File:** `src/leads.ts:210-219` (10 lines removed)
**What changed:** Removed the `listLeads()` function. Its only consumer was the deleted `dashboard.ts`. `listLeadsFiltered()` is a strict superset and remains.
**Review finding:** P3 — `listLeads()` (no filters) was a strict subset of `listLeadsFiltered()`. Any optimization (pagination, column selection) would have needed to be applied to both.

**Note:** `getLeadsByStatus()` was NOT removed — it is still used by `src/twilio-webhook.ts:68`. The review's architecture-strategist agent correctly identified this dependency.

---

## Considered but Rejected

- Removing `getLeadsByStatus()` — the code-simplicity reviewer flagged it as unused, but the architecture-strategist correctly identified that `twilio-webhook.ts` still imports and calls it. Keeping it.

## Deferred to Later Batch

- Nothing deferred. All Batch A items completed.

## Three Questions

### 1. Hardest fix in this batch?

No hard fixes — all deletions. The only decision was verifying `getLeadsByStatus()` had a remaining consumer before deciding to keep it (it does: `twilio-webhook.ts:68`).

### 2. What did you consider fixing differently, and why didn't you?

Considered also replacing the `getLeadsByStatus("sent")` call in `twilio-webhook.ts` with `listLeadsFiltered({ status: "sent" })` to consolidate query functions further. Didn't because: (a) it would change behavior in the Twilio webhook which is outside this review's scope, (b) `getLeadsByStatus` is a simpler function for that use case, and (c) scope creep in a delete-only batch defeats the purpose.

### 3. Least confident about going into the next batch or compound phase?

Batch B touches `src/auth.ts` (env var guard, timing-safe compare, colon parsing) and the approve handler race condition. The auth changes will affect local development — currently auth is skipped when env vars are unset. After the fix, devs will need `DASHBOARD_USER` and `DASHBOARD_PASS` set even locally (or we choose a `NODE_ENV` check). That workflow change should be clearly communicated.
