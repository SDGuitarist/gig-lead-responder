# Codex code review round 2: vague-gate build, 2026-10-14

**Verdict: NO-GO** (one P2), pasted by Alex. **Reviewed:** the four round 1 fixes at HEAD `cc744d1d7e...`. Prior verdict: R1
NO-GO, `docs/reviews/2026-10-14-vague-gate-code-codex-round1.md`. Codex confirmed the other three fixes; it reported only
sandbox limits otherwise (3 unrelated `listen EPERM` failures, leak check blocked). This is the second NO-GO on the same
change: **automatic iteration stops**; round 3 only with the literal `Round 3 authorized by Alejandro: YES`.

| # | Codex finding | My check | Status |
|---|---|---|---|
| P2-4 | VG10's AST predicate matches only a direct `verifyGate` identifier call: an aliased import, a re-export or a wrapper is invisible, and the plan and test claim an inventory of all production call sites without stating that | CONFIRMED by reading the predicate (`ts.isIdentifier(node.expression)` and the text `verifyGate`). Bounded source inventory, run now: `verifyGate` occurs in `src/pipeline/verify.ts` (definition, two internal calls, one doc mention), `src/run-pipeline.ts` (one import, one call) and the runner (an import and the `--paired` calls), with NO alias, re-export or wrapper | valid; documentation and guard coverage, not an undiscovered call |

Counters: code fix attempts so far 1; Codex code reviews 2 (R1 NO-GO, R2 NO-GO).

## Fix applied (fix attempt 2; Alex chose "Fix the wording and guard, no round 3")

- **Root cause:** VG10's predicate matched only a direct `verifyGate(...)` identifier call, and the plan and test
  claimed a complete inventory without saying so.
- **Fix:** VG10 now classifies every use of the identifier `verifyGate` in non-test `src` files: allowed are the
  declaration, a plain import and a direct call; an `as` alias, a re-export, an assignment or passing it as a value
  FAILS. The plan's VG10 states the remaining limit (a wrapper through a different function name).
- **Test and controls:** the parser control finds a multiline call and ignores a string and a comment; it flags an alias,
  a re-export and an assignment (3 of 3) and allows the real declaration and a plain import. Mutation: a production
  `const verifyGateAlias = verifyGate;` in `src/run-pipeline.ts` FAILS VG10 (caught, then restored).
- **Bounded inventory:** direct calls 3 (`src/run-pipeline.ts:343`, `src/pipeline/verify.ts:93`, `:109`); aliases 0;
  re-exports 0; wrappers 0 in production source (the `as` casts are in tests).
- **No round 3.** Results below.
