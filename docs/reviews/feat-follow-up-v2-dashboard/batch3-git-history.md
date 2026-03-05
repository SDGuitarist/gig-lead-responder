# Git History Analyzer — Review Findings

**Agent:** compound-engineering:research:git-history-analyzer
**Branch:** feat/follow-up-v2-dashboard
**Date:** 2026-03-02
**Files reviewed:** 14

## Branch Overview

- **12 commits**, all by Alex Guillen (with Claude Opus 4.6 co-author), on a single day: 2026-03-02
- **Two work sessions**: Phase 1 (09:20 - 09:24), ~2 hour gap, Phase 2+3 (11:23 - 11:45)
- **Total delta**: +1,626 / -94 across 14 files
- **Three implementation phases**, each bookended by documentation commits

### Commit Timeline

```
Phase 1 (09:20 - 09:24) — Schema + Auth
  8c0e02b  feat(schema): add replied status, snoozed_until column, table rebuild migration  (+74)
  b99675e  feat(auth): sessionAuth, CSRF guard, security headers, rate limiter              (+199)
  a90086f  docs: update plan checkboxes and handoff for Phase 1 complete                    (+622)

Phase 2 (11:23 - 11:25) — API + Claim Functions
  efcaa71  feat(follow-up): atomic claim functions, API endpoints, SMS refactor              (+318)
  2854dc9  docs: update plan checkboxes and handoff for Phase 2 complete                    (+16)

Phase 3 (11:32 - 11:45) — Dashboard UI
  f7d9688  feat(api): follow_up=active filter for dashboard tab                             (+25)
  99820b2  feat(dashboard): X-Requested-With CSRF header                                    (+1)
  269a339  feat(dashboard): scrollable tab-nav and follow-up card CSS                       (+161)
  7debb7d  feat(dashboard): Follow-Ups tab button, panel, tab routing                       (+28)
  4bdb88e  feat(dashboard): Follow-Ups tab JavaScript                                       (+182)
  456fb89  docs: update plan checkboxes for Phase 3 complete                                (+16)
  29d5264  docs: update handoff for Phase 3 complete, ready for review                      (+44)
```

## Findings

### [P2] Commit `efcaa71` bundles too many concerns for a single commit
**File:** Multiple files (7 files, 318 insertions, 56 deletions)
**Issue:** This commit performs at least four distinct operations: (1) adds 5 atomic claim functions to `src/leads.ts` (+127 lines), (2) creates the entirely new `src/follow-up-api.ts` file (+138 lines), (3) refactors `src/twilio-webhook.ts` to use shared functions (-44 lines of old logic), and (4) updates `src/follow-up-scheduler.ts` to use atomic claim with a new notification format. The project's own CLAUDE.md targets ~50-100 lines per commit with one concern each. This commit is 3x the upper bound and mixes new feature code with a refactor of existing code paths.
**Suggestion:** In future work, split into at least 3 commits: (a) add atomic claim functions to `src/leads.ts`, (b) create `src/follow-up-api.ts` wired to server, (c) refactor SMS handlers in `src/twilio-webhook.ts` and `src/follow-up-scheduler.ts` to use shared functions.

---

### [P2] Commit `b99675e` bundles auth, security headers, and rate limiting into one commit
**File:** `src/auth.ts`, `src/rate-limit.ts`, `src/server.ts` (6 files, 199 insertions)
**Issue:** This commit introduces three distinct security concerns in one shot: (1) session-based auth with HMAC-SHA256 cookie signing in `src/auth.ts` (+161 lines), (2) a new `followUpActionLimiter` in `src/rate-limit.ts` (+8 lines), and (3) security headers (CSP, X-Frame-Options, nosniff) wired into `src/server.ts` (+13 lines). Each is an independent, reviewable concern. The cookie-signing implementation alone is security-critical code that deserves isolated review.
**Suggestion:** Split into: (a) session auth with signed cookie, (b) CSRF guard middleware, (c) security headers on server, (d) follow-up action rate limiter.

---

### [P3] Phase 2 has a single feature commit covering all backend work
**File:** Commit `efcaa71` (entire Phase 2 backend)
**Issue:** Phase 1 has 2 feature commits and Phase 3 has 5 granular commits. Phase 2 collapses all its backend work into a single commit. This inconsistency suggests Phase 2 was done in a rush (the 2-hour gap before Phase 2 may indicate a context switch). The resulting commit is harder to bisect if any of the 4 logical changes introduces a regression.
**Suggestion:** When returning from a break/gap, maintain the same commit granularity as the other phases.

---

### [P3] `dashboard.html` continues to grow as a monolith (2,474 lines)
**File:** `public/dashboard.html`
**Issue:** The dashboard file has grown from 2,105 to 2,474 lines on this branch. It accumulates CSS, HTML, and JavaScript in a single file across many features. The Phase 3 commits are individually clean (CSS first, then HTML structure, then JS logic), but each append adds to a file that is becoming difficult to navigate.
**Suggestion:** Consider extracting CSS into a separate stylesheet and JavaScript into a separate module file in a future refactoring session. A good trigger for extraction: when the file exceeds 3,000 lines.

---

### [P3] Commit `a90086f` inflates insertion count with bundled plan document
**File:** `docs/plans/2026-03-01-feat-follow-up-pipeline-v2-dashboard-plan.md`
**Issue:** Commit `a90086f` shows +622 insertions, but +596 are the plan document being added. The subject says "update plan checkboxes" which implies a small edit, not a 596-line file addition. The plan was likely created earlier but only committed here.
**Suggestion:** Commit the plan document in the session it was created, with a message like "docs: add follow-up v2 dashboard plan".

---

### [P3] Commit message body length is a signal the commit is too large
**File:** Commit `efcaa71` (commit message)
**Issue:** The commit message body for `efcaa71` lists 6 bullet points covering 4 different files and operations. When a commit message needs more than 3 bullet points in its body, that is a reliable heuristic that the commit should be split.
**Suggestion:** Use the "3 bullet points max" heuristic as a commit-splitting trigger.

## Positive Patterns Observed

1. **Conventional commit prefixes** used consistently (`feat(scope):`, `docs:`)
2. **Phase 3 commits show ideal granularity** — CSS, HTML structure, and JavaScript committed separately
3. **Documentation interleaved with code** — every phase ends with HANDOFF.md update
4. **Co-author attribution consistent** — every commit includes `Co-Authored-By: Claude Opus 4.6`
5. **Refactoring done alongside feature** — twilio-webhook and scheduler refactored to use shared atomic functions
6. **Branch reads as a coherent narrative**: schema → auth → backend API → frontend
