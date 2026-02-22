---
name: lead-test
description: Run all test leads through the pipeline and show a pass/fail table
argument-hint: "[all | lead-number | 'add Lead description here']"
---

# Lead Test Runner

<command_purpose>Run test leads through the pipeline and display results as a pass/fail table. Use after prompt changes, pipeline edits, or to verify a specific lead.</command_purpose>

## Parse the Argument

The argument is: `$ARGUMENTS`

- **No argument or `all`:** Run all test leads (1 through N)
- **A number (e.g., `3`):** Run only that test lead
- **Quoted text starting with `add`:** Add a new test lead (see "Adding Leads" below)

## Test Lead Registry

Read the test lead registry from `docs/test-leads.md`. If it doesn't exist, create it with the 4 known leads:

```markdown
# Test Lead Registry

## Lead 1 — Wedding @ Hilton La Jolla (rich lead)
Event Type: Wedding Reception
Date: Saturday, December 24, 2025
Location: Hilton La Jolla Torrey Pines
Guest Count: 120
Budget: $400-500
Genre Request: Spanish guitar / flamenco
Lead Source: GigSalad
Notes: "We want something authentic and meaningful for our celebration"

**Expected:** flamenco_duo, T3D, stealth premium, past_date_detected, cultural vocab (Nochebuena, Las Mañanitas), no_viable_scope budget mode

## Lead 2 — Birthday March 22 (sparse, overwhelmed)
Event Type: Birthday Party
Date: March 22
Notes: "not sure on details yet"
Lead Source: The Bash

**Expected:** sparse Type 2, gate PASS, concern bundling

## Lead 3 — October 2026 birthday (Type 1 price shopper)
Event Type: Birthday Party
Date: October 2026
Notes: "just getting pricing info"
Lead Source: GigSalad

**Expected:** sparse Type 1, gate PASS, memorable not exhaustive

## Lead 4 — Corporate March 14 (Type 3 impatient filler)
Event Type: Corporate Event
Date: March 14
Location: Downtown San Diego
Lead Source: The Bash

**Expected:** sparse Type 3, genre default stated, concern bundling, gate PASS
```

## Running a Lead

For each lead to run:

1. Echo the lead text through the pipeline:
   ```bash
   echo "<lead text>" | npx tsx src/index.ts --json
   ```
2. Capture the JSON output.
3. Extract these fields from the result:
   - `classification.format_recommended`
   - `classification.rate_card_tier`
   - `classification.stealth_premium`
   - `pricing.budget_gap.tier` (if present)
   - `gate.gate_status`
   - `gate.gut_checks` — count passing/total
   - `gate.attempt_number`
   - `confidence_score`

## Display Results

After running all requested leads, show a summary table:

```
| # | Lead | Gate | Checks | Attempts | Confidence | Key |
|---|------|------|--------|----------|------------|-----|
| 1 | Wedding @ Hilton | PASS | 14/14 | 2 | 90 | flamenco_duo, T3D, no_viable_scope |
| 2 | Birthday sparse | PASS | 14/14 | 1 | 70 | Type 2, bundled |
| 3 | October bday | PASS | 14/14 | 2 | 80 | Type 1 |
| 4 | Corporate | PASS | 14/14 | 1 | 80 | Type 3, genre default |
```

Below the table, flag any lead where:
- Gate status is FAIL
- Gut checks < 12/14
- Attempts = 3 (max retries exhausted)
- Expected behavior from the registry doesn't match actual

## Adding Leads

When the argument starts with `add`:

1. Parse the lead description from the argument text after `add`.
2. Ask the user for the lead text (the raw content to pipe into the pipeline).
3. Ask what behavior to expect (format, tier, budget mode, gate pass).
4. Append a new `## Lead N` section to `docs/test-leads.md`.
5. Run the new lead once to verify it works.
6. Show the result and ask if the expected behavior matches.

## Important Rules

1. **Always read `docs/test-leads.md` first** — the registry is the source of truth for lead text and expectations.
2. **Never modify prompts or pipeline code** — this skill only runs and reports.
3. **Show the table even if leads fail** — failures are the point of testing.
4. **If `ANTHROPIC_API_KEY` is missing**, tell the user to set it in `.env`.
