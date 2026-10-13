# Clarification gate re-run after the scoped opening rule (plan step 5), 2026-10-13

**Code:** `f375f9c` (prompt change `ead7385`; plan `docs/plans/2026-10-13-fix-clarification-gate-opening-plan.md`,
Revision 1b). **Method:** the committed runner, 3 parallel processes x 6 made-up vague leads, 1 run each (18 runs), real
model, scratch databases under one output directory, today pinned to 2026-10-12, nothing sent. **Observational: 18
runs, one model, made-up leads, one run per lead per process.** The baseline is the same set before the change
(`docs/reviews/2026-10-13-clarification-gate-measurement.md`: 17 drafts, 0 verified).

## Result against the baseline

| | Before (`d1c5941` + gate unchanged) | After |
|---|---|---|
| runs | 18 | 18 |
| no draft (`GenerationError`) | 1 | 2 (both "exactly one question") |
| drafts returned | 17 | 16 |
| `verified: true` | **0** | **2** |
| drafts with `lead_specific_opening` false in the final gate | 17 | 8 |

## The plan's decision table, one category per run

| Category | n | Runs |
|---|---|---|
| No draft or `GenerationError` | 2 | `a v4`, `c v6` (one-question rule) |
| Hard condition fails (scene structural 3, competitor true 1) | 4 | `a v2`, `a v3`, `a v5`, `b v1` |
| Opening-only arithmetic candidate STILL failing on `lead_specific_opening` | **4** | `b v3`, `c v2`, `c v3`, `c v5` |
| `lead_specific_opening` true, not verified (another check) | 3 | `b v2` (no false check; reason not recorded), `b v4` (named fear, differentiated), `c v1` (sounds_like_alex) |
| Opening still false plus another cause | 3 | `a v1`, `a v6` (both plus sounds_like_alex), `b v6` |
| Verified, opening passes the anchor, gate detail consistent | 2 | `b v5`, `c v4` |
| Verified but gate detail inconsistent with its rule | 0 | -- |
| Snapshot regression (G2) | 0 | suite 939 pass / 0 fail / 1 skip |

## The openings, read

Verified (both pass the minimum anchor):

- `b v5`: "Spring in San Diego, a private event coming together, and you've already made the call that live music is the
  difference between a nice evening and one people actually remember." (repeats the lead's time frame and event)
- `c v4`: "A private celebration with live music and no format picked yet , that's actually the best moment to catch
  you ..." (the lead said "a party" and "not sure what's best"; "private celebration" paraphrases the occasion, so
  this is the borderline pass of the two; the lead's own doubt is restated)

The 4 opening-only failures, read against the definition:

| Run | Opening | Reading |
|---|---|---|
| `b v3` | "A wedding music inquiry with no date, no venue, no format , just a price question , is actually the most useful place to start ..." | repeats the lead's words (wedding, price question): by the definition this should PASS; the verifier failed it |
| `c v2` | "A private event where someone actually decided live music mattered enough to look for it , that's the first good sign." | no word from the lead; the failure is consistent with the definition |
| `c v3` | "She reaches the end of the aisle and the guitar is already there ..." | a scene, nothing the lead wrote; consistent |
| `c v5` | "Someone reaching out about live music before they've locked in the date, the venue, or the guest count ..." | the lead's spring time frame is not used; consistent |

So 3 of the 4 failures are openings that do not repeat the lead; 1 (`b v3`) is a draft the definition would pass and
the verifier did not. The model writing the drafts is the larger factor: it rarely repeats the lead's words.

## What this means under the plan

- The decision table's third row fires: openings still failing on `lead_specific_opening` alone, **4 runs**. The
  action it names is STOP and return to Alex; no further wording round in this cycle.
- The scoped definition did move the gate: 0 to 2 verified and 17 to 8 drafts failing the opening. It is also
  discriminating: 3 of the 4 remaining failures are drafts that never use the lead's words.
- What moves the other drafts is outside this plan: 4 hard-condition fails (scene, competitor), 6 failing a voice or
  gut check, 2 no-draft runs.
- "Exactly one question": 2 of 18 here; 6 of 72 runs over the four measurements (3, 0, 1, 2 of 18).

## Limits

- 18 runs, one model, made-up leads, one run per lead per process; two verified drafts is a count, not a rate.
- The verified drafts' passing the anchor is my reading of two sentences, not a second reviewer's.
- `b v2` has no false gut check and no recorded reason; its failure is not explained by the recorded fields.
