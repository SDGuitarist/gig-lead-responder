---
title: "Codex PLAN review, round 1: clarification-mode validator (reject a stated amount, not the words quote and rate)"
date: 2026-10-13
plan: docs/plans/2026-10-13-fix-clarification-pricing-validator-plan.md (Revision 0 reviewed; Revision 1 answers it)
reviewed_head: b47d283
---

# Round 1 (plan): NO-GO, 3 P1 + 3 P2

One run. Alex's direction (narrow the validator, leave the prompt) was declared fixed; Codex called it "sound".

## Verdict text (verbatim, the attached fix prompt summarised)

NO-GO — the plan is directionally correct, but needs revision before implementation.

### P1

1. **Price-pattern coverage is incomplete** (`plan:51-55`). The proposed pattern correctly catches `$1200`, `$ 850`,
   `$1,200`, `1,500 bucks`, `950 USD`, and `USD 900`, while preserving `100 guests`, `2 hours`, and `2026`. It
   misses real price statements including: `a thousand dollars`, `one thousand dollars`, `around fifteen hundred`,
   `1.5k`. It does catch `$1.2k` because the dollar alternative matches `$1`. The plan must either add explicit
   coverage/tests for these forms or clearly narrow and document the supported price grammar. As written, "reject a
   stated price" overclaims what the validator guarantees.
2. **The safety scan does not match the stated risk** (`plan:73-76`, `129-137`). Quality Gate item 4 says the rerun
   scans spelled-out amounts, but the Execution Path only scans dollar figures, currency-word numbers, internal
   terms, `price`, `cost`, `per hour`. It does not scan spelled-out amounts, `rate`, `starts low`, or package
   language. Also, `postCheckDrafts` only catches certain dollar-based soft-price phrases; it will not
   deterministically catch examples such as "my rate is high." The plan needs to define whether these are
   intentionally outside the invariant ("no stated amount") or add explicit deterministic controls. The 18-run rerun
   must be labeled observational evidence, not proof of recall.
3. **The human execution path is not reproducible enough** (`plan:77-80`, `127-137`). The required runner is only
   described as an approximately 60-line scratchpad file. Another person cannot execute the rerun if that scratchpad
   is unavailable, and the plan gives no exact launch command or complete source. Commit the runner under `scripts/`,
   or include the exact runner contents and command in the plan. This is required because the rerun is a
   pre-code-review gate.

### P2

4. **Mutation V4 does not mechanically prove each internal term remains protected** (`plan:92`, `107-113`). V4 says
   one test covers `anchor`, `floor`, and `investment`, while the mutation map says each alternative is removed in
   turn. If one test draft contains all three terms, removing only `anchor` still leaves `floor` or `investment`, so
   the test passes and the mutation is not killed. Use one independently failing test case per term.
5. **V7's acceptance test is too weak to kill its mutation** (`plan:96-97`, `114`). A test asserting merely
   `/must not include pricing language/` would still pass if the matched text were omitted. V7 must assert the actual
   match, for example that the error contains `$1200` or `800 dollars`.
6. **The D2 logging impact needs an explicit boundary** (`plan:56-58`). The API and dashboard remain client-safe
   (`src/api.ts:315-318` and `331-338` replace the exception with a generic error). However, the new matched text will
   appear in server logs through `console.error`. This is acceptable if intentional, but the plan should specify that
   only the regex match, not the full draft, is included and add a test for the exact error shape.

### Verified non-findings

- `PRICE_SIGNAL_PATTERN` is used only in `src/pipeline/generate.ts:146`.
- The clarification check remains scoped to unresolved one-question mode at `src/pipeline/generate.ts:127-130`.
- The prompt is unchanged and the post-check/COI/payment paths are separate.
- `npm run test:match` correctly exits `1` for failures and `3` for no matches.
- The existing clarification test passes today (the broader process hit three unrelated `listen EPERM` sandbox
  failures).

The proposed direction remains sound: remove bare `quote`/`rate` rejection while retaining concrete pricing signals.
The measured defect is valid; the fix is not yet sufficiently specified.

## Claude Code's check of each finding (2026-10-13, before revising)

| # | Finding | Check | Result |
|---|---|---|---|
| P1-1 | grammar misses real forms | the old and the proposed pattern tested against reject and pass lists; "a thousand dollars" and "1.5k" have no alternative | **REAL.** Revision 1: alternatives 4 (spelled amount + currency word) and 5 (k amount) added; verified 17 reject forms and 15 pass forms, 0 missed, 0 false rejects. "around fifteen hundred" is deliberately OUTSIDE the grammar (it cannot be told from "a hundred guests"), stated as a documented limit and pinned by V10. |
| P1-2 | scan does not match the risk | the Execution Path list lacked spelled amounts, k, rate, starts, package | **REAL.** The invariant is now a table (stated amount vs allowed vocabulary vs documented limit); the runner scans the stated classes and the vocabulary separately; the re-run is labelled observational. |
| P1-3 | runner not reproducible | the runner was a scratchpad file only | **REAL.** Committed as `scripts/clarification-measure.ts` (typed, in `tsconfig` scope, smoke-run once on 1 lead x 1 run); the plan gives the exact command. |
| P2-4 | V4 one test, three terms | one draft containing all three would survive removing one | **REAL.** V4a, V4b, V4c, one term each. |
| P2-5 | V7 weak | prefix-only assertion cannot kill "match omitted" | **REAL.** V7 asserts the exact message including the matched text, for both fields, and that the draft is not in it. |
| P2-6 | D2 logging boundary | `src/api.ts` replaces the exception for clients; logs only | **REAL (spec gap).** D2 states match-only, server-log-only; V7 pins the shape. |

One thing the review did not name, found while answering P1-1: `floor` and `anchor` are ordinary words ("the dance
floor") that the validator has always rejected. 0 of 21 logged generate calls held one. Recorded as a known limit,
not changed (a separate decision).
