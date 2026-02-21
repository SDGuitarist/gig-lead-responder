# Deepen Metadata

**Plan file:** docs/brainstorms/2026-02-21-rubric-comparison-fixes-brainstorm.md
**Plan name:** 2026-02-21-rubric-comparison-fixes-brainstorm
**Date:** 2026-02-21

## Section Manifest

1. **Fix 1: Past-Date Detection** — Research how to inject today's date into the
   classify prompt, best patterns for date validation in LLM pipelines, and how
   to add a classification flag that conditionally triggers a flagged concern in
   the generate prompt.

2. **Fix 2: Anchor-High Mariachi Pricing** — Research format routing patterns,
   day-of-week parsing from natural language dates, signal-based routing for
   background vs entertainment vs participatory events, and how to present
   multiple pricing options in a single draft. Key constraint: 4-piece is
   Mon–Thu only.

3. **Fix 3: Cultural Vocabulary Mapping** — Research few-shot example patterns
   for cultural term accuracy, how to conditionally inject vocabulary into
   prompts, and whether the pass/fail pattern generalizes beyond the deletion
   test. Also: what other cultural terms might be commonly confused.

## Discovered Skills (0 matched)

No project-local or plugin skills directly match this domain (prompt engineering
for a lead response pipeline). The compound-engineering skills are oriented toward
Rails, Python, frontend design, and gem writing — none apply here.

| # | Skill | Path | Match Reason |
|---|-------|------|-------------|
| — | (none matched) | — | — |

## Discovered Learnings (4 relevant / 8 found)

| # | Learning | Path | Relevance |
|---|----------|------|-----------|
| 1 | Sparse Lead Type Classification | docs/solutions/sparse-lead-type-classification.md | HIGH — Fix 2 format routing and Fix 3 cultural vocab interact with sparse lead handling. The type system (price shopper, overwhelmed, impatient filler) affects how format recommendations land. |
| 2 | Testable Constraints for Prompt Compliance | docs/solutions/testable-constraints-for-prompt-compliance.md | HIGH — Fix 3 uses the exact same pattern (pass/fail examples as forcing rules). This learning validates the approach and may have implementation details to reuse. |
| 3 | Prompt Placement for Hard Constraints | docs/solutions/prompt-placement-for-hard-constraints.md | MEDIUM — Fix 1 and Fix 3 both add new constraints to prompts. Where they're placed (top vs inline) affects compliance rate. |
| 4 | Platform Policy Enforcement | docs/solutions/platform-policy-enforcement.md | MEDIUM — Shows how conditional prompt injection works (two-layer enforcement). Fix 3 injects cultural vocab conditionally on `cultural_context_active`. Same pattern. |

Not relevant:
- async-sqlite-transaction-boundary.md (data layer, not prompt)
- fire-and-forget-timeout.md (resilience, not prompt)
- silent-failure-escape-hatches.md (deployment, not prompt)
- dead-code-env-var-collision.md (code hygiene, not prompt)

## Discovered Agents (24 total)

### Review Agents (10)

| # | Agent | Path | Type |
|---|-------|------|------|
| 1 | kieran-typescript-reviewer | .../agents/review/kieran-typescript-reviewer.md | review |
| 2 | pattern-recognition-specialist | .../agents/review/pattern-recognition-specialist.md | review |
| 3 | architecture-strategist | .../agents/review/architecture-strategist.md | review |
| 4 | code-simplicity-reviewer | .../agents/review/code-simplicity-reviewer.md | review |
| 5 | performance-oracle | .../agents/review/performance-oracle.md | review |
| 6 | security-sentinel | .../agents/review/security-sentinel.md | review |
| 7 | agent-native-reviewer | .../agents/review/agent-native-reviewer.md | review |
| 8 | dhh-rails-reviewer | .../agents/review/dhh-rails-reviewer.md | review |
| 9 | kieran-rails-reviewer | .../agents/review/kieran-rails-reviewer.md | review |
| 10 | kieran-python-reviewer | .../agents/review/kieran-python-reviewer.md | review |
| 11 | data-integrity-guardian | .../agents/review/data-integrity-guardian.md | review |
| 12 | data-migration-expert | .../agents/review/data-migration-expert.md | review |
| 13 | deployment-verification-agent | .../agents/review/deployment-verification-agent.md | review |
| 14 | julik-frontend-races-reviewer | .../agents/review/julik-frontend-races-reviewer.md | review |

### Research Agents (5)

| # | Agent | Path | Type |
|---|-------|------|------|
| 1 | best-practices-researcher | .../agents/research/best-practices-researcher.md | research |
| 2 | learnings-researcher | .../agents/research/learnings-researcher.md | research |
| 3 | repo-research-analyst | .../agents/research/repo-research-analyst.md | research |
| 4 | git-history-analyzer | .../agents/research/git-history-analyzer.md | research |
| 5 | framework-docs-researcher | .../agents/research/framework-docs-researcher.md | research |

### Design Agents (3) — not applicable

| # | Agent | Path | Type |
|---|-------|------|------|
| 1 | figma-design-sync | .../agents/design/figma-design-sync.md | design |
| 2 | design-implementation-reviewer | .../agents/design/design-implementation-reviewer.md | design |
| 3 | design-iterator | .../agents/design/design-iterator.md | design |

### Docs Agents (1) — not applicable

| # | Agent | Path | Type |
|---|-------|------|------|
| 1 | ankane-readme-writer | .../agents/docs/ankane-readme-writer.md | docs |

### Workflow Agents (5) — skipped (orchestrators, not reviewers)

- every-style-editor, lint, pr-comment-resolver, bug-reproduction-validator, spec-flow-analyzer
