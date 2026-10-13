---
date: 2026-10-13
phase: code review, round 2
subject: feat/hub-phase0, fix range e5662c7..90318c7 (G8 voice-block pin, openingOf)
prior_verdicts: docs/reviews/2026-10-13-clarification-gate-code-codex-round1.md (NO-GO)
verdict: NO-GO (one P2, prose only; no new executable defect)
---

# Round 2 (code): NO-GO. The 2nd NO-GO: automatic iteration STOPS.

One run. Pasted by Alex 2026-10-13; verdict verbatim below, the appended fix prompt summarized (one item: the plan's
byte-equality wording). Round 3 only with the literal `Round 3 authorized by Alejandro: YES`; a 3rd NO-GO is the
hard cap.

## Verdict (verbatim)

Round 2 verdict: **NO-GO**.

P2-1 — **FIXED BUT INCOMPLETE (P2 prose residue)**

- G8 now hashes the exact block returned by `voiceBlockOf`; that helper throws unless exactly one block exists:
  `src/verify-prompt-cases.ts:57`.
- G8 hashes raw prompts and checks all cases: `src/clarification-gate-prompt.test.ts:140`.
- The refresh rule is present in the test header: `src/clarification-gate-prompt.test.ts:36`.
- However, the plan still claims unqualified full byte equality at
  `docs/plans/2026-10-13-fix-clarification-gate-opening-plan.md:136`, `:167-169`, and `:177-179`. The executable test
  only proves equality outside the voice block.

P2-2 — **FIXED**

- `openingOf` removes same-line and own-line salutations, then extracts the first content sentence:
  `src/draft-opening.ts:10`.
- O1-O5 cover same-line greetings, separate-line greetings, no greeting, positive controls, and empty drafts:
  `src/draft-opening.test.ts:9`.
- The runner now uses the helper, and no other consumer of the old inline extraction remains:
  `scripts/clarification-measure.ts:70`.

The regex intentionally misses greetings such as "Good morning Sarah," and could classify a conversational "Hey, ..."
as a salutation. Those affect only human-read measurement output; `openingOf` is not used by the app.

New defects caused by `e5662c7..HEAD`: **No new executable defects.**

Verification: G0-G8: 22 pass, 0 fail. Draft Opening O1-O5: 5 pass, 0 fail. TypeScript: clean. Diff check: clean.
Venue-history check remains sandbox-blocked by `tsx` IPC/listen permissions. Broader matcher also hit unrelated
server-binding `EPERM` failures.

Final verdict: **NO-GO**, because the plan still misstates the byte-equality guarantee.

## Claude Code's check (2026-10-13)

| Claim | Check | Result |
|---|---|---|
| Plan lines 136, 167-169, 177-179 claim byte equality | `grep -n -i byte` on the plan: line 73 ("byte-for-byte", about the prompt text, accurate: the live prompt), 136 ("byte-equal to S1-S12"), 168 ("byte-equal to its committed snapshot"), 174 (G4: whole extracted sections, accurate), 178 (G6 "byte for byte", in the normalized form). The snapshots are compared outside the voice-reference block; the block is pinned by G8's hash. | **Valid**, prose only. Lines 136, 168 and 178 need the qualifier; 73 and 174 stay. |
| Codex could not run the leak check or the full matcher | Both ran clean here: leak check exit 0, full suite 946 pass / 0 fail / 1 skip. | Environment limit of the review sandbox, not a finding. |
