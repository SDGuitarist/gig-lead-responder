---
name: update-learnings
description: Update all learning docs after compound phase — LESSONS_LEARNED.md, compound-engineering.local.md, MEMORY.md, HANDOFF.md, and journal
argument-hint: "[cycle or feature name]"
---

# Update Learnings

<command_purpose>After /workflows:compound creates the solution doc, this skill propagates lessons to all surrounding files so nothing falls through the cracks.</command_purpose>

## When to Run

Run immediately after `/workflows:compound` completes. The compound phase creates the solution doc; this skill propagates lessons to all the other files.

## Arguments

<update_target> $ARGUMENTS </update_target>

- First word = cycle number or feature name (e.g., "5" or "rate-limiting"). If omitted, detect from the newest solution doc.

## Steps

### Step 1: Gather Context

Read these files to understand what just happened:

1. **Most recent solution doc** — `docs/solutions/` sorted by modification time, pick newest
2. **LESSONS_LEARNED.md** — current state of the hub (feature sections, Top 10 Patterns)
3. **compound-engineering.local.md** — current risk chain and cumulative risk table
4. **MEMORY.md** — at `/Users/alejandroguillen/.claude/projects/-Users-alejandroguillen-Projects-gig-lead-responder/memory/MEMORY.md`
5. **Review summary** — `docs/reviews/*/REVIEW-SUMMARY.md` for the current cycle (if exists)
6. **Today's journal** — `~/Documents/dev-notes/$(date +%Y-%m-%d).md` (may not exist yet)

### Step 2: Extract Lessons

From the solution doc and review summary, extract:

- **Key lesson** — one sentence summary
- **New patterns** — did any pattern recur across 2+ features? Check existing Top 10.
- **Risk chain** — what was flagged in feed-forward, what actually happened, what was learned
- **Category** — which `docs/solutions/` category the solution belongs to

### Step 3: Update Files

Read each file before editing. Append — never overwrite.

#### 3a. LESSONS_LEARNED.md

- **If the feature already has an H2 section:** append the new learning to its Learnings Summary and update its Quick Reference table.
- **If this is a new feature:** copy the template at the bottom of the file, fill it in, and insert it as a new H2 section above the template.
- **Top 10 Patterns table:** if the new lesson is a cross-feature pattern (appears in 2+ feature sections), add it to the Top 10 and bump the least useful entry if the table is full.
- **Table of Contents:** add the new feature to the TOC if a new section was created.

#### 3b. compound-engineering.local.md

- Update **Risk Chain** section with the latest cycle's chain (brainstorm risk → plan mitigation → work risk → review resolution).
- Add rows to **Cumulative Risk Table** for any new risks opened or resolved.
- Update **Files to Scrutinize** table if new files were introduced.

#### 3c. MEMORY.md

- Update existing sections that are affected (e.g., Pipeline Architecture, Prompt Engineering Patterns, Production Watch Items).
- Add new section if the solution introduced a wholly new concept not covered by existing sections.
- Keep total file under 200 lines (it gets truncated after that).

#### 3d. HANDOFF.md

- Update the header (last updated date, current phase, next session).
- Add a brief entry for this cycle under the latest session section.

#### 3e. Journal entry

- Append to `~/Documents/dev-notes/YYYY-MM-DD.md` (create if needed).
- Use `---` separator before the new entry.
- Format: `## Gig Lead Responder — [Feature Name] Complete`
- Include: what shipped, key lesson, risk chain summary, solution doc path.
- Keep it concise — 30-50 lines max.

### Step 3f: Cycle Reflection (Undocumented Process Insights)

Steps 3a-3e extract lessons from the **solution doc** (code patterns, risk
chains). This step looks across the **entire cycle arc** — plan, review, and
the gaps between them — for process-level insights that no single artifact
captures.

**Inputs:** Re-read the plan, review summary, and solution doc as a set (already
loaded from Step 1).

**Ask these four questions:**

1. **What workflow decision was made that we haven't documented?**
   Examples: skipping brainstorm, bundling multiple findings, deferring a fix,
   splitting commits in a specific order. Look at the plan's "Prior Phase Risk"
   section and the review's "Three Questions" for clues.

2. **Where did complexity exceed severity?**
   Compare the review's severity ratings (P1/P2/P3) against actual
   implementation effort. If a P3 required pattern invention, spec research,
   or 50+ lines of changes, that gap is an insight.

3. **What tool or analysis justified itself unexpectedly?**
   Did SpecFlow, a specific review agent, or plan deepening find issues that
   the "obvious" approach would have missed? Look for additions to the plan
   that weren't in the original scope.

4. **What bundling, batching, or skipping decision worked and should become a rule?**
   Did grouping items by domain save overhead? Did skipping a phase work
   because inputs were already specified? These are reusable process rules.

**For each insight found:**

- Add to `LESSONS_LEARNED.md` under `## Workflow & Process` (3-line format:
  Context, Lesson, Source)
- Add to `workflow.md` under `## Things to Watch` (1-line format)
- Add to `MEMORY.md` under `## User Preferences` if it's a reusable rule
  (1-line format)
- Append to today's journal entry as a `- **Cycle-level insights:**` bullet

**If no insights found:** Note "No undocumented cycle-level insights" in the
Step 4 report and move on. Do not invent insights.

### Step 4: Report

Print a summary:

```
Update Learnings — [Feature Name] Complete

Files updated:
  - LESSONS_LEARNED.md — [new section / updated existing section]
  - compound-engineering.local.md — risk chain updated
  - MEMORY.md — [sections updated]
  - HANDOFF.md — phase updated
  - ~/Documents/dev-notes/YYYY-MM-DD.md — journal entry appended

New cross-feature patterns: [count or "none"]
Top 10 changes: [added/bumped/no changes]
Cycle reflection: [N process insights found / "none"]
```

## Rules

1. **Read before writing** — always read a file before editing it
2. **Don't duplicate** — link to solution docs, don't copy their content into LESSONS_LEARNED.md
3. **Don't invent lessons** — Steps 3a-3e extract from solution doc and review summary. Step 3f (cycle reflection) may surface insights from the plan and cycle arc, but they must be grounded in specific decisions or outcomes — not speculation
4. **Keep journal entries under 50 lines** — concise summary, not a rewrite
5. **Preserve existing content** — append, don't overwrite. Edit specific sections.
6. **Match existing format** — follow the table structures and section headers already in each file
7. **MEMORY.md under 200 lines** — it gets truncated; link to docs instead of inlining
