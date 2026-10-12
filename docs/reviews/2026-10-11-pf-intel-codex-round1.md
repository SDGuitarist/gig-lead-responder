# Codex CODE review, round 1: PF-Intel facts are not Alex's experience

**Code:** `feat/hub-phase0` at `0abc484` (code commits `e573f6c`, `c3a6d28`, `a7e28eb`). **Plan:**
`docs/plans/2026-10-11-fix-pf-intel-facts-are-not-alexs-experience-plan.md` (Revisions 1-3). Prior Codex verdicts:
none for this code (plan rounds 1-2 recorded separately). **Pre-registered stops:** a 2nd NO-GO stops automatic
iteration (round 3 only with Alex's YES); a 3rd NO-GO is the hard cap. **Reader and trigger:** the fix that follows; the
round-2 prompt.

**Verdict: run A GO, run B NO-GO (P2); the stricter verdict is run B.** Both runs: past events, recent events and
contact names no longer reach the generate or edit prompt; the usage text is inside the PF-Intel section and pinned;
the permission appears only in the venue-history section; nothing the plan froze changed; all named mutations covered.

| # | Runs | Finding | Disposition |
|---|---|---|---|
| 1 | B P2 | `docs/LEAD_RESPONSE_VOICE.md:141` (always loaded) models "I have played this room enough to know how to read it on the night", a first-person venue-experience claim, in every generate and edit prompt | Alex's call on the voice-guide words (the guide is his voice); then a deterministic test that the sentence cannot reach the prompt, with positive controls for vendor policies and venue-history claims |

Run A also noted (not a finding): PF-Intel text enters the prompt without the sanitizer used on lead text; low risk
(Alex's own database), out of this plan's scope; logged as a possible future item.

## Run A (Claude Code, `codex exec -s read-only`, 2026-10-11; HEAD `0abc484`)

````
GO — Round 1 code review.

No P1, P2, or P3 findings.

- Event counts, recent events, and contact names are fetched but no longer rendered by `formatVenueContext`; both generate and edit paths use that formatter.
- PF-Intel usage text is inside the PF-Intel section, exact-pinned, and the venue-history permission remains only in the venue-history section.
- Vendor-policy lines, ordering, fetch/timeout/miss logging, and venue-history placement are unchanged.
- Focused PF-Intel tests pass; TypeScript and leak check pass. The sandbox-only IPC/temp `EPERM` prevented the normal runner and one manifest test; Round 0 supplied full-suite and mutation evidence.
- F5’s one accepted borderline (`"The bay-side wind at Catamaran is real"`) is recorded and settled by Alejandro, not a code-review defect.

Compound-start surfaced a separate general lesson about sanitizing external venue text; applying that would expand beyond this plan and should be separately planned.

Next-step verification prompt:

```text
Work in /Users/alejandroguillen/Projects/gig-lead-responder. Branch: feat/hub-phase0 (HEAD = branch tip, verify with git rev-parse feat/hub-phase0). Ask: record Codex code-review Round 1 GO for the PF-Intel venue-facts fix and proceed only with the planned compound handoff.

FIRST gate:
  pwd
  git branch --show-current
  git rev-parse feat/hub-phase0
  git status --short
Expected starting HEAD: 0abc48438e4d5f65fc66b5c63b824b6b9fc136c4
If anything differs or the worktree is dirty, stop and ask Alejandro.

Read HANDOFF.md, CLAUDE.md, the PF-Intel plan, and docs/reviews/2026-10-11-venue-history-local-runs.md. No code fixes are required from Round 1; do not start Round 2.
```

Would you like me to copy this prompt?

````

## Run B (Alex, inside Codex, 2026-10-11; HEAD `0abc484`)

```
NO-GO — one P2 finding.

P2 — pre-existing voice guidance can still prime a false venue-experience claim

- `docs/LEAD_RESPONSE_VOICE.md:141`
- Concrete input: any PF-Intel venue with vendor policies, such as `Example Bay Club`.
- `selectContext(...)` includes the always-loaded sentence: `"I have played this room enough to know how to read it on the night"`.
- `buildGeneratePrompt(...)` injects that context into the generate prompt; `runEditPipeline` uses the same path.
- This does not leak PF-Intel event counts, recent dates, or contact names. Those are correctly removed by `formatVenueContext`.
- It is a residual prompt path that conflicts with the broader "never imply Alex knows or has played this venue" goal. The real-model runs did not surface it, but the deterministic prompt still contains it.

All named mutations are covered by the tests and the supplied mutation evidence. Fetching, timeout, miss logging, vendor-policy order, venue-history placement, and edit/generate wiring are unchanged. TypeScript and the venue-history leak check pass. Local test execution hit the known sandbox `tsx` IPC `EPERM`; Round 0's recorded suite result was 795 pass / 0 fail / 1 skip.

Fix contract: reproduce the prompt leak, identify the root cause, add a deterministic regression test failing before the fix, run focused and full suites, and report remaining risks. Because the fix could overreach, preserve a positive control proving PF-Intel vendor-policy facts and confirmed venue-history claims still reach prompts. No second failure-class instance was confirmed, so bounded inventory is not triggered.

[Handoff prompt omitted here: gate at 0abc484; reproduce with selectContext + buildGeneratePrompt; smallest safe fix
consistent with Alex's venue-history policy; regression test failing before the fix; positive controls for vendor
policies and a confirmed venue-history claim; focused + full suite, tsc, leak check; no PF-Intel, model, DB, server or
private venue data.]
```
