# Fix Batch Plan — feat/lead-conversion-tracking

**Date:** 2026-02-25
**Source:** docs/reviews/feat-lead-conversion-tracking/REVIEW-SUMMARY.md
**Total findings:** 40

## Batch A — Deletes and Removals

| # | Finding | Severity | File | Risk |
|---|---------|----------|------|------|
| 1 | Orphaned `renderDetailPanel(updated)` call — dead code | P2 | `public/dashboard.html:1773` | Zero — delete one line |
| 2 | `OutcomeUpdateBody` interface defined but never used | P2 | `src/types.ts:164-168` | Zero — delete unused interface |
| 3 | `AnalyticsBreakdown` imported but unused in leads.ts | P2 | `src/leads.ts:4` | Zero — remove from import |

## Batch B — Data Integrity and Hot Path

| # | Finding | Severity | File | Risk |
|---|---------|----------|------|------|
| 1 | `_pendingOutcome` shared state mutation without try/finally | P1 | `public/dashboard.html:1718-1736` | Medium — changes rendering path; shallow copy must produce identical HTML |
| 2 | XSS: `g.gate_status` unescaped in innerHTML | P1 | `public/dashboard.html:1997-1998` | Low — adding `esc()` call, defense-in-depth |
| 3 | Missing body guard — `req.body` undefined crash | P1 | `src/api.ts:218-224` | Low — early return before existing logic |
| 4 | Analytics query scoping mismatch — `total_untracked` inflated | P1 | `src/leads.ts:308-349` | Medium — changes analytics numbers; must verify all 3 queries align |
| 5 | Inapplicable sub-fields silently discarded without feedback | P2 | `src/api.ts:218-244` | Medium — adds new 400 responses; dashboard must handle rejection |
| 6 | CHECK constraint mismatch — no runtime guard in storage | P2 | `src/leads.ts:282-301` | Low — adds validation before DB call |
| 7 | `setLeadOutcome` doesn't validate lead is in `done` status | P2 | `src/leads.ts:282-301` | Low — adds guard to exported function |

## Batch C — Code Quality and Abstractions

| # | Finding | Severity | File | Risk |
|---|---------|----------|------|------|
| 1 | `as` cast → type guards | P2 | `src/api.ts:221, 242` | Low — refactor, same runtime behavior |
| 2 | Enum duplication → single source of truth | P2 | `src/types.ts`, `src/api.ts` | Low — const array + derived type |
| 3 | `getAnalytics()` shape in storage layer → split | P2 | `src/leads.ts`, `src/api.ts` | Medium — moves code between files |
| 4 | Full table re-render after save → targeted update | P2 | `public/dashboard.html:1768-1783` | Medium — changes DOM update strategy |
| 5 | `finally` block confusion → restructure | P2 | `public/dashboard.html:1788-1792` | Low — same behavior, clearer structure |
| 6 | Missing `outcome` index | P2 | `src/leads.ts` | Zero — additive DDL |
| 7 | `Set<string>` → `Set<LeadOutcome>` | P2 | `src/api.ts:197-198` | Zero — type-only change (depends on C-2) |
| 8 | Missing `source_platform` index | P2 | `src/leads.ts` | Zero — additive DDL |
| 9 | Body size limit `{ limit: '100kb' }` | P3 | `src/server.ts:18` | Zero — config-only |
| 10 | `savingOutcomeForId` → `savingOutcome` rename | P3 | `public/dashboard.html:1716, 1744` | Zero — rename only |
| 11 | `database` → `db` naming consistency | P3 | `src/leads.ts:305` | Zero — rename only |
| 12 | Read-only transaction comment | P3 | `src/leads.ts:306` | Zero — comment only |
| 13 | CHECK constraint SYNC comment | P3 | `src/leads.ts:67-70` | Zero — comment only |
| 14 | `analyzeKvHTML` label escaping | P3 | `public/dashboard.html:1947` | Zero — defense-in-depth |
| 15 | Inline style → CSS class | P3 | `public/dashboard.html` (renderInsights) | Zero — cosmetic |

## Batch D — Deferred

| # | Finding | Severity | File | Why Deferred |
|---|---------|----------|------|-------------|
| 1 | No security headers (helmet) | P2 | `src/server.ts` | New dependency — needs `npm install helmet` |
| 2 | No CSRF protection | P2 | `src/api.ts` | Auth architecture decision needed |
| 3 | `json_extract` denormalization | P2 | `src/leads.ts` | Schema migration — broad impact, separate feature |
| 4 | `SELECT *` → explicit columns | P2 | `src/leads.ts:245` | Pre-existing pattern, not introduced by this branch |
| 5 | `loadInsights()` caching | P3 | `public/dashboard.html` | New feature behavior — needs TTL/invalidation design |
| 6 | `error_message` leak | P3 | `src/api.ts:55` | Product decision on what to show users |
| 7 | SMS error leak | P3 | `src/api.ts:142-143` | Product decision on error UX |
| 8 | Basic Auth in JS closure | P3 | `public/dashboard.html` | Auth architecture overhaul |
| 9 | Rate limiting | P3 | `src/api.ts` | New dependency or middleware |
| 10 | Triple SELECT optimization | P3 | `src/api.ts` / `src/leads.ts` | Micro-optimization, needs SQLite 3.35+ check |
| 11 | `isStale()` Date optimization | P3 | `public/dashboard.html` | Micro-optimization |
| 12 | Client clock assumption | P3 | `public/dashboard.html` | Acceptable for v1, comment-only |
| 13 | Out-of-order types commit | P3 | Branch-level | Process improvement, no code change |
| 14 | Oversized dashboard commit | P3 | Branch-level | Process improvement, no code change |
| 15 | Dashboard monolith (2,092 lines) | P3 | `public/dashboard.html` | Future architectural refactor |
