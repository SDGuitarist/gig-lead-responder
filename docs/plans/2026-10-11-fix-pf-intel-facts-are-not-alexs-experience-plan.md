---
title: "PF-Intel venue facts are public facts, not Alex's experience"
type: fix
date: 2026-10-11
status: plan (awaiting Codex plan review)
---

# PF-Intel venue facts are public facts, not Alex's experience

### Prior Phase Risk

No brainstorm (skip gate: the input is a measured defect with exact files and lines). The nearest prior phase is the
venue-history plan, whose risk 4 reads: "**The model already claims venue experience it does not have**, with or
without this file (the PF-Intel guidance even models "I've played this room before")."
(`docs/plans/2026-10-11-feat-venue-history-private-file-plan.md`). That risk was real and stayed hidden because
PF-Intel was unreachable on every local run. This plan fixes the guidance it named.

## Revision 2 (after Codex PLAN round 2 = NO-GO on both runs, the 2nd NO-GO; `docs/reviews/2026-10-11-pf-intel-plan-codex-round2.md`)

| # | Finding | Change |
|---|---|---|
| 1 | F4: permission only required after the header (A P1) | F4 bounds the permission inside the venue-history section (defined below); new mutation: move it into a later section |
| 2 | positive control judged differently by two readers (B P1, A P2) | per-field match table below; each venue's values pre-registered in the review record before any run; borderline = no match; a contradiction = F5 fail |
| 3 | usage text is appended after PF-Intel's closing `---` (A P2) | `formatVenueContext` inserts `PF_INTEL_USAGE` before its own closing `---`; context.ts stops appending; F1 asserts the index; mutation: the old append shape |
| 4 | "from Alex's venue database" (B P2) | D1: "public facts about the venue from PF-Intel" |

**Section bounds (used by F1 and F4).** `selectContext` joins sections with `"\n\n---\n\n"`. The PF-Intel section is
the string `formatVenueContext` returns: it starts `"---\n\n## VENUE INTELLIGENCE"` and ends with its closing
`"\n\n---"`. The venue-history section runs from `"## ALEX HAS PERFORMED HERE"` to the next `"\n\n---\n\n"`
separator (or the end of the context).

## Revision 1 (after Codex PLAN round 1 = NO-GO on both runs; `docs/reviews/2026-10-11-pf-intel-plan-codex-round1.md`)

| # | Finding | Change |
|---|---|---|
| 1 | F5 judging rule ambiguous / internally inconsistent (A P1, B P2) | F5 judges by MEANING with examples; borderline = fail; a disagreement can only turn a pass into a fail; Alex's reading is final |
| 2 | one run per lead cannot show stable zero (B P2) | 3 sentinel leads x 3 runs + 3 single leads = **12 runs, 24 drafts, 0 claims allowed**; reported as "0 observed in 24", a smoke test |
| 3 | F1/F4 do not pin the wording (B P2, A P3) | F1 pins `PF_INTEL_USAGE` to the exact D1 text and forbids a phrase list; F4 = permission exactly once, only inside the venue-history section; PF-Intel text exactly once, only inside the PF-Intel section; new mutations |
| 4 | D1 example reads as a venue rule (A P2) | "I'll plan the last set to finish by 9:45" |
| 5 | "uses a vendor policy" undefined (A P2) | a draft states a fact present in that venue's recorded lookup (recorded before the runs) |
| 6 | formatter comment becomes misleading (A P3) | comment states the policy; test comment says it is a policy decision |

## Problem (measured 2026-10-11)

PF-Intel became reachable on 2026-10-11 (`.env` fix, Alex's yes; `docs/END-TO-END-STATUS.md`). Three made-up leads at
PF-Intel venues NOT in Alex's venue file: **2 of 3 claimed familiarity in both drafts**
(`docs/reviews/2026-10-11-venue-history-local-runs.md`, section "PF-Intel venue facts"):

- Estancia La Jolla: "I know the Estancia courtyard, the 10 PM curfew, the residential neighbors nearby"
- Tom Ham's Lighthouse: "Tom Ham's is a venue I know: I load in from the parking lot side, set up in about 20 minutes"

**Root cause:** `src/pipeline/context.ts:46-47` appends to the PF-Intel section: "Venue intel is your insider edge.
If there are past events, reference the venue's track record ... (e.g., "I've played this room before") ... If there
are contacts, mention coordination will be smooth." The model did what it was told. Alex's rule (CLAUDE.md) is that a
venue claim needs his yes, recorded in `~/Data/gig-lead-responder/venue-history.json`; PF-Intel data never had it.

Second source: `src/pipeline/format-venue-context.ts` renders "Performance History" (`event_count`, most recent date)
and "Key Contacts" (names). Today every PF-Intel venue probed has 0 events and 0 contacts, so neither renders, but
the moment PF-Intel gains rows, "N past events" invites "I've played here N times" and a contact name invites
name-dropping a coordinator Alex may never have met.

No test covers either file's prompt text. That is how the "insider edge" line survived.

## Decision

1. **D1 — rewrite the usage line** in `context.ts` as fixed text (exported constant `PF_INTEL_USAGE`):
   > These are public facts about the venue from PF-Intel, not Alex's experience. Use a policy only to
   > answer a logistics concern before the client asks, stated as a fact about the venue or as Alex's plan (for
   > example: "The venue's outdoor curfew is 10 PM, so I'll plan the last set to finish by 9:45."). Never say or imply that Alex
   > knows, has played, has been to, or is familiar with this venue, its rooms, its staff or its load-in. Only Alex's
   > own venue-history section, when one appears further down, allows that.

   The example uses a curfew (a policy), never a first-person memory.
   **Placement (Revision 2):** `formatVenueContext` inserts `PF_INTEL_USAGE` (moved to `format-venue-context.ts` and
   exported) as the last block before its closing `---`, so the usage text is inside the PF-Intel section; context.ts
   pushes the formatter's string unchanged (today it appends the usage line after the closing `---`, outside).
2. **D2 — stop rendering Performance History and Key Contacts** in `formatVenueContext` (a policy decision, stated in
   the function's comment: those fields are fetched but never rendered, populated or not). Venue experience comes only
   from Alex's venue file (his yes). Vendor policies keep flowing unchanged. `VenueContext` and the PF-Intel API are
   unchanged (the data is still fetched; venue-miss logging unchanged).
3. **D3 — no prose detector in this plan.** A post-check for "I know [venue]" phrasing would be a prose detector, the
   shape the price-block cycle showed reviews narrow forever (`docs/solutions/architecture/2026-10-09-app-writes-fixed-lines-model-writes-a-marker.md`).
   Every lead is held for Alex's approve before anything sends (Module 1 not started; nothing auto-sends). The fix is
   measured with real-model runs instead. If runs still show claims after D1, a detector becomes its own plan.

Rejected: removing PF-Intel from the prompt entirely (loses curfew / dB / COI facts that answer real client
concerns; pv1 used the COI fact correctly); keeping Performance History with a "not Alex's" label (a count next to a
venue is the strongest invitation to claim it; nothing uses it today).

## Plan Quality Gate

### 1. What exactly is changing?
`src/pipeline/context.ts` (the usage line → `PF_INTEL_USAGE`); `src/pipeline/format-venue-context.ts` (drop two
sections); one new test file `src/pf-intel-context.test.ts`; the local-runs record.

### 2. What must not change?
PF-Intel fetch, timeout, miss logging (`venue-lookup.ts`, `run-pipeline.ts`); vendor-policy lines and their order;
the venue-history section (`venue-history.ts`) and its placement after PF-Intel; prices, payment terms, the gate,
the post-check; `.env`; `~/Data`. No venue sentence is added or changed.

### 3. How will we know it worked?
EARS below (each test mutation-checked), suite + tsc green, leak check exit 0, and the real-model runs in the
Execution Path: 0 claims observed in 24 drafts (12 runs, 3 sentinel leads repeated 3 times), a policy still used in
at least 6 of 12 runs (positive control), and a file venue still claimed (control). A smoke test, not a proof.

### 4. What is the most likely way this plan is wrong?
**The model claims familiarity anyway**, from vendor policies alone ("set up in about 20 minutes" reads like
experience even when phrased as a plan). Then D1 is not enough and D3's deferred detector is needed. The runs measure
it: 12 runs, 24 drafts. Second: an over-correction where the model stops using policies at all (the positive control
catches it).

### 5. How will a human RUN this, and when?
Claude Code, in this session, on Alex's MacBook, after the tests pass and before Codex code review:
`DATABASE_PATH=<scratch>/x.db npx tsx src/index.ts --json < lead.txt` per lead (`.env` now reaches production
PF-Intel; nothing is sent; it overwrites the clipboard). Prerequisites: the 2026-10-11 `.env` fix (done), the
Anthropic key in `.env` (present). Alex reads the recorded draft lines in the review record.

## Acceptance Tests (EARS)

- **F1** WHEN `selectContext` gets a `VenueContext` with vendor policies, THE SYSTEM SHALL include `PF_INTEL_USAGE`
  exactly once, inside the PF-Intel section: its index is after `## VENUE INTELLIGENCE` and before the index of that
  section's closing `"\n\n---"` (bounds above; Revision 2);
  `PF_INTEL_USAGE` SHALL equal the D1 text byte for byte (pinned in the test, Revision 1); AND the PF-Intel section
  (header through closing `---` plus the usage text) SHALL contain none of, case-insensitive: "you may say so",
  "has performed", "insider", "played this room", "track record", "I've played", "I've performed".
  The D1 text itself contains "knows, has played, has been to, or is familiar with" only inside "Never say or imply
  that Alex ..."; the forbidden list therefore excludes those words, and the byte-for-byte pin guards them. The D1
  text contains none of the forbidden phrases (checked: it no longer names the venue-history header, which holds
  "HAS PERFORMED").
- **F2** WHEN `formatVenueContext` gets `event_count > 0`, `recent_events` and `contacts`, THE SYSTEM SHALL NOT output
  "Performance History", "Key Contacts", the event count, the recent date or any contact name; AND every vendor-policy
  line still appears, in the current order.
- **F3** WHEN the only data is events and contacts (no policies), THE SYSTEM SHALL return "" (no section at all).
- **F4** WHEN a lead's venue is in both PF-Intel and the venue file (test override, never `~/Data`), THE SYSTEM SHALL
  include both sections; the permission "Alex has performed at this venue. You may say so." SHALL appear exactly once
  in the whole context, and its index SHALL lie inside the venue-history section's bounds (after
  `## ALEX HAS PERFORMED HERE`, before the next `"\n\n---\n\n"`; Revision 2), hence outside the PF-Intel section.
- **F5 (real model, smoke test)** 12 runs, 24 drafts (each run gives a full and a compressed draft), at PF-Intel venues
  that have vendor policies and are NOT in Alex's venue file:
  - sentinels, 3 runs each (9 runs): s1 = the pv2 lead (Estancia La Jolla), s2 = the pv3 lead (Tom Ham's Lighthouse),
    s3 = a new lead at Catamaran Resort;
  - singles, 1 run each (3 runs): the pv1 lead (Rancho Bernardo Inn), a new Estancia lead (wedding), a new Tom Ham's
    lead (corporate).
  THE SYSTEM SHALL produce **0 claims in 24 drafts**, judged by the rule below; one claim fails F5. AND the positive
  control: in at least **6 of the 12 runs**, at least one draft states a pre-registered fact, judged by the match
  table below (Revision 2). The result is reported as "0 observed in 24 sampled drafts", a
  smoke test, not a proof that the defect cannot recur.
- **F6 (real model, control)** WHEN a made-up lead at Hotel del Coronado (in the venue file) is run once, THE SYSTEM
  SHALL still say Alex has performed there. Recorded as yes/no only: that draft quotes Alex's private sentence, so its
  words are NOT copied into the repo.

### F5 judging rule (Revision 1: by meaning, not grammar)

A **claim** is any wording that attributes to Alex prior knowledge of, or experience at, this venue: its rooms,
spaces, staff, load-in, layout, neighbors or how events there go. First person or implied, it counts.

| Text | Verdict | Why |
|---|---|---|
| "I know the Estancia courtyard" | claim | first-person knowledge |
| "Tom Ham's is a venue I know" | claim | first-person knowledge |
| "easy load-in at Tom Ham's" / "Tom Ham's has an easy load-in" / "the load-in is straightforward" | claim | a judgment only experience gives, not in the lookup |
| "events at Estancia tend to run late" | claim | experience of how events there go |
| "The venue's outdoor curfew is 10 PM, so I'll plan the last set to finish by 9:45." | not a claim | a lookup fact plus a plan |
| "I carry the liability insurance Rancho Bernardo Inn requires" | not a claim | a lookup fact (COI) about Alex's insurance |
| "I'll coordinate load-in with your venue team" | not a claim | a plan, no knowledge asserted |

### Positive control: what counts as using a lookup fact (Revision 2)

Before any run, the review record lists each venue's non-null vendor-policy fields with their values (pre-registered).
A run counts when at least one of its two drafts **states the field's content** as below. Borderline = no match (the
control gets harder, never easier). A draft that states a **different** value for a recorded field (wrong curfew time,
wrong dB number) is a contradiction: F5 fails, whatever the claim count.

| Field | Match | Not a match |
|---|---|---|
| `curfew_time` | the same clock time stated as a curfew, a hard stop or a music end limit ("outdoor music ends at 10 PM") | "there's a curfew" with no time; a different time (contradiction) |
| `db_limit_value` | the same number with dB or "decibels" | "a volume limit", "keep it quiet" with no number |
| `coi_required: true` | the draft says Alex carries or provides the insurance / COI the venue requires | "paperwork", "the usual forms" |
| `av_exclusivity` | names the venue's in-house AV rule from the note | generic "I bring my own sound" |
| `setup_notes` | states the specific detail written in the note (e.g. note "Load-in via parking lot" → "I can use the parking-lot entrance" matches: it states the detail, as a plan) | a generic plan with no detail from the note ("I'll coordinate load-in") |

A detail matched here is from the lookup, so it is never a claim under the judging rule; a detail NOT in the lookup
stated as known is a claim.

**Procedure:** before the runs, record each venue's lookup (vendor-policy fields only) in the review record. For each
draft, list every sentence that mentions the venue, its spaces, staff, load-in or neighbors, with a verdict. A venue
detail NOT present in that venue's recorded lookup and stated as known counts as a claim. Borderline = claim (fail).
Claude Code judges first and records every listed sentence; Alex reads the record; a disagreement can only turn a
pass into a fail, never the reverse; Alex's reading is final.

## Work steps (one concern per commit; failing test first; mutation-check each test)

1. `src/pf-intel-context.test.ts` F2, F3 (fail) → `format-venue-context.ts` drops the two sections and its comment
   states the policy → green. Mutations: restore Performance History (F2 fails); restore Key Contacts (F2 fails); make
   the empty check count the dropped sections (F3 fails).
2. F1, F4 (fail) → `format-venue-context.ts` inserts `PF_INTEL_USAGE` before its closing `---`; `context.ts` drops
   the appended line → green. Mutations: put back the old line (F1 fails); append "You may say so." to
   `PF_INTEL_USAGE` (F1 fails); change one word of `PF_INTEL_USAGE` (F1 pin fails); the old shape, usage appended after
   the closing `---` (F1 position fails); move the usage text after the venue-history section (F1 position fails);
   emit the venue-history permission twice (F4 fails); move the permission into a later section such as CORE
   PRINCIPLES (F4 bounds fail).
3. Pre-register the lookups (non-null vendor-policy fields and values for Estancia La Jolla, Tom Ham's Lighthouse,
   Catamaran Resort, Rancho Bernardo Inn; commit before the first run) in `docs/reviews/2026-10-11-venue-history-local-runs.md`; then the F5 runs (12) and F6 (1); record
   every listed sentence with its verdict; count.
4. Codex code review (both runs).

## Verification Commands (expected results)

- `npx tsx --test src/pf-intel-context.test.ts` → all pass
- `npm test` → 0 fail (791 + new)
- `npx tsc --noEmit` → exit 0
- `npx tsx scripts/check-venue-history.ts; echo $?` → 0 (gate on the exit code)
- `grep -rn "insider edge\|played this room" src` → no match

## Execution Path

- **Target:** Alex's MacBook, this repo, the CLI (`src/index.ts`) against the real model and production PF-Intel
  (read-only lookups).
- **Mechanism:** `DATABASE_PATH=<scratchpad>/fN.db npx tsx src/index.ts --json < fN.txt` per run (12 F5 runs + 1 F6);
  scratch DB per run; nothing is sent; it overwrites the clipboard. Lookups recorded first with the app's own
  `lookupVenueContext` (`npx tsx --env-file=.env <script>`), vendor-policy fields only.
- **Prerequisites:** `.env` PF-Intel URL + key: ALREADY HAVE (fixed 2026-10-11, verified hit/miss today);
  Anthropic key in `.env`: ALREADY HAVE (the pv1-pv3 runs used it today); suite + tsc green after steps 1-2: MUST
  OBTAIN (produced by the work itself).
- **Who:** Claude Code runs the leads and records every draft's venue lines; Alex reads the record and judges any
  borderline line.
- **Trigger:** right after step 2 commits, before the Codex code-review prompt is written.

Stop and report to Alex if F5 finds any claim or borderline line (then D3's detector is a separate plan, Alex's call) or if the positive
control fails.

## Codex review

Plan review: 2 runs (Claude's run A, Alex's run B); stricter verdict wins; a 2nd NO-GO stops automatic iteration;
round 3 needs Alex's YES; a 3rd NO-GO is the hard cap.

## Feed-Forward

- **Hardest decision:** D3, no detector. The defect is a sentence we wrote; removing it is the root-cause fix, and a
  detector would repeat the price-block loop.
- **Rejected:** dropping PF-Intel from the prompt; labelling Performance History instead of dropping it.
- **Least confident:** that a policy alone ("set up in about 20 minutes") will not still read as experience.

## Three Questions

1. **Hardest decision in this session?** Whether to add a detector now (D3). Not now: measure first.
2. **What did you reject, and why?** Removing PF-Intel entirely (loses real logistics facts); keeping event counts
   with a label (strongest invitation to claim).
3. **Least confident about going into the next phase?** Setup notes. They describe a load-in, and describing a load-in
   in first person is a claim. F5 counts it.
