---
name: review-batched
description: Batched code review — 3 agents per session, 4 sessions, findings saved to disk
argument-hint: "<batch1|batch2|batch3|synthesize> [target: PR#, branch, or 'latest']"
---

# Batched Code Review

You are running a batched code review. This process splits 9 review agents across 3 sessions (3 agents each), then synthesizes findings in a 4th session. This prevents context flooding.

## Rules — Read These First

1. **Max 3 agents per batch.** Never combine batches.
2. **One batch per session.** After writing all finding files for a batch, STOP. Tell the user to run the next batch in a new session.
3. **Always write files before stopping.** Even if an agent finds nothing, write a file noting "No findings."
4. **Target only needs to be specified in batch1.** Subsequent batches read from `pr-metadata.md`.
5. **All output goes to `docs/reviews/<branch>/`.** Create the directory if it doesn't exist.

## Parse the Argument

The argument is: `$ARGUMENTS`

Extract two parts:
- **batch** — One of: `batch1`, `batch2`, `batch3`, `synthesize`
- **target** (optional) — A PR number (e.g. `#42`), branch name, or `latest`. Only required for `batch1`.

If no batch is specified, tell the user:
```
Usage: /review-batched <batch1|batch2|batch3|synthesize> [target]

Run batches in order across separate sessions:
  Session 1: /review-batched batch1 latest
  Session 2: /review-batched batch2
  Session 3: /review-batched batch3
  Session 4: /review-batched synthesize
```

---

## Resolve the Target (batch1 only)

For batch1, resolve the target to a branch name and list of changed files:

- **`latest`** — Use `git log --oneline -1` to find the most recent commit on the current branch. The branch is the current branch.
- **`#<number>`** — Use `gh pr view <number> --json headRefName,files` to get the branch and changed files.
- **Branch name** — Use `git diff main...<branch> --name-only` to get changed files.

Then write `docs/reviews/<branch>/pr-metadata.md`:

```markdown
# PR Metadata

**Branch:** <branch-name>
**Target resolved:** <what the user typed>
**Date:** <today's date>
**Changed files:**
- path/to/file1.ts
- path/to/file2.ts
- ...
```

For batch2, batch3, and synthesize: read the branch name from `docs/reviews/*/pr-metadata.md` (find the most recent one if multiple exist). If no `pr-metadata.md` exists, tell the user to run batch1 first.

---

## batch1 — Code Quality

Launch these 3 agents in parallel using the Task tool:

### Agent 1: kieran-typescript-reviewer
```
subagent_type: compound-engineering:review:kieran-typescript-reviewer
```
Prompt: Review the following changed files for TypeScript patterns, naming conventions, and code quality. List the changed files and branch from pr-metadata.md. Write findings in the format specified below.

### Agent 2: pattern-recognition-specialist
```
subagent_type: compound-engineering:review:pattern-recognition-specialist
```
Prompt: Analyze the changed files for design patterns, anti-patterns, code duplication, and naming convention consistency. List the changed files and branch from pr-metadata.md. Write findings in the format specified below.

### Agent 3: code-simplicity-reviewer
```
subagent_type: compound-engineering:review:code-simplicity-reviewer
```
Prompt: Review the changed files for unnecessary complexity, YAGNI violations, over-engineering, and opportunities for simplification. List the changed files and branch from pr-metadata.md. Write findings in the format specified below.

After all 3 agents complete, write their findings to:
- `docs/reviews/<branch>/batch1-kieran-typescript.md`
- `docs/reviews/<branch>/batch1-pattern-recognition.md`
- `docs/reviews/<branch>/batch1-code-simplicity.md`

Then STOP and tell the user:
```
batch1 complete. 3 finding files written to docs/reviews/<branch>/.
Next: Open a new session and run /review-batched batch2
```

---

## batch2 — Architecture & Security

Read the branch and changed files from `pr-metadata.md`.

Launch these 3 agents in parallel using the Task tool:

### Agent 1: architecture-strategist
```
subagent_type: compound-engineering:review:architecture-strategist
```
Prompt: Review the changed files for architectural compliance, system design, and component boundary issues. Include context from batch1 findings if relevant.

### Agent 2: security-sentinel
```
subagent_type: compound-engineering:review:security-sentinel
```
Prompt: Scan the changed files for OWASP vulnerabilities, injection risks, hardcoded secrets, and input validation issues.

### Agent 3: performance-oracle
```
subagent_type: compound-engineering:review:performance-oracle
```
Prompt: Analyze the changed files for performance bottlenecks, scaling concerns, and algorithmic complexity issues.

After all 3 agents complete, write their findings to:
- `docs/reviews/<branch>/batch2-architecture.md`
- `docs/reviews/<branch>/batch2-security.md`
- `docs/reviews/<branch>/batch2-performance.md`

Then STOP and tell the user:
```
batch2 complete. 3 finding files written to docs/reviews/<branch>/.
Next: Open a new session and run /review-batched batch3
```

---

## batch3 — Data & Deployment

Read the branch and changed files from `pr-metadata.md`.

Launch these 3 agents in parallel using the Task tool:

### Agent 1: data-integrity-guardian
```
subagent_type: compound-engineering:review:data-integrity-guardian
```
Prompt: Review the changed files for data consistency, transaction boundaries, and referential integrity issues.

### Agent 2: git-history-analyzer
```
subagent_type: compound-engineering:review:git-history-analyzer
```
Prompt: Analyze the git history of the changed files for historical context, evolution patterns, and contributor insights.

### Agent 3: deployment-verification-agent
```
subagent_type: compound-engineering:review:deployment-verification-agent
```
Prompt: Create a pre/post deploy checklist with verification queries, rollback procedures, and monitoring plans for the changes in this branch.

After all 3 agents complete, write their findings to:
- `docs/reviews/<branch>/batch3-data-integrity.md`
- `docs/reviews/<branch>/batch3-git-history.md`
- `docs/reviews/<branch>/batch3-deployment.md`

Then STOP and tell the user:
```
batch3 complete. 3 finding files written to docs/reviews/<branch>/.
Next: Open a new session and run /review-batched synthesize
```

---

## synthesize — Final Report

No agents are launched for this step. Instead:

1. Read ALL 9 finding files from `docs/reviews/<branch>/`.
2. Deduplicate findings using **file + line number** as the key. Two agents flagging the same `file:line` is ONE finding with multiple perspectives, even if they describe the issue differently (common with security + architecture overlap). Merge them: combine the descriptions, list all contributing agents in "Found by," and use the highest severity any agent assigned.
3. Categorize each unique finding by severity:
   - **P1 (Critical)** — Security vulnerabilities, data loss risks, breaking bugs
   - **P2 (Important)** — Performance issues, architectural concerns, significant code quality problems
   - **P3 (Minor)** — Style issues, minor simplification opportunities, nice-to-haves
4. Write `docs/reviews/<branch>/REVIEW-SUMMARY.md` using this format:

```markdown
# Review Summary — <branch>

**Date:** <date>
**Agents run:** 9 (3 batches of 3)
**Total unique findings:** <count>

## P1 — Critical (<count>)

### <title>
**Found by:** <agent(s)>
**File:** `<path>:<line>`
**Issue:** <description>
**Suggestion:** <fix>

---

## P2 — Important (<count>)

(same format)

## P3 — Minor (<count>)

(same format)

## Batch Coverage

| Batch | Agent | Findings |
|-------|-------|----------|
| batch1 | kieran-typescript-reviewer | <count> |
| batch1 | pattern-recognition-specialist | <count> |
| batch1 | code-simplicity-reviewer | <count> |
| batch2 | architecture-strategist | <count> |
| batch2 | security-sentinel | <count> |
| batch2 | performance-oracle | <count> |
| batch3 | data-integrity-guardian | <count> |
| batch3 | git-history-analyzer | <count> |
| batch3 | deployment-verification-agent | <count> |

## Three Questions

### 1. Hardest judgment call in this review?

<answer — e.g., severity assignment, dedup merge decision, or dismissal>

### 2. What did you consider flagging but chose not to, and why?

<answer — e.g., findings downgraded or dismissed, with reasoning>

### 3. What might this review have missed?

<answer — e.g., categories no agent checked: accessibility, i18n, logging
consistency, error message leakage, env var hygiene, etc.>
```

Then tell the user:
```
Review complete! Summary written to docs/reviews/<branch>/REVIEW-SUMMARY.md

Findings: <P1 count> critical, <P2 count> important, <P3 count> minor
```

---

## Finding File Format

Every agent finding file MUST use this structure:

```markdown
# <Agent Name> — Review Findings

**Agent:** <agent-type>
**Branch:** <branch>
**Date:** <date>
**Files reviewed:** <count>

## Findings

### [<severity>] <title>
**File:** `<path>:<line>`
**Issue:** <description>
**Suggestion:** <fix>

---

(repeat per finding, or note "No findings — all reviewed files passed this check.")
```

Severity is one of: `P1`, `P2`, `P3`.
