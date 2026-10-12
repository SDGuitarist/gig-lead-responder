# Codex PLAN review, round 3 (final): Tier B venue rule conflict

**Plan:** Revision 2 at `1a45668` (Revision 2 = `4d13be2`). Round 3 authorized by
Alejandro: YES (2026-10-12). **Prior Codex verdicts:** round 1 NO-GO both runs; round 2 NO-GO both runs.
**Hard cap: no round 4.** Remaining findings go to Alex as a decision. **Reader and trigger:** plan Revision 3; work.

**Verdict: NO-GO on BOTH runs (hard cap).** Both runs: Revision 2 closed all eight round 2 findings; one acceptance-test
set; the first-match table is consistent with Alex's settled rules; the commands and fixtures are runnable.

| # | Runs | Finding | Disposition |
|---|---|---|---|
| 1 | A P1 | Tom Ham's with guests null and start hour < 17: own rule decided (not met) but R097 undecidable; no exact first-match row or note | Revision 3: an explicit row before the waterfront row ("<venue> guests not stated; waterfront 50+ buyout rule may apply; T2 $a / T3 $b"), following Alex's settled rule (a missing fact holds) |
| 2 | A P1, B P2 | dashboard showing the note is not acceptance-tested | Revision 3: a deterministic test that the dashboard's lead-detail renderer prints `flagged_concerns` (pins `public/dashboard.html:1510-1512`) |
| 3 | A P2 | EARS form and grouping | Revision 3: B1-B13 rewritten WHEN/SHALL, grouped Happy Path / Error Cases |
| 4 | A P2 | `feed_forward` frontmatter missing | Revision 3: added |
| 5 | A note | PF-Intel URL/key prerequisite not listed | Revision 3: listed (ALREADY HAVE, fixed 2026-10-11) |
| 6 | B P3 | "the JSON after the log lines" called inaccurate | **Not accepted:** the CLI prints log lines ("[travel-fee] Loaded ...", "Gate PASSED on attempt N") on stdout before the JSON (observed in every run on 2026-10-11); wording kept |

## Run A (Claude Code, `codex exec -s read-only`, 2026-10-12)

```
NO-GO — Round 3 final. The hard cap applies; there is no Round 4.

The identity gate passed: correct repo, branch, expected HEAD, and clean worktree. Revision 2 closes all eight Round 2 findings, but these issues remain:

P1 — D3 first-match table / B4, lines 114–128 and 183–187

The case “Tom Ham’s, `guest_count = null`, `event_start_hour = 12`” is still ambiguous.

- The known hour below 17 proves Tom Ham’s own rule is not met.
- The waterfront 50+ rule is undecidable because guest count is null.
- The table only defines the waterfront case for `guests >= 50`.
- B4 nevertheless requires a hold for “waterfront, guests not stated,” without defining the exact first-match branch or note.

An implementer could return no note, use the own-rule-standard note, or invent a new “guests not stated” note. Add an explicit ordered case and exact expected note.

P1 — User-visible both-price evidence, Revision 1 finding 4 / lines 71–74 and 129–130

The plan says Alex sees the hold note in the dashboard, but no acceptance test verifies that surface. B11 only tests routing and prompt filtering.

Concrete failure: an implementation could correctly hold the lead and hide `tier_b:` from generation while failing to render the detailed note—and both candidate prices—in the dashboard. All listed B1–B13 tests could still pass.

Add a deterministic dashboard acceptance test, or explicitly make the existing dashboard rendering a tested invariant.

P2 — Acceptance-test format, lines 161–216

There is one acceptance-test block, but it is not actually grouped into Happy Path and Error Cases and most criteria are not written in the required EARS form:

`WHEN [condition] THE SYSTEM SHALL [behavior]`

This makes the plan fail the repository’s Plan Quality Gate even though the behavioral cases are mostly present. Convert B1–B13 into explicit EARS cases and group them.

P2 — Required plan frontmatter

The plan has a `## Feed-Forward` section but lacks the required frontmatter:

```yaml
feed_forward:
  risk: "..."
  verify_first: true
```

This is a deterministic plan-gate omission.

Execution Path: the shell commands are now mechanically runnable and the committed fixtures exist. However, the path still states that PF-Intel lookups are live without naming the required PF-Intel URL/key prerequisite; only the Anthropic key is declared. That should be clarified before implementation if live venue lookups are part of the claimed run.

Final assessment: the revised plan is substantially improved, but the unresolved Tom Ham’s `null guests + pre-5 PM` branch is a pricing/hold behavior decision, so this round cannot be approved.

```

## Run B (Alex, inside Codex, 2026-10-12)

```
NO-GO — Round 3 final. Hard cap reached; there is no Round 4.

P2 — B11, D3 lines 129–130: dashboard visibility is asserted but not acceptance-tested.
Concrete failure: tests can prove tier_b: is stored, hidden from prompts, and causes routeLead to hold, while the dashboard fails to render the note. Alex would then see only a generic flagged-count or selected price, not both candidate prices. The existing renderer at public/dashboard.html:1510–1512 appears to display concerns, but Revision 2 does not pin this behavior with a test or verification command. Label: executable.

P3 — Execution Path, lines 234–243: wording is inaccurate.
The commands use --json, so there are no log lines before the JSON; the output is already JSON. This does not block execution, but makes the run instructions less precise. Label: prose.

What Revision 2 successfully closed:
- One authoritative B1–B13 acceptance-test set remains.
- The first-match table and settled Tom Ham's, Saturday, and Brick rules are consistent.
- All eight Round 2 findings are addressed.
- The scratch database paths and committed fixtures make the execution commands runnable.
- No code or data was changed during this review.
```
