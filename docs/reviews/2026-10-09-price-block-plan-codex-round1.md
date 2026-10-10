# Codex PLAN review, round 1: app-inserted NP2 price block

**Plan:** `docs/plans/2026-10-09-feat-app-inserted-price-and-in-kind-lines-plan.md` (`7a35753`; HEAD at review
`1313362`). **Prompt:** the plan-review round-1 prompt (Round 0: NO; SETTLED = Alex's three decisions + no price
changes; the insertion point was explicitly left open to challenge).
**Reader and trigger:** the next session (HANDOFF "START HERE — price-block plan session") applies the accepted
findings to the plan before Work starts; Codex plan round 2 (if any) cites this file as its prior verdict.

**Verdict: NO-GO on BOTH runs.** Run A (Claude Code) = NO-GO (3 P1, 3 P2). Run B (Alex, inside Codex) = NO-GO
(2 P1, 5 P2, 1 P3). Run B repeats all six of run A's findings and adds four (B-new rows below). Both runs: the
design closes both round-3 residues in principle. Next: revise the plan; a plan round 2 may follow (round 1 is
the first Codex verdict; a 2nd NO-GO stops automatic iteration).

## Claude Code check of run A (each finding against the code and the plan)

| # | Finding | Check | Disposition |
|---|---|---|---|
| A-P1-1 | Marker past char 2000 is cut by truncation; a model-written "Alex Guillen" before the marker leaves the block after the sign-off | REAL, but fail-closed for truncation (0 markers -> held, never a wrong price). Sign-off: `ensureSignOff` only appends when "Alex Guillen" is absent, and insertion replaces the marker in place, so the block lands wherever the model put the marker | ACCEPT: state the order (truncate -> insert -> sign-off) in row C; add tests: marker past 2000 is held; marker after a model-written sign-off is held (new post-check condition: block before "Alex Guillen") |
| A-P1-2 | Execution path uses a scratch DB + the Anthropic API, "violating the no-network/no-database constraint" | PARTLY a misread: that constraint was for the Codex REVIEW, not for the plan's execution path, whose purpose is to measure the real model. REAL part: lead texts are described, not given, and expected JSON fields are not exact | ACCEPT the real part: put the 4 lead texts verbatim in the plan and the exact JSON fields/values to read; label step 6 "network-dependent model measurement, Claude Code only, not a Codex step" |
| A-P1-3 | `[[PRICE: Guitarra española]]` is rejected by the ASCII name regex -> false hold | REAL (the prompt asked about it) | ACCEPT: `^\p{L}[\p{L} '&-]{0,39}$` with the `u` flag; EARS test for an accented name |
| A-P2-1 | Non-NP2 byte identity asserted, not proven | REAL | ACCEPT: step 1 first commits a golden test capturing `buildGeneratePrompt` output from the PRE-change code for one-price T2 solo, two-price (large gap), duo, no-viable-scope; the refactor must keep it green |
| A-P2-2 | Missing cases: marker inside a sentence; marker in one draft only; accented name; em-dash fixer vs the block; wrong format name | REAL for the first four. "Wrong format name" (e.g. "Mariachi band" on a solo quote) is outside the plan: Alex chose the model names it, and every NP2 draft is held for Alex | ACCEPT four as EARS tests; record "a wrong but well-formed format name passes" as a known gap |
| A-P2-3 | H3b's fallback (assert identical call-site args) is weaker than proving the re-price path | REAL. Re-price runs only when enrichment changes `format_recommended`; whether that can produce a solo NP2 is not yet known | ACCEPT: step 5 must first establish reachability; if reachable, a fixture; if not, a test that spies on the pricing passed to `generateResponse` and to `postCheckDrafts` in one `runPipeline` call and asserts the same object |

| B-new-1 | Marker plus an ordinary model-written price line | REAL: the model may restate `Solo guitar, $695, 2 hours` beside the marker; a second copy of the app's price line would read as two price lines | ACCEPT: hold when the tail `, <tail>` appears more than once; a bare `$695` in prose stays allowed (written-price check governs it) |
| B-new-2 | A verify rewrite dropping or duplicating the marker | REAL as a test gap (every attempt goes through `generateResponse`, so the contract is the same) | ACCEPT: stubbed test where verify fails once and the rewrite drops the marker -> held; and one where the rewrite keeps it -> block present |
| B-new-3 | No deterministic failed-verify -> regenerate test | Same as B-new-2 | ACCEPT (same test) |
| B-new-4 (P3) | Review-record path `2026-10-1x` typo | REAL | ACCEPT: concrete names |
| A-P1-2 / B-P1-1 (both runs) | Execution path needs network | Both runs ask for an offline path. The real-model run stays: Alex's session rule is "run made-up leads locally first", and only the real model can measure marker reliability | ACCEPT BOTH: (1) a deterministic offline harness (stubbed model, four fixed lead texts, exact expected fields) proves the insertion contract; (2) the real-model run is kept, labeled "network-dependent measurement, Claude Code only" |
| B-P1-2 | Full draft is signed off before truncation today; a naive insert lands after "Alex Guillen" | REAL (`src/pipeline/generate.ts:104-113`: full sign-off happens before the compressed cut) | ACCEPT: exact new order in row C, both platform paths (GigSalad: no sign-off) |

Round-3 residues: run A says the design closes both in principle (structural; no runtime claim, Round 0: NO).

## Run A (Claude Code, `codex exec -s read-only`, 2026-10-09)

Verbatim output saved at the time of the run; worktree and HEAD unchanged after (`1313362`, clean).

```
NO-GO — the plan needs revision before implementation.

P1 — Truncation and sign-off ordering are not guaranteed (plan :68,137-140,255-258). If the compressed model
output places [[PRICE: Solo guitar]] after character 2000, truncation removes the marker; insertPriceBlock sees
zero markers; held. If the model already includes "Alex Guillen" before the marker, ensureSignOff can leave the
inserted block after the sign-off. Specify and test: truncate; insert into both drafts; place/normalize sign-off
after the block. Tests: marker near the truncation boundary; model output already containing a sign-off.

P1 — The stated execution path violates the requested no-network/no-database constraint (plan :208-224). The
command uses a scratch SQLite database and an Anthropic API key; placeholder lead descriptions rather than
concrete fixture contents; no exact expected JSON assertions. Replace with a fully specified local/stubbed path,
or label model runs as a separate network-dependent measurement.

P1 — Unicode format names are explicitly rejected (plan :74-76). [[PRICE: Guitarra española]] remains
uninserted and causes an NP2 hold. Use Unicode-aware letter matching; add the accented-name test.

P2 — Non-NP2 byte identity is asserted but not proven (plan :57-58,82-83,147-150). Add a golden or
representative matrix comparison: ordinary one-price, two-price, duo, no-viable-scope.

P2 — Required mutation cases are missing (plan :129-177): marker inside a sentence must not insert; full has a
marker but compressed does not (only compressed fails); Unicode name; em-dash fixer before/after the block must
not damage it; a valid block whose format name is wrong or ambiguous, if arbitrary names are accepted.

P2 — Final pricing identity described correctly but not enforced strongly enough (plan :68-70,141). H3b's
fallback "assert both call sites receive identical arguments" is weaker than proving the post-enrichment path.
Require a reachable fixture or a direct test/instrumentation proving generation and post-check use the same pair.

Round-3 residue verdict: the design closes both residues in principle. Fail-closed paths (missing, duplicated,
malformed or truncated markers) produce an in_kind_line_* hold, never a successful post-check.
```

(Codex also returned a suggested revision prompt; its six asks are the six findings above.)

## Run B (Alex, inside Codex)

Verbatim (verdict and findings; Codex's suggested revision prompt omitted, its seven asks are the findings).

```
## Verdict: NO-GO

The core approach closes the round-3 shape problem, but the plan needs revision before implementation.

### P1

- Plan §Execution Path, lines 208–224 — not executable offline. src/index.ts requires ANTHROPIC_API_KEY and
  calls the model; venue enrichment may also perform external lookup. The proposed command therefore needs network
  access and a scratch database, contrary to the required offline execution gate.
  Failing scenario: with network disabled, DATABASE_PATH=<scratch>/runs.db npx tsx src/index.ts --json < lead.txt
  cannot produce the expected JSON drafts.
  Fix the plan with a deterministic offline harness using stubbed Claude responses and fixed classification/pricing
  fixtures. Include four concrete lead-text fixtures and exact expected JSON fields.
- Plan §1C and H3 — insertion ordering is not actually guaranteed. Current generateResponse signs off the full
  draft at lines 104–106, truncates the compressed draft at lines 108–113, then signs off the compressed draft. A
  naïve implementation can insert after the full-draft sign-off, or insert before truncation.
  Failing scenario: a non-GigSalad NP2 full draft becomes:
      ...draft text

      Alex Guillen
      Solo guitar, $695, 2 hours
      My standard rate is ...
  The plan must specify the exact order: normalize/truncate model output → insert block → add sign-off, with the
  GigSalad no-sign-off path covered. Add tests for full and compressed drafts, both platform paths, and rewrite
  attempts.

### P2

- Plan §Types/name validation, lines 74–76 — valid accented format names are rejected. ^[A-Za-z...]$ rejects
  [[PRICE: Guitarra española]]. insertPriceBlock leaves the marker unchanged, causing a false hold. Either use a
  Unicode-aware validation rule or explicitly constrain the model to ASCII and document that limitation. Add the
  requested Guitarra española acceptance test.
- EARS coverage misses marker-placement mismatches. There is no explicit test for: marker inside a sentence
  (The [[PRICE: Solo guitar]] would work...); marker present in only one of the two drafts; marker plus an
  ordinary model-written price line; marker with Unicode/accents; em-dash fixer running over a completed block;
  a verify rewrite dropping or duplicating the marker. These cases can reach post-check differently from the
  tested "two whole marker lines" case.
- Pricing consistency is asserted but not fully exercised. The design correctly intends generateResponse,
  runPipeline, runEditPipeline, and rewrite attempts to use the same final classification/pricing. However, H3b's
  fallback ("assert identical arguments") is weaker than testing the actual re-price path, and no test exercises
  a failed verify followed by regeneration. Add one deterministic test that forces a verify failure, then confirms
  both generated drafts and post-check use the same final priceBlockFor(...) result.
- Non-NP2 byte identity is under-tested. H6 mostly checks one-price output. It should also compare the exact
  prompt PRICE LINE text for a two-price scoped alternative and a no-viable-scope case against the pre-change
  fixture/output.
- Feed-Forward remains only partly addressed. Marker reliability is measured on only three model-generated leads,
  and the proposed measurement cannot run without network access. The deterministic tests should establish the
  insertion contract offline; the model reliability measurement should be clearly labeled as a separate,
  network-dependent experiment.

### P3

- Documentation path typo, plan lines 72 and 228: docs/reviews/2026-10-1x-price-block-local-runs.md should be
  2026-10-09.... This would make the execution record difficult to locate.

### Required verdict questions

1. Round-3 residues: The design closes both residues in principle. A prose sentence such as I can make $695 work
   for 2 hours cannot satisfy the anchored app-written block, and in  kind is covered by the proposed
   whitespace-tolerant regex.
2. Insertion/pricing consistency: No inherent stale-pricing path exists if every call site uses the final pair.
   The plan does not yet prove this for rewrite loops or the actual enrichment re-price path.
3. Ordering: Not guaranteed as written. The full-draft sign-off order is ambiguous and must be made explicit with
   tests.
4. Non-NP2 byte identity: Plausible, but insufficiently proven for all PRICE LINE variants.
5. EARS mutations: Several requested mutations are missing, especially inline/one-draft markers, Unicode names,
   rewrite duplication/drop, and em-dash interaction.
6. STOP/Execution Path: Not executable without model/network access, and the lead fixtures are descriptions rather
   than concrete text inputs with exact expected output.
```
