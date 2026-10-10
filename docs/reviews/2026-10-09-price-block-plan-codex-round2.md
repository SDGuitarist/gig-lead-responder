# Codex PLAN review, round 2: app-inserted NP2 price block

**Plan:** `docs/plans/2026-10-09-feat-app-inserted-price-and-in-kind-lines-plan.md` at `c018628` (revision 1).
**Prior verdict:** round 1 NO-GO on both runs, `docs/reviews/2026-10-09-price-block-plan-codex-round1.md`.
**Reader and trigger:** the next session (HANDOFF) and the CODE review round 1 prompt, which cites this file.

**Verdict: NO-GO on BOTH runs. This is the 2nd NO-GO on this plan: automatic review iteration STOPS.** Round 3 of
plan review only with `Round 3 authorized by Alex: YES`. Fixes are applied to the plan under the fix contrac
(plan "Revision 2"); applying them is not a review round.

## Claude Code check (every finding against the code and the plan)

| # | Run | Finding | Check | Fix (plan revision 2) |
|---|---|---|---|---|
| 1 | A+B (P1) | Condition (6) "before the LAST line containing Alex Guillen" holds a correct draft that mentions the name mid-body; `ensureSignOff` uses `includes("Alex Guillen")`, so a mid-body mention also suppresses the appended sign-off | REAL; introduced by revision 1 | (6) uses the sign-off LINE: the last line whose trimmed text is exactly `Alex Guillen`; the block must precede it; with no such line, (6) does not apply. Positive tests: mid-body mention before / after the block, real terminal sign-off, GigSalad. The `ensureSignOff` mid-body suppression is pre-existing behaviour, recorded as a known gap, not changed (outside scope) |
| 2 | A (P2) | Organization "In Kind Foundation": the app's own sentence holds two in-kind matches; a correct draft fails (3) | REAL (rare) | (3) counts in-kind mentions in the draft with the app's block removed: must be 0. Regression test with that name; an extra model-written in-kind sentence still fails |
| 3 | A (P2) | H6 golden provenance is a procedural claim; "before any src/ edit" is impossible (the fixture is under src/) | REAL | Step 0 = one commit that ADDS only the fixture + its test; verification: that commit precedes every commit touching `src/prompts/generate.ts`, and `git log --oneline -- src/fixtures/price-line-golden.json` shows exactly one commit at the end of the work |
| 4 | A+B (P2) | STOP rule undefined for 0 or 1 NP2-priced leads | REAL | Stricter (B): fewer than 2 NP2-priced runs = STOP, "insufficient sample", regardless of marker success; record all outputs; Alex decides (re-run, re-word, or proceed) |
| 5 | B (P1) | H7 sets `venue_name` null but expected lead (a)'s block to name the venue | REAL contradiction | H7 expects the no-venue sentence; the venue form is covered by the pure tests (H1 and the existing venue test) |
| 6 | B (P2) | E12's abbreviated copy is not what condition (5) catches | REAL | (5) becomes: the structured core `$<total>, <h> hour(s)` occurs exactly once in the draft (catches a full or shortened copy of the price line); prose "$695 for two hours" is not that shape and stays allowed. E12's fixture uses the shortened copy |
| 7 | B (P2) | H3b does not say how it observes the final pricing | REAL | H3b asserts each returned draft contains `insertPriceBlock` output of `priceBlockFor(result.classification, result.pricing)`; the re-price-cannot-yield-NP2 proof (row C) plus its pure pin test is stated as the complete basis for no mismatch test |

Round-3 residues: both runs, both rounds: closed by the design in principle.

## Run A (Claude Code, `codex exec -s read-only`, 2026-10-09; HEAD `c018628`, clean after)

```
NO-GO — this is the second NO-GO for this plan. Automatic iteration stops; round 3 requires Alejandro’s explicit authorization.

Round-1 dispositions:

- A-P1-1 — FIXED. Row C now specifies truncate → insert → sign-off, with H3/E9/E15 coverage.
- A-P1-2 — FIXED. The offline harness is separate from the explicitly network-dependent model run.
- A-P1-3 — FIXED. Unicode-aware name validation and H13 are included.
- A-P2-1 — PARTLY FIXED. H6 now covers five variants, but pre-change capture is not mechanically protected.
- A-P2-2 — PARTLY FIXED. Four cases are tested; wrong-but-well-formed format names remain a documented accepted gap.
- A-P2-3 — FIXED. The enrichment path is correctly shown unable to produce NP2.
- B-new-1 — FIXED. Condition (5) and E12 reject duplicate price tails.
- B-new-2 — FIXED. H3b tests rewrite retention and marker loss.
- B-new-3 — FIXED. The failed-verify/regeneration path is explicitly covered.
- B-new-4 — FIXED. Concrete review-record paths replace `2026-10-1x`.
- Consolidated execution-path finding — FIXED.
- Consolidated sign-off-order finding — FIXED in the intended implementation order, but condition (6) introduces a new false hold below.

Findings

P1 — False hold from condition (6)
Plan §1C/§1D, lines 77–78; E15, lines 221–222.

The rule “the block line comes before the LAST line containing `Alex Guillen`” rejects a potentially correct draft:

```tex
I’m Alex Guillen, and I’d shape the music around the room.
[[PRICE: Solo guitar]]
```

Because `ensureSignOff` sees `Alex Guillen`, it does not append the normal sign-off. The block is after the only `Alex Guillen` mention, so condition (6) holds the draft even though the block was inserted in the specified order. This applies to ordinary non-GigSalad drafts. E15 currently treats this as an error rather than distinguishing a real trailing sign-off from a mid-body identity mention.

P2 — Correct organization name can create a second “in-kind” match
Plan §1D, line 78; condition (3).

The proposed count scans the entire draft with:

```tex
/\bin\s*-?\s*kind\b/gi
```

But organization names allow ordinary words and spaces. For example:

```tex
organization_name = "In Kind Foundation"
```

produces an app-written sentence containing both:

```tex
in-kind contribution to the In Kind Foundation
```

The regex counts two mentions, so the correct app-generated block fails the post-check. The check should validate the fixed sentence/block structure without counting arbitrary text inside the organization name as an extra in-kind mention.

P2 — H6 provenance is asserted but not enforceable
Plan H6, lines 168–173; work step 0, line 236.

The listed five variants are appropriate, but “captured from the pre-change code” is only a procedural claim. The instruction “commit before any `src/` edit” is also literally impossible because the fixture and test are new files under `src/`. A future implementation could regenerate the golden strings after changing `buildPriceLineBlock`, and the test would still pass.

Clarify that step 0 must capture from the unchanged implementation before modifying existing source, and add a mechanically independent baseline or recorded command/output proving the capture occurred first.

P2 — STOP rule is ambiguous with fewer than two NP2-priced leads
Execution Path, lines 298–300.

The rule says to stop if markers are missing in every NP2-priced run when fewer than two are priced. It does not clearly define:

- what happens when zero leads are NP2-priced;
- whether one successful NP2-priced run is enough evidence;
- whether “every one” means every attempted lead or only the priced subset.

The expected outcomes permit all three candidate leads to be non-NP2, leaving no marker-reliability measurement. State the exact outcome for 0 and 1 priced leads.

Checks requested

- Row C order: correct; it matches current `generate.ts` lines 104–113 and covers both sign-off and GigSalad paths.
- Conditions (5) and (6): condition (6) has the P1 false hold above. The duplicate-tail rule itself is sound for normal NP2 data; the current NP2 standard price is necessarily at least $100 above the quote, so the fixed in-kind line should not contain the quote tail.
- Whole-line marker and Unicode rule: correct for composed Unicode letters and inline-marker rejection. Combining-mark names remain unsupported, but that is not a stated accepted input.
- Enrichment re-price claim: correct. `resolveFormatRouting` only changes mariachi formats, while NP2 is available only through the solo NP2 table.
- H6 variants: the five listed cases cover the planned non-NP2 price-line shapes, but capture provenance needs tightening.
- H7: the `venue_name: null` claim is correct for avoiding `lookupVenueContext` and `logVenueMiss`; the four leads also contain no ZIP, so no travel lookup is activated. The scratch database is still opened by the CLI, as explicitly documented.
- Execution Path: the four lead texts and expected fields are concrete. The STOP rule needs the clarification above.
- Plan Quality Gate: all five questions are present, including a concrete Mac execution path and trigger.

Compound-start surfaced two relevant lessons: use a single final pricing object after enrichment, and treat restrictive regexes as needing both positive and boundary cases. Both informed the findings above.
```

## Run B (Alex, inside Codex, 2026-10-09)

Condensed verbatim (wording kept; failing-scenario code blocks inlined; suggested fix prompt omitted, its five asks
are rows 1, 4, 5, 6, 7).

```
## Verdict: NO-GO

This is the second NO-GO for the plan. Per the review rules, automatic iteration stops; Round 3 requires
Alejandro's explicit authorization. Round-0 remains NO: no execution performed.

### Round-1 finding disposition
- A-P1-1: FIXED   - A-P1-2: FIXED   - A-P1-3: FIXED   - A-P2-1: FIXED
- A-P2-2: FIXED as scoped; the wrong-but-well-formed format name remains an explicitly accepted gap.
- A-P2-3: FIXED; the enrichment routing and NP2-only pricing logic support the claim.
- B-new-1: PARTLY FIXED; condition 5 only catches an exact tail copy, while E12's example uses an abbreviated tail.
- B-new-2: FIXED   - B-new-3: FIXED   - B-new-4: FIXED   - Combined execution-path finding: FIXED
- Full-draft ordering finding: PARTLY FIXED; the insertion sequence is clear, but condition 6 introduces a new
  false-hold problem below.

### P1 findings
- Plan §1D line 78; E15 lines 221-222 — condition 6 falsely holds valid drafts mentioning "Alex Guillen"
  mid-body. The rule treats every occurrence as a sign-off. Failing scenario: "Alex Guillen handles setup and
  breakdown personally." in the body; if the model mentions Alex after the block, it becomes a false hold. Also
  ensureSignOff() checks draft.includes("Alex Guillen"), so a mid-body mention can suppress the appended sign-off.
  Needs a precise sign-off definition (an exact terminal sign-off line). Add positive tests for a mid-body mention
  before and after the block.
- H7 lines 174-179 conflicts with the offline setup at lines 265-267: H7 requires venue_name null, but its
  expected result for lead (a) says the block has the venue named. With venue_name null, inKindSentence() produces
  "My standard rate...", not "My standard Example Grand Hotel rate...". Expect no venue in H7, or test venue-name
  insertion separately.

### P2 findings
- Execution Path STOP rule lines 292-300 still ambiguous when fewer than two leads are NP2-priced. Define: if
  fewer than two NP2-priced runs exist, stop as "insufficient sample," regardless of marker success.
- B-new-1 / E12 lines 213-215 — condition 5 counts the exact ", <tail>" string, but E12 shows an abbreviated
  "Solo guitar, $695, 2 hours | Professional sound, ..."; a model copy omitting the included clause is not caught.
  Specify exact-duplicate-only or any second structured price line with the same amount/hours; make fixture and
  predicate agree.
- H3b lines 156-162 — the rewrite test verifies marker behavior but not the claimed final pricing identity; i
  does not state how it observes the arguments passed to generation and post-check. Add an explicit assertion on
  the final pricing object or document that the unreachable-branch proof is the complete basis.

### Plan Quality Gate
The five questions are now answered. H7's venue contradiction and the ambiguous STOP rule still preven
implementation. The Unicode rule and whole-line marker rule are sound. The enrichment re-price claim is sound.
(Codex could not inspect running processes: the OS denied ps; the repository gate itself passed exactly.)
```
