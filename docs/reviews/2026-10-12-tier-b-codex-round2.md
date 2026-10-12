# Codex CODE review, round 2: Tier B venue holds (Revision 5/5b)

**Code:** `feat/hub-phase0` at `96a091a` (range `39f0329..96a091a`: plan Revisions 5/5b, code `61e60a6`, runs).
**Prior Codex verdicts:** round 1 GO on both runs
(`docs/reviews/2026-10-12-tier-b-codex-round1.md`). Round 2 exists because Alex changed the rule after round 1.
**Reader and trigger:** the compound solution doc; HANDOFF.

**Verdict: GO on BOTH runs. No P1, P2 or P3. Code review closed.** Both runs judged the two noted deviations
(`event_start_hour` still extracted but unread; the prompt keeps "100+ guests or a corporate event" while the app holds
every under-100 lead) intentional and documented.

Note: a first paste for run B was a different repo's review (`~/Projects/sandbox`, pre-104 Bash-contract checker); it
was not acted on, and the correct run B is below.

## Run A (Claude Code, `codex exec -s read-only`, 2026-10-12; HEAD `96a091a`)

```
GO — no P1, P2, or P3 findings.

Revision 5/5b matches the settled rule:

- Shared venues hold under 100 or unknown guests, including corporate leads.
- 100+ guests permits premium; date/time do not affect the rule.
- Waterfront wording applies only to Tom Ham’s and Coasterra at 50–99 guests.
- Both T2/T3 prices are included in every hold note.
- Tier and pricing inputs are not mutated.
- `tier_b:` notes route to hold and are stripped from generate, verify, and edit prompts.
- B8/B9 matching, exclusions, dashboard visibility, and travel pricing remain covered.

The six named mutations are covered by the rewritten boundary tests and would fail as documented. Real Revision 5/5b runs passed 6/6.

Verification limitation: this sandbox blocked focused and full test execution with known `tsx` IPC and temporary-directory `EPERM` errors. TypeScript completed successfully; the worktree remains clean.

```

## Run B (Alex, inside Codex, 2026-10-12; HEAD `96a091a`)

```
GO — Round 2. No P1, P2, or P3 findings.

The Revision 5/5b code matches the settled rule:
- Shared venues use guest_count >= 100; under 100 or unknown always holds.
- Corporate status appears only in the hold note.
- Both T2 and T3 prices are included, including travel fees.
- Tier classification is never mutated.
- Dates and start times are not read by tierBHold.
- Scripps and Martin Johnson remain always premium.
- B8 matching, B9 exclusions, B10 travel pricing, and B11 drafter hiding remain intact.
- Holds reach routing through flagged_concerns; tier_b: notes are stripped before generation and verification.

Evidence: npx tsc --noEmit passed; focused tests hit the known sandbox tsx IPC EPERM, not a test failure; Claude's
recorded suite 811/0/1 and all six named mutations caught; worktree clean at the expected HEAD.

The two noted deviations are intentional and documented: event_start_hour remains extracted for compatibility/tests,
and the prompt retains the corporate wording while the application conservatively holds under-100 leads. Round 3 is
not needed.
```
