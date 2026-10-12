# Codex PLAN review, round 2: Tier B venue rule conflict

**Plan:** Revision 1 + Alex's Tom Ham's change at `65df651`. **Prior Codex verdicts:** round 1 NO-GO on both runs
(`docs/reviews/2026-10-12-tier-b-plan-codex-round1.md`). **Reader and trigger:** plan Revision 2; Alex's round-3 call.

**Verdict: NO-GO on BOTH runs (the 2nd NO-GO): automatic iteration stopped.** Both runs: normalization, aliases, the
`tier_b:` prefix, the dashboard surface, Tier A boundary, pricing context and coverage are addressed.

| # | Runs | Finding | Disposition |
|---|---|---|---|
| 1 | A P1, B P1 | a stale duplicate Acceptance Tests / Work steps block (lines 198-233) contradicts Alex's Tom Ham's rule. Cause: Claude Code's edit script matched the text "## Execution Path" inside Quality Gate Q5 instead of the heading | Revision 2: block deleted; one B1-B13 set |
| 2 | B P1 | the prompt line still says "Brick (large corporate evening)" though Brick is undefined | Revision 2: "Brick (rule not defined yet)" |
| 3 | B P1 | own rule met but priced standard shows only the T3 price | Revision 2: both prices on every `tier_b:` note |
| 4 | A P1, B P1 | B11 asks `runEditPipeline` to return the classification; it returns `{ drafts, gate }` | Revision 2: assert the stored classification passed in keeps the note; return shape unchanged |
| 5 | A P1, B P1 | Execution Path not runnable (`$S` never created; texts not committed) | Revision 2: committed fixtures + exact commands with `mktemp -d` |
| 6 | A P2 | B2 input/output mapping ambiguous | Revision 2: a table per field |
| 7 | A P2 | venue name vs raw text precedence | Revision 2: `venue_name` when present; raw text only when null; negative test |
| 8 | B P2 | "invalid date" undefined (2026-02-31 passes the shape check) | Revision 2: strict calendar date via `civilDay`; impossible date = unknown; test |

## Run A (Claude Code, `codex exec -s read-only`, 2026-10-12; HEAD `65df651`)

````
NO-GO — Revision 1 does not yet close all Round 1 findings.

Round 0 passes: the software has been executed previously, including real-model runs. The required identity gate also passed: correct repo, branch, HEAD `65df65138ebd467a95dd5ebadaa94725343ea826`, and clean worktree. No evidence of another writer or auto-continue was found.

Relevant prior lessons support the architecture: deterministic code should own hard pricing rules, and prompt requirements need literal, testable pins. The revised plan follows that direction, but its acceptance section contains contradictions that make implementation unsafe.

P1 findings

1. Plan sections “Acceptance Tests” and “Work steps” are duplicated and contradictory.

Section: the first `## Acceptance Tests` / `## Work steps` block versus the second block beginning after `## Execution Path` around lines 200–231.

Concrete failures:

- The first B4 correctly requires Tom Ham’s guests `>=100 AND start hour >=17`.
- The later B5 says guests `>=100`, corporate, or Saturday can each independently satisfy the rule.
- The first B5 says Coasterra is premium on any Saturday.
- The later B6 says a Saturday at noon with 40 guests produces no note.
- The first B4 says Tom Ham’s with 120 guests and missing hour is undecidable and held.
- The later B7 says guests `>=100` can decide the rule despite a missing hour.

An implementer could satisfy one block while violating Alex’s settled rule. Remove the obsolete duplicate block and leave one authoritative B1–B13 set, with “first match wins” explicitly ordered.

2. B11 specifies a return value that `runEditPipeline` does not return.

Section: first B11, lines 177–180.

Current `runEditPipeline` returns only `{ drafts, gate }`; it does not return `classification`. The criterion says the edit path “returns the classification with the note intact,” which cannot be tested against the current API without either changing the API or weakening the test.

Concrete failure: an implementation may add an unnecessary public return field, or the test may not actually prove that the stored classification remains intact.

Change B11 to require that the stored classification object passed into `runEditPipeline` retains the `tier_b:` note, while captured generate and verify prompts contain no `tier_b:` text. Explicitly state that the public return shape must not change.

3. The human execution path is still not self-contained.

Section: `## Execution Path`, especially the mechanism and trigger.

Concrete failures:

- `$S` is referenced but never created, assigned, or shown in a command.
- The pv3 fixture has a path, but “two new texts” have no committed fixture path or exact contents.
- A human cannot run B13 exactly as written without inventing the scratch-directory setup and reconstructing the missing inputs.

Provide exact commands, for example using `mktemp -d`, and commit or name every fixture path before the run. This is required by the Plan Quality Gate’s human-execution question.

P2 findings

4. B2’s expected-output mapping is ambiguous.

Section: B2, lines 150–152.

The list of inputs and outputs does not clearly pair each value. It is unclear whether `"50+"`, `50.5`, `-3`, `24`, `"evening"`, and missing fields are being tested for both fields or only one.

Concrete failure: tests could cover valid numeric strings but omit malformed `event_start_hour`, or accidentally accept `null`/missing differently.

Replace it with a small input/output table covering each field independently, explicitly including `null`, missing, digit-only strings, decimal numbers, signed numbers, out-of-range values, and prose.

5. Venue-match precedence is not fully defined.

Section: D1, lines 74–76.

The plan says to match `classification.venue_name` first and then raw lead text, but does not say what happens when the venue name is one venue and the raw text merely mentions another Tier B venue.

Concrete failure: a lead classified with venue `"Example Harbor Grill"` whose prose says “we considered Tom Ham’s” could trigger the Tom Ham’s rule and create an incorrect hold.

Add a negative fixture and choose the intended policy. The safer implementation is to use the extracted venue name when present, and only fall back to raw text when `venue_name` is null.

Because this is Round 2, the second NO-GO stops automatic iteration. Round 3 requires Alejandro’s explicit authorization. I am not generating a Round 3 prompt.

Complete fix handoff:

```text
Work in /Users/alejandroguillen/Projects/gig-lead-responder
Branch: feat/hub-phase0
Ask: revise the Tier B venue-rule plan only; do not implement code.

FIRST gate:
  pwd
  git branch --show-current
  git rev-parse feat/hub-phase0
  git status --short

Expected:
  pwd = /Users/alejandroguillen/Projects/gig-lead-responder
  branch = feat/hub-phase0
  HEAD = 65df65138ebd467a95dd5ebadaa94725343ea826
  worktree = clean

Read HANDOFF.md, CLAUDE.md, AGENTS.md if present,
docs/plans/2026-10-12-fix-tier-b-venue-rule-conflict-hold-plan.md,
and docs/reviews/2026-10-12-tier-b-plan-codex-round1.md.

Fix only the remaining plan issues:

1. Remove the duplicated second Acceptance Tests and Work steps blocks. Keep one authoritative B1–B13 set. Ensure no criterion contradicts the settled rule that Tom Ham’s is premium only when BOTH guests >=100 AND start hour >=17. Preserve the waterfront 50+ hold case and first-match ordering.

2. Rewrite B11 so it matches the existing runEditPipeline API:
   - the stored classification retains the tier_b: note after the edit path;
   - captured generate and verify prompts contain no tier_b: text;
   - routeLead holds the classification;
   - do not require runEditPipeline to return a classification or change its public return shape.

3. Make the Execution Path runnable without reconstruction:
   - create the scratch directory explicitly;
   - provide exact commands;
   - name committed fixture paths for pv3 and both additional real-model inputs;
   - state the required environment/account prerequisite without opening data/leads.db or using network/server/poller paths.

4. Replace B2’s ambiguous value list with an explicit input/output table for guest_count and event_start_hour, including null, missing, digit-only strings, malformed strings, decimals, negatives, and out-of-range values.

5. Define venue-match precedence when venue_name and raw lead text disagree. Add a negative test. Prefer venue_name when present and raw-text fallback only when venue_name is null unless Alex’s intended behavior is explicitly documented.

Re-read the complete revised plan. Verify:
- one non-contradictory Acceptance Tests section;
- D3’s first-match ordering;
- Feed-Forward;
- Verification Commands;
- the human Execution Path;
- the Quality Gate.

Stop after revising the plan. Do not implement code, run the server/poller, open data/leads.db, call PF-Intel, call the model, or generate a Round 3 prompt.
```

Would you like me to copy this handoff prompt to the clipboard?

````

## Run B (Alex, inside Codex, 2026-10-12; HEAD `65df651`)

```
NO-GO — Round 2 (2nd NO-GO; automatic iteration stops). Repository gate passed.

P1 1. Conflicting duplicate acceptance tests, plan lines 198-232: the duplicated B5 says Tom Ham's premium applies with
100 guests, corporate, or Saturday independently, contradicting BOTH 100+ AND 5 PM+. Failure: a 100-guest noon Tom
Ham's lead made premium. (executable)
P1 2. Brick still has an unapproved rule in the classifier prompt (D1 lines 71, 78): "Brick (large corporate evening)".
Failure: the model keeps inferring a Brick rule Alex said is undefined. (executable)
P1 3. Rule disagreement does not always show both prices (D3 lines 100-101): own rule met but priced standard gives
only T3 $b. Failure: Scripps Seaside Forum classified T2 held with only the T3 alternative. (executable)
P1 4. B11 requires an impossible return value (lines 177-180): runEditPipeline returns only { drafts, gate }
(src/run-pipeline.ts:315-356). (executable)
P1 5. Execution Path not self-contained (lines 236-244): $S never created; $S/tbN.txt not a committed input. (executable)
P2 6. "Invalid" dates underspecified (D2 lines 87-89): an impossible date such as 2026-02-31 passes the YYYY-MM-DD
shape check and may be treated as a real Saturday. (executable)

Round-1 items substantially addressed: normalization-before-validation, aliases, tier_b: filtering, dashboard
visibility, edit-path intent, Tier A boundaries, pricing context, venue coverage.

[Fix prompt omitted here: gate at 65df651; revise the plan only for items 1-6; preserve the settled behavior; no code,
model runs, network, server, poller, sends or data/leads.db; no round-3 prompt.]
```

**Round 3 authorized by Alejandro: YES** (2026-10-12, after Revision 2 `4d13be2`).
