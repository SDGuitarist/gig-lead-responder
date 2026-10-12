---
title: "T4 reference lead: Alex's corporate reply as a structure the drafter follows (port manifest R020-R025, R329)"
date: 2026-10-11
status: plan, Revision 1b (plan R1 NO-GO 5 P1 / 2 P2, fixed in Revision 1; plan R2 NO-GO 1 P1, fixed in 1b; round 3 is Alex's call)
branch: feat/hub-phase0
rows: R020 R021 R022 R023 R024 R025 R329
---

# T4 reference lead: a structure for luxury corporate leads, and the banner row closed

### Prior Phase Risk

> "The fingerprint list going stale: if a voice example is edited to carry more of a sentence, the check fails and
> someone must decide whether those words are public." (`docs/solutions/architecture/2026-10-11-private-venue-claims-and-an-exact-leak-sentinel.md`, Feed-Forward)

Touched directly: this plan adds a new example reply that names the Del. It adds no venue sentence of Alex's, and the
leak check (`scripts/check-venue-history.ts`) must PASS on it with no new fingerprint. If it fails, the example
shares 30+ characters with a private sentence: stop and show Alex, never add a key (FC98). No brainstorm (skip gate:
the input is 7 manifest rows with exact ids; Alex chose this scope 2026-10-11).

## Revision 1 (2026-10-12): what changed, by Codex R1 finding

Review: `docs/reviews/2026-10-12-t4-reference-plan-codex-round1.md` (run 1 NO-GO; run 2 pending there). Alex's calls:
the example's payment sentence changes (yes, 2026-10-12); the copy-failure threshold (below, agreed 2026-10-12).

| # | Finding | Fix in this revision |
|---|---|---|
| P1-1 | Example says "A 50% deposit holds the date." but the app now picks the sentence by lead time | Example ends "Full payment holds the date." (6 days out); D2 no longer calls the deposit a standing rule; D7 + T5 pin the sentence to `PAYMENT_SENTENCES.full` |
| P1-2 | Execution Path not reproducible | Four copy-pasteable leads, pinned run date, expected tier / band / format / guests / price / payment sentence (hypotheses until run) |
| P1-3 | T7, T8 had no mutation; mutations had no command | Mutation table: one row per test, with command and the failing assertion |
| P1-4 | T4-only boundary under-tested | T2 extended; T6 now covers verify prompt, `VOICE_REFERENCES`, and an import-graph check |
| P1-5 | Copying risk unresolved | Smoke-test label, failure threshold, and what happens on a failure (Feed-Forward, Execution Path) |
| P2-6 | Stale line numbers | Re-verified 2026-10-12: example call `generate.ts:81`, salutation `:96`, sign-off `:266-267`, Quote Terms `:271`, payment line `:272`, setup `:273`. Codex's own numbers were off by 1-4 in places; these are from the file |
| P2-7 | Leak check is exact-window only | D6: a precise rule for the example's public venue wording, plus paraphrase checks in the runs and a positive control for the leak check |

**Revision 1b (2026-10-12), plan R2 NO-GO, one P1, mine:** T5/D6 banned the word `familiar` over the whole reply,
but the approved reply says "familiar songs", so T5 could not pass. Fix: the D6 word list applies to sentences that
name the Del, and `familiar` is now `familiar with`. Checked by running the rule over the reply's text: 2 sentences
name the Del, 0 hits; the old whole-reply rule hit exactly one word (`familiar`); a known-positive ("I've played the
Del's beach before.") fires. Record: `docs/reviews/2026-10-12-t4-reference-plan-codex-round2.md`.

## What the source holds (read 2026-10-11 in `~/Data`; only the approved anonymized reply is copied below)

File 1 of the extraction, "REFERENCE LEAD: T4 Corporate Direct, Urgent": one booked T4 lead (sparse corporate form,
event inside a week, beach bonfire at the Del, solo guitar 2 hours, booked in 14 minutes, no price pushback; the file
itself says one data point, not a pattern). Sections: when to use (R020); the structure, 7 steps (R021); a bracketed
fill-in template (R022); what to re-derive for every lead (R023); standing rules (R024); known deviations (R025).
R329 is a chat banner in another file ("proceed to DRAFT_METHOD.md").

## Alex's decisions (2026-10-11, in chat, before any code)

1. Scope: R020-R025 plus R329 now; R006 gets its own plan; NP prices (R403 rest) later, those leads stay held.
2. **The example reply goes in the public repo exactly as shown to him** (his sent reply with: client first name
   changed to "Dana"; the price replaced by `[QUOTED_PRICE]`; the deposit amount removed; business name and phone
   removed, per the app's sign-off rule):

   ```
   Hi Dana,

   I'm available Thursday, October 8. Sunset is about 6:25, so 5 to 7 on the Del's beach catches the last daylight and the fire taking over, with guitar underneath.

   Putting a bonfire inside a three-day program is a smart call. It's the hour people put the agenda down and talk to each other.

   Surf and wind swallow a guitar, so I set levels from where your guests sit, present but under conversation. How many people are you expecting around the fire? That tells me how to size the sound.

   Solo guitar, two hours: [QUOTED_PRICE], sound system included. Spanish guitar, bossa nova, familiar songs. My only electrical need is one standard 110V outlet within 25 feet, plus an armless chair. I can send the Del a COI.

   Full payment holds the date. Want me to lock it in?

   Alex Guillen
   ```
3. **The sunset line stays**, with a rule (never state a time, number or fact the lead or the context does not give)
   and a test: the real-model runs check every T4 draft for invented times before review.
4. **Revision 1 (2026-10-12): the example's deposit sentence becomes "Full payment holds the date."** The event in the
   example is 6 days out, and the payment-terms cycle (2026-10-11) makes the app pick that sentence for 14 days or
   fewer. This is Alex's yes in chat 2026-10-12, after he saw the old and new line side by side. Nothing else in the
   reply changed. (The reply above shows the new sentence.)

## Decision

- **D1 Where:** a new module `src/data/t4-reference.ts` exports `T4_REFERENCE_REPLY` (the text above, verbatim) and
  `buildT4ReferenceBlock(classification): string`, which returns `""` unless `classification.rate_card_tier === "T4"`.
  `buildGeneratePrompt` (`src/prompts/generate.ts`) inserts it right after `buildVoiceExamplesBlock()` (the call is at
  line 81; line 79 is `buildVoiceRulesBlock`; examples in the middle, task last). NOT in `VOICE_REFERENCES`: that list also feeds the verify prompt
  (`src/prompts/verify.ts:38`) and every lead's examples; this example is for T4 only.
- **D2 What the block says** (one `## REFERENCE LEAD: T4 CORPORATE` section):
  - The 7 steps (R021), with step 1 conditional: `timeline_band === "urgent"` → "availability first, the cinematic
    line second" (R025 deviation 2); otherwise the usual cinematic opening first, availability after.
  - Re-derive, never copy (R023): no sentence of the example may appear in the draft; the local fact, venue space,
    physical problem, validation line come from THIS lead.
  - **No invented facts (Alex decision 3):** "State a time, a number, a date fact or a physical detail of the place
    only when the lead or a section above gives it to you. The example's sunset time was looked up for that lead;
    you cannot look anything up. With no given fact, build the wedge from the lead's own window and setting."
  - **Only played spaces (R023):** name a venue's room or area as one Alex knows only when an
    `${VENUE_HISTORY_HEADER}` section above names that venue; otherwise do not say or imply Alex has played there.
    The constant is imported from `src/venue-history.ts`, not retyped.
  - Standing rules (R024): ALREADY in the app: salutation (`generate.ts:96`), sign-off (`:266-267`), 110V outlet +
    armless chair (`:273`), the payment sentence (picked by lead time in `src/pipeline/payment-terms.ts`, inserted
    by `paymentLine(paymentTerms)` at `generate.ts:272`, exact text confirmed by `post-check`), em-dashes removed
    after drafting (`src/run-pipeline.ts`, `src/pipeline/post-check.ts`). The block adds only the missing one: never
    mention battery-powered sound. The deposit is NOT a rule the block owns (D7).
  - Word counts (R025 deviation 1): the example runs 142 words; drafts keep the word limits in the drafting steps.
  - The price comes from the PRICE LINE section only (the example's `[QUOTED_PRICE]` is not a price).
  - The example, wrapped with the existing `wrapVoiceReference(1, "t4_corporate", T4_REFERENCE_REPLY)`.
- **D3 R022 (fill-in template):** PORTED as the 7 steps; the bracketed template itself is NOT shipped (a model given
  `[One verified fact about their time and place]` tends to fill it with an invented one, and stray brackets reach
  drafts). Codex may challenge this.
- **D4 R329:** NOT PORTED, class "navigation/placeholder" approved by Alex 2026-10-03 (q-e): a chat-Project banner
  pointing to `DRAFT_METHOD.md`, which the app does not load on purpose (`1bc9cad`); the app enforces order in code
  (R332).
- **D5 Rejected:** activating it for every corporate lead (T4 is the evidence; T3 corporate is a different buyer);
  app-side sunset lookup (a new subsystem with a network dependency; leaves the fix loop per the review rules);
  shipping the source's evidence notes (one data point; nothing in the app should learn from "14 minutes").

- **D6 Public venue wording in the example (Codex P2-7):** the example is public and names "the Del" twice ("the
  Del's beach", "send the Del a COI"). Allowed: those two phrases, because they say where the event is and who
  receives the COI, not that Alex has played there or knows the place. Rule T5 enforces, on every sentence of the
  reply that names the Del (a sentence containing `the Del` or `Del's`): none of `played`, `performed`, `last time`,
  `again`, `familiar with`, `I know`, `my usual` (Revision 1b: the list was applied to the whole reply with
  `familiar`, which fails on the approved "familiar songs", a sentence that does not name the Del). The block also
  says, in one line:
  "The example describes one lead's venue; it is not evidence about any other venue." The exact-window leak check
  (`scripts/check-venue-history.ts`) misses paraphrases by design; the runs add a paraphrase pass (Execution Path).
- **D7 Payment sentence (Codex P1-1):** the block says "The payment sentence comes from the Quote Terms section only.
  The example's payment sentence belongs to that lead's date; do not copy it." The example keeps "Full payment holds
  the date." (T5 asserts it equals `PAYMENT_SENTENCES.full`, imported, not retyped). A draft that copies it onto a
  lead where the app picked another sentence fails `post-check`'s exact-text check; t3 below is built to prove it.

## Plan Quality Gate

### 1. What exactly is changing?
New `src/data/t4-reference.ts` (+ test file), one insertion line in `src/prompts/generate.ts`, the 7 manifest rows,
`docs/END-TO-END-STATUS.md` counts, a V-test on the rows.

### 2. What must not change?
Every non-T4 prompt (byte-identical); `VOICE_REFERENCES` and the verify prompt; pricing (`src/data/rates.ts`,
`lookupPrice`); the price line and NP price block; payment sentences (`src/pipeline/payment-terms.ts`,
`paymentLine`); `docs/DRAFT_METHOD.md` stays unloaded. No price is new or changed.
Nothing from `~/Data` beyond the approved reply enters the repo.

### 3. How will we know it worked?
EARS below; local real-model runs (Execution Path) with recorded results before the Codex code review.

### 4. What is the most likely way this plan is wrong?
The model copies the example (its sunset line, "the Del's beach", "smart call") into other T4 drafts, or invents a
time anyway. The rule is prose, not code. The runs measure both; a copied window is checked mechanically (below).

### 5. How will a human RUN this, and when?
Claude Code runs the made-up leads on Alex's MacBook after step 3, before the code review (Execution Path).

## Acceptance Tests (EARS)

Test file: `src/t4-reference.test.ts` (picked up by the `src/**/*.test.ts` glob in `scripts/test-files.mjs`; no
registration). Test names start `T4 reference T<n>` so `npm run test:match -- "T4 reference T3"` runs one.

- **T1** WHEN `rate_card_tier` is "T4", THE SYSTEM SHALL include the `## REFERENCE LEAD: T4 CORPORATE` section with
  `T4_REFERENCE_REPLY` in the generate prompt.
- **T2** WHEN `rate_card_tier` is "T1", "T2" or "T3", THE SYSTEM SHALL produce a generate prompt that contains no
  `REFERENCE LEAD: T4` and equals the prompt built with the block forced to `""` (string equality).
- **T3** WHILE the block is present AND `timeline_band` is "urgent", THE SYSTEM SHALL include the exact line
  `OPENING: availability first, then the cinematic line.`; WHEN `timeline_band` is not "urgent", THE SYSTEM SHALL
  include `OPENING: cinematic line first, then availability.` instead, and never both.
- **T4** THE SYSTEM SHALL state, as literal lines in the block, `NO INVENTED FACTS`, `ONLY PLAYED SPACES` (carrying
  `VENUE_HISTORY_HEADER`'s value), `PAYMENT: the sentence comes from the Quote Terms section only`, and the D6
  one-line "not evidence" sentence.
- **T5** THE SYSTEM SHALL keep `T4_REFERENCE_REPLY` free of a dollar figure (`/\$\d/`), a phone number
  (`/\(\d{3}\)\s*\d{3}-\d{4}/`), the source client's real first name, the business name, `50%`, and, in each sentence that
  names the Del, each of the D6 words; AND SHALL contain `PAYMENT_SENTENCES.full` exactly once. The reply stays
  verbatim, including "familiar songs".
- **T6** THE SYSTEM SHALL keep the verify prompt free of `REFERENCE LEAD: T4` and of the reply's first 30
  characters; SHALL keep `VOICE_REFERENCES` (count, names) equal to the list pinned in the test at step 1; AND
  SHALL import `src/data/t4-reference.ts` from no non-test file other than `src/prompts/generate.ts` (a scan of
  `src/**/*.ts`).
- **T7** THE SYSTEM SHALL mark manifest rows R020-R025 PORTED and R329 NOT PORTED (by id, as V15 does).
- **T8** WHEN `npx tsx scripts/check-venue-history.ts` runs after step 2, THE SYSTEM SHALL exit 0 with no change to
  its fingerprint list; AND WHEN the same check runs with `CHECK_REPO_ROOT` pointing at a scratch git repo holding
  one real claim sentence (read at run time from the private file, never written to this repo), THE SYSTEM SHALL
  exit 1 (positive control: the check can fail).

### Mutations (apply one, run the command, expect a failure, revert)

Baseline: `npm run test:match -- "T4 reference"` exits 0. Each mutation must make ITS command exit 1 with the named
assertion failing; if it exits 0 the test is vacuous and gets rewritten.

| Test | Mutation | Command | Expected failing assertion |
|---|---|---|---|
| T1 | `buildT4ReferenceBlock` returns `""` always | `npm run test:match -- "T4 reference T1"` | prompt lacks the section header |
| T2 | block returned for every tier | `... "T4 reference T2"` | non-T4 prompt contains `REFERENCE LEAD: T4` |
| T3 | `urgent` branch inverted | `... "T4 reference T3"` | wrong OPENING line for the band |
| T4 | delete the `NO INVENTED FACTS` line (repeat for each of the four literals) | `... "T4 reference T4"` | missing literal line |
| T5 | restore `A 50% deposit holds the date.` in the reply (repeat: a `$` figure; `played` added to the sentence that names the Del) | `... "T4 reference T5"` | `50%` / dollar / D6-word check |
| T6 | add the reply to `VOICE_REFERENCES`; separately, import the block in `verify.ts` | `... "T4 reference T6"` | VOICE_REFERENCES count / import-graph / verify-prompt check |
| T7 | set R329 PORTED in the manifest | `... "T4 reference T7"` | R329 status assertion |
| T8 | scratch-repo copy of a real claim sentence (control) | `npx tsx scripts/check-venue-history.ts` with `CHECK_REPO_ROOT=<scratch>` | exit 1 (a window found) |

## Work steps (one concern per commit; failing test first; mutation-check each test)

1. `src/data/t4-reference.ts` + `src/t4-reference.test.ts` (T1, T3, T4, T5).
2. Insert the block in `buildGeneratePrompt` (T2, T6); run T8.
3. Manifest rows + END-TO-END-STATUS counts + V-test (T7). Counts after: TO PORT 10 → 3 (R006, R398, R403 rest),
   PORTED 165 → 171, NOT PORTED 34 → 35.
4. Real-model runs (Execution Path), recorded in `docs/reviews/2026-10-11-t4-reference-local-runs.md`.

## Verification Commands (expected results)

- `npm test` -> all pass, 0 fail; `npx tsc --noEmit` -> clean.
- `npm run test:match -- "T4 reference"` -> exit 0 (and exit 1 under each mutation above).
- `npx tsx scripts/check-venue-history.ts` -> PASS (exit 0).
- V1 count (END-TO-END-STATUS) -> 171 PORTED, 3 TO PORT, 35 NOT PORTED, 0 BLOCKED (sums to 406 with 197 ALREADY
  PRESENT; Codex R1 re-checked the arithmetic).

## Execution Path

- **Target:** Alex's MacBook, real model, scratch `DATABASE_PATH` (nothing sent; `data/leads.db` untouched). Same
  mechanism as `docs/reviews/2026-10-11-payment-terms-local-runs.md`: a scratch script calls
  `runPipeline(text, undefined, undefined, undefined, "2026-10-12")` (today is pinned, so every date below is
  reproducible) and records tier, band, format, guests, price line, payment sentence, the full draft.
- **Who:** Claude Code. **Trigger:** after step 3, before the Codex code review round 1.
- **Prerequisites:** model access (ALREADY HAVE); `jq` (ALREADY HAVE); the private venue file (ALREADY HAVE).
- **Status of the expected values:** HYPOTHESES until the runs. A lead whose classification differs is recorded as
  found, then re-run once with the stated fix; both results are kept.

| Lead | Text (copy as is) | Expected |
|---|---|---|
| **t1** | `Hi Alex, I'm planning a leadership offsite for 40 people and we'd like live music at a beach bonfire reception at the Hotel del Coronado on Sunday, October 18, 2026, from 5 to 7pm. We'd like a solo guitarist. Could you send availability and pricing? Thanks, Maria Lopez, Cobalt Ridge Partners (events team)` | T4; `urgent` (6 days); solo guitar, 2 h; 40 guests; price line $1,350 (floor $1,200); payment sentence = `PAYMENT_SENTENCES.full`; OPENING availability first; a venue claim only from the VENUE HISTORY section |
| **t2** | `Hello, I'm the executive assistant to the CEO of Northpoint Capital. We're hosting a client dinner for 30 guests on Friday, October 16, 2026, outdoors on the terrace of the five-star Example Grand Resort in La Jolla, 6 to 8pm. We'd like a Spanish or classical guitarist. What are your availability and rates? Thank you, Priya Shah` | T4; `urgent` (4 days); solo guitar, 2 h; 30 guests; $1,350 (floor $1,200); payment = full; NO time or number not in the lead (the 6 and 8pm are given; no sunset time); NO "played there" or any claim about the resort |
| **t3** | `Hello Alex, our firm is hosting a holiday client dinner for 70 guests at the Fairmont Grand Del Mar on Thursday, December 17, 2026. We'd like a guitarist for the cocktail hour and dinner, about 3 hours starting at 6pm. Could you share your availability and your rate? Best, Daniel Okafor, Meridian Wealth Group` | T4; `comfortable` (66 days); solo guitar, 3 h; 70 guests; $1,800 (floor $1,600); payment = `PAYMENT_SENTENCES.twoMonths` (NOT the example's "Full payment..."); OPENING cinematic first; fact-only venue content from the history section, no invented rooms |
| **t4** (control) | `Hi Alex, my husband is turning 50 and I'm planning a surprise backyard birthday party for 35 guests at our home in Point Loma on Saturday, November 14, 2026, 5 to 8pm. Could you play guitar for 2 hours? Thanks, Jenny` | NOT T4 (T2 or T3); generate prompt has no `REFERENCE LEAD: T4`; draft has no T4 structure |

- **Checks per draft (a scratch script; every check self-tested on a known positive first, as the 10-11 runs did):**
  1. classification tier, band, guests vs the table;
  2. the draft's price equals the price line, the payment sentence equals the expected constant (exact), and the
     compressed draft carries it too;
  3. **copy check:** any 30-character window shared with `T4_REFERENCE_REPLY` (whitespace collapsed; the leak
     scan's window method), AND any of the example's distinctive phrases or a close paraphrase, read by hand:
     "put the agenda down", "fire taking over", "swallow a guitar", "last daylight", "smart call";
  4. **number trace:** every time, date, count and dollar figure in the draft traced to the lead or the price line;
  5. **venue-claim paraphrase pass (D6):** the draft has none of `played`, `performed`, `last time`, `again`,
     `familiar with`, `returning`, `back at` in a sentence naming the venue unless a VENUE HISTORY section names it;
     none of `beach`, `bonfire`, `sunset`, `fire` where the lead does not (t2, t3). By-hand read as well.
- **Smoke test, not proof (Codex P1-5):** three T4 drafts and one control cannot show the model never copies. They
  bound the obvious failure. **FAIL rule (agreed by Alex 2026-10-12): any ONE copied sentence or window, any ONE
  invented venue claim, or any ONE time or number not traceable to the lead FAILS that run.** On a FAIL: stop, no
  code review; change the block's wording (never the check), re-run all four leads, record both sets. Two failed
  sets: show Alex before a third.

## Codex review

Plan review round 1 (re-run 2026-10-12): NO-GO, recorded in `docs/reviews/2026-10-12-t4-reference-plan-codex-round1.md`
(the 2026-10-11 run A was lost; this replaces it). Round 2 verifies ONLY the named fixes in the Revision 1 table (2
runs: Claude Code's prompt, Alex runs it twice; stricter verdict wins). Pre-registered stops: a 2nd NO-GO stops
automatic iteration (round 3 only with Alex's yes); a 3rd NO-GO is the hard cap, no round 4.

**Round 2 (2026-10-12): NO-GO, one P1** (T5 contradicted the verbatim example; 6 of 7 fixes FIXED, P2-7 fixed but
introduced it). Recorded in `docs/reviews/2026-10-12-t4-reference-plan-codex-round2.md`. Fixed in Revision 1b. This is
the 2nd NO-GO on this plan, so **automatic iteration has stopped**: round 3 runs only with Alex's written yes.

## Questions for Alex (do not block the build)

None open. Answered 2026-10-12: the example's payment sentence (yes), the copy-failure threshold (any one copy or
invented claim fails the run). NP prices: later, by his choice.

## Feed-Forward

- **Hardest decision:** keeping a looked-up fact in an example for a model that cannot look anything up. Alex chose
  keep + rule + test; Revision 1 adds a fail-on-one threshold and a paraphrase pass.
- **Rejected alternatives:** the bracketed fill-in template (invites invented fills); adding the reply to
  `VOICE_REFERENCES` (it would reach every lead and the verify prompt); a sunset lookup (new subsystem).
- **Least confident:** whether one example teaches structure or gets copied. Four runs bound it; they do not settle
  it, and the plan now says so. A second risk Revision 1 adds: the example's payment sentence is correct only for
  leads 14 days out or fewer; t3 is the one test that the model takes the sentence from Quote Terms.

## Three Questions

1. **Hardest decision in this session?** Setting the copy threshold at "one copy fails" (Alex's call) without a way to
   tell structure-following from copying other than a 30-character window plus a hand read.
2. **What did you reject, and why?** Fixing Codex's line numbers from its report (re-read the file: its numbers were
   off by 1-4); testing T8's positive control with a sentence written into the repo (it would leak; the control reads
   it at run time).
3. **Least confident about going into the next phase?** The expected classifications in the Execution Path are
   hypotheses. `t2` names an invented five-star resort and may not classify T4; if it does not, the block is not
   exercised on an unknown venue and the t2 control has to be rebuilt.
