# Deployment Verification Agent — Review Findings

**Agent:** compound-engineering:review:deployment-verification-agent
**Branch:** feat/lead-conversion-tracking
**Date:** 2026-02-25
**Files reviewed:** 4 (src/types.ts, src/leads.ts, src/api.ts, public/dashboard.html)

## Findings

### [P1] Partial migration failure leaves database in inconsistent state
**File:** `src/leads.ts:72-76`
**Issue:** The migration loop runs individual `ALTER TABLE ADD COLUMN` statements without wrapping them in a transaction. If the server crashes after adding `outcome` but before `outcome_at`, the database has 1-3 of 4 new columns. The `existingCols` check makes this self-healing on restart (skips already-added columns). However, if any single ALTER TABLE fails mid-statement (disk full, corrupt WAL), `initDb()` throws and crashes the server. Railway's restart policy will retry.
**Suggestion:** Acceptable risk for SQLite — the `existingCols` check makes migrations idempotent. The main danger is disk-full, which would break existing migrations too. Document in rollback plan that partial migrations are self-healing.

---

### [P2] Analytics query does full table scan with json_extract
**File:** `src/leads.ts:308-349`
**Issue:** Query 3 calls `json_extract(classification_json, '$.format_recommended')` for every row with an outcome. At 10,000+ leads, this could take 50-100ms synchronously on the main thread, blocking the Express event loop.
**Suggestion:** Monitor `/api/analytics` response time post-deploy. If it exceeds 200ms, add a materialized `format_recommended` column or cache the analytics result.

---

### [P2] Outcome endpoint allows only "done" status leads — no UX feedback for non-done
**File:** `src/api.ts:213-216`
**Issue:** The guard `lead.status !== "done"` means leads manually marked `sent` (where a gig was booked without the pipeline finishing) cannot have outcomes recorded. The dashboard only shows outcome controls for `done` leads. Deliberate design choice, but verify UX communicates why the dropdown is absent.
**Suggestion:** Verify during post-deploy testing. Consider adding a tooltip or disabled state message in a future iteration.

---

### [P3] `_pendingOutcome` temporary property mutation
**File:** `public/dashboard.html:1711-1730`
**Issue:** Change handler temporarily mutates `lead.outcome` to render sub-fields, then restores. Synchronous path guarantees restoration, but pattern is fragile.
**Suggestion:** Flag for refactoring (shallow copy approach). No change needed for deploy.

---

### [P3] No rate limiting on outcome or analytics endpoints
**File:** `src/api.ts:200` and `src/api.ts:257`
**Issue:** No rate limiting beyond Basic Auth gate. `GET /api/analytics` runs 3 SQL queries per call, and Insights tab calls it on every tab click with no client-side cache.
**Suggestion:** No immediate action at current scale. If tab-switching spam becomes a concern, add client-side cache in `loadInsights()`.

---

## Pre-Deploy Checklist

### Required Before Deploy

- [ ] **Back up production database** — `cp "$DATABASE_PATH" "$DATABASE_PATH.bak-$(date +%Y%m%d-%H%M%S)"`; also copy WAL file
- [ ] **Record baseline counts**:
  ```sql
  SELECT status, COUNT(*) AS cnt FROM leads GROUP BY status;
  SELECT COUNT(*) AS total FROM leads;
  SELECT COUNT(*) FROM pragma_table_info('leads') WHERE name IN ('outcome', 'outcome_reason', 'actual_price', 'outcome_at');
  -- Expected: 0 (columns don't exist yet)
  ```
- [ ] **Verify auth env vars** — `DASHBOARD_USER` and `DASHBOARD_PASS` are set in Railway
- [ ] **Test fresh DB locally** — `DATABASE_PATH=/tmp/test.db npx tsx -e "..."` — verify 4 new columns created
- [ ] **Test migration on existing DB locally** — copy dev DB, run server, verify columns added
- [ ] **No other deploys in progress** on Railway

### Go/No-Go

- [ ] Database backup completed and verified (file exists, size > 0)
- [ ] Baseline counts saved
- [ ] Auth env vars confirmed
- [ ] Fresh DB test passed
- [ ] Existing DB migration test passed

---

## Migration Details

| Step | What Happens | Time | Rollback |
|------|-------------|------|----------|
| 1 | `CREATE TABLE IF NOT EXISTS` (no-op on existing DB) | <100ms | N/A |
| 2 | `pragma_table_info` reads existing columns | <10ms | N/A |
| 3 | `ALTER TABLE ADD COLUMN outcome` (TEXT, CHECK) | <50ms | **Irreversible** — restore backup |
| 4 | `ALTER TABLE ADD COLUMN outcome_reason` (TEXT, CHECK) | <50ms | **Irreversible** — restore backup |
| 5 | `ALTER TABLE ADD COLUMN actual_price` (REAL, CHECK) | <50ms | **Irreversible** — restore backup |
| 6 | `ALTER TABLE ADD COLUMN outcome_at` (TEXT) | <50ms | **Irreversible** — restore backup |
| 7 | `CREATE INDEX IF NOT EXISTS idx_leads_confidence` | <50ms | N/A |
| 8 | Express server starts, health check passes | <1s | N/A |

**Total migration time:** Under 1 second. No data backfill needed — all new columns default to NULL.

---

## Post-Deploy Verification (Within 5 Minutes)

### 1. Health Check
```bash
curl -s https://YOUR-APP.railway.app/health
# Expected: {"status":"ok"}
```

### 2. Verify New Columns Exist
```sql
SELECT name, type FROM pragma_table_info('leads')
WHERE name IN ('outcome', 'outcome_reason', 'actual_price', 'outcome_at');
-- Expected: 4 rows (outcome TEXT, outcome_reason TEXT, actual_price REAL, outcome_at TEXT)
```

### 3. Verify No Data Corruption
```sql
SELECT status, COUNT(*) FROM leads GROUP BY status;
-- Must match pre-deploy baseline exactly

SELECT COUNT(*) FROM leads WHERE outcome IS NOT NULL;
-- Expected: 0 (no outcomes set yet)
```

### 4. Verify New Endpoints
```bash
# Analytics (requires auth)
curl -s -u "$DASHBOARD_USER:$DASHBOARD_PASS" https://YOUR-APP.railway.app/api/analytics

# Outcome validation (should reject bad input)
curl -s -X POST -u "$DASHBOARD_USER:$DASHBOARD_PASS" \
  -H "Content-Type: application/json" \
  -d '{"outcome":"invalid"}' \
  https://YOUR-APP.railway.app/api/leads/1/outcome

# Auth required (no creds)
curl -s -o /dev/null -w "%{http_code}" https://YOUR-APP.railway.app/api/analytics
# Expected: 401
```

### 5. Dashboard Smoke Test
- [ ] Dashboard loads, Queue and All Leads tabs work
- [ ] Detail panel opens with existing data intact
- [ ] Approve and Edit flows still work
- [ ] Analyze tab works
- [ ] NEW: Insights tab shows "No outcomes recorded yet"
- [ ] NEW: Done leads show outcome dropdown
- [ ] NEW: Non-done leads do NOT show outcome dropdown

---

## Rollback Plan

### Decision Tree
```
Server crashing on startup?
  YES → Check logs. Migration error? Restore backup + redeploy previous commit.
  NO  → Server running.

Existing features broken?
  YES → Deploy previous commit. New NULL columns are harmless to old code.
  NO  → Existing features work.

New features broken?
  Data corruption? → Restore backup + previous commit.
  UI-only issue?   → Fix forward, file bug.
```

### Code Rollback (preserves data)
Deploy the commit before this branch was merged. The 4 new NULL columns remain in the DB but are harmless — old code ignores them.

### Full Rollback (restores schema)
```bash
cp "$DATABASE_PATH.bak-TIMESTAMP" "$DATABASE_PATH"
cp "$DATABASE_PATH-wal.bak-TIMESTAMP" "$DATABASE_PATH-wal" 2>/dev/null || true
# Deploy previous commit
```

---

## Monitoring (First 24 Hours)

| Check | How | Alert If |
|-------|-----|----------|
| Server uptime | Railway dashboard | Any restart within first hour |
| Error logs | Railway logs, filter `ERROR` | New error patterns |
| `/api/analytics` response time | `time curl -s -u ... /api/analytics` | Over 500ms |
| `/api/leads` response time | `time curl -s -u ... /api/leads` | Slower than pre-deploy |
| Database file size | `ls -la $DATABASE_PATH` | Unexpected growth |

**Keep database backup for at least 1 week.**

---

## Data Invariants (must hold at all times)

1. `SELECT COUNT(*) FROM leads` unchanged by migration
2. `SELECT status, COUNT(*) FROM leads GROUP BY status` unchanged by migration
3. All new columns NULL immediately after deploy (before user interaction)
4. CHECK constraints enforced: outcome only accepts booked/lost/no_reply/NULL
5. Outcomes only on done leads: `SELECT COUNT(*) FROM leads WHERE outcome IS NOT NULL AND status != 'done'` = 0
6. Sub-field cleanup: booked leads have no `outcome_reason`; lost leads have no `actual_price`
