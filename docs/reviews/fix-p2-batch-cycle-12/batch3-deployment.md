# Deployment Verification Agent — Review Findings

**Agent:** compound-engineering:review:deployment-verification-agent
**Branch:** fix/p2-batch-cycle-12
**Date:** 2026-03-05
**Files reviewed:** 27

## Findings

### [P1] Table rebuild migration runs automatically on startup -- requires pre-deploy verification
**File:** `src/db/migrate.ts:88-148`
**Issue:** The `initDb()` function conditionally rebuilds the `leads` table to add `'replied'` to the `follow_up_status` CHECK constraint. It runs a DROP TABLE + RENAME inside a transaction. If the production DB already has `'replied'`, it safely skips. But if the migration runs and fails (e.g., duplicate `mailgun_message_id` values), the app becomes unrecoverable without manual DB intervention.
**Suggestion:** Verify the current schema state before deploying. Back up the DB file if the migration will run. Add a pre-migration duplicate check.

---

### [P1] Import paths changed across all 8 consumers -- build verification critical
**File:** `src/api.ts`, `src/webhook.ts`, `src/twilio-webhook.ts`, `src/follow-up-api.ts`, `src/follow-up-scheduler.ts`, `src/post-pipeline.ts`, `src/run-pipeline.ts`, `src/server.ts`
**Issue:** Every file that imported from `../leads.js` now imports from `../db/index.js`. The old `src/leads.ts` is deleted. `tsc --noEmit` passes locally, but Railway's build environment must match.
**Suggestion:** Verify the Railway build succeeds with a test deploy or by checking build logs carefully.

---

### [P2] No automated tests exist
**File:** `package.json` (test script)
**Issue:** The test script runs `node --import tsx --test src/*.test.ts` but no test files exist. All verification is manual. This means deployment confidence relies entirely on TypeScript compilation and manual testing.
**Suggestion:** Add at minimum smoke tests for the critical paths: webhook processing, pipeline execution, follow-up scheduling.

---

### [P2] New DEV_WEBHOOK_KEY env var for dev mode
**File:** `src/webhook.ts:56-59`
**Issue:** Dev-only requirement when `DISABLE_MAILGUN_VALIDATION=true`. No production impact (startup guard blocks it), but developers need to know about it.
**Suggestion:** Document in README or .env.example.

---

### [P3] stmt() cache duplicated across 3 DB modules
**File:** `src/db/leads.ts`, `src/db/follow-ups.ts`, `src/db/queries.ts`
**Issue:** Intentional design decision per HANDOFF.md. No immediate deployment risk.
**Suggestion:** No action needed for deployment.

---

## Pre-Deploy Checklist

- [ ] Verify Railway volume is mounted for SQLite persistence
- [ ] Check if `leads` table schema already includes `'replied'` in CHECK constraint
- [ ] If migration will run: back up the SQLite DB file
- [ ] Run pre-migration duplicate check on `mailgun_message_id`
- [ ] Verify all env vars are set: `MAILGUN_WEBHOOK_SIGNING_KEY`, `SESSION_SECRET`, `TWILIO_AUTH_TOKEN`, `ANTHROPIC_API_KEY`
- [ ] Confirm `tsc --noEmit` passes in Railway build environment
- [ ] No new dependencies added (no `npm install` needed)

## Deployment Steps

1. Push to `origin/main` (already merged)
2. Railway auto-builds with Nixpacks
3. Runs `npx tsx src/server.ts` as start command
4. Watch startup logs for:
   - Migration messages (if schema change runs)
   - `[scheduler] started` confirmation
   - Health endpoint responding

## Post-Deploy Verification

- [ ] `GET /health` returns 200
- [ ] Dashboard loads and requires auth
- [ ] Dashboard shows existing leads correctly (import path change didn't break queries)
- [ ] Submit a test webhook -- verify it processes through the pipeline
- [ ] Check follow-up scheduler is ticking (look for scheduler log entries)
- [ ] Verify CSP nonce is present in dashboard HTML source (`nonce=` attribute on script tags)
- [ ] Test `/logout` endpoint works (POST with auth)

## Rollback Procedure

1. **Railway instant rollback:** Use Railway's rollback-to-previous-deploy feature
2. The `'replied'` schema change is backward-compatible -- old code never writes that value
3. No data loss on rollback
4. If migration corrupted the DB: restore from backup taken in pre-deploy step

## Monitoring Plan (First Hour)

- Watch Railway logs for:
  - `FATAL:` messages (startup failures)
  - Pipeline errors (LLM call failures, SMS send failures)
  - Scheduler tick confirmations every 60 seconds
- SQL spot checks at +1h, +4h, +24h:
  - `SELECT status, COUNT(*) FROM leads GROUP BY status` (verify no stuck leads)
  - `SELECT follow_up_status, COUNT(*) FROM leads WHERE follow_up_status IS NOT NULL GROUP BY follow_up_status`
  - `SELECT COUNT(*) FROM venue_misses` (verify analytics still recording)
