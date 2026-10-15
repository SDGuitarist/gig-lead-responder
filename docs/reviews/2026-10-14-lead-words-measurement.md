# lead_words measurement (real model, 2026-10-14)

Code under test: fa7134723060d29cfcd2cd306ab97a5a8a97e2eb. `before` regression: a worktree of 95f3dda (pre-change classifier
prompt). Model claude-sonnet-4-6. Command: the plan's Execution Path, unchanged.

**RESULT=VOID failed=0 limits=0 files=5 after=0 grounding=0 compare=1 controls=1**

No spend-limit errors, no failed jobs, 5 arm files. The VOID line is two pre-registered STOPs (compare=1 and controls=1),
not an infrastructure failure. By the plan's table both go back to Alex.

## STOP 1: regression compare (exit 1)

| Lead / field | Before (5) | After (5) |
|---|---|---|
| L1_wedding_rich format_recommended | duo x3, flamenco_duo x2 | flamenco_duo x5 |
| L1_wedding_rich quote_price | 1495 x3, 1595 x2 | 1595 x5 |

The other 6 leads: identical on all 8 fields, 0 errors. L1 was already split before the edit. 5 runs per side cannot
separate "the prompt moved it" from "a coin flip landed on one side"; the rule fires on the mode as written.

## Grounding (no stop)

14 of 115 returned values dropped (12.2%, line 1 in 5): occasion 4/47, time_frame 2/25, doubt 8/43. 0 errors.
Stable on v1-v4 and h1-h3; v5 and h4 flicker between a phrase and null.

## STOP 2: controls (exit 1, false pass)

| Cell | Result |
|---|---|
| A (null words, generic) x2 | false, false: as required |
| B (null words, app label) x2 | B1 false; **B2 passed `lead_specific_opening` in both verifies** |
| C (valid phrase, quotes it) x3 | pass x3: as required |
| D (valid phrase, generic) x3 | fail x3: as required |
| E (malformed stored value) x2 | fail x2: as required |

B2 is the planted opening "Spring private event, no venue yet, and the guitar is already the one thing you've decided on."
with all-null `lead_words`. The verifier read it as lead-specific. The plan names a false pass as the harm direction.

## Arm (informational: the controls are not ok, so the table's last two rows do not apply)

50 runs, 50 drafts. verified 20 of 50 (was 9-11). `lead_specific_opening` false 10 of 50 runs (was 32). unusable 7 of 50
(14%). exactly one question 38 of 50. median 197 words. shared 30-char windows with the example: max 83, 40 drafts above
zero (the copying concern is not fixed). `lead_words` kept in 48 of 50 runs.

## What this does and does not show

- The arm moved in the direction the plan hoped, but the verifier also let a generic opening through in control B2, so part
  of the drop in opening-false may be a looser verifier, not better openings. The two cannot be separated from these runs.
- Neither STOP is interpreted away here. Revert / accept / re-plan is Alex's decision.
