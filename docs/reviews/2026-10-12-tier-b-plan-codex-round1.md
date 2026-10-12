# Codex PLAN review, round 1: Tier B venue rule conflict

**Plan:** `docs/plans/2026-10-12-fix-tier-b-venue-rule-conflict-hold-plan.md` at `0054c94`. Prior Codex verdicts: none.
**Pre-registered stops:** a 2nd NO-GO stops automatic iteration (round 3 only with Alex's YES); a 3rd NO-GO is the hard
cap. **Reader and trigger:** plan Revision 1; the round-2 prompt.

**Verdict: NO-GO on BOTH runs (A: 4 P1; B: 3 P1).** Overlapping findings merged:

| # | Runs | Finding | Disposition |
|---|---|---|---|
| 1 | A P1, B P1 | "Saturday evening = start >= 17" was unconfirmed; Brick's "evening" undefined | **Alex 2026-10-12:** "any Saturday" counts. Source check found Tom Ham's rule was mis-ported (source: "Large party, sunset timing"); Alex: 100+ guests OR start 5 PM or later, either alone. Brick held until Alex defines it. Revision 1 |
| 2 | A P1 | R097 "private buyout" dropped | Revision 1: buyout is never extracted, so a waterfront 50+ lead whose own rule says standard is always held with both prices |
| 3 | A P1, B P1 | new note prefix missing from `HOLD_NOTE_PREFIXES`: it would reach generate and verify | Revision 1: `tier_b:` prefix; tests on generate, verify and the edit path |
| 4 | A P1 | where Alex sees both prices | Revision 1: the dashboard lead detail "Concerns" row (`public/dashboard.html:1510`) renders every note; SMS shows a count only (Module 1 item) |
| 5 | B P1, A P2 | malformed values fail validation instead of becoming null | Revision 1: normalize first (digit-only strings parse; anything else null), then validate |
| 6 | A P2, B P2 | extraction rules for "50+", ranges, "about", times, noon/midnight, missing date | Revision 1: exact rules + fixtures |
| 7 | A P2, B P2 | aliases not listed ("Tom Hams Lighthouse" seen today) | Revision 1: patterns enumerated and tested |
| 8 | A P2 | relationship to stealth_premium / Tier A undefined | Revision 1: the check reads only `rate_card_tier`; never writes; Tier A untouched (test) |
| 9 | A P2, B P2 | edit path untested | Revision 1: a real `runEditPipeline` test |
| 10 | A P2, B P2 | candidate prices must keep travel and the P/D column; "below T3" vs T2P/T3D keys | Revision 1: tier family on `rate_card_tier`; `lookupPrice` with the same classification fields and travel data |
| 11 | A P3, B P3 | full venue coverage; literal pin for the prompt line; concrete execution path | Revision 1 |

## Run A (Claude Code, `codex exec -s read-only`, 2026-10-12; HEAD `0054c94`)

````
NO-GO — Plan Review Round 1

The identity gate passed:

- Repo: `/Users/alejandroguillen/Projects/gig-lead-responder`
- Branch: `feat/hub-phase0`
- HEAD: `0054c940896379435698e74b7b2964fd3913c428`
- Worktree: clean
- No evidence of another writer or auto-continue changing the branch.

Relevant prior lessons: deterministic code should own tier constraints; ambiguous rules should fail closed into an explicit hold; candidate prices must come from the rate-card source of truth.

P1 findings

1. D1/D3, B3–B5: R097’s “private buyout” condition is dropped.

The plan reduces the generic rule to “waterfront restaurant + guests >= 50.” A 50-person dinner at a waterfront restaurant that is not a private buyout would incorrectly trigger the generic premium conflict.

Fix the plan by explicitly defining how `private buyout` is extracted. If it is unknown, hold with both prices rather than silently treating it as true. Add positive, negative, and unknown tests.

2. D1 lines 48–49, B5–B6: `Saturday evening = start hour >= 17` is an unapproved pricing rule.

The source says “Saturday evening,” but does not establish 5 PM as the boundary. The plan’s own Feed-Forward calls this uncertain. A 5:00 PM lead would be held while a 4:30 PM lead would not, despite no source supporting that cutoff.

Either obtain Alex’s explicit boundary or represent the condition as unknown and hold the edge case. Add tests for missing, boundary, and non-evening times.

3. D3, Work Step 3, B10: the new hold note is not added to `HOLD_NOTE_PREFIXES`.

`buildGeneratePrompt` and `buildVerifyPrompt` call `withoutHoldNotes()`. If the new note begins with `tierB:`, it will remain in the drafting and verification prompts. The internal hold explanation could therefore influence or appear in the draft.

The plan must include the prefix update in `src/types.ts`, plus tests proving the note is stored for routing but removed from both drafting prompts.

4. D3/B10: the plan does not prove where Alex sees both prices.

`routeLead` holds any flagged concern, but the orchestrator’s SMS says only “1 flagged concern(s).” The stored classification contains the detailed note, but the plan does not identify whether Alex is expected to see it in the dashboard, SMS, or both.

Add an explicit user-visible surface and acceptance test. A hold that prevents sending but shows Alex only the model-selected draft price does not fully satisfy the settled decision.

P2 findings

5. D2/B2: extraction rules are not precise enough.

The plan does not define behavior for:

- `50+`, `50 or more`, `under 50`, `up to 50`
- “about/around 50”
- `50–60` versus “up to 60”
- `5–8 PM`, noon, midnight, and timezone wording
- missing date or time
- invalid dates

Also clarify whether malformed values become `null` or cause classification failure. Add fixtures for each threshold-sensitive form.

6. D1/B9: venue matching requirements are underspecified.

The source includes aliases such as “Scripps Forum,” while the plan only names canonical spellings. It also says patterns will cover spellings from today’s runs without listing them.

Specify the exact patterns and test aliases for Tom Ham’s/Tom Hams, Coasterra variants, Marina Village, Brick, Scripps Seaside Forum/Scripps Forum, and Martin Johnson House.

7. D3 and `classify-verify`: the relationship to `stealth_premium` is undefined.

Tier A has a deterministic consistency check involving T3/T4 and `stealth_premium`; Tier B will add a separate price hold but does not state whether it should read, validate, or deliberately ignore those fields.

State the boundary explicitly and add a test showing that the Tier B check does not change Tier A behavior or silently override `rate_card_tier`.

8. B10 and Work Step 3 claim edit-path coverage but do not test it.

The plan says edits reuse the stored classification, but B10 only describes `runPipeline`. Add a `runEditPipeline` regression test proving the hold note survives storage/reload and remains hidden from the regenerated draft.

9. D3 line 66 does not specify how travel data is preserved for the two candidate prices.

Calling `lookupPrice` without the original travel data can produce alternative prices that do not match the actual rate-card calculation for an out-of-area lead. Pass the same pricing inputs/context used for the original lookup, and test that both alternatives use the same duration, column, competition position, and travel treatment.

P3 findings

10. B9 does not cover the complete Tier B table.

Add negative and positive tests for Brick, Coasterra, Martin Johnson House, and the non-corporate Marina Village threshold. Also add a regression test proving unrelated waterfront restaurants remain governed by the existing model judgment.

11. The Execution Path uses placeholders (`<scratchpad>`, `tbN.txt`) and does not include the exact pv3 lead text.

Replace these with a concrete scratch-directory command and an explicit fixture/input location so a human can run B11 without reconstructing missing setup.

Fix contract for Claude Code

```text
Work in /Users/alejandroguillen/Projects/gig-lead-responder
Branch: feat/hub-phase0
Ask: Revise docs/plans/2026-10-12-fix-tier-b-venue-rule-conflict-hold-plan.md using the Round 1 Codex plan-review findings below. Do not implement code.

FIRST gate:
  pwd
  git branch --show-current
  git rev-parse feat/hub-phase0
  git status --short
Expected:
  pwd = /Users/alejandroguillen/Projects/gig-lead-responder
  branch = feat/hub-phase0
  HEAD = 0054c940896379435698e74b7b2964fd3913c428
  worktree = clean
Stop if any value differs.

Read HANDOFF.md, CLAUDE.md, AGENTS.md if present, and the current plan before editing it.

Required fixes:
1. Define private-buyout handling for R097, including unknown facts.
2. Resolve or explicitly hold the Saturday-evening boundary; do not silently keep >=17 without source support.
3. Add the new hold-note prefix to the plan scope and tests so drafting prompts never receive it.
4. Specify exactly where Alex sees both prices and test that surface.
5. Make guest/time extraction rules precise for ranges, “around,” “50+,” missing values, time ranges, noon/midnight, and malformed input.
6. List and test venue aliases, including Scripps Forum and Martin Johnson House.
7. Define the Tier B relationship to stealth_premium, T3, and the existing Tier A verifier.
8. Add an actual runEditPipeline regression test.
9. Preserve original pricing context, including travel treatment, when calculating both candidate prices.
10. Expand coverage for all Tier B venues and unrelated waterfront restaurants.
11. Make the B11 execution path concrete and self-contained.

For each accepted fix:
- identify the root cause;
- add a directly testable acceptance criterion;
- include a regression test that fails without the plan change, or explain why impractical;
- keep the settled behavior: hold edge cases, show both existing rate-card prices, never change the selected tier, and never invent a price.

Re-read the revised plan and verify its Feed-Forward section, EARS tests, verification commands, and human execution path. Stop after the plan revision and return the revised plan path plus a short summary. Do not start code or generate a Round 3 prompt.
```

This is the first NO-GO, so automatic iteration may proceed to Round 2. A second NO-GO stops automatic iteration; Round 3 requires the literal authorization `Round 3 authorized by Alejandro: YES`.

Would you like me to copy this handoff prompt to the clipboard?

````

## Run B (Alex, inside Codex, 2026-10-12; HEAD `0054c94`)

```
NO-GO — Round 1. (Repo gate passed; no files changed.)

P1 — D2, B2, validation contract: malformed values become null vs validation accepts only integers or null; current
validation rejects invalid shapes before normalization. Failure: the model returns "50" or "50+"; classification fails
instead of producing a held lead. Define normalization first.

P1 — D3, B10, hold-note plumbing: the new prefix is not in HOLD_NOTE_PREFIXES (src/types.ts); generate and verify call
withoutHoldNotes. Failure: "tierB: ... T2 $895 / T3 $1,200" reaches the drafter and verifier. Add the prefix; test both
prompts including the edit path.

P1 — D1, D3, B5-B7, source-rule fidelity: "Saturday evening = start >= 17" is unconfirmed; missing date/time must be
handled; Brick "large corporate evening" has only corporate and guest predicates. Failures: a Saturday 4:30 PM;
a 120-guest corporate Brick event at 2 PM. Obtain Alex's threshold or hold; per-venue predicates; boundary tests.

P2 — D2, B2, B7, B11: extraction rules miss "50+", time ranges, noon, midnight, AM/PM, minutes, missing
event_date_iso. Failures: "50+" may become null; "5–8 PM" read as 20:00; a missing date not covered by B7.

P2 — D3, B3-B5: "priced below T3" ambiguous with T2P/T3P/T2D/T3D; define a tier-family comparison; candidate lookups
keep format, duration and source column.

P2 — D1, pattern matching: aliases not enumerated; the observed lead used "Tom Hams Lighthouse" without the apostrophe.

P2 — B10: tests only runPipeline's return, not that the stored note survives editing while hidden from generation.

P3 — B1: "byte-identical" needs a literal pinned fixture.

[Handoff prompt omitted here: gate at 0054c94; revise the plan only for the eight items above; keep the settled
behavior; no model, PF-Intel, server, poller, network or data/leads.db.]
```
