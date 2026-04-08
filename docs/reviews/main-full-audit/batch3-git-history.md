# Git History Analyzer — Review Findings

**Agent:** git-history-analyzer
**Branch:** main (full codebase audit)
**Date:** 2026-04-07
**Files reviewed:** git history, all branches

## Findings

### [P1] 16 security/reliability fixes on `fix/review-cycle-12-fixes` NEVER merged to main
**File:** `origin/fix/review-cycle-12-fixes` (remote branch, 16 commits)
**Issue:** The entire "full-codebase review" batch from Cycle 12 exists only on an unmerged branch. MEMORY.md documents these as complete, but NONE reached main or production. Missing fixes include:

| Commit | Fix | Severity |
|--------|-----|----------|
| `87bc69d` | COOKIE_SECRET validation at startup (throw instead of process.exit) | P1 |
| `9f41a49` | Pre-check duplicate mailgun_message_id before table rebuild | P1 |
| `e542826` | Shared stmt-cache.ts (triplicated cache) | P2 |
| `dd1fa7b` | Pagination for listLeadsFiltered (LIMIT 50, max 200) | P2 |
| `0e4932f` | Startup recovery for stuck "received" leads | P2 |
| `7c4a958` | Dashboard HTML + root redirect behind sessionAuth | P2 |
| `f4615af` | try-catch on JSON.parse in twilio-webhook | P2 |
| `b6489e6` | Rate limiting (30/15min) on webhooks | P2 |
| `5300cc7` | Remove raw HTML flag from analyzeKvHTML | P2 |
| `94d9198` | SSE heartbeat every 15s for /api/analyze | P2 |
| `40b3479` | Phone number redacted to last 4 digits | P2 |

**Suggestion:** Merge this branch to main or cherry-pick fixes. This is the highest-priority action from the entire audit.

---

### [P1] 5 Helmet/error-sanitization fixes on `fix/batch-d-quick-wins` NEVER merged
**File:** `origin/fix/batch-d-quick-wins` (remote branch, 5 commits)
**Issue:** Security headers (Helmet middleware), SMS error response sanitization, analyze endpoint error sanitization, and CSP inline event handler fixes all exist on an unmerged branch.
**Suggestion:** Merge or cherry-pick to main.

---

### [P2] Sourced format T1 tier gap — latest commit may cause pipeline crashes
**File:** `src/data/rates.ts` (commit `1c461cf`)
**Issue:** New sourced cultural rate tables only define T2P/T2D/T3P/T3D — no T1. If LLM classifier assigns `rate_card_tier: "T1"` to a sourced format, `price.ts` will throw. The guard exists only in prompt text (fragile LLM-only defense, no code fallback).
**Suggestion:** Add runtime fallback in `price.ts` for missing T1 tier, or add T1 entries to sourced rate tables.

---

### [P2] `feat/gig-lead-pipeline` is stale — still set as GitHub default branch
**File:** GitHub repository settings
**Issue:** 370 commits behind main, 20 commits ahead (all cherry-picked separately). This branch is effectively dead but is the GitHub default branch, which could confuse new clones or CI.
**Suggestion:** Change GitHub default branch to `main`.

---

### [P3] Dead code `src/data/venues.ts` — created in first commit, never imported
**File:** `src/data/venues.ts`
**Issue:** Created in the very first feature commit (`1a09a3e`). Never meaningfully modified after. Superseded by PF-Intel HTTP API (`src/venue-lookup.ts`). Zero imports confirmed.
**Suggestion:** Delete.

---

### [P3] Dual automation entry points can drift
**File:** `src/automation/main.ts` vs `src/automation/poller.ts`
**Issue:** `main.ts` created first (Phase 3, standalone PM2 process). `poller.ts` created later (commit `2d18427`) to embed in server for Railway single-deploy. Both duplicate initialization logic. `main.ts` lacks credential bootstrapping that `poller.ts` has — would fail silently on Railway.
**Suggestion:** Delete `main.ts` if standalone mode is no longer used, or refactor to delegate to `poller.ts`.

---

### [P3] `src/server.ts` has 40 commits — highest-churn production file
**File:** `src/server.ts`
**Issue:** Combines env validation, middleware ordering, DB init, and poller lifecycle. History shows repeated fixes to middleware ordering — a sign complexity exceeds what one file should manage.
**Suggestion:** Monitor. Current separation (app.ts vs server.ts) is adequate but server.ts accumulates responsibilities.

---

## Code Churn Hotspots

| Commits | File | Risk |
|---------|------|------|
| 40 | `src/server.ts` | High — repeated middleware ordering fixes |
| 31 | `src/types.ts` | Medium — grows with each feature |
| 31 | `public/dashboard.html` | Medium — monolith HTML |
| 25 | `src/api.ts` | Medium — handler accumulation |
| 22 | `src/prompts/generate.ts` | Low — prompt engineering iterations (expected) |

## Security Fix Completeness

| Category | Status |
|----------|--------|
| Cycle 11 injection hardening | All on main |
| Cycle 12 P2 batch (first 8 fixes) | All on main |
| Cycle 12 full-codebase review (11 fixes) | NONE on main |
| Batch D quick wins (Helmet + sanitization) | NONE on main |

**Net assessment:** Targeted security fixes (injection, CSRF, CSP) present. Systemic hardening (rate limiting, auth coverage, error sanitization, Helmet) missing.

## Summary

- **P1:** 2 (21 unmerged fixes across 2 branches)
- **P2:** 2 (T1 tier gap, stale default branch)
- **P3:** 3 (dead code, dual entry points, churn hotspot)

**The single most important finding from the entire audit is that production is running without 21 security and reliability fixes that were written, reviewed, and documented as complete — but never merged.**
