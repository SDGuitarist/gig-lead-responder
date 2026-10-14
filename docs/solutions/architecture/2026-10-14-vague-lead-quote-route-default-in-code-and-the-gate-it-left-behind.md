---
title: "Vague-lead quote route: the default format lives in code, and the verify gate still scopes its opening rule to the old mode"
category: architecture
tags: [classifier, default-format, generate-prompt, reference-block, two-arm-measurement, regression, plan-review, codex-review, observational-evidence, verify-gate]
module: src/pipeline/classify.ts, src/prompts/generate.ts, src/data/vague-quote-reference.ts, src/route-metrics.ts, scripts/clarification-measure.ts
symptom: "A vague, low-competition lead got a no-price clarification draft, while Alex's own reply to such a lead quotes a default format with one binary question."
root_cause: "The route was 'clarify first'; Alex's rule is 'default to solo guitar, quote that default, ask one question'. The classifier prompt could not carry the default without moving ordinary leads."
date: 2026-10-14
model: claude-sonnet-5-5
predecessor: architecture/2026-10-13-internal-pricing-terms-are-rejected-as-compounds-not-as-words.md
related:
  - docs/plans/2026-10-13-feat-vague-lead-quote-with-question-plan.md
  - docs/reviews/2026-10-13-classifier-regression-baseline.md
  - docs/reviews/2026-10-13-classifier-regression-after.md
  - docs/reviews/2026-10-13-vague-quote-plan-codex-round1.md
  - docs/reviews/2026-10-13-vague-quote-plan-codex-round2.md
  - docs/reviews/2026-10-13-vague-quote-code-codex-round1.md
  - docs/reviews/2026-10-13-vague-quote-code-codex-round2.md
  - docs/reviews/2026-10-13-vague-quote-measurement.md
  - docs/reviews/2026-10-14-vague-quote-final-prompt-measurement.md
  - docs/reviews/2026-10-14-vague-quote-false-checks.md
---

# A vague lead gets a quoted default and one question; the default belongs in code

## Prior Phase Risk

> "The ensemble word match (a false match or a miss changes the route), that the block's example is not copied
> (arm B reports shared windows), and that Revision 2 had no plan review." (HANDOFF Update 19, least confident)

All three materialised in part. The ensemble match has a documented conservative boundary ("the bride's group");
the example IS partly reused (30 of 50 final-prompt drafts share a window outside the mandated sentences); Revision 2
got its first independent look in code review, which found no defect in the mechanism itself.

## Problem

Alex's own reply to a category-only lead (written in his Claude.ai Project) quotes the default format with a price and
asks one binary question. The app instead produced a no-price clarification draft. Two attempts to teach the
classifier the default failed or were rejected: a classifier prompt wording edit moved ordinary leads (L1 flamenco duo
7/15 to 14/15, p 0.007; L7 quote 0/15 to 4/15, p 0.05) in a before/after regression, so it was reverted.

## Solution (what ships)

| Piece | What it does |
|---|---|
| `defaultVagueFormat` (`classify.ts`) | in code, after the classifier: a vague `one_question` lead with an unresolved format and no ensemble word becomes `solo` (or `duo` for dinner/cocktail/dancing); the classifier PROMPT is pinned by SHA-256 |
| Reference block (`vague-quote-reference.ts`, `generate.ts`) | Alex's reply (footer dropped, placeholder price, the app's payment and COI sentences) shown for ORDER; gated like T4 plus payment kind, nonprofit, cultural, T4 |
| Setup sentence | allowed verbatim ONLY when compatible with the lead (Codex R1/R2) |
| Route metrics | pre-registered formulas; failed runs labelled by stage (R1 finding 2) |
| Limits | a stored pre-change classification keeps its route (plan Revision 2b, V10a) |

Evidence: 1061 pass / 0 fail / 1 skip; mutation map 14 rows each killed; Codex plan R1 NO-GO (5 P1), R2 NO-GO
(1 P1); Codex code R1 NO-GO (3 P1, 1 P2), R2 NO-GO (1 P1), each fix recorded.

## What the measurement showed (50 runs per arm, one model, made-up leads, descriptive)

| | Earlier prompt | Final prompt (`2aa57e1`) |
|---|---|---|
| Quote at the app's price / no footer | 50 / 50, 50 / 50 | 50 / 50, 50 / 50 |
| Verified | 20 / 50 | 10 / 50 |
| Unusable | 12 / 50 (24%) | 13 / 50 (26%) |
| Shared windows above 0 | 44 / 50 | 30 / 50 (setup sentence now cut) |
| Words, median | 199 | 203 |

**17 of the 40 unverified fail `lead_specific_opening` alone**; 33 of 40 fail it with or without others.

## How it got there (what each step taught)

1. **A prompt-wording edit cannot be unit-tested; a before/after regression can.** The wording looked right on the
   three leads it was written for and shifted two it was not written for. A deterministic default in code removed the
   unmeasurable part.
2. **Alex's own words beat my candidates.** Three drafted reference candidates failed or passed for reasons I had
   predicted wrongly; his reply, with the footer dropped, passed the real gate 3 of 3.
3. **Revision 2 changed the mechanism after the plan review.** The plan review cap was spent, so the code review had
   to say "this mechanism has no plan review" and ask for a design check. It was the right instrument for it.
4. **A permission needs a condition.** "You may use this sentence" turned a true fact about a rig into a possible
   false claim about a lead. Codex found it in round 2; the test now pins the condition.
5. **Spend limits void arms silently.** 28 of 50 runs returned an API error and the report printed a 66% "unusable"
   rate before I read the log. The arm was recorded as void; the metric now labels failure stage.
6. **My snapshot script run rewrote a committed baseline.** Running a script "to look at its output" regenerated a
   fixture, `git add -A` committed it, and G6 failed; V7 failed from my regenerated hashes. Restore from the prior
   commit; do not run snapshot writers to read.
7. **Moving a lead out of a mode moves it out of that mode's relaxed rules.** The plan-1 gate-opening rule applies to
   `one_question` + unresolved; giving the lead a default format left it under the strict opening rule.

## What this does NOT fix

- **The verify gate for a vague lead with a resolved default** (17 of 40 fail on the opening alone). Needs its own plan
  and a measured arm (Alex chose "compound now").
- **Length:** median 203 words against about 100 in Alex's reply.
- **Copying:** 30 of 50 drafts still share a clause-level window; whole-sentence reuse is rare (1 draft).
- **"Exactly one question":** 33 of 50 in the final arm, and 12 of 122 earlier; untouched.
- **The conditional setup sentence:** no lead in the set contradicts it, so the judgment is unmeasured.
- **Verified 20 to 10:** a single sample of each, unexplained beyond the gate cause above.

## Prevention

- **When a prompt change cannot be tested, move the decision into code** and keep the prompt pinned by hash.
- **Run a before/after regression on ordinary leads** before keeping any classifier wording change.
- **A reference block's permissions need conditions**, and its copy check must name what it exempts.
- **Read the API error log before reading the rate** of a failed arm.
- **Never run a snapshot writer to look at output**; use the verify-only mode.
- **Check every mode-scoped rule when a lead changes mode.**

## Feed-Forward

- **Hardest decision:** default format in the classifier prompt versus in code after the regression.
- **Rejected:** deleting clarification mode; a runtime copy rejection (ends in no draft); re-resolving stored leads on
  edit (no raw text, unresolved pricing); a third Codex round on one wording sentence.
- **Least confident:** that the verify-gate opening rule is the whole reason 40 of 50 drafts failed; I read counts and
  two reasons, and have not run the verifier with the rule changed.

## Three Questions

1. **Hardest pattern to extract from the fixes?** That three separate findings (the stage label, the unconditional
   permission, the stored-lead route) were the same shape: a boundary the plan named in one place and the code or the
   metric did not enforce at the next.
2. **What did you consider documenting but left out, and why?** The per-lead unusable counts and the false-check
   breakdown beyond the opening check (they are in the measurement and false-check records).
3. **What might future sessions miss that this solution doesn't cover?** The shipped route quotes correctly and the
   router holds every vague lead for Alex, so nothing unverified is sent; but if that hold is ever relaxed, 80% of
   these drafts would arrive at the send path with a failed gate.
