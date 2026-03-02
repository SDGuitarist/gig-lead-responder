# Compound Engineering Plugin: v2.28.0 → v2.35.2

Upgrade performed 2026-02-25. This doc captures what changed so we know what's new.

---

## At a Glance

|                | v2.28.0 | v2.35.2 | Delta |
|----------------|---------|---------|-------|
| **Agents**     | 28      | 29      | +1    |
| **Commands**   | 24      | 18      | -6    |
| **Skills**     | 15      | 19      | +4    |
| **MCP Servers** | 1      | 1       | same  |

Commands went *down* because 6 manual/side-effect commands were marked
`disable-model-invocation: true` (they still exist, Claude just won't
auto-invoke them — you call them explicitly).

---

## New Agent

- **`schema-drift-detector`** (v2.29.0) — Detects unrelated `schema.rb` changes
  in PRs. Compares schema diff against migrations, catches columns/indexes from
  other branches, prevents accidental inclusion of local DB state.

## New Skills (+4)

| Skill | Version | What it does |
|-------|---------|-------------|
| `setup` | 2.33.0 | Auto-detects your stack, configures review agents, writes `compound-engineering.local.md` |
| `document-review` | 2.31.0 | Brainstorm and plan refinement through structured review |
| `orchestrating-swarms` | 2.30.0 | Guide to multi-agent orchestration (Teams, Teammates, Inboxes, spawn backends) |
| `resolve-pr-parallel` | 2.31.0 | Resolve all PR comments using parallel processing |

## New Commands

| Command | Version | What it does |
|---------|---------|-------------|
| `/slfg` | 2.30.0 | Swarm-enabled variant of `/lfg` — uses swarm mode for parallel execution |
| `/sync` | 2.31.0 | Sync Claude Code personal config across machines |

## Removed Commands

| Command | Why |
|---------|-----|
| `/technical_review` | Superseded by configurable review agents in `/workflows:review` |
| `/release-docs` | Moved to local `.claude/commands/` (repo maintenance, not distributed) |
| `/plan_review` | No longer in commands dir (functionality absorbed elsewhere) |
| `/resolve_pr_parallel` | Moved to a skill |

---

## Major Feature Changes

### Configurable Review Agents (v2.33.0)
**This is the biggest change for us.**
- `/workflows:review` now reads agent config from `compound-engineering.local.md`
- If that file doesn't exist, it auto-invokes the `setup` skill to create one
- The `learnings-researcher` agent always runs during review (searches `docs/solutions/`)
- `schema-drift-detector` runs conditionally when PRs have migrations

### Context Token Optimization — 79% Reduction (v2.31.0)
- Plugin was consuming 316% of the context description budget, causing Claude to
  silently exclude components
- All 29 agent descriptions trimmed from ~1,400 to ~180 chars average
- 18 manual commands marked `disable-model-invocation: true`
- 6 manual skills marked `disable-model-invocation: true`
- Now at 65% budget usage

### `/workflows:plan` Improvements
- **Brainstorm integration** (v2.35.2): When plan finds a brainstorm doc, it
  heavily references it throughout. Added `origin:` frontmatter, brainstorm
  cross-check, and "Sources" section to all three plan templates.
- **System-wide impact templates** (v2.35.1): MORE and A LOT templates now have
  interaction graphs, error propagation, state lifecycle, API surface parity sections.
- **Plan status tracking** (v2.33.1): Plans get `status: active` frontmatter,
  changed to `status: completed` when `/workflows:work` finishes.
- **File always written to disk** (v2.35.0): Fixed bug where plan wasn't saved
  before interactive prompts.

### `/workflows:work` Improvements
- **System-wide test check** (v2.35.1): Before marking a task done, forces 5
  questions about callbacks, middleware, mocked isolation, orphaned state, etc.
- **Swarm mode** (v2.30.0): Optional parallel execution with coordinated agents.
- **Review agents configurable** (v2.33.0): Uses `compound-engineering.local.md` settings.

### `/lfg` and `/slfg` Fixes (v2.35.0)
- Ralph-loop step made optional (graceful fallback when `ralph-wiggum` skill
  not installed)
- Added explicit "do not stop" instruction across all steps
- Fixed agent namespace typo in `/workflows:plan`

---

## Skill Enhancements

### `dspy-ruby` (v2.31.1)
- Complete rewrite to DSPy.rb v0.34.3 API: `.call()` / `result.field` patterns,
  `T::Enum` classes, tools, events, lifecycle callbacks, evaluation framework

### `dhh-rails-style` (v2.16.0)
- Massive expansion: controllers (authorization, rate limiting, CSRF),
  models (validations, bang methods, Rails 7.1+), frontend (Turbo morphing,
  Stimulus patterns), architecture (multi-tenancy, background jobs, security)

### `agent-native-architecture` (v2.17.0–2.18.0)
- 5 new reference docs: dynamic context injection, action parity discipline,
  shared workspace architecture, agent-native testing, mobile patterns
- Dynamic Capability Discovery pattern, Architecture Review Checklist

---

## Version-by-Version Summary

| Version | Date | Headline |
|---------|------|----------|
| 2.35.2 | 2026-02-20 | `/workflows:plan` brainstorm integration |
| 2.35.1 | 2026-02-18 | System-wide test check + impact templates |
| 2.35.0 | 2026-02-17 | `/lfg` fixes, plan file-write fix |
| 2.34.0 | 2026-02-14 | Gemini CLI converter target |
| 2.33.1 | 2026-02-13 | Plan status tracking (`active`/`completed`) |
| 2.33.0 | 2026-02-12 | Configurable review agents, setup skill, learnings-researcher |
| 2.32.0 | 2026-02-11 | Factory Droid converter target |
| 2.31.1 | 2026-02-09 | `dspy-ruby` rewrite |
| 2.31.0 | 2026-02-08 | Context token optimization (79% reduction), `document-review`, `/sync` |
| 2.30.0 | 2026-02-05 | `orchestrating-swarms` skill, `/slfg` command |
| 2.29.0 | 2026-02-04 | `schema-drift-detector` agent |

---

## Action Items for Our Project

1. **Run `/setup`** in next session to generate `compound-engineering.local.md`
   — this will configure review agents for our TypeScript/Node pipeline.
2. **Plan status tracking** — Our existing plans in `docs/plans/` don't have
   `status:` frontmatter. Add `status: completed` to finished plans if we want
   agents to distinguish current vs historical.
3. **Context budget win** — The 79% token reduction means more of our project
   context fits. No action needed, just enjoy it.
4. **Learnings researcher** — Our `docs/solutions/` files will now be
   automatically searched during `/workflows:review`. Keep documenting there.
