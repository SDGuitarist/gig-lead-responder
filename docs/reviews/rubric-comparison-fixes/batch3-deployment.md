# Deployment Verification Agent — Review Findings

**Agent:** compound-engineering:review:deployment-verification-agent
**Branch:** main (rubric-comparison-fixes)
**Date:** 2026-02-21
**Files reviewed:** 8

## Findings

### [P1] Stricter gate threshold may cause regressions
**File:** `src/prompts/verify.ts:83`
**Issue:** The threshold moved from 9/11 to 12/14. For leads that activate all three new dimensions (cultural context + past date + mariachi format), all 14 checks are evaluated and only 2 failures are tolerated. This is strictly harder than before. Mitigation: all three new gut checks have "Always true" no-op paths when their condition is inactive, so standard leads are not affected. However, leads that activate multiple new dimensions simultaneously could hit the tighter ceiling.
**Suggestion:** Run the 4 test leads pre- and post-deploy. Compare `gut_checks: X/14` and `gate_status` to verify no regressions. If a previously-passing lead now fails, either relax the threshold or tune the new gut check definitions.

---

### [P2] Date calculations depend on deployment timezone
**File:** `src/pipeline/enrich.ts:77`
**Issue:** The `parseLocalDate` trick (noon padding) works for all US timezones, but would produce wrong day-of-week results on a UTC cloud VM for dates near timezone boundaries.
**Suggestion:** Set `TZ=America/Los_Angeles` in the deployment environment if deploying to cloud.

---

### [P2] Unit test uses reference equality that is fragile
**File:** `src/enrich-generate.test.ts:58`
**Issue:** The test asserts `assert.equal(result, c)` (same object reference) but the new enrichment logic can create new objects in more cases now. Currently safe because the test fixtures omit `event_date_iso`, but fragile for future changes.
**Suggestion:** Switch to deep equality (`assert.deepEqual`) or structural comparison.

---

### [P3] Classify prompt signature change covered by TypeScript
**File:** `src/prompts/classify.ts:5`
**Issue:** Breaking change to function signature, but the only caller was updated in the same commit. TypeScript catches mismatches.
**Suggestion:** No action needed — noting for awareness.

---

### [P3] Flagged concerns are not deduplicated
**File:** `src/pipeline/enrich.ts:30-34`
**Issue:** No functional impact — `.includes()` works correctly with duplicates in the array.
**Suggestion:** No action needed — noting for awareness.

---

### [P3] "Always true" gut check instructions rely on LLM compliance
**File:** `src/prompts/verify.ts:134-191`
**Issue:** The LLM could hypothetically return `false` for a check marked "Always true." This pattern already exists for `budget_acknowledged` and works reliably in practice.
**Suggestion:** Monitor for false negatives on the new "Always true" checks in production logs.

---

## Deployment Checklist

### Pre-Deploy

- [ ] Run all 4 test leads through the pipeline and record `gut_checks` counts and `gate_status`
- [ ] Verify `npm run build` succeeds with no TypeScript errors
- [ ] Verify `npm test` passes all unit tests
- [ ] Confirm `TZ` environment variable is set if deploying to cloud (not localhost)
- [ ] Confirm no `.env` changes are required (no new API keys or config)

### Post-Deploy Verification

- [ ] Run all 4 test leads again — compare `gut_checks: X/14` and `gate_status` to pre-deploy baseline
- [ ] Specifically test: wedding lead (flamenco duo, rich details) — should pass all 14 checks
- [ ] Specifically test: birthday lead (sparse, "not sure on details") — should pass with "Always true" fallbacks
- [ ] Specifically test: corporate lead (Type 3, impatient filler) — verify cultural vocab and format routing behave correctly
- [ ] Check that `past_date_detected` appears in CLI output for any lead with a past date
- [ ] Check that mariachi weekend leads show `mariachi_full` format, not `mariachi_4piece`

### Rollback Procedure

1. `git revert 09897ca b68bb33 b807909 bdf31e6 9119acd` (revert all 5 commits in reverse order)
2. `npm run build`
3. Restart the service
4. Run test leads to confirm rollback succeeded

**Alternative:** `git reset --hard <hash-before-9119acd>` if reverts create conflicts (destructive — confirm with team first).

### Monitoring Plan

- Watch for increased gate failure rate (drafts going to rewrite loop) — indicates threshold is too strict
- Watch for "Always true" gut checks returning `false` — indicates LLM non-compliance
- Watch for pricing mismatches in mariachi leads (see P1 finding about stale pricing after format override)
- Monitor Claude API latency — 3 new gut checks add evaluation overhead to the verify stage

### Key Deployment Facts

- **No database changes** — all new fields live inside JSON blobs in existing columns
- **Fully reversible** — git revert the 5 commits and restart
- **No feature flags** — changes are live immediately
- **No batching/migration** — pure code change
