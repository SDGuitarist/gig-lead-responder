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
   > These are public facts about the venue from Alex's venue database, not Alex's experience. Use a policy only to
   > answer a logistics concern before the client asks, stated as a fact about the venue or as Alex's plan (for
   > example: "Estancia's outdoor curfew is 10 PM, so the last set ends by 9:45."). Never say or imply that Alex
   > knows, has played, has been to, or is familiar with this venue, its rooms, its staff or its load-in. Only a
   > section headed "ALEX HAS PERFORMED HERE" allows that.

   The example uses a curfew (a policy), never a first-person memory.
2. **D2 — stop rendering Performance History and Key Contacts** in `formatVenueContext`. Venue experience comes only
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
Execution Path: 0 familiarity claims at non-file venues, a policy still used (positive control), and a file venue
still claimed (control that D1 did not silence the venue file).

### 4. What is the most likely way this plan is wrong?
**The model claims familiarity anyway**, from vendor policies alone ("set up in about 20 minutes" reads like
experience even when phrased as a plan). Then D1 is not enough and D3's deferred detector is needed. The runs measure
it: 6 leads, 12 drafts. Second: an over-correction where the model stops using policies at all (the positive control
catches it).

### 5. How will a human RUN this, and when?
Claude Code, in this session, on Alex's MacBook, after the tests pass and before Codex code review:
`DATABASE_PATH=<scratch>/x.db npx tsx src/index.ts --json < lead.txt` per lead (`.env` now reaches production
PF-Intel; nothing is sent; it overwrites the clipboard). Prerequisites: the 2026-10-11 `.env` fix (done), the
Anthropic key in `.env` (present). Alex reads the recorded draft lines in the review record.

## Acceptance Tests (EARS)

- **F1** WHEN `selectContext` gets a `VenueContext` with vendor policies, THE SYSTEM SHALL include `PF_INTEL_USAGE`
  exactly once and SHALL NOT include "insider edge", "I've played this room" or "track record".
- **F2** WHEN `formatVenueContext` gets `event_count > 0`, `recent_events` and `contacts`, THE SYSTEM SHALL NOT output
  "Performance History", "Key Contacts", the event count, the recent date or any contact name; AND every vendor-policy
  line still appears, in the current order.
- **F3** WHEN the only data is events and contacts (no policies), THE SYSTEM SHALL return "" (no section at all).
- **F4** WHEN a lead's venue is in both PF-Intel and the venue file (test override, never `~/Data`), THE SYSTEM SHALL
  include both sections, and the permission "Alex has performed at this venue. You may say so." SHALL appear only in
  the venue-history section.
- **F5 (real model)** WHEN 6 made-up leads at PF-Intel venues with policies and NOT in the venue file are run (pv2 and
  pv3 again, plus 4 new at Rancho Bernardo Inn, Catamaran Resort, Fairmont Grand Del Mar if not matched by the file's
  "Grand Del Mar" entry else another policy venue, and Estancia again with a different event), THE SYSTEM SHALL produce
  0 drafts (of 12) that say or imply Alex knows, has played, or has been to the venue; AND at least 3 of the 6 leads
  SHALL use a vendor policy (positive control).
- **F6 (real model, control)** WHEN a made-up lead at Hotel del Coronado (in the venue file) is run, THE SYSTEM SHALL
  still say Alex has performed there.

Judging F5 by hand: a "claim" is any first-person statement of knowing, having played, having been to, or being
familiar with the venue, its rooms, staff or load-in. A plan ("I'll load in through the service entrance") with no
claim of prior knowledge is not a claim; "easy load-in at Tom Ham's" is a claim (it asserts knowledge of the load-in).
Borderline lines are listed for Alex, not counted as passes.

## Work steps (one concern per commit; failing test first; mutation-check each test)

1. `src/pf-intel-context.test.ts` F2, F3 (fail) → `format-venue-context.ts` drops the two sections → green.
   Mutations: restore Performance History (F2 fails); restore Key Contacts (F2 fails); make the empty check count the
   dropped sections (F3 fails).
2. F1, F4 (fail) → `context.ts` uses `PF_INTEL_USAGE` → green. Mutations: put back the old line (F1 fails); add
   "You may say so." to `PF_INTEL_USAGE` (F4 fails).
3. Real-model runs F5, F6; record every draft's venue lines in `docs/reviews/2026-10-11-venue-history-local-runs.md`.
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
- **Mechanism:** `DATABASE_PATH=<scratchpad>/fN.db npx tsx src/index.ts --json < fN.txt` per made-up lead; scratch
  DB; nothing is sent; it overwrites the clipboard.
- **Prerequisites:** `.env` PF-Intel URL + key: ALREADY HAVE (fixed 2026-10-11, verified hit/miss today);
  Anthropic key in `.env`: ALREADY HAVE (the pv1-pv3 runs used it today); suite + tsc green after steps 1-2: MUST
  OBTAIN (produced by the work itself).
- **Who:** Claude Code runs the leads and records every draft's venue lines; Alex reads the record and judges any
  borderline line.
- **Trigger:** right after step 2 commits, before the Codex code-review prompt is written.

Stop and report to Alex if F5 finds any claim (then D3's detector is a separate plan, Alex's call) or if the positive
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
