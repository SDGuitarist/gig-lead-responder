---
name: deepen-batched
description: Batched plan deepening — skills, research, and review agents across 5 sessions, findings saved to disk
argument-hint: "<plan|batch1|batch2|batch3|synthesize> [path to plan file]"
---

# Batched Deepen Plan

You are running a batched plan deepening. This process splits the work of deepening a plan (skills, learnings, research, review agents) across 4 sessions, then synthesizes findings in a 5th session. This prevents context flooding.

## Rules — Read These First

1. **One batch per session.** After writing all output files for a batch, STOP. Tell the user to run the next batch in a new session.
2. **Always write files before stopping.** Even if nothing was found, write a file noting "No findings."
3. **Plan path only needs to be specified in the plan step.** Subsequent batches read from `deepen-metadata.md`.
4. **All output goes to `docs/deepens/<plan-name>/`.** Create the directory if it doesn't exist.
5. **NEVER modify the plan file until synthesize.** Batches 1-3 only write finding files.
6. **NEVER write code.** This is research and enhancement only.

## Parse the Argument

The argument is: `$ARGUMENTS`

Extract two parts:
- **step** — One of: `plan`, `batch1`, `batch2`, `batch3`, `synthesize`
- **plan-path** (optional) — Path to the plan file. Only required for `plan`.

If no step is specified, tell the user:
```
Usage: /deepen-batched <plan|batch1|batch2|batch3|synthesize> [plan path]

Run steps in order across separate sessions:
  Session 1: /deepen-batched plan docs/plans/2026-02-21-feat-my-feature-plan.md
  Session 2: /deepen-batched batch1
  Session 3: /deepen-batched batch2
  Session 4: /deepen-batched batch3
  Session 5: /deepen-batched synthesize
```

---

## Derive the Plan Name

The `<plan-name>` used in directory paths is the plan filename without extension.

Example: `docs/plans/2026-02-21-feat-budget-mismatch-handling-plan.md` → plan-name is `2026-02-21-feat-budget-mismatch-handling-plan`

---

## plan — Parse Plan and Discover Resources

### Step 1: Read and parse the plan

If no plan path provided, check `docs/plans/` and ask which plan to deepen.

Read the plan file and extract:
- Overview/problem statement
- All section titles and brief descriptions
- Technologies/frameworks mentioned
- Domain areas (data models, APIs, UI, security, performance, etc.)
- Any file paths referenced

Create a **section manifest** — a numbered list of every plan section with a brief note on what research would help.

### Step 2: Discover all available skills

```bash
# 1. Project-local skills
ls .claude/skills/

# 2. User's global skills
ls ~/.claude/skills/

# 3. compound-engineering plugin skills
ls ~/.claude/plugins/cache/*/compound-engineering/*/skills/

# 4. ALL other installed plugins
find ~/.claude/plugins/cache -type d -name "skills" 2>/dev/null
```

For each discovered skill, read its SKILL.md description (first ~20 lines). Record which skills match plan content.

### Step 3: Discover all learnings/solutions

```bash
# Project learnings
find docs/solutions -name "*.md" -type f 2>/dev/null
```

For each learning file, read frontmatter (first ~20 lines). Filter by tag/category/module relevance to the plan. Record which learnings are likely relevant.

### Step 4: Discover all review agents

```bash
# 1. Project-local agents
find .claude/agents -name "*.md" 2>/dev/null

# 2. User's global agents
find ~/.claude/agents -name "*.md" 2>/dev/null

# 3. compound-engineering plugin agents (review, research, design, docs — NOT workflow)
find ~/.claude/plugins/cache/*/compound-engineering/*/agents -name "*.md" 2>/dev/null

# 4. ALL other installed plugins
find ~/.claude/plugins/cache -path "*/agents/*.md" 2>/dev/null
```

Record all discovered agents.

### Step 5: Write metadata and manifest

Create directory `docs/deepens/<plan-name>/`.

Write `docs/deepens/<plan-name>/deepen-metadata.md`:

```markdown
# Deepen Metadata

**Plan file:** <path to plan>
**Plan name:** <plan-name>
**Date:** <today's date>

## Section Manifest

1. [Section Title] — [what to research]
2. [Section Title] — [what to research]
...

## Discovered Skills (<count>)

| # | Skill | Path | Match Reason |
|---|-------|------|-------------|
| 1 | <skill-name> | <path> | <why it matches> |

## Discovered Learnings (<count> relevant / <total> found)

| # | Learning | Path | Relevance |
|---|----------|------|-----------|
| 1 | <title from frontmatter> | <path> | <why relevant> |

## Discovered Agents (<count>)

| # | Agent | Path | Type |
|---|-------|------|------|
| 1 | <agent-name> | <path> | review/research/design/docs |
```

### Step 6: STOP

Tell the user:
```
Plan parsed. Manifest written to docs/deepens/<plan-name>/deepen-metadata.md

Sections: <count>
Skills matched: <count>
Learnings relevant: <count>
Agents discovered: <count>

Next: Open a new session and run /deepen-batched batch1
```

---

## batch1 — Skills & Learnings

### Step 1: Read context

- Read `docs/deepens/<plan-name>/deepen-metadata.md` for the manifest.
- Read the plan file (path from metadata).

### Step 2: Launch skill sub-agents in parallel

For EACH matched skill from the metadata, spawn a sub-agent:

```
Task general-purpose: "You have the [skill-name] skill available at [skill-path].

1. Read the skill: cat [skill-path]/SKILL.md
2. Follow the skill's instructions
3. Apply the skill to this plan:

[full plan content]

Return the skill's output: recommendations, patterns, code examples, warnings."
```

### Step 3: Launch learning sub-agents in parallel

For EACH relevant learning from the metadata, spawn a sub-agent:

```
Task general-purpose: "Read this learning file completely: [path]

This documents a previously solved problem. Check if it applies to this plan:

[full plan content]

If relevant:
- Explain specifically how it applies
- Quote the key insight or solution
- Suggest where in the plan to incorporate it

If NOT relevant after deeper analysis:
- Say 'Not applicable: [reason]'"
```

**Spawn ALL skill + learning sub-agents in a SINGLE parallel batch.**

### Step 4: Write finding files

After all sub-agents complete, write:

- `docs/deepens/<plan-name>/batch1-skills.md`:

```markdown
# Batch 1 — Skill Findings

**Date:** <date>
**Skills applied:** <count>

## [Skill Name]

**Path:** <skill-path>
**Recommendations:**
- <recommendation 1>
- <recommendation 2>

**Patterns/Examples:**
<any code patterns or examples the skill suggested>

---

(repeat per skill, or "No applicable recommendations" if a skill found nothing)
```

- `docs/deepens/<plan-name>/batch1-learnings.md`:

```markdown
# Batch 1 — Learning Findings

**Date:** <date>
**Learnings checked:** <count>
**Relevant:** <count>

## [Learning Title]

**Path:** <learning-path>
**Applies to:** <which plan section>
**Key insight:** <quoted insight>
**Recommendation:** <how to incorporate>

---

(repeat per relevant learning, or "No applicable learnings found")
```

### Step 5: STOP

Tell the user:
```
batch1 complete. 2 finding files written to docs/deepens/<plan-name>/.
  Skills applied: <count>
  Learnings relevant: <count>

Next: Open a new session and run /deepen-batched batch2
```

---

## batch2 — Per-Section Research

### Step 1: Read context

- Read `docs/deepens/<plan-name>/deepen-metadata.md` for the section manifest.
- Read the plan file.
- Read `batch1-skills.md` and `batch1-learnings.md` if they exist (for context).

### Step 2: Launch per-section research agents

For EACH section in the manifest, launch an Explore agent:

```
Task Explore: "Research best practices, patterns, and real-world examples for: [section topic].

Context from the plan: [relevant section content]

Find:
- Industry standards and conventions (2024-2026)
- Performance considerations
- Common pitfalls and how to avoid them
- Concrete implementation patterns

Return actionable recommendations with sources."
```

### Step 3: Query Context7 for frameworks

For any technologies/frameworks mentioned in the plan:

1. Use `resolve-library-id` to find the library ID.
2. Use `query-docs` to get relevant documentation and patterns.

### Step 4: Web search for current practices

Use WebSearch for recent (2024-2026) articles and documentation on key topics from the plan. Focus on topics where the Explore agents found gaps.

### Step 5: Write finding files

After all research completes, write:

- `docs/deepens/<plan-name>/batch2-research.md`:

```markdown
# Batch 2 — Per-Section Research

**Date:** <date>
**Sections researched:** <count>

## Section: [Section Title]

**Research focus:** <what was researched>

**Best Practices:**
- <practice 1>
- <practice 2>

**Performance Considerations:**
- <consideration>

**Common Pitfalls:**
- <pitfall and how to avoid>

**Implementation Patterns:**
```[language]
// concrete example
```

**References:**
- <source URL or documentation link>

---

(repeat per section)
```

- `docs/deepens/<plan-name>/batch2-context7.md`:

```markdown
# Batch 2 — Framework Documentation (Context7)

**Date:** <date>
**Libraries queried:** <count>

## [Framework/Library Name]

**Library ID:** <context7 ID>
**Query:** <what was asked>

**Key Findings:**
- <finding 1>
- <finding 2>

**Code Patterns:**
```[language]
// from documentation
```

---

(repeat per library, or "No frameworks required Context7 lookup")
```

### Step 6: STOP

Tell the user:
```
batch2 complete. 2 finding files written to docs/deepens/<plan-name>/.
  Sections researched: <count>
  Libraries queried: <count>

Next: Open a new session and run /deepen-batched batch3
```

---

## batch3 — Review Agents

### Step 1: Read context

- Read `docs/deepens/<plan-name>/deepen-metadata.md` for the agent list.
- Read the plan file.

### Step 2: Launch ALL review agents in parallel

For EVERY agent discovered in the metadata, launch a Task:

```
Task [agent-subagent-type]: "Review this plan using your expertise. Apply all your checks and patterns.

Plan content:

[full plan content]

Return specific findings: issues, improvements, warnings, or 'No findings for this plan.'"
```

**CRITICAL RULES:**
- Do NOT filter agents by "relevance" — run them ALL.
- Launch ALL agents in a SINGLE message with multiple Task tool calls.
- 20, 30, 40 parallel agents is fine — use everything available.
- Each agent may catch something others miss.
- For compound-engineering agents, use the `compound-engineering:review:<name>` or `compound-engineering:research:<name>` subagent type.
- SKIP `workflow/` agents — those are orchestrators, not reviewers.

### Step 3: Write finding files

After all agents complete, write one file per agent category:

- `docs/deepens/<plan-name>/batch3-review-agents.md`:

```markdown
# Batch 3 — Review Agent Findings

**Date:** <date>
**Agents run:** <count>
**Agents with findings:** <count>

## [Agent Name]

**Type:** <agent subagent type>
**Findings:**

### [Finding Title]
**Severity:** P1/P2/P3
**Applies to:** <plan section>
**Issue:** <description>
**Suggestion:** <improvement>

---

(repeat per agent, or note "No findings" for agents that found nothing)
```

- `docs/deepens/<plan-name>/batch3-research-agents.md`:

```markdown
# Batch 3 — Research Agent Findings

**Date:** <date>
**Agents run:** <count>

## [Agent Name]

**Type:** <agent subagent type>
**Research output:**

<agent's research findings>

---

(repeat per research agent)
```

### Step 4: STOP

Tell the user:
```
batch3 complete. 2 finding files written to docs/deepens/<plan-name>/.
  Review agents run: <count>
  Research agents run: <count>
  Total findings: <count>

Next: Open a new session and run /deepen-batched synthesize
```

---

## synthesize — Merge Everything Into Enhanced Plan

No agents are launched for this step.

### Step 1: Read ALL finding files

Read every file from `docs/deepens/<plan-name>/`:
- `deepen-metadata.md` (manifest + plan path)
- `batch1-skills.md`
- `batch1-learnings.md`
- `batch2-research.md`
- `batch2-context7.md`
- `batch3-review-agents.md`
- `batch3-research-agents.md`

Also read the original plan file.

### Step 2: Deduplicate and prioritize

- Merge similar recommendations from multiple sources.
- Prioritize by impact (high-value improvements first).
- Flag conflicting advice for human review.
- Group by plan section.

### Step 3: Enhance each plan section

For each section in the plan, add a `### Research Insights` subsection:

```markdown
## [Original Section Title]

[Original content preserved — do NOT modify]

### Research Insights

**Best Practices:**
- [Concrete recommendation] *(source: [agent/skill/learning])*
- [Concrete recommendation] *(source: [agent/skill/learning])*

**Performance Considerations:**
- [Optimization] *(source: [agent])*

**Edge Cases:**
- [Edge case and how to handle] *(source: [agent])*

**Relevant Learnings:**
- [Past solution that applies] *(from: docs/solutions/...)*

**Implementation Details:**
```[language]
// concrete code pattern
```

**References:**
- [URL or documentation link]
```

### Step 4: Add Enhancement Summary at top of plan

```markdown
## Enhancement Summary

**Deepened on:** [Date]
**Sections enhanced:** [Count]
**Sources:** [Count] skills, [Count] learnings, [Count] research queries, [Count] review agents

### Key Improvements
1. [Major improvement 1]
2. [Major improvement 2]
3. [Major improvement 3]

### New Considerations Discovered
- [Important finding 1]
- [Important finding 2]

### Batch Coverage

| Batch | Source | Findings |
|-------|--------|----------|
| batch1 | Skills | <count> |
| batch1 | Learnings | <count> |
| batch2 | Per-section research | <count> |
| batch2 | Context7 docs | <count> |
| batch3 | Review agents | <count> |
| batch3 | Research agents | <count> |
```

### Step 5: Write the enhanced plan

- Write the enhanced plan to the original file path (overwrite in place).
- The original is recoverable via `git checkout -- <plan-path>`.

### Step 6: Write synthesis summary

Write `docs/deepens/<plan-name>/DEEPEN-SUMMARY.md`:

```markdown
# Deepen Summary — <plan-name>

**Date:** <date>
**Plan file:** <path>
**Batches run:** 3

## Statistics

| Metric | Count |
|--------|-------|
| Sections enhanced | <count> |
| Skills applied | <count> |
| Learnings checked | <count> |
| Research queries | <count> |
| Review agents run | <count> |
| Total recommendations merged | <count> |
| Conflicting advice flagged | <count> |

## Top Recommendations by Impact

1. **[Recommendation]** — from [source], applies to [section]
2. **[Recommendation]** — from [source], applies to [section]
3. **[Recommendation]** — from [source], applies to [section]

## Conflicting Advice (needs human review)

- **[Topic]:** [Source A] says X, [Source B] says Y. Flagged in [section].

## Three Questions

### 1. Hardest decision in this session?

<answer — e.g., which conflicting advice to include, how to prioritize findings>

### 2. What did you reject, and why?

<answer — e.g., recommendations that didn't fit the plan's scope or context>

### 3. Least confident about going into the next phase?

<answer — e.g., sections where research was thin, topics that need human validation>
```

### Step 7: Tell the user

```
Deepen complete! Enhanced plan written to <plan-path>.
Summary: docs/deepens/<plan-name>/DEEPEN-SUMMARY.md

Sections enhanced: <count>
Total sources: <skills> skills, <learnings> learnings, <research> research, <agents> agents
Recommendations merged: <count>
Conflicts flagged: <count>

The original plan is recoverable via: git checkout -- <plan-path>
```

Then use **AskUserQuestion** to present options:

**Question:** "What would you like to do next?"

**Options:**
1. **View diff** — Show what was added to the plan
2. **Start /workflows:work** — Begin implementing this enhanced plan
3. **Deepen further** — Run another round on specific sections
4. **Revert** — Restore original plan via git checkout
