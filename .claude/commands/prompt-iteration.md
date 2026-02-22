---
name: prompt-iteration
description: Tune a prompt file against test leads — run, compare, edit, repeat
argument-hint: "[generate | verify | classify] [lead-number or 'all']"
---

# Prompt Iteration

<command_purpose>Structured prompt tuning loop: run a lead, inspect the output, edit the prompt, run again. Keeps you focused on one prompt file and one behavior at a time.</command_purpose>

## Parse the Argument

The argument is: `$ARGUMENTS`

- **First word:** which prompt to tune — `generate`, `verify`, or `classify`
  - `generate` → `src/prompts/generate.ts`
  - `verify` → `src/prompts/verify.ts`
  - `classify` → `src/prompts/classify.ts`
- **Second word (optional):** which lead to test with — a number (e.g., `2`) or `all`
  - Default: `all`

If no argument, ask: "Which prompt are you tuning? (generate / verify / classify)"

## Step 1: Baseline Run

1. Read the target prompt file.
2. Read `docs/test-leads.md` for the test lead registry.
3. Run the specified lead(s) through the full pipeline:
   ```bash
   echo "<lead text>" | npx tsx src/index.ts --json
   ```
4. Show a baseline results table (same format as `/lead-test`).
5. Ask: **"What behavior do you want to change?"**

## Step 2: Identify the Fix

Based on the user's answer:

1. Read the relevant section of the prompt file.
2. Propose a specific edit — show the old text and new text.
3. Explain in one sentence why this should fix the behavior.
4. Wait for user approval before editing.

## Step 3: Edit and Re-run

1. Apply the approved edit to the prompt file.
2. Re-run the same lead(s).
3. Show a comparison table:

```
| # | Lead | Before | After | Changed? |
|---|------|--------|-------|----------|
| 2 | Birthday sparse | FAIL 9/14 | PASS 14/14 | Yes — bundling fixed |
```

4. Ask: **"Is this what you wanted? (yes / try again / undo)"**
   - **yes** → go to Step 4
   - **try again** → go back to Step 2 with the new output as context
   - **undo** → revert the edit, show the original prompt text, go back to Step 2

## Step 4: Regression Check

1. Run ALL test leads (not just the one being tuned).
2. Show the full results table.
3. Flag any lead that changed from PASS to FAIL (regression).
4. If regressions found, ask: **"Lead [N] regressed. Fix it now, undo, or accept?"**
   - **fix** → go to Step 2 targeting the regressed lead
   - **undo** → revert, show table again
   - **accept** → note it and continue

## Step 5: Commit

When the user is satisfied:

1. Show the full diff of the prompt file.
2. Commit with message describing what changed and why:
   ```
   fix(prompts): [prompt name] — [what behavior was fixed]
   ```
3. Push to origin.
4. Show the final results table.

## Important Rules

1. **One prompt file per session.** Don't edit `generate.ts` and `verify.ts` in the same run.
2. **Always run before and after.** Never edit a prompt without showing the impact.
3. **Regression check is mandatory.** Even if the user says "just commit", run all leads first.
4. **Don't touch pipeline code.** This skill edits prompt files only. If the fix needs pipeline changes, tell the user to use `/workflows:work` instead.
5. **Show the actual LLM output** for the specific behavior being tuned (e.g., the opening sentence, the named fear, the budget acknowledgment) — not just the gate pass/fail.
