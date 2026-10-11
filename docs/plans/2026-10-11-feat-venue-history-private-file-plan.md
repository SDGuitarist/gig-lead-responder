---
title: "Venues Alex has played: a private file the app reads (port manifest R081-R089, R405)"
date: 2026-10-11
status: plan (awaiting Codex plan review round 1)
branch: feat/hub-phase0
rows: R081 R082 R083 R084 R085 R087 R088 R089 R405
---

# Venues Alex has played: a private file the app reads

### Prior Phase Risk

> "the venue sitting in `organization_name` while `venue_name` is empty or worded differently. Not observed in 3
> runs, and nothing measures it." (`docs/solutions/logic-errors/2026-10-10-organization-name-is-never-the-venue.md`,
> Feed-Forward)

Not addressed here: this plan reads `venue_name` but does not change how it is filled. It inherits the same
lesson in a different form: the match keys on `venue_name`, so a venue the classifier leaves out gets no history
(a miss, never a false claim).

No brainstorm (skip gate: the inputs are 9 manifest rows with named destinations). Alex chose this group and the
destination on 2026-10-11: "Venues (9 rows)", "Private file in ~/Data".

## What the source actually holds (read 2026-10-11, text NOT copied here: the repo is public)

| Row | Venue | Usable content |
|---|---|---|
| R081 | Section 2 heading (Tier A profiles) | heading only |
| R082 | Hotel del Coronado | a complete credibility sentence in Alex's words |
| R083 | The Grand Del Mar | a sentence with two `[blanks]` (event types, space) |
| R084 | Lodge at Torrey Pines | a complete sentence |
| R085 | La Valencia Hotel | `[TBD]`: no claim, no evidence he played there |
| R087 | Section 3 heading (Tier B profiles) | heading only |
| R088 | Coasterra | a complete sentence |
| R089 | Scripps Seaside Forum | `[TBD]`: no claim, no evidence |
| R405 | venue-history memory | 4 stated facts: Alex has performed at The Old Rancho Wedding Estate, Mille Fleurs, the Japanese Friendship Garden, the Rancho Santa Fe Inn |

**Every "Operational Intel" field (load-in, power, curfew, dB, contact, best spots, notes) is an empty
placeholder for all six venues.** There is nothing operational to port. The venue PRICE tiers (R077-R079) are
already ported in `src/prompts/classify.ts` Step 2.75 and are untouched.

So the port is: **which venues Alex has played, plus his own sentence where a complete one exists.**

## Decision

1. **Data file (private, outside the repo):** `~/Data/gig-lead-responder/venue-history.json`. `~/Data` is a git
   repo whose only remote is encrypted (README), so the file gets history and never reaches GitHub readable.
   Shape:
   ```json
   { "venues": [ { "name": "Hotel del Coronado", "aliases": ["Del Coronado"], "claim": "<Alex's sentence>",
                   "source": "R082" } ] }
   ```
   `claim` is optional. Entries written in step 1 (Claude, verbatim from the source, no edits):
   | name | aliases | claim | source |
   |---|---|---|---|
   | Hotel del Coronado | Del Coronado | yes | R082 |
   | The Grand Del Mar | Fairmont Grand Del Mar | **no** (blanks; Alex question Q1) | R083 |
   | Lodge at Torrey Pines | Torrey Pines Lodge | yes | R084 |
   | Coasterra | — | yes | R088 |
   | The Old Rancho Wedding Estate | — | no (fact only) | R405 |
   | Mille Fleurs | — | no | R405 |
   | Japanese Friendship Garden | — | no | R405 |
   | Rancho Santa Fe Inn | — | no | R405 |
   La Valencia and Scripps Seaside Forum get **no entry** (no evidence Alex played there; Q2).
   Aliases are chosen so no alias is a prefix-place of a different venue: NOT "Torrey Pines" (golf course, state
   reserve), NOT "Old Rancho" (inside "Old Rancho Santa Fe"), NOT "the Del" (one word after "the" is dropped).

2. **Loader + matcher** in a new `src/venue-history.ts`:
   - `venueHistoryPath()`: `process.env.VENUE_HISTORY_PATH` if set, else `${os.homedir()}/Data/gig-lead-responder/venue-history.json`.
   - `loadVenueHistory(path)` returns a discriminated result, so "no file" never reads like "no match":
     `{ type: "ok", venues }` · `{ type: "missing", path }` · `{ type: "invalid", reason }`. Read once per process
     and cached (the file is tiny; restart to pick up edits). `missing`/`invalid` print ONE warning naming the
     path, in words different from a no-match.
   - Validation per entry: `name` a non-empty string; `aliases` strings; a `claim` containing `[` or `TBD`
     (case-insensitive) is DROPPED with a warning (the venue fact is kept). An entry without a valid `name` is
     dropped with a warning; the rest still load.
   - `findVenueHistory(venueName, venues)`: normalise with the SAME word normaliser as the org-venue guard
     (`nameWords` in `src/pipeline/classify.ts`, exported; no behaviour change). **Match, one direction only:**
     the lead's words are identical to an entry name/alias, OR the entry name/alias (at least 2 words) appears as a
     contiguous whole-word run INSIDE the lead's words. Never the reverse: the lead "Rancho Santa Fe" (a different
     place) must not match the entry "Rancho Santa Fe Inn". An empty word list never matches. First match wins
     (file order).
   **Why one direction:** a false match makes the draft claim Alex played somewhere he did not, a false statement
   to a client. A miss only loses a credibility line. The rule is biased to misses on purpose.

3. **Where it reaches the draft:** inside `selectContext` (`src/pipeline/context.ts`), right after the PF-Intel
   block. Both `runPipeline` and `runEditPipeline` call `selectContext`, so one call covers both paths (the
   org-venue lesson: a guard in one entry point is a guard in half; FC45). Section:
   ```
   ## ALEX HAS PERFORMED HERE: <entry name>
   Alex has performed at this venue. You may say so.
   [if claim] Alex's own words about it (use as written or shorten; add nothing): "<claim>"
   Do not invent rooms, event counts, dates or details that are not written here.
   ```
   No section when there is no match, no file, or no `venue_name` (the prompt is byte-identical to today's then).

4. **Tests never read the real file.** `scripts/run-tests.mjs` sets `VENUE_HISTORY_PATH` to a path that does not
   exist (same place it neutralises the API key), and tests that need data point it at a fixture of MADE-UP
   venues via a test setter (`setVenueHistoryForTests(result | null)`), never Alex's text.

## Alex confirmed the sentences (2026-10-11, before any code)

The three complete sentences (R082 Hotel del Coronado, R084 Lodge at Torrey Pines, R088 Coasterra) came from a
template whose other fields were all blank, so they were shown to Alex verbatim and he confirmed each: **"True, use
as written."** The four R405 facts: **"All true."** (Prompted by a reviewer note: a wrong room or "many times" in
a client reply is hard to take back.)

**Rule this adds (mechanical, not a promise):** every `claim` in the file carries `"confirmed": "YYYY-MM-DD"`; the
loader drops a claim without a valid `confirmed` date (venue fact kept, warning printed). A sentence Alex or a later
session adds to the file cannot reach a client until someone records his confirmation. Test V7b; mutation: ignore
`confirmed` → fails.

## Plan Quality Gate

### 1. What exactly is changing?

| # | File | Change |
|---|---|---|
| A | `~/Data/gig-lead-responder/venue-history.json` (NOT in the repo) | New data file, 8 entries above; committed in `~/Data` locally (no push without Alex) |
| B | `src/venue-history.ts` (new) | `venueHistoryPath`, `loadVenueHistory`, `findVenueHistory`, `formatVenueHistory`, test setter |
| C | `src/pipeline/classify.ts` | `nameWords` gets `export` (no other change) |
| D | `src/pipeline/context.ts` | One block after the PF-Intel block appends the section when a match exists |
| E | `scripts/run-tests.mjs` | `env.VENUE_HISTORY_PATH = <nonexistent path>` |
| F | `src/port-manifest-venues.test.ts` (new) | EARS tests V1-V12 |
| G | `docs/research/2026-10-02-booking-hub/port-manifest.md` | Row statuses (below) |

Manifest outcome: R082, R084, R088, R405 → **PORTED** (marker `ALEX HAS PERFORMED HERE`, test
`port manifest venues`). R081, R087 → **PORTED** as the section headings whose venues are ported (same marker/test).
R083 → **PORTED** for the fact; the claim's blanks are listed as Q1 in the Where column (the row stays honest about
what is missing). R085, R089 → **BLOCKED** (Q2: has Alex played there?). Counts after (V1): **TO PORT 19 → 10,
PORTED 156 → 163, BLOCKED 0 → 2**; ALREADY PRESENT 197 and NOT PORTED 34 unchanged; total 406.

### 2. What must not change?

- Prices and tiers: `src/prompts/classify.ts` Step 2.75, `src/data/rates.ts`, `src/pipeline/price.ts` untouched.
- PF-Intel lookup and `formatVenueContext`: untouched; a PF-Intel hit and a history match can both appear.
- A lead with no `venue_name`, or a venue with no match: the assembled context is byte-identical to today
  (test V8).
- `nameWords` behaviour (org-venue tests O1-O10 stay green unchanged).
- No source text in the repo: no claim sentence appears in any committed file (test V12 greps the repo for
  each claim's first 30 characters, read from the real file only when it exists, skipped with a printed reason
  when it does not, so CI cannot fake a pass silently: it says "skipped").
- `.env`, `data/leads.db`, `public/`: untouched.

### 3. How will we know it worked?

EARS tests below (mutation-checked), suite + tsc green, and the real-model runs in the Execution Path: a Hotel del
Coronado lead's draft says Alex has played there; a control lead at an unknown venue does not claim it.

### 4. What is the most likely way this plan is wrong?

**The model already claims venue experience it does not have**, with or without this file (the PF-Intel guidance
even models "I've played this room before"). Then the control run fails for a reason this plan does not create
and cannot fix. The Execution Path runs the control on the CURRENT code first, so a pre-existing false claim is
recorded as its own finding instead of being blamed on (or hidden by) this change. Second: the lead's venue text
is worded unlike any alias ("the Del", "Torrey Pines Lodge & Spa"): a miss, no harm, measured by nothing; Alex
can add aliases to the file.

### 5. How will a human RUN this, and when?

See **Execution Path**. Claude runs it during work step 5 on Alex's Mac (the only host with `~/Data`). After
merge, it runs on every real lead the Mac poller handles (poller start is still Alex's gate).

## Acceptance Tests (EARS)

All in `src/port-manifest-venues.test.ts`, titles starting `port manifest venues`, made-up venues only
("Example Harbor Hall", alias "Harbor Hall Pavilion", claim "Example claim sentence."; "Example Garden Estate" no
claim).

- **V1** WHEN the lead's `venue_name` is identical (after normalising) to an entry name, THE SYSTEM SHALL add the
  section with the marker `ALEX HAS PERFORMED HERE` and the entry's name. *Mutation:* return null from
  `findVenueHistory` → fails.
- **V2** WHEN the entry name (2+ words) appears as whole words inside a longer lead venue ("The Example Harbor Hall
  Ballroom"), THE SYSTEM SHALL match. *Mutation:* identity only → fails.
- **V3** WHEN the lead venue is SHORTER than the entry and contained in it ("Example Harbor" vs "Example Harbor
  Hall"), THE SYSTEM SHALL NOT match. *Mutation:* make containment two-way → fails.
- **V4** WHEN a one-word entry ("Examplia") is contained in a longer lead venue ("Examplia Rooftop"), THE SYSTEM
  SHALL NOT match; identical one word SHALL match.
- **V5** Accents, `&`/`and`, case and a leading "the" SHALL NOT prevent a match ("THE Éxample Harbor Hall").
- **V6** WHEN the entry has a claim, THE SYSTEM SHALL include it verbatim in quotes; WHEN it has none, THE SYSTEM
  SHALL include the "performed at" line and SHALL NOT include the "own words" line.
- **V7** WHEN a claim contains `[` or `TBD`, THE SYSTEM SHALL drop the claim, keep the venue, and warn.
- **V8** WHEN `venue_name` is null, or matches nothing, THE SYSTEM SHALL produce context byte-identical to
  `selectContext` with history disabled (absence assertion for the manifest).
- **V9** WHEN the file is missing, `loadVenueHistory` SHALL return `missing` with the path, and WHEN it is not valid
  JSON or not `{venues: [...]}`, SHALL return `invalid`; neither SHALL throw, and `selectContext` SHALL add no
  section. The two warnings SHALL differ in wording from each other.
- **V10** WHEN an entry lacks a valid `name`, THE SYSTEM SHALL drop that entry and load the rest.
- **V11** `runEditPipeline` reaches the section (stored classification with a matching venue, model stubbed via
  `setClaudeRequesterForTests`; assert the captured generate prompt contains the marker). *Mutation:* move the
  block out of `selectContext` into `runPipeline` only → fails.
- **V12** No committed file contains any real claim (see "must not change"); prints "skipped: no venue-history
  file" when the real file is absent.
- Plus: the test runner guard: under `npm test`, `venueHistoryPath()` is NOT under `~/Data` (asserts the env set
  in E took effect).

## Work steps (one concern per commit; failing test first; mutation-check each test)

0. Write `~/Data/gig-lead-responder/venue-history.json` (check `git -C ~/Data status` first; commit only that
   file there; no push). Validate it with `jq`.
1. `src/venue-history.ts` loader + matcher + V1-V7, V9, V10 (unit) and the runner env (E) + its guard test.
2. `nameWords` export (C) folded into step 1 if it is the only reason for the export.
3. `selectContext` block (D) + V8, V11.
4. V12 + manifest rows (G) + V1 count in `docs/END-TO-END-STATUS.md`.
5. Execution Path runs; record `docs/reviews/2026-10-11-venue-history-local-runs.md`.

## Execution Path

- **Target:** Alex's MacBook (the only host with `~/Data/gig-lead-responder/venue-history.json`), the CLI pipeline
  `src/index.ts`, real model.
- **Mechanism:** per run, scratch DB, nothing sent (`src/index.ts` copies the draft to the clipboard):
  ```
  T=$(mktemp -d); printf '%s' "<lead text>" > "$T/lead.txt"
  DATABASE_PATH="$T/runs.db" npx tsx src/index.ts --json < "$T/lead.txt" | sed -n '/^{/,$p' > "$T/out.json"
  jq -r '.classification.venue_name, .drafts.full_draft' "$T/out.json"
  ```
- **Prerequisites:** the venue file written in step 0 (MUST CREATE, step 0); Claude Code model access for the CLI
  (ALREADY HAVE: the 2026-10-09 runs used it); `jq` (ALREADY HAVE); no PF-Intel (unreachable locally; not needed,
  and a PF-Intel miss cannot add a claim).
- **Who:** Claude Code.
- **Trigger:** baseline run (u) BEFORE step 3 lands; all runs after step 4 and before the Codex CODE review round 1.
  After merge, the same path runs on every real lead the Mac poller handles (poller start stays Alex's gate).

Leads (made up; real venue names are fine, they are public places):
- **(d) Del:** "Hi! We're getting married at the Hotel del Coronado on June 12, 2027, ceremony on the Windsor
  Lawn around 5pm, about 120 guests. Looking for a solo guitarist for the ceremony and cocktail hour. What would
  that cost?" Expected: `venue_name` mentions the Del; the draft says Alex has performed there, with no detail
  beyond his sentence.
- **(k) Coasterra (one-word entry):** "Corporate dinner at Coasterra, March 4 2027, 6-9pm, 80 guests, looking for
  background acoustic music." Expected: matched when `venue_name` is exactly "Coasterra"; if the classifier writes
  "Coasterra San Diego", recorded as a miss (by design).
- **(u) control, unknown venue:** the (d) text with "Example Grand Hotel" instead. Expected: no claim of having
  performed there. **Run (u) on the CURRENT code first** (before step 3) and record the result as the baseline.
Two runs each of (d) and (u), one of (k). Reading per run: venue_name; claim present/absent; any invented detail
(room counts, dates) not in his sentence.

## Codex review

Plan review round 1 (2 runs: Alex's and Claude Code's), stricter verdict wins. Pre-registered stops: a 2nd NO-GO
stops automatic iteration; round 3 only with Alex's explicit YES.

## Questions for Alex (do not block the build)

- **Q1** The Grand Del Mar sentence has two blanks: which events have you played there, and which space has the
  great acoustics? (Until then: fact only, no sentence.)
- **Q2** Have you played La Valencia Hotel or Scripps Seaside Forum? If yes, a sentence for each (or "fact only").
- **Q3** `git -C ~/Data push` (encrypted) after the file is committed: yes/no.

## Feed-Forward

- **Hardest decision:** the match direction. Two-way containment (the org-venue rule) would let "Rancho Santa Fe"
  claim the Rancho Santa Fe Inn; here a false match is a false statement to a client, so only the entry may sit
  inside the lead's venue, never the reverse.
- **Rejected alternatives:** seeding PF-Intel (production data in another project, unreachable locally; Alex chose
  the private file); reusing `~/Data/venues/registry` (an outreach dataset with contact PII, a different purpose);
  porting the empty operational-intel tables (placeholders only); a deterministic check that drafts never claim
  unlisted venues (a new subsystem: detecting a claim in prose is the problem the price-block work just retired).
- **Least confident:** whether the model already invents venue experience for unknown venues. The baseline control
  run measures it before the change.

## Three Questions

1. **Hardest decision in this session?** Treating 9 rows as "venues Alex has played" after finding that every
   operational field is empty: the rows promised more than the source holds.
2. **What did you reject, and why?** PF-Intel seeding, the outreach registry, and a claim detector (above).
3. **Least confident about going into the next phase?** The baseline: if the model already claims experience at
   unknown venues, this plan adds true claims but does not stop false ones.
