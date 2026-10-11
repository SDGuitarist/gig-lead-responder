# Codex PLAN review, round 3: payment terms by lead time

**Plan:** `docs/plans/2026-10-11-fix-payment-terms-by-lead-time-plan.md` at `d84228b` (Revision 2). **Round 3
authorized by Alejandro: YES** (2026-10-11, after the 2nd NO-GO). Prior Codex verdicts: round 1 and round 2 NO-GO on
both runs. **Reader and trigger:** Revision 3; the work phase.

**Verdict: NO-GO on BOTH runs. HARD CAP fired: no round 4.** Both runs: every round-2 fix closed (P10 gate assertion,
P12 edit past-date flag, P13 unknown-platform precedence, P8 provenance by regeneration). Remaining findings are all
concrete and checkable; all fixed in Revision 3 under the fix contract, and the work starts on it. The next independent
check is the Codex CODE review after the build.

| # | Runs | Finding | Disposition (Revision 3) |
|---|---|---|---|
| 1 | B P1 | The `unknown_platform` prompt says "the platform handles payment": false for a Thumbtack lead (client pays Alex); generic "payment" not in the word list | FIXED: `unknown_platform` gets its own line that claims nothing ("Say nothing about payment"); `\bpayments?\b` added to the word list (never musician prose) |
| 2 | A P2 | The execution sample counts a lead by kind only; `one_question` with a resolved format still yields kind `platform` | FIXED: a lead counts only if `action` is "quote" or "assume_and_quote" AND the kind is the expected one; a predicate test with a mutation (`action` → "one_question" must not count) |
| 3 | B P2 | P10's mutation (post-check terms for 2026-10-12) stays in the same band, so it cannot fail | FIXED: the mutation uses 2026-10-10 (15 days → two-weeks sentence), which crosses the band |
| 4 | B P2 | P14: the CLI exits 1 on a missing API key before it could reject `--platform thumbtack` | FIXED: argument parsing and validation run before the key check; the test spawns the CLI with an empty key and expects usage + exit 2 |

## Run A (Claude Code, `codex exec -s read-only`, 2026-10-11; HEAD `d84228b`)

```
## NO-GO — Round 3 hard cap

Identity gate passed: branch `feat/hub-phase0`, HEAD `d84228bff0f2e5c053b250646edbe7c792f075f1`, clean worktree.

### P2 — Execution sample still accepts non-quote classifications

Plan: `docs/plans/2026-10-11-fix-payment-terms-by-lead-time-plan.md:242-247`.

Revision 2 prints `classification.action`, but the fail-closed rule only requires the expected `PaymentTerms.kind`. It never requires `action === "quote"`.

Concrete failing input:

- lead **b**
- `platform = "gigsalad"`
- model classification: `action: "one_question"`, `format_recommended: "solo"`
- resulting kind: `"platform"`
- drafts contain no payment words

The sample counts this lead as valid because kind is `"platform"`, even though it was not a quote. The named round-2 mutation—changing the classification action from `"quote"` to `"one_question"`—therefore does not fail.

Required correction: require the expected action (`"quote"`; or explicitly define whether `"assume_and_quote"` is valid) before counting a lead, and add a mutation test proving the count fails when action changes.

Label: `executable`.

### Round-2 fix verification

- P10 final post-check assertion: closed by the stated expected-sentence/old-sentence control and mutation.
- P12 edit past-date flag: closed by sharing `isPastDate` between enrichment and edit flow.
- P13 unknown-platform precedence and flag: correct—exclusions, known platform, then unknown `P`.
- P14 CLI validation: specified sufficiently for known and unknown platform values.
- P8 provenance: the clean detached worktree plus regeneration diff catches fixtures captured from edited-then-reverted source. It proves reproducibility, not semantic correctness of the historical source itself.

This is the third NO-GO. The hard cap fires: no round 4. The remaining known limit is the execution evidence accepting a non-quote classification.

[fix handoff omitted]
```

## Run B (Alex, inside Codex, 2026-10-11; HEAD `d84228b`)

```
## NO-GO — Round 3

This is the hard-cap NO-GO. No round 4 should be proposed.

Findings:

- **P1 — Unknown-platform prompt says something false.**
  Plan `D3`, lines 78–80 and 96–104.

  Concrete input: a hand-run lead with `platform: undefined`, `lead_source_column: "P"`, and a future date, representing a Thumbtack lead. The plan selects `unknown_platform`, but instructs the model: “the platform handles payment.” Thumbtack clients pay Alex directly, so this is false and violates the settled “no payment sentence + flag” rule. The post-check also permits generic “payment” wording.

  The unknown-platform prompt must prohibit payment claims entirely, while retaining `payment_terms_platform_unknown`.
- **P2 — P10’s mutation is not guaranteed to fail.**
  Plan `P10`, lines 182–187.

  Concrete mutation: compute post-check terms with `today = "2026-10-12"` instead of `"2026-10-11"` for event `"2026-10-25"`. Both dates still select full payment, so the exact full-payment sentence passes and the test remains green. The mutation must cross a band boundary, such as `"2026-10-10"` or `"2026-10-26"`.
- **P2 — P14 does not specify validation order, so its required exit behavior is not reliable.**
  Plan `P14`, lines 196–197; current `src/index.ts:8-15`.

  Concrete input: `echo "lead" | env -u ANTHROPIC_API_KEY npx tsx src/index.ts --platform thumbtack`. The current CLI exits `1` for the missing API key before it can print usage and exit `2` for the invalid platform. The plan needs an explicit deterministic validation path and test command, including behavior when the API key is absent.

What is closed:

- P8 provenance is materially fixed by regenerating through a clean worktree.
- P12 correctly requires reapplying the past-date check in edit runs.
- P13’s unknown-platform flag and the execution sample’s quote-kind fail-closed rule are specified.
- The execution sample dates and expected bands are correct.

The starting repository identity and clean-worktree gate passed. The process inspection itself was blocked by macOS permissions (`ps: operation not permitted`), but there was no HEAD drift or dirty-worktree evidence of another writer.
```
