---
pr: 10
branch: fix/p3-batch-cycle-15
date: 2026-03-06
agents: 7
findings: 4
---

# Review Summary — PR #10: fix: P3 batch — Cycle 15 cleanup

## Severity Snapshot

- **P1 (Critical):** 0 — nothing blocks merge
- **P2 (Important):** 3 — should fix
- **P3 (Nice-to-have):** 1 (bundled, 5 sub-items) — defer

## Recommended Fix Order

| # | Issue | Priority | Why this order | Unblocks |
|---|-------|----------|---------------|----------|
| 1 | 058 — Move event_type normalization to insertLead() | P2 | Root cause — covers all write paths, not just webhook | Query 6 cleanup, stale data migration |
| 2 | 059 — Add loop guard to fillMonthlyGaps() | P2 | Independent, 2-line defensive fix | — |
| 3 | 060 — Hoist getBarValue above row loop | P2 | Independent, 3 agents flagged, 1-line move | — |
| 4 | 061 — Deferred P3 bundle (5 items) | P3 | Cosmetic/backlog, no urgency | — |

## Agent Reports

| Agent | Findings | Key Insight |
|-------|----------|-------------|
| TypeScript Reviewer | 0 P1, 1 P2, 3 P3 | fillMonthlyGaps infinite-loop risk on malformed data |
| Security Sentinel | 0 P1, 0 P2, 2 P3 | Clean — esc() caching is safe, CSS extraction adds no surface |
| Performance Oracle | 0 P1, 0 P2, 2 P3 | getBarValue closure-in-loop, Cache-Control opportunity |
| Architecture Strategist | 0 P1, 1 P2, 2 P3 | Normalization belongs in insertLead(), not webhook (root cause) |
| Learnings Researcher | 1 flag (downgraded) | constants-at-the-boundary doesn't apply to external strings |
| Agent-Native Reviewer | PASS | 9/9 UI actions have API equivalents, no gaps |
| Code Simplicity Reviewer | 0 P1, 1 P2, 1 P3 | getBarValue in loop is the only complexity issue |

## Synthesis Decisions

### Downgraded: Learnings Researcher P1 (constants-at-the-boundary)

The learnings researcher flagged event_type normalization as violating the constants-at-the-boundary pattern documented in `docs/solutions/logic-errors/constants-at-the-boundary.md`. **Downgraded because:**

- That pattern applies to **app-defined enums** (like `LOSS_REASONS` in types.ts)
- Event types are **externally-defined strings** from email platforms (GigSalad, The Bash, etc.)
- You cannot create an exhaustive whitelist — new event types appear with every platform
- `trim().toLowerCase()` is correct data hygiene for external strings, not type validation

The real issue (identified by Architecture Strategist) is that normalization is at the wrong layer — webhook instead of insertLead(). This is captured in todo 058.

### Merged findings

- getBarValue-in-loop was flagged by 3 agents independently (Performance, Simplicity, TypeScript) — merged into single todo 060
- event_type normalization concerns from 3 agents (Learnings, Architecture, Agent-Native) — merged into todo 058

### Discarded findings

- None discarded. No agents flagged protected artifacts (docs/plans/, docs/solutions/).

## What This Review Did NOT Cover

- LLM pipeline behavior (prompt injection resilience) — no agent tested
- Accessibility — no agent reviewed
- `npm audit` — not run
- Dashboard end-to-end browser testing — not performed
- Analytics transaction error handling (pre-existing gap, deferred)

## Three Questions

1. **Hardest judgment call in this review?** Whether the learnings researcher's P1 flag (constants-at-the-boundary violation) was valid. Decided event types are external data, not app-controlled enums, so the pattern doesn't apply. The architecture strategist's "wrong layer" framing was the real insight — same symptoms, better diagnosis.

2. **What did you consider flagging but chose not to, and why?** The Security Sentinel noted that CSS extraction creates an opportunity to remove `'unsafe-inline'` from `style-src` CSP (pre-existing todo 029). Considered making this a standalone P2 but it requires verifying all inline styles are gone — a separate investigation, not a finding against this PR.

3. **What might this review have missed?** The dashboard JS is vanilla (no framework, no bundler, no tests). All 7 agents can read the code but none can execute it. Browser-based testing would catch rendering regressions from the CSS extraction that static analysis cannot. The `fillMonthlyGaps()` function has no unit tests — the loop guard (059) is a mitigation, not a substitute.
