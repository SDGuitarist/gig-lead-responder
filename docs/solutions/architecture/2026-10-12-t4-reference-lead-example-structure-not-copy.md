---
title: "T4 reference lead: teach the model a structure with one example, then prove it did not copy the example"
category: architecture
tags: [prompt, t4, reference-example, copy-check, response-modes, anonymization, manifest-test, leak-check, codex-review]
module: src/data/t4-reference.ts, src/prompts/generate.ts, src/t4-reference.test.ts, src/port-manifest.test.ts
symptom: "Alex's T4 (luxury corporate) reference lead was a ported protocol that the app never used. A model given one worked example either copies its sentences or invents a fact the lead never stated."
root_cause: "An example is the strongest instruction in a prompt and also the easiest thing to copy. The example held a looked-up fact (a sunset time) that the model cannot look up, and in the first draft of the block the rules came before the example, so drafts copied its sentences or invented facts."
date: 2026-10-12
model: claude-sonnet-5-5
predecessor: architecture/2026-10-12-tier-b-venue-rules-from-facts-hold-with-both-prices.md
related:
  - docs/plans/2026-10-11-feat-t4-reference-lead-plan.md
  - docs/reviews/2026-10-12-t4-reference-plan-codex-round1.md
  - docs/reviews/2026-10-12-t4-reference-plan-codex-round2.md
  - docs/reviews/2026-10-12-t4-reference-local-runs.md
  - docs/reviews/2026-10-12-t4-reference-code-codex-round1.md
  - docs/reviews/2026-10-12-t4-reference-code-codex-round2.md
  - docs/reviews/2026-10-12-t4-reference-code-codex-round3.md
  - docs/plans/2026-10-12-feat-coi-sentence-by-request-plan.md
---

# T4 reference lead: one example teaches the order; a check proves it was not copied

## Prior Phase Risk

> "Whether any instruction wording can stop a model copying an example when the lead sits in the example's own
> setting. t1 may be unpassable as written; sets 1 and 2 do not settle it." (HANDOFF, Three Questions, T4 work phase)

Accepted, not closed. Alex replaced t1 with a lead at a different venue (Revision 1c), mandated text was cut before
copy windows were taken, and sets 3 and 4 show **0 copied 30-character windows in all T4 drafts**. That is two drafts
per lead over four leads and four sets: it bounds the risk, it does not prove no example can ever be copied.

## Problem

Alex's own T4 protocol (his best corporate reply, a seven-step order, and rules for what to keep) was in the port
manifest as six TO PORT rows. The app wrote T4 drafts from the generic prompt, so none of that structure reached the
model. Porting it meant putting one worked reply in front of a model that writes every draft: a model shown one example
copies its sentences, or fills its slots with invented facts.

## Solution (what ships)

- `buildT4ReferenceBlock(classification)` returns the block only when `rate_card_tier === "T4"`, else `""`.
  The anonymized example reply ("Dana", ends "Full payment holds the date.") comes **before** the rules; the order is
  written as seven steps; step 1 follows the timeline band (urgent leads answer the date first).
- Rules in the block: NO INVENTED FACTS (use only what the lead states, including times: no clock time of the draft's
  own inside their window), ONLY PLAYED SPACES (name a venue's space only when the venue-history section names it),
  PAYMENT (the sentence comes from Quote Terms only), DO NOT REUSE (re-derive every detail; no sentence of the example),
  never mention battery-powered sound.
- `buildT4ReferenceSection(classification, pricing)` gates it: **no block** when Quote Terms are off (clarification,
  no_viable_scope, residency), when the budget gap is large (two prices), on graceful decline, or when a past date was
  detected. The small-gap mode keeps it (one price plus one validation sentence). Non-T4 prompts stay byte-identical
  (three prompt-baseline fixtures).
- The manifest rows R020-R025 are PORTED, each tied to a marker and a named test; R329 is NOT PORTED with the reason
  and Alex's approval recorded.
- Evidence: 851 pass / 0 fail / 1 skip, `tsc` clean, leak check exit 0; manifest 197 present / 171 PORTED /
  35 NOT PORTED / 3 TO PORT. Four sets of real-model runs, recorded.

## How it got there (what each step taught)

1. **The first smoke set failed on the check, not the draft.** The payment sentences are mandated text, so any draft
   that obeys the rule shares a long window with the example. Alex's decision: cut mandated text (payment sentences,
   "Want me to lock it in…?", the sign-off) before taking 30-character windows. The threshold stayed "one copy fails".
2. **Do not change the check after it fails.** Wording changed twice; the example, the word lists and the copy check
   did not. A new lead that exercises the same setting (t1) was replaced only by Alex's decision, made with no draft in
   front of him.
3. **A clock time the lead never stated is an invented fact, even when it is "just scene".** Set 3's "by 5:15" sat
   inside the stated 5-7pm window. Fixed with one rule line, then verified on a fresh set.
4. **Codex code review round 1 found the gate had modelled the wrong thing.** It asked "do Quote Terms exist?", not
   "does the whole T4 structure fit this response mode?". Three modes with their own mandatory shape still got a block
   that said "one price, then payment, then a close". Fixed with three conditions, regression tests written first
   (they failed on the old code), and positive controls (met-budget and small-gap leads still get the block).
5. **An anonymization test cannot embed the private values it checks for.** The source client's real name and business
   are private, so the test asserts a structural boundary: the mid-sentence capitalised words equal an approved set.
   The first version let a name that started a sentence through; it now pins **every** capitalised word.
6. **A test that ties a manifest row to "a test" must name one test.** A title prefix matched four bodies, two holding
   the same marker, so deleting the assertion from the intended test stayed green. Rows now bind to an exact title and
   a positive assertion. Codex round 3 left one residue: a marker typed in a trailing comment on an assert line also
   passes. **Alex accepted it** (a text scan catches a deleted assertion, not a deliberate fake); the limit is named in
   a comment above `assertsPositively`.

## What this does NOT fix

- **The model may still copy.** Four sets of two drafts per lead bound it; they do not prove it. The copy check is a
  mechanical 30-character window: paraphrase of the example's sentences is only caught by the phrase list and a read.
- **The COI sentence.** The model wrote its own COI timeline ("within 24 hours of booking") in one draft, which is the
  one literal FAIL left. Alex's rule: the first reply always says "COI available upon request."; a timeline only when
  the client says they require one. It is its own plan (`docs/plans/2026-10-12-feat-coi-sentence-by-request-plan.md`),
  not built, waiting on two answers from Alex. The approved example still says "I can send the Del a COI."
- **The classifier's timeline band** returned `short` intermittently for 6-9 day events where Step 5 says urgent. The
  block follows the band it is given, so an urgent lead can get the cinematic-first opening. Own cycle, not started;
  the first step is a repeat-run measurement, because one run proves nothing about an intermittent miss.
- **Short quoted fragments of private venue claims** in already-pushed history (two to four words, descriptions of the
  kind of statement). The leak check sees only 30-character windows. Force-push or leave is Alex's open call.

## Prevention

- **Put the worked example before the rules, and write the order as numbered steps.** Set 2 did this together with a
  conditional step 4 and a DO NOT REUSE paragraph, so which change helped is not isolated; the combination is what
  passed the copy check.
- **A prompt block must be gated on the response mode, not only on whether its inputs exist.** List every mode that
  has its own mandatory shape and test each one with a lead that reaches it.
- **When a check fails, change the prompt, never the check.** A threshold moved after a FAIL is tuning the test to
  pass. If the check itself is wrong, decide that with no draft in front of you.
- **Cut mandated text before measuring copying.** Text the app requires verbatim will always overlap; measure only
  what the model chose.
- **A privacy test that cannot embed its subject checks structure.** Pin every capitalised word, not just the ones
  mid-sentence, and keep a positive control that proves the finder can find a name.
- **Describe venue statements; never quote them.** A model draft can repeat a private claim, and the exact check
  misses anything under 30 characters. Rewriting unpushed history needs Alex's yes; pushed history is his call.
- **A review claim "N tests pass" needs the denominator.** Prefix matching reported six rows covered while two had
  two matching bodies. Count bodies per row before trusting the green.
- **One run per round is the process; do not invent a second run.** A memory file inferred "Alex runs every prompt
  twice" from one re-run and it propagated into HANDOFF and several Codex prompts. Cite what the user said, not what a past
  session concluded.

## Feed-Forward

- **Hardest decision:** keeping a looked-up fact (a sunset time) in the example for a model that cannot look anything
  up. Alex chose keep, plus a rule, plus a test, over a lookup subsystem. It held across four sets.
- **Rejected:** the bracketed fill-in template (invites invented fills); adding the reply to `VOICE_REFERENCES` (it
  would reach every lead and the verify prompt); a sunset lookup (a new subsystem); a force-push of pushed history
  (rewrites shared history for two-to-four-word descriptions).
- **Least confident:** whether the model's copying stays at zero over many leads. Eight drafts per set is a thin
  sample, and the t1 setting that tripped sets 1 and 2 was replaced rather than solved. The first real T4 leads that
  reach Alex's review queue are the real test: read each one against the example before sending.

## Three Questions

1. **Hardest pattern to extract from the fixes?** That every defect was the same shape at a different surface: a check
   that could pass without the thing it names (a gate on "inputs exist", a name test blind to sentence starts, a title
   prefix with four bodies). Each fix made the check bind to one specific item.
2. **What did you consider documenting but left out, and why?** The full plan-review history (two NO-GO rounds, one
   introduced by Revision 1's own wording) and the history rewrite that removed a leaked claim from unpushed commits.
   Both are in the review records and the runs doc; neither changes how to build the next reference block.
3. **What might future sessions miss that this solution doesn't cover?** Other tiers. T1-T3 have no reference lead, and
   the same example-copying risk applies the moment one is added. Also the COI items above: a future session reading
   the block will see "I can send the Del a COI." and may take it as the rule, when Alex's rule is the default
   sentence.
