# Codex PLAN review, round 1: PF-Intel facts are not Alex's experience

**Plan:** `docs/plans/2026-10-11-fix-pf-intel-facts-are-not-alexs-experience-plan.md` at `58ff1ba`. Prior Codex
verdicts: none. **Pre-registered stops:** a 2nd NO-GO stops automatic iteration (round 3 only with Alex's YES); a 3rd
NO-GO is the hard cap. **Reader and trigger:** plan Revision 1; the round-2 prompt.

**Verdict: NO-GO on BOTH runs; the stricter verdict is run A (P1).** Both runs: the root-cause fix is sound, D2's
inventory is complete (only `formatVenueContext` renders PF-Intel data; both pipeline paths reach it via
`selectContext`; follow-ups do not), and D3 is defensible while every lead is held.

| # | Runs | Finding | Disposition |
|---|---|---|---|
| 1 | A P1, B P2 | F5 judging rule: borderline not defined as a failure (A); "first-person" contradicts counting "easy load-in at Tom Ham's" (B) | Revision 1: claims judged by meaning, with examples; borderline = fail; disagreement can only turn a pass into a fail; Alex final |
| 2 | B P2 | one run per lead cannot show stable zero (output is stochastic) | Revision 1: 3 sentinel leads x 3 runs + 3 single leads = 12 runs, 24 drafts, 0 allowed; labelled a smoke test |
| 3 | A P2, B P2 | F1/F4 do not pin the wording: appending "You may say so." to the PF-Intel text passes F1 (B); permission once and in the right section (A P3) | Revision 1: F1 pins the exact text + a forbidden-phrase list; F4 exactly once and only after the venue-history header; new mutations |
| 4 | A P2 | D1's example reads as a venue rule, not Alex's plan | Revision 1: "I'll plan the last set to finish by 9:45" |
| 5 | A P2 | 12 drafts is a smoke test; "uses a vendor policy" undefined | Revision 1: report "0 observed in 24"; a policy use = a fact present in that lead's recorded lookup |
| 6 | A P3 | the formatter's "omit all-null sections" comment becomes misleading | Revision 1: comment states the policy |

## Run A (Claude Code, `codex exec -s read-only`, 2026-10-11; HEAD `58ff1ba`)

```
NO-GO — Round 1.

The plan addresses the measured root cause: it removes the “insider edge” instruction, drops PF-Intel performance history and contacts, and preserves vendor policies plus the private venue-history section. I found these gaps:

### P1

- **Plan §F5 / judging rule:** The pass/fail rule is ambiguous. It says borderline lines are “not counted as passes,” but does not explicitly say whether they are failures. Two readers could therefore report 0 claims while treating the same line differently.

  Concrete failure: one reader treats “easy load-in at Tom Ham’s” as a claim; another treats it as harmless logistics language. The same 12 drafts receive different results.

  Fix: define each draft as independently passing only when it contains no claim or implication. Any borderline line is a failure/STOP condition and remains in the record. Keep the denominator fixed at 12.

### P2

- **Plan §D1:** The example is safer than the old example, but its agency is still unclear:

  > “Estancia's outdoor curfew is 10 PM, so the last set ends by 9:45.”

  This can be copied as an asserted venue-specific schedule rather than Alex’s plan. Use explicit first-person planning language, for example: “The venue’s outdoor curfew is 10 PM, so I’ll plan the last set to finish by 9:45.”

- **Plan §F5 / §3:** Six leads and 12 drafts are enough for a bounded regression smoke test, especially against the prior 4/6 false-claim result, but not enough to support a general claim that the defect is gone. A rare failure could still pass 0/12.

  Fix: label the result explicitly as “0 observed in 12 sampled drafts,” not “zero claims” generally, and record the limitation. The positive control should also define what counts as “uses a vendor policy.”

### P3

- **Plan §1 / `format-venue-context.ts`:** The existing comment says sections are omitted when all-null, but after D2 contacts and performance history are intentionally ignored even when populated. Update the comment and add a test comment explaining that this is a policy decision, not merely null-data handling.

- **Plan §F1/F4:** Add an assertion that the PF-Intel usage text appears only in the PF-Intel section and that the venue-history permission appears exactly once. This protects against future prompt assembly changes reintroducing the two permissions in the wrong section.

The PF-Intel data-flow inventory is otherwise complete: both first-draft and edit paths call `selectContext`; `formatVenueContext` is the only formatter for contacts, event history, and vendor policies; follow-up generation does not receive PF-Intel context. D3 is defensible while every lead is held for Alex’s approval, provided F5 remains a measurement—not a permanent safety guarantee.

```

## Run B (Alex, inside Codex, 2026-10-11; HEAD `58ff1ba`)

```
NO-GO — three P2 plan findings. The root-cause fix is sound, and I found no other PF-Intel path into generation/edit prompts beyond `run-pipeline.ts` → `selectContext()`.

P2 — F1/F4 do not fully pin the safety wording
Plan sections: D1, F1, F4, work step 2.

Concrete failure: append `You may say so.` to `PF_INTEL_USAGE`. F1's listed assertions still pass, and F4 only requires the full permission sentence to appear in the venue-history section. The unsafe permission fragment can therefore reach the PF-Intel section.

Fix: assert the literal D1 prohibition text or explicitly forbid all experience terms (`knows`, `has played`, `has been to`, `familiar`, and `You may say so.`) in the PF-Intel usage block. Assert the permission sentence appears exactly once and only in the venue-history section.

P2 — F5's manual judging rule is internally inconsistent
Plan lines 108–111.

Concrete failure: `easy load-in at Tom Ham's` is explicitly a claim, but the definition first says a claim must be first-person. Two reviewers could disagree about outputs such as `Tom Ham's has an easy load-in` or `The load-in is straightforward`.

Fix: define claims by meaning, not grammar—any wording that attributes prior venue knowledge or experience to Alex, whether first-person or implied—and provide positive and negative examples. Specify how disagreements are resolved before counting F5.

P2 — six one-shot leads do not establish stable zero leakage
Plan sections 3–4, F5, Execution Path.

Concrete failure: all 12 drafts pass once, but a repeat of the same leads produces one familiarity claim because model output is stochastic. F5 still passes because each lead runs only once.

Fix: either repeat the sentinel leads and require zero claims across all runs, or explicitly label F5 as a smoke test and add a follow-up repeat criterion before treating the result as evidence that the defect is closed. The measured 2-of-3 defect warrants more than one sample per lead.

D3 is defensible: current leads are held for Alex's approval, and the plan has a stop-and-report rule if the real-model runs still leak claims. D2 is complete for the current code: `formatVenueContext()` is the only renderer, and both initial generation and edit paths call `selectContext()`.

I made no changes and did not access `~/Data/`, PF-Intel, the model, `data/leads.db`, or runtime services.

[Fix handoff omitted here: gate at 58ff1ba; revise the plan only; the three findings above; preserve D1-D3 and
everything in "What must not change"; exact commands or a human judging procedure for every criterion.]
```
