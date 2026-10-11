---
title: "Venues Alex has played: a private file the app reads (port manifest R081-R089, R405)"
date: 2026-10-11
status: plan, Revision 3 (after Codex plan review round 3 = NO-GO on both runs; hard cap, no round 4; all findings fixed). Round 3 authorized by Alejandro: YES (2026-10-11). Ready for work
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

## Revision 3 (after Codex PLAN round 3 = NO-GO on both runs; HARD CAP, no round 4)

Record: `docs/reviews/2026-10-11-venues-plan-codex-round3.md`. Both runs closed all round-2 findings. Fixed: the
privacy line no longer says "enforced": the sentinel is bounded, and the privacy gate is a human review of every
staged diff (work step rule below); V15 lives in `src/port-manifest.test.ts` beside its `tableRows` helper (not
exported, so no new sharing); the test file says V1-V14 and names V15 as the one test that reads the real public
manifest. Plus Alex's point (2026-10-11): the `confirmed` date is a label, not proof he approved a sentence; the
gate is his yes in chat (project `CLAUDE.md` rule + memory).

## Revision 2 (after Codex PLAN round 2 = NO-GO on both runs; the 2nd NO-GO)

Record: `docs/reviews/2026-10-11-venues-plan-codex-round2.md`. Accepted, all five: V15 asserts the exact status of
all 9 rows; check (iii) searches every 30-character window of each claim and is called a bounded local sentinel;
an exit-1 known-answer control; `confirmed` must be a real calendar date; the `scripts/test-files.mjs` step is
removed (it already globs `src/**/*.test.ts`; Claude Code's round-1 note claiming otherwise was wrong).

## Revision 1 (after Codex PLAN round 1 = NO-GO on both runs)

Record: `docs/reviews/2026-10-11-venues-plan-codex-round1.md`. Accepted: aliases match by identical word list only
(containment is for the canonical name), with negative tests for the exact failing inputs; the "no claim in the repo"
check is a local script that fails loudly without the private file (CI cannot enforce it, said plainly); the
`confirmed` date is in the shape and the EARS (V7b); malformed `claim`/`aliases` defined (V10b); follow-up drafts
explicitly excluded (V13); a named mutation for every test; cache keyed by absolute path with a reset (V9b);
concrete lead files and a Verification Commands list; V8 compares the full string; PF-Intel coexistence (V14).
Rejected with arithmetic: run A's "TO PORT 19 → 12" (9 rows leave TO PORT: 19 − 9 = 10).

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
   { "venues": [ { "name": "Hotel del Coronado", "aliases": [], "claim": "<Alex's sentence>",
                   "confirmed": "2026-10-11", "source": "R082" } ] }
   ```
   `aliases`, `claim` and `confirmed` are optional; a `claim` reaches a draft only with a valid `confirmed` date.
   Entries written in step 0 (Claude, claims verbatim from the source, no edits; confirmed by Alex 2026-10-11):
   | name | aliases | claim | source |
   |---|---|---|---|
   | Hotel del Coronado | — | yes, confirmed 2026-10-11 | R082 |
   | The Grand Del Mar | — | **no** (blanks; Alex question Q1) | R083 |
   | Lodge at Torrey Pines | Torrey Pines Lodge (exact only) | yes, confirmed 2026-10-11 | R084 |
   | Coasterra | — | yes, confirmed 2026-10-11 | R088 |
   | The Old Rancho Wedding Estate | — | no (fact only) | R405 |
   | Mille Fleurs | — | no | R405 |
   | Japanese Friendship Garden | — | no | R405 |
   | Rancho Santa Fe Inn | — | no | R405 |
   La Valencia and Scripps Seaside Forum get **no entry** (no evidence Alex played there; Q2).
   "Del Coronado" is removed (round 1: "Del Coronado Yacht Club" / "Beach Club" are other places). "Fairmont Grand
   Del Mar" is unnecessary (the canonical name sits inside it). Never "Torrey Pines" (golf course, state reserve),
   "Old Rancho" (inside "Old Rancho Santa Fe"), or "the Del".

2. **Loader + matcher** in a new `src/venue-history.ts`:
   - `venueHistoryPath()`: `process.env.VENUE_HISTORY_PATH` if set, else `${os.homedir()}/Data/gig-lead-responder/venue-history.json`.
   - `loadVenueHistory(path)` returns a discriminated result, so "no file" never reads like "no match":
     `{ type: "ok", venues }` · `{ type: "missing", path }` · `{ type: "invalid", reason }`. **Cached per absolute
     path** (a `Map`; the file is tiny; restart to pick up edits); `resetVenueHistoryForTests()` clears it.
     `missing` and `invalid` each print ONE warning per path naming it ("venue history file not found at <path>:
     no venue-history lines" / "venue history file at <path> is invalid: <reason>"), never the words of a no-match.
   - Validation per entry (each failure prints a warning naming the entry and what was dropped):
     - `name` not a non-empty string → the whole entry is dropped; the rest still load.
     - `aliases` not an array → all aliases dropped; a non-string or empty alias → that alias dropped.
     - `claim` not a string, or containing `[` or `TBD` (case-insensitive) → the claim is dropped, the venue kept.
     - `claim` without `confirmed` that is a real calendar date (`^\d{4}-\d{2}-\d{2}$` AND a `Date.UTC` round-trip
       gives back the same year, month and day, so `2026-99-99` and `2026-02-30` fail) → the claim is dropped, the venue kept.
     - Top level not `{ "venues": [...] }`, or not JSON → `invalid`.
   - `findVenueHistory(venueName, venues)`: normalise with the SAME word normaliser as the org-venue guard
     (`nameWords` in `src/pipeline/classify.ts`, exported; no behaviour change). **Match, one direction only:**
     (a) the lead's words are identical to the entry's name OR any alias; or (b) the entry's **canonical name**
     (at least 2 words) appears as a contiguous whole-word run INSIDE the lead's words. **Aliases never use (b).**
     Never the reverse: the lead "Rancho Santa Fe" must not match the entry "Rancho Santa Fe Inn". An empty word
     list never matches. First match wins (file order).
   **Residual, stated:** a same-name venue in another city ("Japanese Friendship Garden" also exists in Phoenix and
   San Jose) can match by (b). Alex's leads are San Diego area; no city check is added (no reliable city field for
   every lead). Recorded in the Feed-Forward.
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
   exist (same place it neutralises the API key; it covers `npm test` and `npm run test:match`, which share that
   script; CI runs `npm test`). Tests that need data use `setVenueHistoryForTests(result | null)` with MADE-UP
   venues only. **Isolation:** `node --test` runs each test file in its own process and a file's tests one at a
   time, so the setter and cache are per file; every test that sets either resets both in a `finally`
   (`resetVenueHistoryForTests()`).

5. **The real file's safety check: a local script, not CI.** `scripts/check-venue-history.ts` reads the REAL file
   and (i) prints each entry and which claims survive validation; (ii) runs a fixed list of dangerous lead venue
   strings and fails if any matches ("Del Coronado Yacht Club", "Del Coronado Beach Club", "Torrey Pines Lodge at
   UCSD", "Torrey Pines Golf Course", "Rancho Santa Fe", "Old Rancho Santa Fe", "Hotel Del", "Coasterra San Diego"
   are all MISSES; "Hotel del Coronado", "The Lodge at Torrey Pines", "Fairmont Grand Del Mar", "Coasterra" are
   HITS); (iii) a **bounded local leakage sentinel**, not proof: fails if ANY 30-character window of any claim
   (sliding, step 1, whitespace collapsed) appears in any file tracked by git under `CHECK_REPO_ROOT` (default:
   this repo). It cannot see a paraphrase, a split across lines, or a copy shorter than 30 characters. Exit 0 = PASS; exit 1 = a check failed; **exit 2 = "cannot check: no
   venue-history file at <path>"**, never a pass. **CI cannot enforce (iii)**, because CI never has the private
   file; the script is the gate, run by Claude before every commit of this work and in the Execution Path.

6. **Follow-up drafts are excluded.** `src/pipeline/follow-up-generate.ts` builds its prompt with
   `buildFollowUpPrompt` and never calls `selectContext`. Venue credibility belongs in the first quote and its
   edits; follow-ups are short check-ins. Pinned by V13 so adding it later is a stated decision.

## Alex confirmed the sentences (2026-10-11, before any code)

The three complete sentences (R082 Hotel del Coronado, R084 Lodge at Torrey Pines, R088 Coasterra) came from a
template whose other fields were all blank, so they were shown to Alex verbatim and he confirmed each: **"True, use
as written."** The four R405 facts: **"All true."** (Prompted by a reviewer note: a wrong room or "many times" in
a client reply is hard to take back.)

**Rule this adds:** every `claim` in the file carries `"confirmed": "YYYY-MM-DD"`; the loader drops a claim without
a real calendar date there (venue fact kept, warning printed). Test V7b; mutation: ignore `confirmed` → fails.
**What it does NOT prove (Alex, 2026-10-11):** the date is a label. The app checks that a date is there, not that
Alex gave it; any session could write a sentence plus today's date. It stops blank and half-finished sentences only.
**The real gate is procedural:** no session adds or edits a venue sentence (or venue) without showing Alex the exact
words in chat and getting his yes (project `CLAUDE.md` rule; memory `feedback_venue-sentences-need-alex-yes`).
Visibility, not prevention: `scripts/check-venue-history.ts` prints every surviving sentence on each run, and
`~/Data`'s git history shows when each was added.

## Plan Quality Gate

### 1. What exactly is changing?

| # | File | Change |
|---|---|---|
| A | `~/Data/gig-lead-responder/venue-history.json` (NOT in the repo) | New data file, 8 entries above; committed in `~/Data` locally (no push without Alex) |
| B | `src/venue-history.ts` (new) | `venueHistoryPath`, `loadVenueHistory`, `findVenueHistory`, `formatVenueHistory`, `setVenueHistoryForTests`, `resetVenueHistoryForTests` |
| C | `src/pipeline/classify.ts` | `nameWords` gets `export` (no other change) |
| D | `src/pipeline/context.ts` | One block after the PF-Intel block appends the section when a match exists |
| E | `scripts/run-tests.mjs` | `env.VENUE_HISTORY_PATH = <nonexistent path>` |
| E3 | `scripts/check-venue-history.ts` (new) | The local real-file check (decision 5) |
| F | `src/port-manifest-venues.test.ts` (new) | EARS tests V1-V14 |
| F2 | `src/port-manifest.test.ts` | V15 added beside `tableRows` (the helper stays local) |
| H | `CLAUDE.md` (project) | One rule: venue sentences need Alex's yes on the exact words |
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
- No source text in the repo: no claim sentence appears in any committed file. **Gate: Claude Code reads every
  staged diff of this work before each commit** (`git diff --cached`), looking for Alex's sentences, paraphrases
  and short fragments. **Backstop, bounded:** `scripts/check-venue-history.ts` (iii) catches exact copies of 30+
  characters only, locally only; it misses paraphrases, line splits and copies under 30 characters; CI cannot see
  the private file.
- Follow-up prompts: unchanged (V13).
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

V1-V14 in `src/port-manifest-venues.test.ts`, titles starting `port manifest venues`, made-up venues only (V15 is
the exception: it is in `src/port-manifest.test.ts` and reads the real, public `port-manifest.md` rows):
"Example Harbor Hall" (alias "Harbor Hall Pavilion", claim "Example claim sentence.", confirmed "2026-01-01"),
"Example Garden Estate" (no claim), "Examplia" (one word). Each line names its mutation; the test must FAIL under it.

- **V1** WHEN the lead's `venue_name` normalises identical to an entry name, THE SYSTEM SHALL add the section with
  the marker `ALEX HAS PERFORMED HERE` and the entry's name. *Mutation:* `findVenueHistory` returns null.
- **V2** WHEN the canonical name (2+ words) appears as whole words inside a longer lead venue ("The Example Harbor
  Hall Ballroom"), THE SYSTEM SHALL match. *Mutation:* identity only.
- **V3** WHEN the lead venue is shorter than the entry and inside it ("Example Harbor" vs "Example Harbor Hall"),
  THE SYSTEM SHALL NOT match. *Mutation:* containment both ways.
- **V3b** WHEN an alias appears inside a longer lead venue ("Harbor Hall Pavilion Yacht Club"), THE SYSTEM SHALL
  NOT match; WHEN the lead is exactly the alias ("harbor hall pavilion"), it SHALL match. *Mutation:* apply
  containment (b) to aliases.
- **V3c** The canonical name still matches when an alias-shaped lead does not: "Example Harbor Hall" hits while
  "Harbor Hall Pavilion Yacht Club" misses (the exact shape of round 1's "Del Coronado Yacht Club").
  *Mutation:* same as V3b.
- **V4** WHEN a one-word entry ("Examplia") is inside a longer lead venue ("Examplia Rooftop"), THE SYSTEM SHALL
  NOT match; identical one word SHALL match. *Mutation:* drop the 2-word minimum.
- **V5** Accents, `&`/`and`, case and a leading "the" SHALL NOT prevent a match ("THE Éxample Harbor Hall").
  *Mutation:* compare raw lower-cased strings instead of `nameWords`.
- **V6** WHEN the entry has a confirmed claim, THE SYSTEM SHALL include it verbatim in quotes; WHEN it has none,
  THE SYSTEM SHALL include the "performed at" line and SHALL NOT include the "own words" line. *Mutation:* always
  print the "own words" line.
- **V7** WHEN a claim contains `[` or `TBD`, THE SYSTEM SHALL drop the claim, keep the venue, and warn.
  *Mutation:* remove the placeholder check.
- **V7b** WHEN a claim has no `confirmed`, or `confirmed` is not a real `YYYY-MM-DD` date (`"2026-99-99"`,
  `"2026-02-30"`, `"Oct 11"`), THE SYSTEM SHALL drop the claim, keep the venue, and warn; `"2026-10-11"` keeps it.
  *Mutation:* ignore `confirmed`; second mutation: shape regex only (the two impossible dates then pass).
- **V8** WHEN `venue_name` is null, or matches nothing, `selectContext` SHALL return a string `===` the string it
  returns with history disabled (`setVenueHistoryForTests(null)`), compared whole (the manifest's absence
  assertion). *Mutation:* append an empty heading on no match.
- **V9** WHEN the file is missing, `loadVenueHistory` SHALL return `missing` with the path; WHEN it is not JSON or
  not `{venues: [...]}`, `invalid`; neither SHALL throw; `selectContext` SHALL add no section; the two warnings
  SHALL differ. *Mutation:* return `ok` with `[]` on a missing file (fail-silent).
- **V9b** WHEN `loadVenueHistory` is called with path A then path B (two temp files in `os.tmpdir()`), THE SYSTEM
  SHALL return B's data the second time; after `resetVenueHistoryForTests()`, an edited A is re-read.
  *Mutation:* one global cache.
- **V10** WHEN an entry lacks a valid `name`, THE SYSTEM SHALL drop it and load the rest. *Mutation:* reject the
  whole file on one bad entry.
- **V10b** WHEN `claim` is an object, THE SYSTEM SHALL drop the claim (no `[object Object]` or JSON in the
  prompt); WHEN `aliases` is a string, or holds a number, THE SYSTEM SHALL drop those aliases and keep the venue.
  *Mutation:* `String(claim)`.
- **V11** `runEditPipeline` reaches the section (stored classification with a matching venue, model stubbed via
  `setClaudeRequesterForTests`; the captured generate prompt contains the marker). *Mutation:* move the block out
  of `selectContext` into `runPipeline` only.
- **V12** The test runner isolates the real file: under `npm test`, `venueHistoryPath()` is not under `~/Data`.
  *Mutation:* delete the env line in `scripts/run-tests.mjs`.
- **V13** `buildFollowUpPrompt` for a lead at a matching fixture venue SHALL NOT contain the marker (exclusion,
  decision 6). *Mutation:* append the section in `buildFollowUpPrompt`.
- **V14** WHEN PF-Intel returns a hit AND the venue matches history, `selectContext` SHALL contain both
  `VENUE INTELLIGENCE` and the marker. *Mutation:* `else` between the two blocks.

- **V15** In `port-manifest.md`, R081, R082, R083, R084, R087, R088 and R405 SHALL be `PORTED` and R085 and R089
  SHALL be `BLOCKED`, asserted row by row by id with that file's local `tableRows`; title `port manifest venues rows`. *Mutation:* leave R085 `TO PORT` and mark R086
  `PORTED` (the counts can still add up; this test fails).

**Real-file check (not a unit test, decision 5):** `npx tsx scripts/check-venue-history.ts` → exit 0. Its own
known-answer controls: `VENUE_HISTORY_PATH=/nonexistent` → exit 2 ("cannot check"); a planted mid-sentence window
→ exit 1 (Verification Commands).

## Work steps (one concern per commit; failing test first; mutation-check each test)

**Every commit of this work:** read `git diff --cached` in full for Alex's sentences, paraphrases or fragments
(the privacy gate), and from step 4 on also run `npx tsx scripts/check-venue-history.ts` (the bounded backstop).


0. Write `~/Data/gig-lead-responder/venue-history.json` (first `git -C ~/Data status --short`; commit only that
   file there; no push without Alex). Validate with `jq`.
1. `src/venue-history.ts` loader + matcher; V1-V7b, V9, V9b, V10, V10b; the runner env (E) and V12. Inclusion
   control: `npm run test:match -- "port manifest venues"` lists and passes the new tests (the existing glob in
   `scripts/test-files.mjs` already covers the file; no edit there).
2. `nameWords` export (C), in step 1's commit if it is the only reason for the export.
3. `selectContext` block (D) + V8, V11, V13, V14. **Before this step lands: baseline run (u) on the current code.**
4. `scripts/check-venue-history.ts` (E3) + its exit-2 and exit-1 controls; manifest rows (G) + V15; V1 count in
   `docs/END-TO-END-STATUS.md`.
5. Execution Path runs; record `docs/reviews/2026-10-11-venue-history-local-runs.md`.

## Verification Commands (expected results)

```
npm test                                                     # 0 fail
npm run test:match -- "port manifest venues"                 # the new tests run and pass (inclusion control)
npx tsc --noEmit                                             # no output, exit 0
npm run test:match -- "port manifest"                        # 0 fail (structure, PORTED marker/test/absence)
awk -F'|' '/^\| R[0-9]+ \|/{s=$5; gsub(/^ +| +$/,"",s); c[s]++} END{for(k in c) print c[k], k}' docs/research/2026-10-02-booking-hub/port-manifest.md
                                                             # 197 ALREADY PRESENT, 163 PORTED, 34 NOT PORTED, 10 TO PORT, 2 BLOCKED
npx tsx scripts/check-venue-history.ts                       # exit 0, "PASS"
VENUE_HISTORY_PATH=/nonexistent npx tsx scripts/check-venue-history.ts   # exit 2, "cannot check"
# exit-1 control: a made-up claim whose MIDDLE 30+ characters sit in a file tracked by a throwaway repo
R=$(mktemp -d); git -C "$R" init -q; printf 'xx the zebra quartet tunes every harp twice yy\n' > "$R/leak.txt"; git -C "$R" add leak.txt
printf '{"venues":[{"name":"Example Harbor Hall","claim":"Opening words, then the zebra quartet tunes every harp twice, and an ending.","confirmed":"2026-01-01"}]}' > "$R/v.json"
VENUE_HISTORY_PATH="$R/v.json" CHECK_REPO_ROOT="$R" npx tsx scripts/check-venue-history.ts; echo "exit=$?"   # exit=1, names leak.txt
```

## Execution Path

- **Target:** Alex's MacBook (the only host with `~/Data/gig-lead-responder/venue-history.json`), the CLI pipeline
  `src/index.ts`, real model.
- **Mechanism:** write the three lead files once, then one command per run (scratch DB, nothing sent;
  `src/index.ts` copies the draft to the clipboard):
  ```
  T=$(mktemp -d)
  cat > "$T/d.txt" <<'LEAD'
  Hi! We're getting married at the Hotel del Coronado on June 12, 2027, ceremony on the Windsor Lawn around 5pm, about 120 guests. Looking for a solo guitarist for the ceremony and cocktail hour. What would that cost?
  LEAD
  cat > "$T/k.txt" <<'LEAD'
  Corporate dinner at Coasterra, March 4 2027, 6-9pm, 80 guests, looking for background acoustic music.
  LEAD
  cat > "$T/u.txt" <<'LEAD'
  Hi! We're getting married at the Example Grand Hotel on June 12, 2027, ceremony on the lawn around 5pm, about 120 guests. Looking for a solo guitarist for the ceremony and cocktail hour. What would that cost?
  LEAD
  run() { DATABASE_PATH="$T/runs.db" npx tsx src/index.ts --json < "$T/$1.txt" | sed -n '/^{/,$p' > "$T/$2.json"; jq -r '.classification.venue_name, .drafts.full_draft' "$T/$2.json"; }
  run u u0     # baseline, CURRENT code, before step 3
  run d d1; run d d2; run k k1; run u u1; run u u2   # after step 4
  ```
- **Prerequisites:** the venue file written in step 0 (MUST CREATE, step 0); Claude Code model access for the CLI
  (ALREADY HAVE: the 2026-10-09 runs used it); `jq` (ALREADY HAVE); no PF-Intel (unreachable locally; not needed,
  and a PF-Intel miss cannot add a claim).
- **Who:** Claude Code.
- **Trigger:** baseline run (u) BEFORE step 3 lands; all runs after step 4 and before the Codex CODE review round 1.
  After merge, the same path runs on every real lead the Mac poller handles (poller start stays Alex's gate).

Expected: (d) the draft says Alex has performed at the Del, and adds nothing beyond his sentence; (k) a hit
when `venue_name` is exactly "Coasterra", a recorded miss (by design) if the classifier writes more; (u) no claim
of having performed there, in u0 (baseline) and u1/u2.
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
  run measures it before the change. Second: a same-name venue in another city matches by canonical containment
  (accepted; Alex's leads are San Diego area).

## Three Questions

1. **Hardest decision in this session?** Treating 9 rows as "venues Alex has played" after finding that every
   operational field is empty: the rows promised more than the source holds.
2. **What did you reject, and why?** PF-Intel seeding, the outreach registry, and a claim detector (above).
3. **Least confident about going into the next phase?** The baseline: if the model already claims experience at
   unknown venues, this plan adds true claims but does not stop false ones.
