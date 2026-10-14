---
date: 2026-10-13
phase: plan review, round 2
subject: docs/plans/2026-10-13-fix-clarification-internal-terms-plan.md (Revision 1, HEAD ed47a40)
prior_verdicts: docs/reviews/2026-10-13-clarification-internal-terms-plan-codex-round1.md (NO-GO)
verdict: NO-GO (one P2: the mutation map; no P1; the six round 1 items FIXED)
---

# Round 2 (plan): NO-GO. The 2nd NO-GO: automatic iteration STOPS.

One run. Pasted by Alex 2026-10-13; verdict verbatim below, the appended fix prompt summarized (one item: the
mutation map at plan lines 145-148). Round 3 only with the literal `Round 3 authorized by Alejandro: YES`; a 3rd
NO-GO is the hard cap. Process note from the run: `ps` was denied by macOS; branch and HEAD matched, worktree clean.

## Verdict (verbatim, condensed to the verdict lines)

1. R1 diagnosis/evidence -- **FIXED.** The plan distinguishes 172 total runs from the 154-run stored corpus and
   records provenance and limits (plan 31-52); `investment` occurs 0 times, the six matches are `anchor` x3,
   `anchors` x2, `floor` x1 (45-50); expected replay counts are consistent (175-177).
2. Possessive false rejects -- **FIXED.** The possessive alternative was removed; Alex's decision is recorded
   (19-26); "My anchor is my family" and "Our floor is upstairs" are pass cases in V12 (130-132).
3. Plural pricing leaks -- **FIXED.** Both alternatives use `s?`; plural forms are covered by V13a-pl and V13b-pl
   (72-81, 133-138). The plan honestly records accepted false rejects such as "price anchors the whole conversation"
   and "floor number" (91-100). No ReDoS issue.
4. V4a amendment approval -- **FIXED.** Recorded as Alex's 2026-10-13 choice (19-26); reflected in V4a/V4b (83-85,
   125-129).
5. V15 and mutation isolation -- **FIXED BUT INTRODUCES A NEW TEST-MAP DEFECT.** Dropping V15 and splitting the
   compound cases was correct (104-106, 130-148). The mutation map still makes two invalid isolation claims:
   - Removing the plural `s?` from alternative 1 will not fail V13a-pl. "Anchor prices" and "Floor rates" pluralize
     `prices`/`rates`, not `anchor`/`floor`; alternative 1 still matches.
   - Removing `quote` from alternative 2 will not isolate through V13b-pl, because that test also contains "Price
     floors" and "Rate anchors," which still fail. The problem is at 145-148: the tests are split by direction, but
     not into one-case-per-token mutations.
6. Replay inputs and limits -- **FIXED.** Concrete session-local directories, input counts, SHA-256 recording and
   exit-2 behavior (158-177); the corpus is session-local and observational, drafts written under the old validator
   and mixed prompts (98-100, 175-177).

New defect: **P2 -- Mutation map does not actually prove the named mutations** (145-148). Use one test sentence per
mutation target, or say the tests provide aggregate coverage rather than token-level isolation.

Final verdict: **NO-GO**

## Claude Code's check (2026-10-13)

| Claim | Check (Python `re`, the same alternatives) | Result |
|---|---|---|
| Removing `s?` from alternative 1 does not fail V13a-pl | "Anchor prices vary." and "Floor rates apply." still match without the `s?` | **Valid.** The `s?` in alternative 1 only matters for "anchors price", which is not a natural form; it is dead weight. |
| `quote` removal not isolated by V13b-pl | Without `quote`, "Price floors differ." and "Rate anchors help." still match; only "Quote floors vary." passes. The loop test fails because of that one sentence, so the mutation IS killed by V13b-pl; what is wrong is the claim of isolation, since the failing sentence is not named by a test of its own. | **Valid as an isolation defect**, not a kill defect. |

Both accepted. Smallest fix: drop the dead `s?` from alternative 1 and make V13a/V13b one test per sentence (table
driven), so each mutation fails the test of its own token.
