# Codex PLAN review, round 2: organization_name must never be the venue

**Plan:** revision 1 at `c4ea0c6`. **Prior verdict:** round 1 NO-GO on both runs
(`docs/reviews/2026-10-09-org-venue-plan-codex-round1.md`).
**Reader and trigger:** the work phase and the code-review round-1 prompt.

**Verdict: run A (Claude Code) = NO-GO, 1 P2; run B (Alex) = GO, no findings. Stricter wins: NO-GO. This is the
2nd NO-GO on this plan: automatic review iteration STOPS.** Round 3 only with `Round 3 authorized by Alex: YES`.

| # | Run | Finding | Fix (plan revision 2, under the fix contract) |
|---|---|---|---|
| 1 | A P2 | O5b tests empty/punctuation VENUE only; the decision says an empty list on EITHER side is non-comparable | O5b adds organization `"..."` and `"   "` with venue "Example Grand Hotel": the organization is not dropped by the guard (it stays whatever the existing rule returns). Mutation: make an empty organization list match; O5b fails |

All seven round-1 findings: run A FIXED x6 + PARTLY FIXED x1 (this row); run B FIXED x7.

## Run A (Claude Code, `codex exec -s read-only`, 2026-10-09; HEAD `c4ea0c6`, clean after)

```
NO-GO — one remaining P2 plan gap. Round 2 stops automatic iteration; no Round 3 prompt is authorized.

Round 0: NO — no execution yet. Runtime model behavior remains for the planned run to measure.

Round 1 findings:

| # | Status | Verification |
|---|---|---|
| 1 | PARTLY FIXED | Empty/whitespace venues are specified and tested. Empty/whitespace organization inputs are specified in the decision but not covered by O5b. |
| 2 | FIXED | NFD/mark removal and `&` → `and` are specified and tested; `St.`/`Saint` remains explicitly pinned as a known miss. |
| 3 | FIXED | One-word containment is rejected; O4 covers `"The Grand"` / `"Grand Avenue Foundation"`, `"The Rock"` / `"Rock the Vote"`, and `"The Center"` / `"Center for Community Arts"`. |
| 4 | FIXED | O6 now traverses `classifyLead` and tests the returned classification. |
| 5 | FIXED | Execution uses concrete temporary paths, inline fixtures, `jq`, and three-way interpretation. |
| 6 | FIXED | `runEditPipeline` normalization is specified at entry before downstream reads. O9 tests the resulting hold. |
| 7 | FIXED | O8 preserves the existing non-nonprofit `null` behavior. |

Finding:

- P2 — Missing regression case for an empty organization list  
  Plan: `docs/plans/2026-10-09-fix-organization-name-is-the-venue-plan.md:47-48, 121-122`  
  Concrete input: `organization_name = "..."`, `venue_name = "Example Grand Hotel"` (also `"   "`). The decision says an empty word list on either side must be non-comparable, but O5b only tests empty/punctuation `venue_name`. Add organization-side cases and require the organization to remain unchanged.

O1–O10 otherwise have mutations that should fail as stated. The normalization order, exact one-word equality, 2-word containment minimum, empty venue handling, and edit-path reread behavior are internally consistent.
```

## Run B (Alex, inside Codex, 2026-10-09)

```
GO — Round 2 verification.

Repo gate passed: correct path, branch, HEAD `c4ea0c6...`, and clean worktree. `ps` remained unavailable due macOS
`EPERM`; no write drift was visible. No server, poller, network, sends, or database access occurred.

Round 1 dispositions: 1 FIXED (empty/whitespace venue, O5b) · 2 FIXED (NFD + &/and, O2) · 3 FIXED (2-word
minimum, O4) · 4 FIXED (O6 through classifyLead) · 5 FIXED (Execution Path) · 6 FIXED (runEditPipeline entry, O9) ·
7 FIXED (O8). No new P1/P2/P3 findings.

Specific checks: empty lists non-comparable incl. punctuation-only; identical lists match at any length (O4b);
two-word containment intentionally accepts holds such as "Hotel del Coronado Foundation" at "Hotel del Coronado";
St./Saint documented and pinned by O10; runEditPipeline mutates the same classification object before context,
verification and post-check, which do not re-read an older stored value; O1, O2, O4, O5b, O6, O9 mutations should
fail as stated; all five Plan Quality Gate questions answered.

The plan review is GO; implementation may proceed. Automatic iteration is complete after this second review.
```
