---
title: "The app inserts the NP2 price line and in-kind line into both drafts"
date: 2026-10-09
type: feat
phase: plan
branch: feat/hub-phase0
input: docs/reviews/2026-10-09-np2-codex-round3.md
brainstorm: skipped (the round-3 record names the surface, the failing inputs and the fix; CLAUDE.md brainstorm skip gate)
feed_forward:
  risk: "Whether the drafting model writes the [[PRICE: ...]] marker exactly once in both drafts; a missed marker is a false hold, and NP2 is only useful if false holds are rare."
  verify_first: true
---

# The app inserts the NP2 price line and in-kind line into both drafts

### Prior Phase Risk

> "Whether the drafting model writes the in-kind sentence word for word (the post-check holds it if not, but a
> high false-hold rate would make NP2 useless), and whether the LLM verify gate penalises the second dollar figure."
> (HANDOFF, NP2 work session, Three Questions 3.)

This plan takes the in-kind sentence out of the model's hands entirely: the app writes it, so "word for word" is
no longer a model behaviour. The risk moves to one smaller model behaviour, writing one marker line, which the
local runs (step 6) measure before any Codex review.

## Why (the round-3 finding, in one paragraph)

`hasInKindLine` in `src/pipeline/post-check.ts` has to guess which line of free prose is "the price line". Three
Codex rounds narrowed the guess (any position, then any line with the amount, then the amount and the hours), and
round 3 still passed `I can make $695 work for 2 hours.` followed by the correct in-kind line. Both runs graded it
(c): the surface is the wrong shape. The fix is to stop guessing: the app writes the price line and the in-kind line
itself, so the post-check confirms a block it knows character for character.

## Decisions already made (Alex, 2026-10-09, this session)

1. **Scope: NP2 drafts only.** The block is inserted only when `inKindSentence()` returns a sentence (a one-price
   NP2 quote: solo, 1-2h, standard at least $100 above the NP2 price, not a scoped alternative or a minimum-set
   redirect). Every other draft keeps today's model-written price line, unchanged.
2. **The model names the format; the app writes everything else.** The model writes one marker line,
   `[[PRICE: Solo guitar]]`. The app replaces it with
   `Solo guitar, $695, 2 hours | Professional sound, setup and breakdown, repertoire shaped to their event`
   and, on the next line, Alex's in-kind sentence. Every number and every fixed word is the app's.
3. **"[standard]" keeps the normal price lookup** (no venue-level T3 rate). `lookupPrice`, `NP_MIN_IN_KIND` and
   `inKindSentence` are unchanged. This closes the open question in HANDOFF.

## Types (written out)

```ts
// src/pipeline/price-block.ts
export interface PriceBlock { tail: string; inKind: string }   // tail: "$695, 2 hours | Professional sound, ..."
export function priceLineTail(pricing: Pick<PricingResult, "travel" | "format">, price: number, hours: number): string;
export function priceBlockFor(classification: Pick<Classification, "venue_name" | "organization_name">,
  pricing: PricingResult): PriceBlock | null;                   // non-null iff inKindSentence() is non-null
export function insertPriceBlock(draft: string, block: PriceBlock | null): string;  // unchanged when block is null or the marker is not exactly one valid line
```

`priceLineTail` is the ONLY builder of the tail: `buildPriceLineBlock` uses it for every draft's prompt line
(non-NP2 included, so its output is byte-identical), and `priceBlockFor` uses it for the inserted block.

## Plan Quality Gate

### 1. What exactly is changing?

| # | File | Change |
|---|---|---|
| A | `src/pipeline/price-block.ts` (new, ~60 lines) | `priceLineTail(pricing, price, hours)`: the text after the format name (`$<clientTotal>, <h> hour(s)<included clause>`), moved here from `buildPriceLineBlock` so the prompt and the block share ONE builder. `priceBlockFor(classification, pricing)`: `{ tail, inKind }` when `inKindSentence()` is non-null, else `null`. `insertPriceBlock(draft, block)`: replaces exactly one valid marker line with `<name>, <tail>\n<inKind>`; returns the draft unchanged if there are 0 markers, 2 or more markers, or an invalid name. |
| B | `src/prompts/generate.ts` | `buildPriceLineBlock` uses `priceLineTail` (output for non-NP2 drafts byte-identical). When `priceBlockFor` is non-null, the PRICE LINE section instead tells the model to write `[[PRICE: <the format in plain words>]]` once, alone on its own line, in both drafts, and to write no price line, no in-kind sentence, and no other standard-rate or in-kind statement. `buildInKindBlock` (the "write this sentence word for word" section) is deleted. |
| C | `src/pipeline/generate.ts` | After the compressed draft is truncated to 2000 chars and BEFORE the sign-off is added, both drafts go through `insertPriceBlock(draft, priceBlockFor(classification, pricing))`, built from the SAME `classification` and `pricing` arguments `generateResponse` already receives. Those are the final, post-enrichment values: `runPipeline` passes `enriched, pricing` to `runWithVerification` (`run-pipeline.ts` ~line 254), which passes them unchanged to every `generateResponse` call (`verify.ts:89`, `:105`), and `runEditPipeline` passes its stored pair. So the block inserted and the block post-checked (row E) are built from identical inputs (lesson: `prompt-injection-hardening`, insert after any cap so the cap cannot slice the block). This sits inside `generateResponse`, so the LLM verify gate and every rewrite see the finished block, and the SMS edit path (`runEditPipeline` calls `generateResponse`) gets it too. |
| D | `src/pipeline/post-check.ts` | Option `inKind?: string \| null` becomes `priceBlock?: PriceBlock \| null`. `hasInKindLine` and its KNOWN GAP comment are deleted and replaced by `hasPriceBlock(text, block)`, which passes only when: (1) no `[[PRICE` text remains; (2) exactly one line matches `^<valid format name>, <escaped tail>$` (anchored at the start and end of the line) AND the next line is exactly `<inKind>`; (3) exactly one in-kind mention, counted with `/\bin\s*-?\s*kind\b/gi` (closes "in  kind" with two spaces); (4) exactly one first-person standard-rate statement (`STANDARD_RATE_STATEMENT`, unchanged). Violation names stay `in_kind_line_<full\|compressed>` and `in_kind_org_missing` (the hold note readers already know them); the message becomes "the NP2 draft must carry the app's price block unchanged". |
| E | `src/run-pipeline.ts` | Both `postCheckDrafts` calls pass `priceBlock: priceBlockFor(<classification>, pricing)` instead of `inKind: inKindSentence(...)`. Computed from the final `pricing` (after the enrichment re-price; lesson: `reprice-after-enrichment-override`). |
| F | `src/port-manifest-np2.test.ts` | Tests at lines 160, 172, 230, 278, 304, 322 and 335 are rewritten to build drafts with `insertPriceBlock`. Two tests are deleted because the behavior they pinned no longer exists: 230 ("must follow the price line", which inferred placement from prose) and 304 ("only a line with the NP price and hours is the price line", which inferred the price line from prose). Each deletion is named in its commit message. New tests are listed under the acceptance tests below. |
| G | Docs | HANDOFF: delete the two NP2 known gaps (prose price line, "in  kind") and the open "[standard]" question; record this cycle. `docs/reviews/2026-10-1x-price-block-local-runs.md`: the step-6 record. |

Name validation (marker): `^[A-Za-z][A-Za-z '&-]{0,39}$` after trimming. No digits, `$`, `|`, brackets or
newlines, so the model cannot put a number on the price line through the name. NP2 is solo only, so the name
will be something like "Solo guitar" or "Solo Spanish guitar".

### 2. What must not change?

- **Every number.** `lookupPrice`, `NP_MIN_IN_KIND`, `clientTotal`, `inKindSentence`, `nonprofitPriceNote` and the
  rate tables are untouched. No new price, no changed price (HARD STOP if a step seems to need one).
- **Every non-NP2 draft.** The generate prompt for any lead where `priceBlockFor` is null is byte-identical to
  today. All of `src/port-manifest-price-line.test.ts` (R300-R302) passes with no edits.
- **Holds.** Every nonprofit lead is still held (classify note). `in_kind_org_missing` still fires when the lead
  names no organization (`[organization]` stays in the app's sentence, for Alex to fill).
- **The other post-checks.** Written-price check (`belowFloorPrices`), priced-hours check, voice, banned phrases
  and the em-dash fixer run exactly as today, on the text with the block in it.
- **Two-price and redirect NP2 drafts** (scoped alternative, minimum-set redirect): no block, no line, note says
  "Alex adds it". Unchanged.
- **Files not to touch:** `src/pipeline/price.ts`, `src/prompts/classify.ts`, `src/prompts/verify.ts`,
  `src/pipeline/verify.ts`, `.env`, `data/leads.db`, anything under `public/`.

### 3. How will we know it worked?

The acceptance tests below, a green suite + `npx tsc --noEmit` at every commit, and the step-6 local runs:
made-up NP2 leads (a) and (b) give drafts with the block intact in both drafts, lead (c) gives the block with `[organization]` and an `in_kind_org_missing` hold, plus 1 non-NP2 lead whose draft looks as it
does today.

### 4. What is the most likely way this plan is wrong?

**The model does not write the marker reliably.** It writes it in one draft but not the other, writes it twice,
writes a price line as well as the marker, or puts a number in the name. Each of these is held, not sent (the
post-check fails), so the risk is false holds, not a wrong price reaching a client. NP2 is useless if most NP2
drafts are held for a missing marker. Step 6 measures this on made-up leads BEFORE Codex. The marker count covers the three NP2-priced runs
(a), (b), (c). Lead (c) counts too: the marker must still be there, and its hold comes from the organization name, not the marker.
If 2 or more of those 3 runs miss the marker in either draft, STOP and bring the outputs to Alex. Do not tune the prompt in a loop.

Second most likely: **the verify gate reacts badly to the marker.** It cannot, because insertion happens inside
`generateResponse`, before `verifyGate` is called. EARS P3 pins that order.

Third: **an SMS edit asking to drop the price** makes the model drop the marker, and the draft is held. That is
today's behavior too (HANDOFF known gap). It is accepted because Alex reviews every nonprofit lead. Recorded, not
fixed.

### 5. How will a human RUN this, and when?

See **Execution Path** below.

## Acceptance Tests (EARS)

All new tests go in `src/port-manifest-np2.test.ts` (`scripts/test-files.mjs` globs `src/**/*.test.ts`, so it
runs). Every test runs with
`npm test`, and singly with `npm run test:match -- "<test name>"` (exit 3 = nothing matched; never read that as
a pass). The step-5 edit-path test follows `src/confidence.test.ts:157`, which already stubs the model under
`runEditPipeline`. The mutation
column names the one-line change each test must catch. Each mutation is applied and reverted during work, and
the result is recorded in the commit message.

### Happy path

- **H1** WHEN `priceBlockFor` is called for a one-price NP2 solo 2h lead with a travel fee THE SYSTEM SHALL return
  a tail that states the client total (base + fee) and the same `inKindSentence` text. *Mutation:* drop
  `clientTotal` from `priceLineTail`; the test fails.
- **H2** WHEN a draft contains exactly one line `[[PRICE: Solo guitar]]` THE SYSTEM SHALL replace that line with
  `Solo guitar, <tail>` followed by a newline and the in-kind sentence, leaving every other line unchanged.
  *Mutation:* insert the in-kind sentence before the price line; the test fails.
- **H3** WHEN `generateResponse` runs for an NP2 lead with a stubbed model (`setClaudeRequesterForTests`) whose two
  drafts each carry the marker THE SYSTEM SHALL return both drafts with the block inserted, and the compressed
  draft's block is intact even when the model's compressed text is over 2000 chars. *Mutation:* insert the block
  before truncation; the over-2000 case fails.
- **H3b** WHEN `runPipeline` runs (stubbed model) on an NP2 lead whose enrichment changes the classification after the first price lookup THE SYSTEM SHALL insert and post-check the block from the same final `pricing`, with no `in_kind_line_*` violation. *Mutation:* call `priceBlockFor` in `run-pipeline.ts` with the pre-enrichment `sanitized` classification; the test fails. If no NP2 lead can reach the re-price branch (solo stays solo), the test instead asserts that both call sites receive identical arguments, and the commit says which.
- **H4** WHEN `postCheckDrafts` receives both drafts as `insertPriceBlock` produced them THE SYSTEM SHALL report no
  `in_kind_line_*` violation.
- **H5** WHEN the generate prompt is built for an NP2 lead THE SYSTEM SHALL contain the marker instruction and SHALL
  NOT contain the in-kind sentence or the `## IN-KIND LINE` heading. *Mutation:* keep `buildInKindBlock`; the test
  fails.
- **H6** WHEN the generate prompt is built for a non-NP2 lead (T2 solo, a two-price scoped NP2, a duo) THE SYSTEM
  SHALL produce the same PRICE LINE text as before this change (R300-R302 tests unchanged and green; plus one
  equality test against `priceLineTail` for the one-price shape). *Mutation:* change one character of the tail;
  R300 fails.

### Error cases (each is a HOLD, never a send)

- **E1 (round-3 residue 1)** WHEN a draft has no marker and instead carries `I can make $695 work for 2 hours.`
  followed by the correct in-kind sentence THE SYSTEM SHALL report `in_kind_line_<label>`. *Mutation:* make
  `hasPriceBlock` search for the in-kind sentence alone; the test fails.
- **E2 (round-3 residue 1, with the block)** WHEN a draft carries the app's block AND a second copy of the in-kind
  sentence after a prose line THE SYSTEM SHALL report `in_kind_line_<label>`. *Mutation:* drop the "exactly once"
  count; the test fails.
- **E3 (round-3 residue 2)** WHEN a draft carries the block plus `That is a $100 in  kind gift.` (two spaces) THE
  SYSTEM SHALL report `in_kind_line_<label>`. Also hyphen, no space, `In - Kind`. "kind words" alone does not
  count. *Mutation:* revert the regex to `\bin[-\s]?kind\b`; the two-space case fails.
- **E4** WHEN a draft has zero markers, two markers, or a marker whose name has a digit, `$` or `|` THE SYSTEM SHALL
  leave the draft unchanged (marker text still present), and the post-check SHALL report `in_kind_line_<label>`.
  *Mutation:* insert at the first of two markers; the two-marker case fails.
- **E5** WHEN either draft's block is edited after insertion (amount, hours, included clause, organization name, a
  word of the in-kind sentence) THE SYSTEM SHALL report `in_kind_line_<label>` for that draft only. (Ports the
  existing "changed amount / changed wording / different organization" cases.)
- **E6** WHEN the draft carries the block plus a first-person standard-rate claim (`My standard rate is $800 for
  most events.`) THE SYSTEM SHALL report `in_kind_line_<label>`. Someone else's rate (`The venue's standard room
  rate is $300`) SHALL NOT be reported. (Ports the existing test at line 322.)
- **E7** WHEN the lead names no organization THE SYSTEM SHALL insert the sentence with `[organization]` and report
  `in_kind_org_missing` (and no `in_kind_line_*`). *Mutation:* fill the placeholder with "your organization"; the
  test fails.
- **E8** WHEN `priceBlockFor` is null (non-NP2, two prices, redirect, clarification) THE SYSTEM SHALL NOT alter the
  draft even if it contains `[[PRICE: x]]`, and the post-check SHALL NOT run the block check. (A stray marker on a
  non-NP2 draft is not this check's job; the model is never told to write one there.)

### Verification commands

```
npm test                                    # 720 + new, 0 fail (count recorded at each commit)
npx tsc --noEmit                            # clean
grep -n "hasInKindLine\|KNOWN GAP (Codex round 3" src/pipeline/post-check.ts   # no output
grep -n "buildInKindBlock\|## IN-KIND LINE" src/prompts/generate.ts           # no output
git diff --stat <base>..HEAD -- src/pipeline/price.ts src/prompts/classify.ts src/prompts/verify.ts src/pipeline/verify.ts public/   # empty
```

## Work steps (one concern per commit; failing test first; mutation-check each new test)

1. **`price-block.ts` + `priceLineTail` extraction** (A, plus `buildPriceLineBlock` calling the shared tail).
   Tests H1, H2, E4, H6 equality. ~90 lines incl. tests.
2. **Prompt: marker instruction for NP2; delete `buildInKindBlock`** (B). Tests H5, H6. ~40 lines.
3. **Insert in `generateResponse`** (C). Test H3 (stubbed model). ~50 lines.
4. **Post-check: `hasPriceBlock` replaces `hasInKindLine`** (D) and rewrite/delete NP2 tests (F). Tests H4,
   E1-E8. ~120 lines (mostly test rewrites; split into 4a check + new tests, 4b port old tests, if over 100).
5. **Wire `run-pipeline.ts`** (E). Covered by a typecheck (the option was renamed) plus one test that calls
   `runEditPipeline` with a stubbed model and asserts the block is in the returned drafts. That test closes the
   known gap "the run-pipeline wiring of the inKind option is not tested", for the edit path. ~40 lines.
6. **Local runs** (Execution Path). Record in `docs/reviews/`. Doc-only commit.
7. **Un-flag trackers**: grep the repo for `in  kind`, `prose sentence stating the NP amount`, `[standard]`,
   `hasInKindLine`, and update HANDOFF + the NP2 note in `docs/reviews/2026-10-09-np2-codex-round3.md` (append
   "fixed by <sha>"; do not rewrite the record). Doc-only commit.

Before every commit: `git fetch origin` and confirm `origin/feat/hub-phase0` has not moved. A peer session was
active on this branch on 2026-10-09. If it moved, stop and read its commits before going on.

## Execution Path

- **Target:** this Mac, the local CLI (`src/index.ts`). Nothing is sent and no server or poller is started.
- **Mechanism:** for each made-up lead file in the session scratchpad,
  `DATABASE_PATH=<scratchpad>/runs.db npx tsx src/index.ts --json < <lead>.txt`.
  Leads (Example names only): (a) an arts foundation donor reception, 1h, at a named hotel. Expect T3, NP2 $500,
  block with the venue. (b) a foundation gala, 2h, no venue, organization named. (c) a foundation event with no
  organization name in the text. Expect the block with `[organization]` and a hold. (d) a non-nonprofit T2 solo
  2h. Expect today's model-written price line, no marker. Inspect `drafts.full_draft`, `drafts.compressed_draft`
  and `gate.fail_reasons` in the JSON. NP2 eligibility at 1h flips with the classifier's T2/T3 call (local runs,
  2026-10-09). If a lead comes back T2 and unpriced, that is not this plan's failure. Re-word the lead toward a
  named upscale hotel and re-run once.
- **Prerequisites:** ALREADY HAVE: Node + `npx tsx`, the app's Anthropic key in `.env` (read only, never edited),
  the scratchpad directory. Nothing to obtain. Note: the CLI overwrites the clipboard.
- **Who:** Claude Code runs the four leads. Alex reads the four draft pairs in the review record.
- **Trigger:** after step 5 is committed and green, BEFORE writing the Codex round-1 prompt. The STOP rule in
  Gate question 4 applies.

## Codex review (after step 7)

Round 1 prompt: scratchpad + `pbcopy`. Run it twice, once in Alex's Codex and once by Claude Code, and record both
runs in `docs/reviews/2026-10-1x-price-block-codex-round1.md`. Stops, registered now: a 2nd NO-GO on the same
change stops automatic iteration. Round 3 needs `Round 3 authorized by Alex: YES`. A 3rd NO-GO is the hard cap.

## Feed-Forward

- **Hardest decision:** where the insertion happens. Inserting at post-check time is simpler, but then the LLM
  verify gate grades a draft that has no price, and its rewrites chase that. Inserting inside `generateResponse`
  means the gate, the rewrites and the SMS edit path all see the real block, at the cost of a new step in the
  drafting path.
- **Rejected alternatives:** (1) another narrowing of `hasInKindLine`. Three rounds showed a prose detector cannot
  recognise a structured line. (2) The app writes the whole line including the format name. That needs a
  client-facing name table Alex would have to write; Alex chose the model naming it. (3) Every one-price draft gets
  the block. That widens the change to every lead for no gap anyone has found; Alex chose NP2 only. (4) Throwing a
  `GenerationError` when the marker is missing. That would crash the run instead of holding a reviewable draft.
- **Least confident:** whether the model writes the marker exactly once in BOTH drafts. The compressed draft is
  short and the model may fold the price into prose there. Step 6 measures it on 3 NP2 leads, which is a small
  sample. The false-hold rate on real leads stays unmeasured until real NP2 leads arrive.

## Three Questions

1. **Hardest decision in this session?** The scope: NP2 only versus every draft. The HANDOFF item said it "touches
   how every draft is assembled". Alex chose NP2 only. That keeps the change aimed at the one detector that failed
   review, and leaves the model-written price line, which the local runs showed exact, alone.
2. **What did you reject, and why?** Inserting the block in the post-check (the verify gate would never see the
   real price), an app-owned format name table (new client-facing wording for Alex to write, for a solo-only
   track), and throwing on a missing marker (a crash instead of a hold).
3. **Least confident about going into the next phase?** The marker's reliability in the compressed draft, and
   whether `insertPriceBlock` sits after the 2000-char cut and before the sign-off on every path. H3 pins the
   order for `generateResponse`. The edit path inherits it because it calls the same function, and step 5's test
   confirms that.
