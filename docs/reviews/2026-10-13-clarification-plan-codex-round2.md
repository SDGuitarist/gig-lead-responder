---
title: "Codex PLAN review, round 2: clarification-mode validator (the six named fixes)"
date: 2026-10-13
plan: docs/plans/2026-10-13-fix-clarification-pricing-validator-plan.md (Revision 1)
reviewed_head: bb7a4ae
prior_verdicts: docs/reviews/2026-10-13-clarification-plan-codex-round1.md (NO-GO)
---

# Round 2 (plan): NO-GO, 1 P1 (wording). The 2nd NO-GO: automatic iteration STOPS.

One run. Round 3 only with the literal `Round 3 authorized by Alejandro: YES`; a 3rd NO-GO is the hard cap.

## Verdict text (verbatim; the attached fix prompt summarised)

Baseline checks passed: clean worktree, expected HEAD, three changed files, no `src` diff, TypeScript clean.

| Finding | Result | Evidence |
|---|---|---|
| P1-1 grammar coverage | **FIXED BUT INTRODUCES a contradictory invariant claim** | Added alternatives 4-5 and tests: plan lines 77-88, 135-138. However, line 55 says the validator guarantees no `AMOUNT`, while lines 65 and 150 explicitly allow unmarked amounts such as "around fifteen hundred." |
| P1-2 scan/evidence mismatch | **FIXED** | The plan separates stated amounts from allowed vocabulary and labels reruns observational: lines 53-70, 108-116, 195-200. Runner scan classes at `scripts/clarification-measure.ts:46-58`. |
| P1-3 reproducibility | **FIXED** | Exact parallel command and prerequisites: plan lines 182-200. Committed runner and CLI parsing: `scripts/clarification-measure.ts:4-30`. |
| P2-4 V4 independence | **FIXED** | Separate V4a/V4b/V4c tests and mutations: plan lines 133-134, 160-162. |
| P2-5 V7 strength | **FIXED** | Exact field-specific message, matched text, and draft-exclusion requirements: plan lines 141-144; mutation at line 167. |
| P2-6 D2 logging boundary | **FIXED** | Match-only, server-log-only boundary and exact-shape test: plan lines 89-92, 141-144. |

**New defects:** P1 — The invariant wording is still broader than the implemented grammar. "No AMOUNT" / "no stated
amount" conflicts with V10's intentional acceptance of unmarked amounts. The plan should say "no amount matching the
supported amount grammar and no internal pricing term." No other new defects found in the bounded sweep.

**Final verdict: NO-GO.** Automatic iteration stops here under the pre-registered round-2 budget. Round 3 requires the
literal authorization `Round 3 authorized by Alejandro: YES`.

(Codex attached a Claude Code fix prompt: narrow the invariant wording and every dependent sentence (invariant table,
Quality Gate items 3-4, D1/D5, V10 and the mutation map, the Execution Path expected result, Feed-Forward and Three
Questions) to "amounts matching the supported grammar plus internal pricing terms"; keep the documented limit and
V10; a plan-level regression check showing the broad wording is absent and the supported and V10 examples remain; no
production code; a bounded inventory of affected invariant claims; no round 3 without the literal approval.)

## Claude Code's check (2026-10-13, read-only; nothing edited after the verdict)

- **REAL, and a defect I introduced.** A grep of the plan for the broad claim finds four sentences that say or imply
  "no amount" in general:

  | Line | Text | Overclaims? |
  |---|---|---|
  | 55 | "**This validator guarantees one thing: a clarification draft states no AMOUNT and no internal pricing term.**" | **yes, the finding** |
  | 199 | "no draft holds a stated amount" (Execution Path, expected) | yes, same claim |
  | 206 | Feed-Forward: "The invariant is 'no stated amount', not 'no price vocabulary'" | yes, same claim |
  | 8, 38 | title and Problem: "reject a stated amount" | mild: states intent, not a guarantee |

  The table directly under line 55 and V10 already say the true thing (an amount with no currency marker is outside
  the grammar). Nothing in the grammar, the tests or the runner is affected.
- **The five other fixes are confirmed FIXED by Codex** (P1-2, P1-3, P2-4, P2-5, P2-6).
- **Nature of the residue:** a single claim restated in four places; wording only. It is the same class as the COI
  plan's round 3 (a statement made once and left broader than the thing it describes).

## Per the pre-registered budget

Automatic iteration stops. No round 3 prompt was written. The options and a recommendation are put to Alex.

## Alex's decision and the fix (2026-10-13): "a", accept, fix the wording, build

- **Root cause:** one invariant sentence was written broader than the grammar and restated in the Execution Path
  expectation and in Feed-Forward.
- **Fix (Revision 1b, in place):** the bold guarantee now reads "no text matching the supported price grammar ...
  and no internal pricing term" and says it does not guarantee "no amount of any kind"; the title and Problem say
  "marked price"; the Execution Path expectation and Feed-Forward say "matching the supported price grammar". No
  grammar, test, mutation, runner or design changed.
- **Bounded inventory of the claim** (grep of `no AMOUNT`, `no stated amount`, `states no`, `holds a stated`,
  `amount of any kind`): line 8 (title), 38 (Problem), 55 (the guarantee), 199 (expected), 206 (Feed-Forward). All
  five narrowed; the two remaining matches of "amount of any kind" are the explicit negations.
- **Regression check (a scratch script, deliberately not a permanent test: a test that pins plan prose would break
  on any legitimate plan edit):** the broad phrases are absent; the 12 supported rejection examples and the 3 V10
  pass examples are present; the narrow wording is present. Positive controls: reinserting "states no AMOUNT",
  removing a V10 example, and removing a supported example each fail it.
- **Remaining risk:** the 18-run re-run and the mutation map remain UNEXECUTED until the code is built.

