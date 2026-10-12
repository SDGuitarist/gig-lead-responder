# Codex PLAN review, round 2: PF-Intel facts are not Alex's experience

**Plan:** Revision 1 at `6ae3661`. **Prior Codex verdicts:** round 1 NO-GO on both runs
(`docs/reviews/2026-10-11-pf-intel-plan-codex-round1.md`). **Reader and trigger:** plan Revision 2; Alex's round-3 call.

**Verdict: NO-GO on BOTH runs (the 2nd NO-GO): automatic iteration stopped.** Both runs: Revision 1 closed every round
1 finding; the F1 pin, forbidden list and named mutations are implementable. Remaining findings are all about the
precision of test oracles (where text must sit) and the positive-control judging.

| # | Runs | Finding | Disposition |
|---|---|---|---|
| 1 | A P1 | F4 only requires the permission after the venue-history header and outside PF-Intel; moving it into a later section passes | Revision 2: permission index inside the venue-history section's bounds (header to the next `## ` or `---`); mutation "move it to a later section" |
| 2 | B P1, A P2 | positive control ("states a fact from the lookup") judged differently by two readers (paraphrase vs plan; "paperwork" vs COI; dB without a number) | Revision 2: per-field match table; values pre-registered before the runs; borderline = no match; a contradiction = F5 fail |
| 3 | A P2 | current code appends the usage text after the PF-Intel section's closing `---`; F1's position check needs the assembly changed | Revision 2: the formatter inserts `PF_INTEL_USAGE` before its closing `---`; F1 asserts the index; mutation "append after `---`" |
| 4 | B P2 | D1 says "from Alex's venue database", which makes PF-Intel sound like Alex's own knowledge | Revision 2: "public facts about the venue from PF-Intel" |

## Run A (Claude Code, `codex exec -s read-only`, 2026-10-11; HEAD `6ae3661`)

````
NO-GO — Round 2, second NO-GO. Automatic iteration stops; Round 3 requires Alejandro’s explicit authorization.

### P1

- **Plan §F4, lines 116–118 — permission is not required to be inside the venue-history section.**

  F4 requires the permission to appear exactly once, after `## ALEX HAS PERFORMED HERE`, and outside PF-Intel. It could still be moved into `## LEAD RESPONSE VOICE` or another later section and pass.

  Concrete mutation: move `Alex has performed at this venue. You may say so.` from `venueHistorySection()` into a later context section. The current F4 assertions still pass.

  Fix: require the permission’s index to fall between the venue-history header and that section’s closing boundary, not merely after the header and outside PF-Intel.

### P2

- **Plan §F5 / positive control — “states a fact present in the recorded lookup” remains semantically ambiguous.**

  Two readers could disagree whether “the property needs paperwork” matches `coi_required: true`, or whether “sound must stay under the limit” matches a numeric dB field. The 6-of-12 threshold can therefore differ.

  Fix: pre-register acceptable matches for each venue—exact normalized values or explicitly defined semantic equivalents—and state how paraphrases, partial facts, and contradictions are judged.

- **Plan §F1 and Work step 2 — placement is specified, but the implementation/test contract is incomplete.**

  The current code appends the usage text after `formatVenueContext()`, whose returned PF-Intel section already ends with `---`. Simply replacing the old string with `PF_INTEL_USAGE` leaves it outside the PF-Intel section, failing the stated requirement.

  The exact-text pin and forbidden-list mutations are implementable and should fail as described; F4’s duplicate mutation also fails. The missing regression is the current assembly shape itself.

  Fix: specify that the test asserts the usage text lies before the PF-Intel section’s closing delimiter, and require the work step to change assembly accordingly.

The F5 claim definition is substantially clearer: it now judges by meaning, includes implied claims, defines borderline as failure, and gives concrete examples. D1, D2, the formatter comment, and the 12-run sampling revision close the corresponding round-1 findings.

Compound-start also found a relevant lesson: wording gates must constrain the exact fact being exempted, with tests for false placement and false claims. The HANDOFF kickoff is stale and points to an unrelated T4 phase; no repository files were changed.

### Fix handoff

```text
Work in /Users/alejandroguillen/Projects/gig-lead-responder. Branch: feat/hub-phase0 (HEAD = branch tip, verify with git rev-parse feat/hub-phase0). Ask: revise the PF-Intel plan after Codex PLAN review Round 2.

FIRST -- confirm no other session or auto-continue is live here. Run:
  - pwd
  - git branch --show-current
  - git rev-parse feat/hub-phase0
  - git status --short
Expected starting HEAD: 6ae36612a299944a557ce218f32565bcf439836d
If HEAD differs or the worktree is dirty, STOP and ask Alejandro.

Read:
  - HANDOFF.md
  - CLAUDE.md
  - docs/plans/2026-10-11-fix-pf-intel-facts-are-not-alexs-experience-plan.md
  - docs/reviews/2026-10-11-pf-intel-plan-codex-round1.md
  - src/pipeline/context.ts
  - src/pipeline/format-venue-context.ts
  - src/venue-history.ts

Round-2 findings to fix in the plan only; do not implement code, call PF-Intel, run the model, start the server/poller, or open data/leads.db:

1. F4 placement P1:
   Require the venue-history permission to be inside the venue-history section bounds, not merely after its header and outside PF-Intel. Add a concrete regression mutation: move the permission into a later unrelated context section; F4 must fail.

2. F5 positive-control determinism P2:
   Pre-register the acceptable lookup facts or exact normalized values for each positive-control venue. Define how exact values, semantic paraphrases, partial facts, and contradictions are judged so two readers produce the same 6-of-12 result.

3. F1 placement P2:
   State that PF_INTEL_USAGE must be inserted before the PF-Intel section’s closing delimiter. Add a test assertion for that index relationship and explain that the current append-after-formatVenueContext shape is insufficient. Keep the existing byte-for-byte pin, forbidden list, exactly-once check, and named mutation checks.

Preserve the settled decisions:
  - Alex’s venue claim requires his yes in the private venue file.
  - PF-Intel remains enabled.
  - D3 remains deferred while every lead is held for Alex’s approval.
  - Root cause is the context.ts “insider edge” line.
  - Do not read ~/Data, do not alter venue sentences, and do not modify source code in this revision.

Reproduce each issue in the plan text with the concrete mutation above, revise the relevant acceptance criteria and work steps, and return the updated plan plus a short revision table. This is the second NO-GO, so automatic iteration stops after this revision. Do not generate or run a Round 3 review prompt unless Alejandro explicitly provides:
  Round 3 authorized by Alejandro: YES
```

Would you like me to copy this handoff prompt, or leave it visible only?

````

## Run B (Alex, inside Codex, 2026-10-11; HEAD `6ae3661`)

```
NO-GO — Revision 1 closes the round-1 findings, but two remaining ambiguities prevent implementation.

P1 — Plan §F5 / "F5 judging rule" — positive-control judging remains underspecified.

Concrete failure: a lookup says `setup_notes: "Load-in via parking lot"`, and a draft says "I can use the parking-lot entrance." One reader counts that as stating a recorded lookup fact; another counts it as a plan rather than lookup usage. The 6-of-12 positive-control result can therefore differ between readers.

Require a semantic rule with examples for lookup usage, including paraphrases versus plans, and specify that the same "borderline = fail" policy applies to the positive control.

P2 — Plan §D1/F1 — "from Alex's venue database" conflicts with the stated source boundary.

Concrete failure: the text says PF-Intel facts come "from Alex's venue database," although the plan's root cause and settled rule say PF-Intel facts are public/vendor facts and Alex's experience is authorized only by the private venue-history file. This wording could make the model treat PF-Intel as Alex-curated knowledge.

Change it to identify PF-Intel/public vendor data directly, e.g. "These are public facts about the venue from PF-Intel," while retaining the explicit prohibition on claiming Alex's experience.

Checks that now pass

- F1's exact-text pin and forbidden list are implementable.
- F4's exactly-once and section-position checks are implementable.
- The named F1/F4 mutations should fail their respective checks.
- The revised claim definition, borderline-fail rule, repeated sentinel runs, D1 example, formatter comment, and smoke-test limitation close the round-1 findings.
- I found no new data-flow or scope regression in the reviewed files.

Because this is the second NO-GO, automatic iteration stops. Round 3 requires Alejandro's explicit authorization; I am not generating a round-3 review prompt.
```

**Alex, 2026-10-11:** no plan round 3 ("Start building"). Revision 2 (`4afca19`) fixes all four findings; the code review covers the tests and their mutations, and the F5 record is read by Alex.
