# Git History Analyzer — Review Findings

**Agent:** compound-engineering:research:git-history-analyzer
**Branch:** fix/p2-batch-cycle-12
**Date:** 2026-03-05
**Files reviewed:** 22 (source files)

## Branch Overview

- **24 commits** (694c9f7..05f762d), all dated 2026-03-05
- **Already merged to main** at commit 9292d35
- **Net change:** 22 files, +1057 / -882 lines (source files only)
- **Two phases:** (1) batched P1+P2 security/correctness fixes (#026-#034), then (2) structural refactor splitting `src/leads.ts` (762 lines) into `src/db/` modules

## Findings

### [P2] Triplicated stmt cache pattern across db modules -- maintenance risk
**File:** `src/db/leads.ts:9-23`, `src/db/follow-ups.ts:9-23`, `src/db/queries.ts:9-23`
**Issue:** The `stmt()` helper with `cachedDb` and `stmtCache` is copy-pasted identically into all three db modules. Each module has its own independent cache instance and a comment "keep in sync." This is a maintenance landmine -- if one copy diverges, behavior becomes inconsistent. Three separate caches also mean 3x the memory for the same database handle.
**Suggestion:** Extract `stmt()` into a shared `src/db/shared.ts` helper that all three modules import.

---

### [P2] shapeLead can return null into res.json() without a 404/500 guard
**File:** `src/api.ts:96`, `src/api.ts:140`, `src/api.ts:215`, `src/follow-up-api.ts:28`, `src/follow-up-api.ts:77`
**Issue:** After the response envelope standardization (#032), `shapeLead(updated)` is passed directly to `res.json()`. But `shapeLead` returns `LeadApiResponse | null`. If `updated` is somehow undefined, the client receives `null` as the response body with a 200 status. The old code in `follow-up-api.ts` had explicit null guards that were removed in this branch.
**Suggestion:** Either add a null guard after `shapeLead()` calls before `res.json()`, or tighten the function signature.

---

### [P2] Timestamp replay protection had to be fixed twice -- indicates missing test
**File:** `src/webhook.ts:64-68`
**Issue:** Commit 1d3b928 introduced replay protection using `Math.abs()`, which silently accepted future-dated timestamps. This was caught and fixed 17 minutes later in commit 69839b5. The quick fix-on-fix pattern suggests no test validated the behavior boundary. The current code is correct, but the lack of test coverage means a future refactor could reintroduce the flaw.
**Suggestion:** Add unit tests for timestamp validation: (1) valid recent timestamp passes, (2) timestamp 6 minutes old rejects, (3) timestamp 2 minutes in the future rejects, (4) NaN timestamp rejects.

---

### [P3] Dashboard HTML is read once at startup and cached in memory
**File:** `src/server.ts:70`
**Issue:** `readFileSync` at module top level means dashboard HTML is cached for the lifetime of the process. Fine for production but requires server restart during development.
**Suggestion:** No action needed for production. Consider reading on each request when `NODE_ENV !== "production"` if it becomes annoying in dev.

---

### [P3] CSP nonce regex could inject into `<script` inside HTML comments or strings
**File:** `src/server.ts:73`
**Issue:** The regex `/<script(?=[\s>])/gi` matches all `<script` occurrences including those inside HTML comments or string content. Harmless for the current single-file dashboard.
**Suggestion:** Acceptable for now. If the HTML grows more complex, switch to template placeholders instead of regex replacement.

---

### [P3] Dead code path: leads.map(shapeLead) passes array through nullable function
**File:** `src/api.ts:27`, `src/api.ts:39`
**Issue:** `leads.map(shapeLead)` produces `(LeadApiResponse | null)[]` because `shapeLead` returns `LeadApiResponse | null`. The API sends an array that could contain null entries.
**Suggestion:** Either use `.map(shapeLead).filter(Boolean)` or tighten the `shapeLead` signature.

---

## Commit Quality Assessment

**Strengths:**
- Commit messages are excellent -- clear, specific, include ticket numbers (#026-#034)
- Commit sizes are disciplined: most under 20 lines of source change
- Security fixes well-categorized with `fix(security):` prefix
- Clean separation between fix commits and refactor commits

**Churn Analysis:**

| File | Commits | Notes |
|------|---------|-------|
| `src/webhook.ts` | 2 | Timestamp fix required correction (P2 above) |
| `src/server.ts` | 4 | CSP nonce + regex fix + logout + import repoint |
| `src/leads.ts` | 4 then deleted | Modified, split into db/ modules, deleted |
| `src/api.ts` | 3 | shapeLead extraction + envelope fix + cleanup |

## Historical Context for Reviewers

1. **`src/leads.ts` was a 762-line god module** touched by 20+ commits across cycles. The split into `src/db/` was planned with a 13-agent research session and executed cleanly.

2. **The branch sits between two security-focused cycles.** Cycle 11 fixed 3 P1 security issues. This branch (Cycle 12) handled the P2 batch. Cycle 13 continues with email parser security hardening.

3. **The response envelope change (#032) was a breaking API contract change.** Follow-up action endpoints previously returned `{ success: true, lead: {...} }` and now return the bare lead object. Dashboard JS was updated in the same branch.

4. **Post-merge status:** 7 additional security commits have landed on main after the merge, targeting `src/email-parser.ts`.
