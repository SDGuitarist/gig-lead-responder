# Review Summary: P3 Bundle 061

**Date:** 2026-03-08
**Commits:** 3347228..c128563 (4 commits on main)
**Plan:** docs/plans/2026-03-08-fix-p3-bundle-061-plan.md
**Files changed:** src/server.ts, src/db/migrate.ts, src/db/leads.ts, src/db/queries.ts, public/dashboard.html, public/dashboard.css

## Prior Phase Risk

> "Least confident about going into review? Whether the `applyDataWidths` hooks
> cover every code path that rebuilds detail panels. There are 3 separate
> innerHTML assignments for `renderDetailPanel` (expand, outcome preview, outcome
> save). All 3 got hooked, but if a future code path adds a 4th, bars will
> render at 0 width with no error."

**Resolution:** Security Sentinel independently verified all 4 `applyDataWidths`
call sites (lines 726, 922, 966, 1124) match all `innerHTML` assignments that
produce `data-width` elements. Coverage is complete. Architecture Strategist
recommends a contract comment to reduce future maintenance risk (see 062).

## Severity Snapshot

| Priority | Count |
|----------|-------|
| P1 (Critical) | 0 |
| P2 (Important) | 2 |
| P3 (Informational) | 6 (no action needed) |

## Recommended Fix Order

| # | Issue | Priority | Why this order | Unblocks |
|---|-------|----------|---------------|----------|
| 1 | 062 - applyDataWidths contract comment | P2 | Low effort (1 comment), reduces maintenance risk for anyone touching dashboard innerHTML | -- |
| 2 | 063 - updateLead missing event_type normalization | P2 | Structural gap — no current callers but prevents regression if updateLead is ever called with event_type | -- |

## P2 Findings

### 062 - applyDataWidths contract comment (Architecture)

The `applyDataWidths` function must be called after every `innerHTML` assignment
that may contain `data-width` elements. Currently 2 producers (renderDetailPanel,
table builder) and 4 call sites. If a future path forgets the call, bars render
at 0 width silently. A contract comment above the function definition turns
"must remember" into documented obligation.

**Effort:** Small (1 comment block)
**Agents:** Architecture Strategist (P2), Code Simplicity Reviewer (confirmed pattern is correct)

### 063 - updateLead missing event_type normalization (Data Migration)

`updateLead` accepts `event_type` in its allowed columns but does NOT apply
`trim().toLowerCase()` normalization. No code currently calls it with event_type,
but the gap exists structurally — the exact same class of bug the migration fixes.

**Effort:** Small (~3 lines)
**Agents:** Data Migration Expert (P2)

## P3 Informational Notes (no action needed)

1. **loadMoreWrap uses .style.display** — could use class toggle for consistency, but CSSOM is not governed by CSP. (Security Sentinel)
2. **analyzeKvHTML raw-HTML flag** — pre-existing, already mitigated in Cycle 11. (Security Sentinel)
3. **No versioned migration system** — appropriate at ~180 lines. Monitor when approaching ~300. (Architecture Strategist)
4. **Inconsistent `??` vs `||` across insertLead fields** — only event_type needs `||` today since it's the only field with `.trim()`. Not a bug. (Architecture Strategist)
5. **Startup COUNT runs every boot** — negligible at <100 rows, self-quenching (returns 0 after first normalization). (Performance Oracle)
6. **No index on event_type** — not needed at current scale. (Performance Oracle)

## Known Patterns (from docs/solutions/)

Learnings Researcher surfaced 5 relevant past solutions:
- **CSP regex lookahead** (Cycle 4) — validated the nonce injection pattern
- **Write-time normalization** (Cycle 15) — confirms data-layer-owns-the-contract principle
- **Data attributes for DOM updates** (Cycle 15) — validates the data-width approach
- **Stmt cache misuse** (Cycle 12) — no new instances introduced
- **Pre-migration duplicate detection** (Cycle 12) — migration follows the guard pattern

## Review Agents Used

| Agent | Findings | Verdict |
|-------|----------|---------|
| Security Sentinel | 0 P1, 0 P2, 2 P3 | Clean — CSP complete, all call sites verified |
| Performance Oracle | 0 P1, 0 P2, 4 P3 | Clean — no actionable performance issues |
| Architecture Strategist | 0 P1, 1 P2, 3 P3 | One actionable: contract comment |
| Code Simplicity Reviewer | 0 findings | Already minimal |
| Data Migration Expert | 0 P1, 1 P2, 2 P3 | One actionable: updateLead gap |
| Agent-Native Reviewer | 0 findings | No agent parity issues |
| Learnings Researcher | 5 relevant solutions | No new risks |

## Verdict

**Ship it.** Zero P1 blockers. Two small P2 items (a comment + a 3-line guard)
that can be fixed in a quick follow-up. The bundle is well-planned, correctly
ordered, and all acceptance criteria from the plan are met. The flagged risk
(applyDataWidths coverage) was independently verified as complete by Security
Sentinel.

## Three Questions

1. **Hardest judgment call in this review?** Whether `updateLead` missing
   normalization is P2 or P3. Chose P2 because it's the same class of bug the
   migration is fixing — a structural gap that will bite silently if a future
   caller passes event_type to updateLead. Zero current callers makes it
   non-urgent, but the fix is trivial.

2. **What did you consider flagging but chose not to, and why?** The `??` vs
   `||` inconsistency across other insertLead fields (client_name, venue,
   budget_note). These fields don't apply `.trim()` so empty string can't be
   produced by the optional chain. The inconsistency is only relevant if
   normalization is added to those fields later — speculative, not actionable.

3. **What might this review have missed?** Browser-level CSP testing. All agents
   verified the code changes are correct, but no agent actually loaded the
   dashboard in a browser to confirm zero CSP violations in the console. The
   work phase noted this as a manual verification step.
