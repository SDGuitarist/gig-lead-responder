---
title: "The app writes the fixed lines; the model writes a marker; the check confirms exact text"
category: architecture
tags: [llm-output, post-check, marker-substitution, prose-detector, fail-closed, np2, in-kind, review-convergence, golden-test]
module: src/pipeline/price-block.ts, src/pipeline/generate.ts, src/pipeline/post-check.ts, src/prompts/generate.ts, src/run-pipeline.ts
symptom: "A post-check that had to find 'the price line' in model prose kept passing look-alikes: three Codex rounds each narrowed it and round 3 still passed 'I can make $695 work for 2 hours' next to the in-kind line, and missed 'in  kind' (two spaces)."
root_cause: "The check inferred a structured line from free prose. No detector can tell a quote line from a sentence that states the same amount and hours, so every patch only narrowed the false pass. The model owned text the app could have written exactly."
date: 2026-10-09
model: claude-opus-5-5
predecessor: architecture/hybrid-llm-deterministic-computation.md
related:
  - docs/plans/2026-10-09-feat-app-inserted-price-and-in-kind-lines-plan.md
  - docs/reviews/2026-10-09-np2-codex-round3.md
  - docs/reviews/2026-10-09-price-block-plan-codex-round1.md
  - docs/reviews/2026-10-09-price-block-plan-codex-round2.md
  - docs/reviews/2026-10-09-price-block-local-runs.md
  - docs/reviews/2026-10-09-price-block-codex-round1.md
---

# The app writes the fixed lines; the model writes a marker; the check confirms exact text

### Prior Phase Risk

> "The marker on real, varied leads: 6 runs on 3 texts, and the classifier's T2/T3 call decides whether NP2 fires
> at all; plus organization_name filled with the venue, which no check sees." (HANDOFF, price-block work session,
> Three Questions 3. No fix-batch phase ran: the code review was GO with no findings.)

This doc accepts that risk and does not close it. The pattern makes a missed marker a HOLD, never a wrong
price. Only real NP2 leads can measure how often the marker is missed, and the organization-name problem is a
separate work item (HANDOFF).

## Problem

An NP2 (established-foundation) quote must carry Alex's price line and, on the next line, his exact in-kind
sentence: "My standard rate is $795, so the difference is my in-kind contribution to the Example Foundation."
The model wrote both, and `hasInKindLine` in `post-check.ts` tried to confirm them. The in-kind sentence was easy
to check, because the app built it (`inKindSentence`). The hard part was where it sat: right after **the price
line**, which the model wrote in its own words.

Three Codex rounds on NP2 each narrowed what counted as "the price line":
- round 1: any position, so the sentence could sit anywhere;
- round 2: a line containing the NP amount, so "The client budget is $695" passed;
- round 3: a line with the amount AND the hours, so "I can make $695 work for 2 hours." still passed. Separately,
  `in  kind` (two spaces) was not counted as a contradicting mention.

Both round-3 runs graded it **(c): same-class residue on one surface. The surface is the wrong shape.** The cap
fired; Alex accepted the residue and planned this fix.

## Root cause

The check was asked to recognise a **structured** line inside **free prose**, which it cannot do. "Solo
guitar, $695, 2 hours | ..." and "I can make $695 work for 2 hours." share every feature a pattern can see. Each
patch picked a stricter feature (position, then amount, then hours), and each one had a prose counterexample.
The real defect was ownership: the model owned text the app already knew character for character (the amount,
the hours, the included clause, the sentence).

## Solution

**The app writes the fixed lines. The model writes only a slot for them. The check confirms text it knows
exactly.**

1. **Marker in the prompt** (`src/prompts/generate.ts`, NP2 only). The PRICE LINE section asks for one line,
   `[[PRICE: <the format in plain words>]]`, alone, in both drafts, and no price line, in-kind or standard-rate
   sentence. The format name stays the model's (Alex: no new client wording table). Everything after it is the
   app's.
2. **Substitution inside drafting** (`src/pipeline/price-block.ts`, called in `generateResponse`).
   `insertPriceBlock` replaces exactly one whole-line marker with `"<name>, <tail>"` plus the in-kind sentence.
   The **order** is: cut the compressed draft to 2000 chars, then insert, then add the sign-off. Because it runs
   inside `generateResponse`, the LLM verify gate, every rewrite and the SMS edit path all see the real block.
3. **One builder** for the tail: `priceLineTail` (`$<clientTotal>, <h> hour(s)<included clause>`) is used by both
   the prompt and the block, so the two cannot drift. A golden test captured from the pre-change code pinned
   every non-NP2 prompt while the builder moved.
4. **Fail closed.** Zero markers, two, a marker inside a sentence, or a bad name (the name allows any letter,
   `\p{L}`, but no digits, `$`, `|` or brackets, so no number reaches the price line through the name) leave the
   draft unchanged. The post-check then holds it for Alex. The app never guesses a price line.
5. **Exact-text check** (`hasPriceBlock` in `post-check.ts`): no `[[PRICE` left; exactly one `<name>, <tail>`
   line followed by the exact sentence; **outside the block**, no in-kind mention (`/\bin\s*-?\s*kind\b/gi`) and
   no "my standard ... rate is $"; the core `$695, 2 hours` exactly once; the block before the sign-off **line**.

```ts
// price-block.ts
export function insertPriceBlock(draft: string, block: PriceBlock | null): string {
  if (!block) return draft;
  const lines = draft.split("\n");
  const at = lines.flatMap((l, i) => (MARKER_LINE.test(l) ? [i] : []));
  if (at.length !== 1) return draft;                       // 0 or 2+: held, never guessed
  const name = (MARKER_LINE.exec(lines[at[0]])?.[1] ?? "").trim();
  if (!FORMAT_NAME.test(name)) return draft;               // a digit in the name: held
  lines.splice(at[0], 1, `${name}, ${block.tail}`, block.inKind);
  return lines.join("\n");
}
```

**Result.** Both round-3 residues are closed (E1, E3). Codex code review round 1: GO on both runs, no findings.
Real model: 3 of 3 NP2 runs carried the block in both drafts after one prompt line (below).

## What the reviews and the runs caught (worth reusing)

- **A fix can carry the next defect.** Plan revision 1 held a draft whose block came after "the LAST line
  containing Alex Guillen". That rule was round 2's P1, because a mid-body mention ("Alex Guillen handles setup")
  then held a correct draft. Fixed by matching the sign-off **line** (trimmed text exactly `Alex Guillen`).
- **Counting over the whole draft can hold a correct one.** An organization named "In Kind Foundation" puts two
  in-kind matches in the app's own sentence. Fixed by counting with the block's two lines removed.
- **Exact-copy checks miss shortened copies.** Counting the full tail missed `Solo guitar, $695, 2 hours` without
  the included clause. Fixed by counting the core `$<total>, <h> hours`. Prose (`$695 for two hours`) is not
  that shape, so it is not held.
- **A test of the stub is not a test of the model.** The offline harness (stubbed model) proved what the app does
  with a marker. Only the real CLI runs showed the model writing `[[PRICE: Solo guitar, 1 hour]]` (hours inside
  the name), which the name rule held. One prompt line ("Inside the brackets write the format name only: no
  hours, no price, no commas.") took it from 2/3 to 3/3.
- **A sample that never reaches the branch measures nothing.** The first lead texts were all classified T2, so
  0 of 3 were NP2-priced and no marker was ever asked for. The plan's STOP rule ("fewer than 2 priced =
  insufficient sample") caught it. Re-worded upscale texts were priced 3 of 3.
- **Golden tests need an expiry.** A full-prompt SHA froze 22,000 characters, so any later voice edit would fail
  it (Alex caught this). Kept during the work; in the last step, cut down to the PRICE LINE section only.

## Prevention

- **When a check must find a structured line inside model prose, stop patching the detector.** Ask: "does the
  app already know this text?" If yes, the app writes it and the model writes a marker. The tell is a review
  loop that narrows one function round after round (here: three rounds, one surface, grade (c)).
- **Substitute inside the generation function, before any verifier.** Otherwise the verifier and the rewrites
  grade a draft that has no real price in it.
- **Make every non-match fail closed** (unchanged draft + hold). A substitution that guesses is just the old
  detector in a new place.
- **Count contradictions outside the inserted block**, and match the sign-off as a line, not a substring.
- **Pin the moved builder with a golden captured from the pre-change code**, in its own commit. Prove its
  provenance from git history (`git log --reverse -- <fixture>` precedes every edit of the builder). Then expire
  the parts that guard more than the change.
- **Measure the model separately from the app**: a stubbed harness for the contract, plus real runs whose sample
  must actually reach the branch (count the priced runs before reading any marker result).

Tests that pin this: `src/port-manifest-np2.test.ts` ("price block" H1-H7, E1-E15b) and
`src/price-line-golden.test.ts` (H6). Every new test was mutation-checked; the mutations are listed in the
commit messages (`45dea5a`, `f4be3a1`, `679062f`, `57c58eb`, `45f2ed6`).

## Known gaps (accepted, recorded in HANDOFF)

- False-hold rate on real NP2 leads: 6 runs on 3 texts only.
- A well-formed but wrong format name ("Mariachi band" on a solo quote) passes. Alex chose the model naming it;
  every NP2 draft is held for Alex.
- An SMS edit that drops the marker is held.
- Separate items: the classifier fills `organization_name` with the venue (2/2 runs); the local `.env`'s PF-Intel
  URL is Railway-internal (venue lookups fail locally; production unverified); `ensureSignOff` skips the sign-off
  on a mid-body mention; the em-dash fixer leaves " , ".

## Three Questions

1. **Hardest pattern to extract from the fixes?** That "make the app own the text" is the fix and not just one
   more patch. The deciding signal was the review history, not the code: three rounds narrowing one function, all
   graded (c), means the surface's shape is wrong. More rules would not have fixed it.
2. **What did you consider documenting but left out, and why?** The full plan-review back-and-forth (two NO-GO
   rounds, 13 findings). It is recorded in `docs/reviews/`. Here only the three findings that generalise are
   kept (sign-off line, count outside the block, core-not-tail).
3. **What might future sessions miss that this solution doesn't cover?** Using the pattern where the app does
   NOT know the text exactly. It only works for fixed, app-computed text. It also moves the risk to the model
   writing the marker, which only real leads measure. And it cannot catch a wrong input, such as a venue in
   `organization_name`: the block is "intact" and still wrong.

## Feed-Forward

- **Hardest decision:** where the substitution runs. In the post-check would have been simpler, but the LLM
  verify gate and its rewrites would grade drafts with no real price. Inside `generateResponse` (cut, then
  insert, then sign-off) every consumer sees the real block.
- **Rejected alternatives:** a fourth narrowing of the prose detector (three rounds proved the shape wrong); an
  app-owned client format-name table (new wording for Alex for a solo-only track); the app quietly stripping
  ", 1 hour" from a marker name (accepts model drift; Alex chose one prompt line); the block on every draft
  (Alex: NP2 only, no gap found elsewhere).
- **Least confident:** the marker's false-hold rate on real, varied nonprofit leads (6 runs on 3 texts), and
  whether the classifier's T2/T3 call lets NP2 fire often enough for any of this to matter.
