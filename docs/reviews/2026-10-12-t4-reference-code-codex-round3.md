---
title: "Codex CODE review, round 3: T4 reference lead (the T7 fix only)"
date: 2026-10-12
plan: docs/plans/2026-10-11-feat-t4-reference-lead-plan.md (Revision 1d)
code_reviewed: c2f9aba..05d25a1 (the fix is 8536db1; a4999c7 and 05d25a1 are documentation)
prior_verdicts: docs/reviews/2026-10-12-t4-reference-code-codex-round1.md (NO-GO), docs/reviews/2026-10-12-t4-reference-code-codex-round2.md (NO-GO, stricter of two recorded verdicts)
authorization: "Round 3 authorized by Alejandro: YES" (his words, 2026-10-12: "you are authorised for round three, yes")
---

# Round 3 (code): NO-GO, classification (c). THE CAP HAS FIRED. There is no round 4.

One verdict recorded (one run).

## Verdict text (verbatim)

**T7 fix: FIXED BUT INTRODUCES a P2 lexical false-green bypass.**

- Exact title binding is correct at `src/port-manifest.test.ts:130-133`.
- All six rows have unique exact titles at `:114-122`; duplicate titles fail at `:152-154`.
- R025's constant-to-marker relationship remains enforced at `:155-157`.
- The self-tests correctly pin exact binding and negation handling at `:173-200`.

However, `assertsPositively` at `src/port-manifest.test.ts:135-138` trusts any line containing the marker and `assert.`.
A trailing comment such as:

```
assert.ok(block.includes("other")); // REFERENCE LEAD: T4 CORPORATE
```

is accepted as positive evidence. I reproduced this mutation: `comment_mutation_would_pass: true`. A multiline real
assertion is rejected, conservatively, but comments remain a false-green bypass.

New defects:

- **P2:** `src/port-manifest.test.ts:135-138` can mistake a comment or trailing comment for a positive executable assertion.
- No production defects.

Focused tests: **45 passed / 0 failed**. Typecheck: clean. The broader matcher still has the unrelated sandbox
`listen EPERM` failure in `payment-terms-approve.test.ts`.

**(c) NARROWING same-class residue landing on ONE surface** — `src/port-manifest.test.ts`. The exact-title prefix
problem is fixed, but lexical source parsing remains the wrong shape for proving executable assertions. The cap fires.
There is no Round 4.

## Claude Code's check (2026-10-12, read-only; nothing edited after the verdict)

- **Finding is real, by reading `assertsPositively`.** It accepts a line when the line contains the needle, contains
  `assert.`, and has no `!x.includes(`. A trailing `// <marker>` comment on any assert line therefore passes.
- **What it does and does not weaken.** The accidental case it exists for (someone deletes an assertion) is caught: all
  six rows fail under deletion (mutation run, `8536db1`). The bypass needs the marker typed into a comment on an
  assertion line, which is a deliberate act. Multi-line assertions are rejected, which fails safe (a false RED, not a
  false green).
- **What it does not touch.** No production code, prompt, price or customer text. The block's content is also asserted
  directly by `T4 reference T1`-`T4` tests; T7 only ties manifest rows to those tests.
- **Per the pre-registered budget:** automatic fixing and reviewing STOP. No round 4 prompt. The choice below is Alex's.

## Options put to Alex (the template's three)

1. **Different approach:** stop parsing source text. Export each marker as a constant from `src/data/t4-reference.ts`
   and have T7 import them, so a row's marker is not a string in a regex over a file. (A new design; needs its own
   review.)
2. **Revert** T7 to the round 1 version (statuses only).
3. **Accept** the residue: keep `8536db1`, record the limit in the test's comment and here.

Recommendation: see HANDOFF Update 8.
