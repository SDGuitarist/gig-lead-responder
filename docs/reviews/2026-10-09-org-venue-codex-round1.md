# Codex CODE review, round 1: organization_name is never the venue

**Range:** `c7bf63f..bfafbc0` (code commits `e0ab871` `eb56333` `bef0bf2`; record `bfafbc0`). **Plan:**
`docs/plans/2026-10-09-fix-organization-name-is-the-venue-plan.md`. **Execution record:**
`docs/reviews/2026-10-09-org-venue-local-runs.md`. Prior Codex verdicts on this CODE: none (the plan reviews,
`...-org-venue-plan-codex-round1.md` (NO-GO) and `...-round2.md` (GO), reviewed the plan, not code).
**Reader and trigger:** the compound phase (solution doc) and HANDOFF.

**Verdict: GO on BOTH runs, no findings. Code review CLOSED at round 1.** No fixes; no round 2.
Residual risk (both runs, accepted in the plan): the pinned `St.`/`Saint` miss (O10) keeps a venue whose
spelling differs from the organization's; it costs at most one held draft. Both Codex sandboxes could not run the
full suite (`EPERM`, environment only); the suite result is Claude Code's (733 pass / 0 fail / 1 skip at
`bfafbc0`, `tsc` clean). Run B ran the focused org-venue tests: 5 passed.

## Run A (Claude Code, `codex exec -s read-only`, 2026-10-10; HEAD `bfafbc0`, clean after)

```
GO — no actionable P1/P2/P3 findings.

- Match rule, empty-list handling, 2-word containment, call sites, and O1–O10 all match the plan.
- Unicode folding and non-Latin scripts behave consistently with the specified contract. The `St.`/`Saint` miss is correctly pinned by O10.
- No production caller currently reuses or persists the object passed to `runEditPipeline`; its mutation is intentional and covered by O9.
- Supplied Round 0 evidence: 733 pass / 0 fail / 1 skip, clean `tsc`, mutation checks passed, real-model runs passed.
- Local rerun was blocked only by sandbox `EPERM` restrictions for temporary directories/listening tests.

Final identity check passed: clean `feat/hub-phase0` at `bfafbc0c0ba772521388f437025ba135524f5790`.
```
(Codex's optional next-step prompt offer omitted.)

## Run B (Alex, inside Codex, 2026-10-10)

```
GO — no P1/P2/P3 findings.

The code matches the approved plan:

- Matching uses NFD accent folding, `&`/`and`, punctuation removal, leading "the" removal, identical lists, and 2+ word containment.
- Empty lists never match.
- Classifier and edit-path call sites both apply the guard.
- Nonprofit and non-nonprofit behavior remains correct.
- O1–O10 are exercised, including the real `classifyLead` path and stored-classification edit path.
- No production caller currently reuses or persists the mutated `runEditPipeline` argument; database persistence serializes `runPipeline` output instead.
- Unicode property handling is appropriate for combining marks and non-Latin letters. The pinned `St.`/`Saint` miss remains intentional.

Verification:

- Focused `org-venue` tests: 5 passed; the runner reported 127 total tests, 0 failures.
- Round 0 evidence: full suite 733 passed, TypeScript clean, mutation checks passed, and real-model runs passed.
- A direct `tsx -e` probe was blocked by the known sandbox `listen EPERM`; this is not a code finding.
```

## Stricter verdict

Both GO with no findings, so the verdicts agree. Next: compound phase (solution doc, then `/update-learnings`).
