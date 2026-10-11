---
title: "T4 reference lead: Alex's corporate reply as a structure the drafter follows (port manifest R020-R025, R329)"
date: 2026-10-11
status: plan, Revision 0 (before Codex plan review)
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

   A 50% deposit holds the date. Want me to lock it in?

   Alex Guillen
   ```
3. **The sunset line stays**, with a rule (never state a time, number or fact the lead or the context does not give)
   and a test: the real-model runs check every T4 draft for invented times before review.

## Decision

- **D1 Where:** a new module `src/data/t4-reference.ts` exports `T4_REFERENCE_REPLY` (the text above, verbatim) and
  `buildT4ReferenceBlock(classification): string`, which returns `""` unless `classification.rate_card_tier === "T4"`.
  `buildGeneratePrompt` (`src/prompts/generate.ts`) inserts it right after `buildVoiceExamplesBlock()` (line 79:
  examples in the middle, task last). NOT in `VOICE_REFERENCES`: that list also feeds the verify prompt
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
  - Standing rules (R024): ALREADY in the app: salutation (`generate.ts:93-94`), sign-off / contact block
    (`:262-265`), 50% deposit and 110V outlet + armless chair (`:270-271`), em-dashes removed after drafting
    (`src/run-pipeline.ts`, `src/pipeline/post-check.ts`). The block adds only the missing one: never mention
    battery-powered sound.
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

## Plan Quality Gate

### 1. What exactly is changing?
New `src/data/t4-reference.ts` (+ test file), one insertion line in `src/prompts/generate.ts`, the 7 manifest rows,
`docs/END-TO-END-STATUS.md` counts, a V-test on the rows.

### 2. What must not change?
Every non-T4 prompt (byte-identical); `VOICE_REFERENCES` and the verify prompt; pricing (`src/data/rates.ts`,
`lookupPrice`); the price line and NP price block; `docs/DRAFT_METHOD.md` stays unloaded. No price is new or changed.
Nothing from `~/Data` beyond the approved reply enters the repo.

### 3. How will we know it worked?
EARS below; local real-model runs (Execution Path) with recorded results before the Codex code review.

### 4. What is the most likely way this plan is wrong?
The model copies the example (its sunset line, "the Del's beach", "smart call") into other T4 drafts, or invents a
time anyway. The rule is prose, not code. The runs measure both; a copied window is checked mechanically (below).

### 5. How will a human RUN this, and when?
Claude Code runs the made-up leads on Alex's MacBook after step 3, before the code review (Execution Path).

## Acceptance Tests (EARS)

- **T1** WHEN `rate_card_tier` is "T4", THE SYSTEM SHALL include the `## REFERENCE LEAD: T4 CORPORATE` section with
  `T4_REFERENCE_REPLY` in the generate prompt.
- **T2** WHEN `rate_card_tier` is "T1", "T2" or "T3", THE SYSTEM SHALL produce a generate prompt identical to the one
  built before this change (string equality against a prompt built with the block forced to `""`).
- **T3** WHILE the block is present AND `timeline_band` is "urgent", THE SYSTEM SHALL tell the model availability
  first; WHEN `timeline_band` is not "urgent", THE SYSTEM SHALL NOT.
- **T4** THE SYSTEM SHALL state the no-invented-facts rule and the only-played-spaces rule in the block, the latter
  containing `VENUE_HISTORY_HEADER`'s value.
- **T5** THE SYSTEM SHALL keep `T4_REFERENCE_REPLY` free of a dollar figure (`/\$\d/`), a phone number
  (`/\(\d{3}\)\s*\d{3}-\d{4}/`), the source client's real first name, and the business name.
- **T6** THE SYSTEM SHALL leave `VOICE_REFERENCES` (count, names) and the verify prompt unchanged.
- **T7** THE SYSTEM SHALL mark manifest rows R020-R025 PORTED and R329 NOT PORTED (by id, as V15 does).
- **T8** (by hand) WHEN `npx tsx scripts/check-venue-history.ts` runs after step 2, THE SYSTEM SHALL print PASS with no
  change to its fingerprint list.

Each test gets a named mutation (block always on; block never on; urgent branch inverted; rule line deleted; a `$`
restored in the reply; reference added to `VOICE_REFERENCES`).

## Work steps (one concern per commit; failing test first; mutation-check each test)

1. `src/data/t4-reference.ts` + `src/t4-reference.test.ts` (T1, T3, T4, T5).
2. Insert the block in `buildGeneratePrompt` (T2, T6); run T8.
3. Manifest rows + END-TO-END-STATUS counts + V-test (T7). Counts after: TO PORT 10 → 3 (R006, R398, R403 rest),
   PORTED 165 → 171, NOT PORTED 34 → 35.
4. Real-model runs (Execution Path), recorded in `docs/reviews/2026-10-11-t4-reference-local-runs.md`.

## Verification Commands (expected results)

- `npm test` → all pass, 0 fail; `npx tsc --noEmit` → clean.
- `npx tsx scripts/check-venue-history.ts` → PASS (exit 0).
- V1 count (END-TO-END-STATUS) → 171 PORTED, 3 TO PORT, 35 NOT PORTED, 0 BLOCKED.

## Execution Path

- **Target:** Alex's MacBook, CLI `src/index.ts --json`, real model, scratch `DATABASE_PATH` (nothing sent;
  `data/leads.db` untouched; the CLI overwrites the clipboard).
- **Mechanism:** made-up leads, one run each after step 3 (plus a re-run of any lead that does not classify T4):
  - **t1** urgent corporate, beach evening at the Hotel del Coronado (a history venue): expect T4, availability
    first, a claim allowed.
  - **t2** urgent corporate, outdoor evening at "Example Grand Resort" (unknown venue): expect no sunset time or
    other number not in the lead, no "I've played there".
  - **t3** corporate dinner in 5 weeks at the Fairmont Grand Del Mar (history, fact only): expect cinematic first,
    no invented rooms.
  - **t4** control: same as t2 but a private birthday party (T2/T3): expect no T4 structure.
- **Checks per draft:** classification tier and band; every time/number in the draft traced to the lead or the
  pricing; any 30-character window shared with `T4_REFERENCE_REPLY` (a scratch script, same window method as the leak
  scan); any venue claim.
- **Prerequisites:** model access for the CLI (ALREADY HAVE); `jq` (ALREADY HAVE).
- **Who:** Claude Code. **Trigger:** after step 3, before the Codex code review round 1.

## Codex review

Plan review round 1 next (2 runs: Claude Code's and Alex's; stricter verdict wins). Pre-registered stops: a 2nd
NO-GO stops automatic iteration (round 3 only with Alex's yes); a 3rd NO-GO is the hard cap.

## Questions for Alex (do not block the build)

None open. (NP prices: later, by his choice.)

## Feed-Forward

- **Hardest decision:** keeping a looked-up fact in an example for a model that cannot look anything up. Alex chose
  keep + rule + test; the plan makes the test mechanical where it can (copied windows, numbers traced to the lead).
- **Rejected alternatives:** the bracketed fill-in template (invites invented fills); adding the reply to
  `VOICE_REFERENCES` (it would reach every lead and the verify prompt); a sunset lookup (new subsystem).
- **Least confident:** whether one example teaches structure or gets copied. Three T4 runs bound it; they do not
  settle it.

## Three Questions

1. **Hardest decision in this session?** The sunset line (above).
2. **What did you reject, and why?** The fill-in template, `VOICE_REFERENCES`, an app lookup (D5).
3. **Least confident about going into the next phase?** Copying: a T4 draft that reuses the example's sentences, or
   claims a venue space from it, at a venue Alex has not played.
