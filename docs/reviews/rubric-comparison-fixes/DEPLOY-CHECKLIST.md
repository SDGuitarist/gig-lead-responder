# Deployment Checklist: Rubric Comparison Fixes

**Commits:** 9119acd, bdf31e6, b807909, b68bb33, 09897ca (5 commits on main)
**Date:** 2026-02-21
**Risk level:** Medium — prompt engineering changes with a stricter gate threshold

---

## Change Summary

These 5 commits introduce:

1. **New Classification fields**: `event_date_iso`, `past_date_detected`, `event_energy` added to `Classification` type
2. **New gut checks**: `past_date_acknowledged`, `mariachi_pricing_format`, `cultural_vocabulary_used` added to verify gate (11 -> 14 checks)
3. **Verify gate threshold raised**: 9/11 -> 12/14 (86% pass rate required)
4. **Date utility**: `parseLocalDate()` to avoid UTC midnight timezone rollover
5. **Enrichment expansion**: Past-date detection and mariachi format routing added to `enrichClassification()`
6. **Prompt updates**: Cultural vocabulary FAIL/PASS examples, dual-format blocks, past-date flagging in generate prompt
7. **Classify prompt**: Now receives `today` parameter, outputs `event_date_iso` and `event_energy`

---

## Findings

### [P1] Stricter gate threshold may cause previously-passing leads to fail

**File:** `src/prompts/verify.ts:83`
**Issue:** The threshold changed from 9/11 (82%) to 12/14 (86%). The three new gut checks (`past_date_acknowledged`, `mariachi_pricing_format`, `cultural_vocabulary_used`) all have "always true" no-op paths when their condition is not active. This means for a standard non-mariachi, non-cultural, non-past-date lead, the effective threshold is still 12/14 with 3 checks auto-passing = 9/11 real checks must pass. However, any lead that activates ONE of these new dimensions now needs 12/14 total, meaning only 2 failures are tolerated (down from 2 at 9/11). If a lead activates ALL THREE new dimensions (e.g., a mariachi lead with cultural context and a past date), all 14 checks are real and 12 must pass. This is strictly harder.
**Suggestion:** After deploy, compare pass rates on the 4 test leads to baseline. Any lead that was passing at 9/11 but now fails at 12/14 requires prompt tuning, not threshold lowering.

### [P2] Existing unit test asserts reference equality that now breaks

**File:** `src/enrich-generate.test.ts:58`
**Issue:** Line 58 asserts `assert.equal(result, c)` (reference equality) for the "no budget, no enrichment" case. But the new `enrichClassification()` code runs past-date detection and format routing before the budget check. For a classification with `event_date_iso` set, it will create a new object even when `past_date_detected` is false (because the code only spreads when `eventDate < today`, it does not spread for non-past dates). So the reference equality test should still pass when `event_date_iso` is undefined or null (the default in `makeClassification`). However, if someone adds `event_date_iso` to the test fixture defaults, this test will break. This is fragile but not immediately broken.
**Suggestion:** Run `npx tsx --test src/enrich-generate.test.ts` as part of pre-deploy. If all tests pass, this is safe. Consider updating the test to use deep equality instead of reference equality in a follow-up.

### [P2] `past_date_detected` is optional on Classification type, but downstream code assumes it exists

**File:** `src/types.ts:43`
**Issue:** `past_date_detected?: boolean` is optional (note the `?`). The `buildPastDateInstruction` in `verify.ts:159` checks `!classification.past_date_detected` which evaluates to `true` for `undefined`, correctly treating it as "no past date." The `buildGeneratePrompt` in `generate.ts:17` checks `classification.past_date_detected` as truthy, which is `false` for `undefined`. Both directions are safe. However, `event_date_iso?: string | null` being optional means older serialized `classification_json` in the leads database will not have this field. If the edit pipeline rehydrates an old classification and runs enrichment, `event_date_iso` will be undefined, so past-date detection will skip (correct behavior). No bug, but worth documenting.
**Suggestion:** No action needed. The optional types correctly handle missing data from older pipeline runs.

### [P2] Mariachi format routing depends on day-of-week calculation via parseLocalDate

**File:** `src/pipeline/enrich.ts:77`
**Issue:** `parseLocalDate(dateISO).getDay()` returns the day of week using the machine's local timezone. The `T12:00:00` trick ensures the date is correct in US timezones (Pacific through Eastern). But if the server were ever deployed in a non-US timezone (e.g., UTC on a cloud VM), a date like "2026-03-14" parsed at noon UTC is still March 14 everywhere, so this is safe. Friday is treated as weekend (`day === 5`), which is a business decision, not a bug.
**Suggestion:** Verify that the deployment target (local machine, or server) is in a US timezone. If deploying to a cloud VM, set `TZ=America/Los_Angeles` in the environment.

### [P3] `buildClassifyPrompt` signature changed — callers must pass `today`

**File:** `src/prompts/classify.ts:5`
**Issue:** `buildClassifyPrompt()` now requires a `today` parameter. The only caller (`src/pipeline/classify.ts:11`) was updated in the same commit to pass `new Date().toISOString().slice(0, 10)`. No broken callers exist. TypeScript compilation will catch any future missed updates.
**Suggestion:** Verify TypeScript compiles cleanly as part of pre-deploy.

### [P3] New flagged_concerns values are appended by enrichment, not deduplicated

**File:** `src/pipeline/enrich.ts:30-34`
**Issue:** When format routing triggers, enrichment appends `mention_4piece_alternative` or `mention_full_ensemble_upgrade` to `flagged_concerns`. If the LLM classification already included one of these (unlikely but possible since they are not in the classify prompt's vocabulary), it would be duplicated. The downstream `buildMariachiPricingInstruction` uses `includes()` which would still work correctly with duplicates. The `buildDualFormatBlock` in generate.ts also uses `includes()`. No functional bug.
**Suggestion:** No action needed. Duplicate concerns cause no harm in current code.

### [P3] No-op gut checks return "Always true" string to the LLM

**File:** `src/prompts/verify.ts:134-191`
**Issue:** When a gut check is not applicable (e.g., `past_date_acknowledged` when no past date exists), the instruction says "Always true -- no past date detected." The LLM is expected to return `true` for these. If the LLM misunderstands and returns `false`, the lead fails the gate unnecessarily. This pattern was already established by the `budget_acknowledged` check (which existed before these commits) and has been working in production.
**Suggestion:** Monitor for any gut check returning `false` when its instruction says "Always true." This would show up in gate failures where a no-op check unexpectedly fails.

---

## Pre-Deploy (Required)

### 1. TypeScript compilation

```bash
cd /Users/alejandroguillen/Projects/gig-lead-responder
npx tsc --noEmit
```

**Expected:** Zero errors. Any error is a STOP.

### 2. Unit tests pass

```bash
npx tsx --test src/enrich-generate.test.ts
npx tsx --test src/budget-gap.test.ts
```

**Expected:** All tests pass (green). Any failure is a STOP.

### 3. Baseline: Run all 4 test leads, save outputs

Run each lead and save the full JSON output for comparison. These are the 4 test leads documented in MEMORY.md:

**Lead 1 — Wedding @ Hilton La Jolla (rich lead, flamenco duo)**
```bash
echo 'Event Type: Wedding Reception
Date: Saturday, June 14, 2026
Time: 5:00 PM - 8:00 PM (3 hours)
Location: Hilton La Jolla Torrey Pines
Guest Count: 180
Budget: Not specified
Genre Request: Spanish guitar, flamenco
Equipment: Provided by venue
Additional Notes: Looking for elegant background music during cocktail hour and dinner. Want something classy and sophisticated.
Lead Source: GigSalad
Quotes received: 6' | npx tsx src/index.ts --json > /tmp/lead1-baseline.json 2>/dev/null
```

**Lead 2 — Birthday March 22 (sparse, "not sure on details")**
```bash
echo 'Event Type: Birthday Party
Date: March 22, 2026
Location: Del Mar
Additional Notes: Not sure on details yet, just want some live music
Lead Source: GigSalad
Quotes received: 3' | npx tsx src/index.ts --json > /tmp/lead2-baseline.json 2>/dev/null
```

**Lead 3 — October 2026 birthday (Type 1 price shopper)**
```bash
echo 'Event Type: Birthday
Date: October 2026
Genre Request: guitar
Lead Source: GigSalad
Quotes received: 8' | npx tsx src/index.ts --json > /tmp/lead3-baseline.json 2>/dev/null
```

**Lead 4 — Corporate March 14 downtown (Type 3 impatient filler)**
```bash
echo 'Event Type: Corporate Event
Date: March 14, 2026
Location: Downtown San Diego
Genre Request: background music
Lead Source: The Bash
Quotes received: 2' | npx tsx src/index.ts --json > /tmp/lead4-baseline.json 2>/dev/null
```

**After running all 4, extract key metrics:**

```bash
for f in /tmp/lead{1,2,3,4}-baseline.json; do
  echo "=== $(basename $f) ==="
  cat "$f" | npx tsx -e "
    import { readFileSync } from 'fs';
    const d = JSON.parse(readFileSync('/dev/stdin','utf8'));
    console.log('gate_status:', d.gate.gate_status);
    console.log('verified:', d.verified);
    const c = d.gate.gut_checks;
    const passed = Object.values(c).filter(Boolean).length;
    console.log('gut_checks:', passed + '/' + Object.keys(c).length);
    console.log('confidence:', d.confidence_score);
    const failing = Object.entries(c).filter(([,v]) => !v).map(([k]) => k);
    if (failing.length) console.log('failing_checks:', failing.join(', '));
    if (d.gate.fail_reasons.length) console.log('fail_reasons:', d.gate.fail_reasons.join('; '));
  "
  echo ""
done
```

**Expected baselines:**
- All 4 leads should have `gate_status: pass` or at minimum `verified: true`
- All should show `gut_checks: X/14` (not X/11 -- confirms new gut checks are present)
- New gut checks (`past_date_acknowledged`, `mariachi_pricing_format`, `cultural_vocabulary_used`) should all be `true` on these standard leads (they should hit the "Always true" no-op path)
- Confidence scores should be 40+ (gate pass = 40 points minimum)

### 4. Edge case test: Past-date detection

Create a lead with a date that has already passed to verify the new past_date_detected enrichment:

```bash
echo 'Event Type: Birthday Party
Date: December 24, 2025
Location: Chula Vista
Genre Request: mariachi
Additional Notes: For my mothers birthday
Lead Source: GigSalad
Quotes received: 2' | npx tsx src/index.ts --json > /tmp/lead-pastdate.json 2>/dev/null
```

**Verify:**
```bash
cat /tmp/lead-pastdate.json | npx tsx -e "
  import { readFileSync } from 'fs';
  const d = JSON.parse(readFileSync('/dev/stdin','utf8'));
  console.log('event_date_iso:', d.classification.event_date_iso);
  console.log('past_date_detected:', d.classification.past_date_detected);
  console.log('past_date_acknowledged:', d.gate.gut_checks.past_date_acknowledged);
  console.log('cultural_context_active:', d.classification.cultural_context_active);
  console.log('cultural_vocabulary_used:', d.gate.gut_checks.cultural_vocabulary_used);
  console.log('format_recommended:', d.classification.format_recommended);
  console.log('draft mentions past date:', d.drafts.full_draft.toLowerCase().includes('2025') || d.drafts.full_draft.toLowerCase().includes('passed'));
"
```

**Expected:**
- `event_date_iso: "2025-12-24"`
- `past_date_detected: true`
- `past_date_acknowledged: true` (draft should address the past date)
- `cultural_context_active: true` (mariachi + Mexican family signals)
- `cultural_vocabulary_used: true`
- `format_recommended: "mariachi_full"` (Saturday = weekend, full ensemble only)
- Draft should mention the past date

### 5. Edge case test: Weekday mariachi format routing

```bash
echo 'Event Type: Corporate Dinner
Date: Wednesday, March 18, 2026
Time: 6:00 PM - 8:00 PM
Location: US Grant Hotel, downtown San Diego
Guest Count: 80
Genre Request: mariachi
Additional Notes: Executive dinner, want background mariachi
Lead Source: The Bash
Quotes received: 1' | npx tsx src/index.ts --json > /tmp/lead-mariachi-weekday.json 2>/dev/null
```

**Verify:**
```bash
cat /tmp/lead-mariachi-weekday.json | npx tsx -e "
  import { readFileSync } from 'fs';
  const d = JSON.parse(readFileSync('/dev/stdin','utf8'));
  console.log('format_recommended:', d.classification.format_recommended);
  console.log('event_energy:', d.classification.event_energy);
  console.log('tier:', d.classification.tier);
  console.log('flagged_concerns:', d.classification.flagged_concerns);
  console.log('mariachi_pricing_format:', d.gate.gut_checks.mariachi_pricing_format);
"
```

**Expected:**
- If `event_energy: "background"` and `tier: "premium"` --> `format_recommended: "mariachi_4piece"` with `mention_full_ensemble_upgrade` in flagged_concerns
- If `event_energy: "performance"` or `tier: "standard"` --> `format_recommended: "mariachi_full"` with `mention_4piece_alternative` in flagged_concerns
- `mariachi_pricing_format: true`

### 6. Confirm no database schema changes needed

These commits do NOT modify the database schema in `src/leads.ts`. The new fields (`event_date_iso`, `past_date_detected`, `event_energy`, new gut checks) exist only in the JSON blobs stored in `classification_json` and `gate_json` columns. No ALTER TABLE is needed.

**Verify:**
```bash
# Check that leads.ts has not been modified in these commits
git diff 9119acd^..09897ca -- src/leads.ts
```

**Expected:** Empty output (no changes to leads.ts).

---

## Deploy Steps

This is a TypeScript application that runs on `npx tsx`. There is no build step or container deployment -- changes take effect when the code files are updated.

1. [ ] Pull latest main: `git pull origin main`
2. [ ] Verify you are on commit `67a506c` (the latest including the HANDOFF.md doc update) or at minimum `09897ca` (last code change)
3. [ ] Run `npx tsc --noEmit` to confirm compilation
4. [ ] Run `npx tsx --test src/enrich-generate.test.ts` to confirm unit tests
5. [ ] If server is running (`src/server.ts`), restart it to pick up changes

There are no feature flags, no migrations, no batching. The deploy is atomic with the git pull.

---

## Post-Deploy Verification (Within 30 Minutes)

### 1. Run all 4 test leads again, compare to baseline

```bash
for i in 1 2 3 4; do
  echo "=== Lead $i ==="
  # (re-run the same lead commands from pre-deploy, saving to /tmp/lead${i}-postdeploy.json)
done
```

Compare key fields:

```bash
for i in 1 2 3 4; do
  echo "=== Lead $i ==="
  echo "BASELINE:"
  cat /tmp/lead${i}-baseline.json | npx tsx -e "
    import { readFileSync } from 'fs';
    const d = JSON.parse(readFileSync('/dev/stdin','utf8'));
    console.log(d.gate.gate_status, d.verified, Object.values(d.gate.gut_checks).filter(Boolean).length + '/' + Object.keys(d.gate.gut_checks).length);
  "
  echo "POSTDEPLOY:"
  cat /tmp/lead${i}-postdeploy.json | npx tsx -e "
    import { readFileSync } from 'fs';
    const d = JSON.parse(readFileSync('/dev/stdin','utf8'));
    console.log(d.gate.gate_status, d.verified, Object.values(d.gate.gut_checks).filter(Boolean).length + '/' + Object.keys(d.gate.gut_checks).length);
  "
  echo ""
done
```

**Acceptable results:**
- All 4 leads still pass the gate (gate_status: "pass")
- All 4 leads show 14 gut checks (not 11)
- Confidence scores within 10 points of baseline (LLM variance is expected)

**STOP condition:**
- Any lead that was passing pre-deploy now fails post-deploy
- Any lead showing 11 gut checks instead of 14 (code not loaded correctly)
- `past_date_acknowledged`, `mariachi_pricing_format`, or `cultural_vocabulary_used` returning `false` on standard leads where they should be no-op ("Always true")

### 2. Database spot check (if leads.db exists and has data)

```bash
cd /Users/alejandroguillen/Projects/gig-lead-responder
npx tsx -e "
  import { listLeads } from './src/leads.js';
  const leads = listLeads();
  console.log('Total leads in DB:', leads.length);
  for (const lead of leads.slice(0, 3)) {
    console.log('---');
    console.log('ID:', lead.id, '| Status:', lead.status, '| Gate:', lead.gate_passed);
    if (lead.gate_json) {
      const gate = JSON.parse(lead.gate_json);
      const checkCount = Object.keys(gate.gut_checks || {}).length;
      console.log('Gut check count in stored JSON:', checkCount);
      if (checkCount === 11) console.log('  ^ OLD FORMAT (11 checks) - this is expected for pre-deploy leads');
      if (checkCount === 14) console.log('  ^ NEW FORMAT (14 checks)');
    }
  }
"
```

**Expected:** Existing leads have 11-check gate_json. New leads processed after deploy will have 14-check gate_json. Both formats are valid -- the code reads gut_checks dynamically.

### 3. Verify index.ts displays new gut check count

```bash
echo 'Event Type: Birthday
Date: April 2026
Genre: guitar
Lead Source: GigSalad
Quotes received: 3' | npx tsx src/index.ts 2>/dev/null | grep "Gut checks"
```

**Expected:** Output shows `Gut checks: X/14 passed` (not X/11).

---

## Rollback Plan

**Can we roll back?** YES -- fully reversible.

**Why:** These changes are purely prompt engineering + TypeScript logic. No database schema was modified. No data was migrated or deleted. The `classification_json` and `gate_json` columns store whatever the pipeline produces, so older 11-check JSON and newer 14-check JSON coexist safely.

**Rollback Steps:**

1. Revert to the commit before this series:
   ```bash
   # Identify the parent commit
   git log --oneline -1 9119acd^
   # That commit is 74fc35a (docs: brainstorm + deepen metadata)
   # But for code, the last code commit before this series is e55731d
   ```

2. Deploy the revert:
   ```bash
   git revert --no-commit 09897ca b68bb33 b807909 bdf31e6 9119acd
   git commit -m "revert: rubric comparison fixes (5 commits)"
   ```

   Or, if urgency demands it:
   ```bash
   # Deploy from a specific known-good commit (code only, not docs)
   git checkout e55731d -- src/
   git commit -m "revert: rollback src/ to pre-rubric-comparison state"
   ```

3. Restart the server if running.

4. Run lead 1 through the pipeline and confirm `Gut checks: X/11 passed` (old format).

**What data needs restoring?** None. Leads processed during the deploy window will have 14-check gate_json, but `src/index.ts` uses `Object.keys(checks).length` dynamically, so it reads either format correctly. No database changes needed on rollback.

**Risk of rollback:** Very low. The only risk is that leads processed during the deploy window and stored in the DB will have `past_date_detected`, `event_energy`, and `event_date_iso` in their `classification_json`. These are simply extra JSON fields that older code will ignore.

---

## Monitoring Plan (First 24 Hours)

This application does not have a traditional metrics/alerting stack. Monitoring is manual, based on pipeline runs.

### Hour 1: Spot check

Run 2 leads (one sparse, one rich) and verify:
- [ ] Gate passes
- [ ] 14 gut checks present in output
- [ ] No-op checks ("Always true" path) all return `true`
- [ ] Confidence score >= 40

### Hour 4: Check for regressions

If the webhook server (`src/server.ts`) is running and processing real leads:

```bash
npx tsx -e "
  import { getLeadsByStatus } from './src/leads.js';
  const recent = getLeadsByStatus('sent').slice(0, 5);
  for (const lead of recent) {
    const gate = JSON.parse(lead.gate_json || '{}');
    const checks = gate.gut_checks || {};
    const passed = Object.values(checks).filter(Boolean).length;
    const total = Object.keys(checks).length;
    console.log('Lead', lead.id, '| Gate:', gate.gate_status, '| Checks:', passed + '/' + total);
    const failing = Object.entries(checks).filter(([,v]) => !v).map(([k]) => k);
    if (failing.length) console.log('  Failing:', failing.join(', '));
  }
"
```

**Alert conditions (manual):**
- Gate fail rate > 50% of leads processed (normal is <20%)
- Any no-op gut check returning `false` (should always be `true`)
- `verified: false` on more than 2 consecutive leads (retry loop exhausted)

### Hour 24: Aggregate review

```bash
npx tsx -e "
  import { listLeads } from './src/leads.js';
  const leads = listLeads();
  const last24h = leads.filter(l => {
    const created = new Date(l.created_at);
    return (Date.now() - created.getTime()) < 24 * 60 * 60 * 1000;
  });
  console.log('Leads processed in last 24h:', last24h.length);
  const passed = last24h.filter(l => l.gate_passed).length;
  const failed = last24h.filter(l => l.gate_passed === false).length;
  const pending = last24h.filter(l => l.gate_passed === null).length;
  console.log('Gate passed:', passed, '| Failed:', failed, '| Pending:', pending);
  if (last24h.length > 0) {
    const passRate = (passed / (passed + failed) * 100).toFixed(1);
    console.log('Pass rate:', passRate + '%');
  }
"
```

**Expected:** Pass rate should be comparable to pre-deploy (typically 70-90% before retry loop, near 100% after retries).

---

## Data Invariants

These must remain true before and after deploy:

- [ ] All existing leads in the database remain readable and displayable
- [ ] `gate_json` with 11 gut checks (old format) is still valid -- `Object.keys()` reads it dynamically
- [ ] `classification_json` without `event_date_iso` or `event_energy` fields is still valid -- these fields are optional (`?`) in the TypeScript type
- [ ] The 4 test leads (Wedding, Birthday March 22, October 2026, Corporate March 14) all pass the gate
- [ ] `parseLocalDate("2026-03-14")` returns March 14 (not March 13) in the deployment timezone
- [ ] No new columns were added to the SQLite database
- [ ] The edit pipeline (`runEditPipeline`) still works with old classification data that lacks the new fields

---

## Quick Reference: What Changed Per File

| File | Change | Risk |
|------|--------|------|
| `src/types.ts` | Added 3 fields to Classification, 3 gut checks to GateResult | Low -- additive, all optional |
| `src/utils/dates.ts` | New file, `parseLocalDate()` utility | Low -- pure function, timezone-safe |
| `src/pipeline/classify.ts` | Passes `today` to classify prompt | Low -- one-line change |
| `src/prompts/classify.ts` | Accepts `today` param, adds `event_date_iso` + `event_energy` to output schema | Medium -- LLM must produce new fields |
| `src/pipeline/enrich.ts` | Past-date detection + mariachi format routing | Medium -- new business logic |
| `src/prompts/generate.ts` | Cultural vocab block, dual-format block, past-date block | Medium -- prompt changes affect draft quality |
| `src/prompts/verify.ts` | 3 new gut checks, threshold 9/11 -> 12/14 | Medium -- stricter gate |
| `src/index.ts` | Past-date warning in CLI output | Low -- display only |
