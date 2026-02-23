# Deepen Metadata

**Plan file:** docs/plans/2026-02-22-feat-dashboard-ui-redesign-plan.md
**Plan name:** 2026-02-22-feat-dashboard-ui-redesign-plan
**Date:** 2026-02-22

## Section Manifest

1. **Overview** — general dashboard architecture, unified interface replacing two surfaces
2. **Design Decisions** — 13 resolved open questions from spec-flow analysis
3. **Proposed Solution** — new/modified/deprecated file listing
4. **Chunk 1: Database Layer** — SQLite filtered listing + stats aggregation queries
5. **Chunk 2: API Router** — Express JSON endpoints, Basic Auth, JSON blob parsing
6. **Chunk 3: Dashboard HTML** — layout, stats cards, data table, CSS, dynamic rendering
7. **Chunk 4: Expandable Row Detail** — accordion, approve action, edit draft, error states
8. **Chunk 5: Analyze Tab** — SSE streaming integration, manual stream reader
9. **Chunk 6: Route Cleanup** — redirect, mockup cleanup, HANDOFF update
10. **Technical Considerations** — performance, security, error handling, no build step

## Discovered Skills (2 matched)

| # | Skill | Path | Match Reason |
|---|-------|------|--------------|
| 1 | frontend-design | ~/.claude/plugins/cache/every-marketplace/compound-engineering/2.28.0/skills/frontend-design | Directly building a beautiful dashboard UI with specific design system |
| 2 | agent-native-architecture | ~/.claude/plugins/cache/every-marketplace/compound-engineering/2.28.0/skills/agent-native-architecture | API design — ensuring endpoints are usable by agents, not just the browser UI |

**Skipped (not relevant to this plan):** andrew-kane-gem-writer (Ruby), dhh-rails-style (Rails), dspy-ruby (Ruby LLM), every-style-editor (editorial), brainstorming (already done), compound-docs (documentation), skill-creator/create-agent-skills (skill authoring), gemini-imagegen (image gen), git-worktree (git), rclone (file sync), file-todos (todo management), agent-browser (browser automation)

## Discovered Learnings (6 relevant / 15 found)

| # | Learning | Path | Relevance |
|---|----------|------|-----------|
| 1 | Async SQLite Transaction Boundary | docs/solutions/database-issues/async-sqlite-transaction-boundary.md | Approve endpoint does SMS (async) + DB update — exactly this pattern |
| 2 | Fire-and-Forget Pipeline Timeout | docs/solutions/architecture/fire-and-forget-timeout.md | Dashboard shows mid-pipeline leads; understanding timeout behavior matters |
| 3 | Silent Failure Escape Hatches | docs/solutions/architecture/silent-failure-escape-hatches.md | Adding Basic Auth to new API routes — auth failures can be silent |
| 4 | Extract Constants at Module Boundaries | docs/solutions/logic-errors/constants-at-the-boundary.md | Status strings ("received"→"Pending"), score thresholds, format names shared across API + frontend |
| 5 | Required-Nullable vs Optional Types | docs/solutions/logic-errors/required-nullable-vs-optional-types.md | Parsing JSON blobs that can be null; API response shape design |
| 6 | Compute 'Today' Once at Pipeline Entry | docs/solutions/logic-errors/today-as-parameter-timezone.md | Stats card "This Month" depends on today's date; date display in table |

**Skipped (prompt-engineering/pipeline-specific, not UI):** hybrid-llm-deterministic-computation, noop-gut-checks, platform-policy-enforcement, reprice-after-enrichment-override, contrastive-pair-vocabulary, sparse-lead-type-classification, testable-constraints, prompt-placement, dead-code-env-var-collision

## Discovered Agents (16)

### Review Agents (9)

| # | Agent | Subagent Type | Relevance |
|---|-------|---------------|-----------|
| 1 | kieran-typescript-reviewer | compound-engineering:review:kieran-typescript-reviewer | TypeScript API code in src/api.ts, src/leads.ts |
| 2 | performance-oracle | compound-engineering:review:performance-oracle | SQLite query performance, API response size, frontend rendering |
| 3 | security-sentinel | compound-engineering:review:security-sentinel | Basic Auth on API, credential handling in browser JS |
| 4 | code-simplicity-reviewer | compound-engineering:review:code-simplicity-reviewer | YAGNI check — is the plan overbuilt? |
| 5 | julik-frontend-races-reviewer | compound-engineering:review:julik-frontend-races-reviewer | SSE streaming, fetch race conditions, accordion UI state |
| 6 | architecture-strategist | compound-engineering:review:architecture-strategist | Overall system architecture — API + frontend + DB layer split |
| 7 | pattern-recognition-specialist | compound-engineering:review:pattern-recognition-specialist | Design patterns across the plan sections |
| 8 | agent-native-reviewer | compound-engineering:review:agent-native-reviewer | Can an agent use these APIs? |
| 9 | data-integrity-guardian | compound-engineering:review:data-integrity-guardian | DB queries, approve endpoint atomicity |

### Research Agents (2)

| # | Agent | Subagent Type | Focus |
|---|-------|---------------|-------|
| 1 | best-practices-researcher | compound-engineering:research:best-practices-researcher | Vanilla JS dashboard patterns, Express API design |
| 2 | framework-docs-researcher | compound-engineering:research:framework-docs-researcher | Express.js, better-sqlite3, SSE patterns |

### Skipped Agents

- kieran-rails-reviewer, kieran-python-reviewer, dhh-rails-reviewer (wrong language)
- deployment-verification-agent, data-migration-expert (no deployment/migration)
- figma-design-sync, design-implementation-reviewer, design-iterator (no Figma, no implementation yet)
- ankane-readme-writer (not writing docs)
- pre-commit-check, code-explainer, session-kickoff (user utility agents, not reviewers)
