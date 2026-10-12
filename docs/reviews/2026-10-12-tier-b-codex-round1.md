# Codex CODE review, round 1: Tier B venue holds

**Code:** `feat/hub-phase0` at `39f0329` (code commits `2ece142`, `ca49e11`, `62929e0`, `69ae3ae`). **Plan:**
`docs/plans/2026-10-12-fix-tier-b-venue-rule-conflict-hold-plan.md` (Revisions 1-4). Prior Codex verdicts: none for this
code (plan rounds 1-3 recorded separately). **Reader and trigger:** Revision 5 (Alex's shared rule, decided during this
round); the round-2 prompt.

**Verdict: GO on BOTH runs. No P1, P2 or P3.** Run B noted (not a finding) that the plan still holds superseded
pre-Revision-4 Saturday/date acceptance text; cleaned up in Revision 5.

**Decided by Alex during this round (2026-10-12), applied after it:** one shared premium rule for Coasterra, Tom Ham's
Lighthouse, Marina Village and Brick: **100+ guests or a corporate event**; Scripps Seaside Forum and Martin Johnson
House stay always premium; the waterfront 50+ hold stays at Tom Ham's and Coasterra; no day or time trigger.

## Run A (Claude Code, `codex exec -s read-only`, 2026-10-12; HEAD `39f0329`)

```
GO — Round 1

No P1/P2/P3 findings.

The implementation matches the plan, including Revision 4:

- Coasterra uses only `100+ guests OR corporate`; Saturday/date no longer matter.
- Tom Ham’s requires `100+ guests AND start hour >= 17`.
- Marina Village, Brick, Scripps, and Martin Johnson rules match the plan.
- Holds include both T2/T3 prices and preserve the original tier.
- `tier_b:` notes are routed to hold and stripped from generate, verify, and edit prompts.
- Odd guest/hour inputs normalize to `null` without rejecting classification.
- No evidence of notes reaching the drafter/verifier or changing tiers.
- Real-model record shows B13 passing 9/9.
- Leak check passed; TypeScript passed; worktree remains clean.

Verification limitation: local tests were blocked by the known sandbox `EPERM` errors for `tsx` IPC and temporary-directory creation. The full runner reported unrelated environment failures, not Tier B assertion failures. B14 remains a source-string pin rather than a rendered DOM test, as documented; the renderer itself is correct at [public/dashboard.html](/Users/alejandroguillen/Projects/gig-lead-responder/public/dashboard.html:1510).

No Claude Code fix handoff is required. Next step is the compound phase.

```

## Run B (Alex, inside Codex, 2026-10-12; HEAD `39f0329`)

```
GO — no P1/P2/P3 findings.

The implementation matches the settled Revision 4 behavior:

- Tom Ham's requires both 100+ guests and a 5 PM+ start.
- Coasterra ignores Saturday/date; corporate or 100+ guests triggers premium.
- Marina Village, Brick, Scripps, and Martin Johnson rules behave correctly.
- Holds include both T2/T3 prices and never mutate the tier.
- `tier_b:` notes are routed to hold, hidden from drafting/verifying/edit prompts, and shown in the dashboard.
- Odd `guest_count`/`event_start_hour` values normalize to `null` without failing classification.

Verification:

- Focused Tier B tests: 15/15 passed.
- TypeScript: passed.
- Venue-history leak check: passed.
- Full suite: Tier B passed; remaining failures were sandbox IPC/listen/`sysctl` EPERM failures, matching the stated environment limitation.
- Worktree remains clean.

The plan retains superseded pre-Revision-4 Saturday/date acceptance text, but the explicit Revision 4 and recorded run expectations correctly establish that date no longer matters; I'm treating those older lines as stale prose, not an implementation defect.
```
