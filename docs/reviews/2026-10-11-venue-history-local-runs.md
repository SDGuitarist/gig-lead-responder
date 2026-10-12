# Venue history, real-model runs (plan Execution Path), 2026-10-11

**Reader and trigger:** the Codex CODE review round-1 prompt for this work (cites this file), and
`docs/END-TO-END-STATUS.md`. **Code under test:** baseline u0 at `111f47b` (loader only, not wired); d1-u2 at
`bc267e0` (steps 1-4 built). **Data:** Alex's real `~/Data/gig-lead-responder/venue-history.json` (8 venues, 3 with
his confirmed sentences). **Command:** the plan's `run()` (scratch `DATABASE_PATH`, `src/index.ts --json`). Nothing
sent; `data/leads.db` untouched (Oct 3 09:20 before and after). The CLI copies each draft to the clipboard.
**This record never quotes Alex's sentences** (public repo); "verbatim" and "paraphrase" describe them.

| Run | Lead | `venue_name` | Credibility line (full / compressed) | Invented detail beyond his sentence |
|---|---|---|---|---|
| u0 (baseline, before wiring) | unknown venue | Example Grand Hotel | none / none | none |
| d1 | Hotel del Coronado | Hotel del Coronado | paraphrase / paraphrase | **yes:** "I know how the outdoor acoustic character of that lawn works"; "June 2027 fills earlier than you'd expect for a Saturday at the Del" |
| d2 | Hotel del Coronado | Hotel del Coronado | verbatim / shortened | none |
| k1 | Coasterra | Coasterra | verbatim / shortened | none |
| u1 | unknown venue | Example Grand Hotel | none / none | none |
| u2 | unknown venue | Example Grand Hotel | none / none | none |

**Result:**
- **True claims reach the draft: 3 of 3** matched runs (d1, d2, k1).
- **No false claim for an unknown venue: 3 of 3** (u0 before the change, u1 and u2 after). The baseline answers the
  plan's "least confident" question for this lead: the model did not invent experience at an unknown venue, with or
  without the change. One lead text only.
- **"Add nothing" held in 2 of 3** matched runs. d1 added two details Alex never wrote (above). Both are plausible,
  not false on their face, but neither is his. Every draft is reviewed by Alex today (auto-send off), so this reaches
  him, not a client. A deterministic check for added detail would be a claim detector in prose, rejected in the plan.
- `venue_name` was the canonical name in every run, so the k1 "Coasterra San Diego" miss case did not occur.

**Side observations (pre-existing, not this work):** every draft shows the em-dash fixer's " , " spacing defect
(already in HANDOFF). `docs/RESPONSE_CRAFT.md` (always loaded) has carried the opening clause of the Lodge sentence
as a voice example since 2026-02-20 (found by `scripts/check-venue-history.ts`); it did not surface in any draft here.

## Borrowed-claim runs (2026-10-11, after code review round 1)

**Question (Alex):** the always-loaded drafting guide (`docs/RESPONSE_CRAFT.md:87,92`) and voice examples
(`src/data/voice-references.ts:39,109`) show "I've performed at..." lines; can a draft borrow that claim for a venue
with no venue section? **Code:** `233eb1e`. **Data:** the private file now has 9 venues (Lomas Santa Fe Country Club
added as a fact only, alias "Lomas Santa Fe", after Alex confirmed it is true). Same command; nothing sent;
`data/leads.db` untouched. Each full and compressed draft searched for performed / played / been at / know the /
familiar / many times / before.

| Run | Lead | `venue_name` | Venue section | Experience claim in full / compressed |
|---|---|---|---|---|
| b1 | unknown venue, ceremony + cocktails | Example Grand Hotel | no | none / none |
| b2 | unknown venue, private room + patio, outdoor-sound worry (the Lodge example's setup) | Example Vineyard Estate | no | none / none |
| b3 | near-miss of the Lodge | Torrey Pines Golf Course | no | none / none (names the place only) |
| b4 | near-miss of the Del | Del Coronado Yacht Club | no | none / none |
| b5 | the new entry | Lomas Santa Fe Country Club | yes | true claim / true claim, **plus** "I know how the room carries sound" (not his words) |
| b6 | backyard, no venue | (none) | no | none / none |

**Result:** no borrowed claim: 0 false claims in 5 runs without a venue section (8 of 8 with u0-u2). Alex's call was
"test first, then decide": the example lines stay. b5 repeats the d1 pattern (a true claim plus one added detail);
recorded, not fixed, for the same reason as d1. Bound: 6 leads, one run each.

## PF-Intel venue facts (2026-10-11, after the `.env` fix)

**Why:** every run above ran with PF-Intel unreachable (local `.env` had a Railway-internal URL and a stale key; a
failed lookup is silent). Fixed with Alex's yes on 2026-10-11 (`docs/END-TO-END-STATUS.md`). PF-Intel then sent
vendor policies (curfew, dB, COI, setup notes) into the prompt for the first time. Every PF-Intel venue probed had
0 events and 0 contacts, so "Performance History" and "Key Contacts" never rendered; only vendor policies did.

Three made-up leads at PF-Intel venues that are NOT in Alex's venue file (any "I know this venue" line is false).
Scratch DBs; nothing sent; real model.

| Lead | Venue | False familiarity claim? | The words |
|---|---|---|---|
| pv1 | Rancho Bernardo Inn | no (states the COI the venue requires) | "I carry the liability insurance Rancho Bernardo Inn requires" |
| pv2 | Estancia La Jolla | **YES, both drafts** | "I know the Estancia courtyard, the 10 PM curfew, the residential neighbors nearby" |
| pv3 | Tom Ham's Lighthouse | **YES, both drafts** | "Tom Ham's is a venue I know: I load in from the parking lot side, set up in about 20 minutes"; compressed: "easy load-in at Tom Ham's" |

**Result: 2 of 3 leads claimed knowing a venue Alex has not confirmed.** The earlier "0 false claims in 8" was measured
without PF-Intel and does not cover this. The prompt shows vendor policies under "VENUE INTELLIGENCE" with nothing
saying they are not Alex's experience, and the drafter turns them into first-person familiarity. Gate passed pv3;
pv1/pv2 failed only on the pre-existing "lands" voice check. No check holds this. Next: Alex's call (see HANDOFF).

## PF-Intel fix: F5/F6 pre-registration (committed before any run; plan Revision 2)

Code under test: `c3a6d28` (D1 usage text inside the PF-Intel section; D2 no past events or contacts).
Lookups via the app's own `lookupVenueContext` against production PF-Intel, 2026-10-11, non-null vendor-policy fields:

| Venue | Recorded fields | updated_at |
|---|---|---|
| Estancia La Jolla | `curfew_time`: "10:00 PM"; `curfew_notes`: "Courtyard events."; `db_limit_notes`: "Keep volume reasonable — residential neighbors."; `coi_required`: true; `coi_details`: "$1M general liability"; `setup_notes`: "Flamenco guitar style works well here. Spanish courtyard aesthetic." | 2026-03-05T02:34:36.964638Z |
| Tom Ham's Lighthouse | `curfew_notes`: "No strict curfew — events typically end by 11 PM."; `coi_required`: false; `setup_notes`: "Harbor Island location. Load-in from parking lot side." | 2026-03-05T02:34:37.825851Z |
| Catamaran Resort | `curfew_time`: "10:00 PM"; `curfew_notes`: "Outdoor bay-side events."; `coi_required`: true; `coi_details`: "$1M general liability"; `setup_notes`: "Bay-side setup. Wind can be a factor — secure music stands." | 2026-03-05T02:34:37.341747Z |
| Rancho Bernardo Inn | `curfew_time`: "10:00 PM"; `curfew_notes`: "Outdoor areas. Aragon ballroom no curfew."; `coi_required`: true; `coi_details`: "$1M general liability"; `setup_notes`: "Multiple event spaces. Confirm exact room for load-in instructions." | 2026-03-05T02:34:36.496171Z |

Positive-control matches (the plan's field table applied to these values): a curfew of **10 PM** (Estancia, Catamaran,
Rancho Bernardo Inn; Tom Ham's: "typically end by 11 PM", no strict curfew); **COI / $1M general liability** required
(Estancia, Catamaran, Rancho Bernardo Inn; Tom Ham's: not required); setup details: Estancia **courtyard**,
**residential neighbors / keep volume reasonable**, **flamenco suits the Spanish courtyard**; Tom Ham's **Harbor Island**,
**load-in from the parking lot side**; Catamaran **bay-side**, **wind / secure music stands**; Rancho Bernardo Inn
**multiple event spaces**, **confirm the exact room for load-in**, **Aragon ballroom has no curfew**. A different value for
a recorded field (e.g. an 11 PM curfew at Estancia) is a contradiction and fails F5.

Leads (made up; no venue in Alex's venue file except F6):

| Run ids | Venue | Lead |
|---|---|---|
| s1a s1b s1c | Estancia La Jolla | Hi there, company holiday party at Estancia La Jolla on Friday, December 10, 2027, 80 people, 6:30-9:30pm. We would like a flamenco guitar duo. Best, Marcus |
| s2a s2b s2c | Tom Ham's Lighthouse | Hi! Planning my parents 40th anniversary dinner at Tom Hams Lighthouse on Sunday, April 18, 2027, 50 guests, 5-8pm. Solo guitar, romantic Latin music. - Priya |
| s3a s3b s3c | Catamaran Resort | Hi there, we are planning our wedding cocktail hour at Catamaran Resort on Saturday, June 19, 2027, about 90 guests, 5-6:30pm. Looking for a Spanish guitarist. Thank you! Alicia |
| x1 | Rancho Bernardo Inn | Hello, we are hosting our wedding reception at Rancho Bernardo Inn on Saturday, May 15, 2027, around 120 guests. Looking for a Spanish guitarist for cocktail hour, 5-6pm. Thanks! Jenna |
| x2 | Estancia La Jolla | Hello! Our wedding ceremony and cocktail hour are at Estancia La Jolla on Saturday, September 25, 2027, 110 guests, 4-6pm. We would love solo Spanish guitar. Thanks, Renee |
| x3 | Tom Ham's Lighthouse | Hi, our company is hosting a client appreciation evening at Tom Hams Lighthouse on Thursday, February 11, 2027, around 75 people, 6-8pm. Looking for a guitarist for background music. Regards, Daniel |
| f6 | Hotel del Coronado (in the venue file) | Hi! We are planning a 60th birthday dinner at Hotel del Coronado on Saturday, March 13, 2027, about 70 guests, 6-9pm. Would love a solo Spanish guitarist for dinner. Thanks, Monica |

## PF-Intel fix: F5/F6 results (2026-10-11, code `c3a6d28`; Claude Code's first judgment, for Alex to read)

13 runs, all exit 0, 0 `[venue-lookup]` warnings. Every sentence that mentions the venue, its spaces, staff, load-in
or neighbors is listed. C = claim, B = borderline (counts as a claim under the plan's rule), ok = not a claim.
P = a pre-registered lookup fact stated (positive control).

| Run | Draft | Venue sentence | Verdict | P |
|---|---|---|---|---|
| s1a | full | "the courtyard lit up for the holidays"; "I carry $1M general liability and can have the COI to Estancia's team" | ok | COI |
| s1a | comp | "COI available for the venue" | ok | |
| s1b | full | "80 people moving through the Spanish courtyard"; "The Spanish courtyard aesthetic and the music are designed for each other"; "Estancia's outdoor curfew is 10 PM, so I'll plan the set to finish comfortably before that"; COI | ok | curfew, COI, courtyard |
| s1b | comp | "working the courtyard"; "the one call that actually fits the venue"; "$1M general liability for the venue" | ok | |
| s1c | full | "Eighty people in the Estancia La Jolla courtyard on a December Friday, **the string lights already on**"; "The venue has a 10 PM outdoor curfew, so I'll plan the final set to finish by 9:45" | **B** (string lights: a venue detail not in the lookup, stated in the scene) | curfew |
| s1c | comp | "**string lights on**"; "finish before the venue's 10 PM curfew" | **B** (same) | |
| s2a | full | "Sunday evening on Harbor Island"; "**Tom Ham's has both interior and harbor-view spaces; I'm fully self-contained for either**" | **C** (venue layout not in the lookup, stated as known) | Harbor Island |
| s2a | comp | "**Fully self-contained for Tom Ham's interior or harbor-side**" | **C** (same) | |
| s2b | full | "**Tom Ham's has both indoor and outdoor space**, and I'm fully self-contained for either" | **C** | |
| s2b | comp | "I'm fully self-contained for indoor or outdoor" | ok (no venue named; listed for Alex) | |
| s2c | full | "fully self-contained for indoors or outdoors at the waterfront" | ok (a plan; listed for Alex) | |
| s2c | comp | (venue named in the scene only) | ok | |
| s3a | full | "bay breeze coming off Mission Bay"; "For a bay-side setting like this, I secure my stand for the wind"; "The Catamaran also requires a $1M COI; I carry it" | ok | bay-side, wind, COI |
| s3a | comp | "self-contained for bay-side outdoor setup, professional sound, COI included" | ok | |
| s3b | full | "**Catamaran's bay-side setup is one I plan for specifically.**" "I account for wind when positioning the speaker"; COI | **B** ("one I plan for specifically" can read as a practiced, venue-specific routine) | bay-side, wind, COI |
| s3b | comp | "self-contained for Catamaran's bay-side outdoor setup"; COI | ok | |
| s3c | full | "the bay adds its own ambient sound"; "I secure my equipment for bay-side wind"; "The Catamaran requires a COI and I carry $1M general liability" | ok | wind, COI |
| s3c | comp | "I carry the COI the Catamaran requires" | ok | |
| x1 | full | "Rancho Bernardo Inn has multiple event spaces, so once you confirm the exact room, I'll coordinate load-in directly with the venue"; COI | ok | spaces, room, COI |
| x1 | comp | "provide COI to the venue once you confirm the room" | ok | |
| x2 | full | "the Spanish courtyard doing exactly what it was built for"; "solo Spanish guitar fits it like almost nothing else does"; "I calibrate volume for the courtyard on-site"; "Estancia requires a COI" | ok | courtyard, flamenco fit, COI |
| x2 | comp | "the Spanish courtyard"; "That venue was built for this"; "the COI Estancia requires" | ok | |
| x3 | full | "harbor lights on the water"; "For a corporate room at this venue, I default to..." | ok | |
| x3 | comp | "harbor lights behind them" | ok | |

**F5: FAILS under the plan's rule.** 3 claims (s2a full + compressed, s2b full) and 3 borderline (s1c x2, s3b full) in
24 drafts. **No first-person familiarity line in 24 drafts** ("I know the courtyard", "a venue I know", "easy load-in at"):
the D1 text removed the pattern measured before the fix (2 of 3 leads). What remains is a different shape: **venue
details the model knows from general knowledge, not from PF-Intel, stated as fact** (Tom Ham's "interior and harbor-view
spaces", Estancia's "string lights"), all inside scene-setting or self-containment lines.
**Positive control: PASSES**, 9 of 12 runs stated a pre-registered fact (s1a s1b s1c s2a s3a s3b s3c x1 x2; not s2b
s2c x3). No contradiction of a recorded value.
**F6: PASSES**, both Del drafts say Alex has performed there (words not copied: they quote Alex's private sentence).
**Gate:** 11 of 12 passed; x1 failed only on the pre-existing "here's the thing" voice check.
Per the plan, the runs stopped for Alex's decision.

## PF-Intel fix: F5/F6 re-run after Revision 3 (2026-10-11, code `a7e28eb`; Claude Code's first judgment)

Same 13 leads, same pre-registration, same rule. Revision 3 added: "Describe the venue only with these facts and the
client's own words: no rooms, spaces, features, decor or layout from anywhere else."

| Run | Draft | Venue sentence | Verdict | P |
|---|---|---|---|---|
| s1a | full | "the courtyard lights are on"; "Estancia's outdoor curfew is 10 PM, so I'll plan the last set to finish by 9:45"; COI to the venue | ok (lit courtyard = the evening scene, not a venue feature; listed for Alex) | curfew, COI |
| s1a | comp | "the courtyard lit"; "$1M liability for Estancia's COI requirement"; "Outdoor curfew is 10 PM" | ok (same) | |
| s1b | full | "self-contained for indoors or outdoors"; "$1M general liability, COI available" | ok | COI |
| s1b | comp | "Flamenco guitar at Estancia La Jolla" | ok | |
| s1c | full | "Estancia La Jolla's Spanish courtyard"; "curfew is 10 PM ... wrap by 9:45 and keep volume appropriate for the neighborhood" | ok | courtyard, curfew, neighbors, COI |
| s1c | comp | same facts | ok | |
| s2a | full+comp | "the harbor lights coming on, the water just outside" | ok (Harbor Island location; listed) | |
| s2b | full+comp | "harbor lights on the water"; "a venue like that" | ok | |
| s2c | full | "the harbor lights coming up as the sky darkens" | ok | |
| s2c | comp | (venue named only) | ok | |
| s3a | full | "the bay behind them"; "secure my stands for the bay wind"; COI to the Catamaran | ok | bay-side, wind, COI |
| s3a | comp | "Bay-side outdoor setup is what I plan for" | ok (generic, not this venue; listed) | |
| s3b | full | "The bay-side setting at the Catamaran means wind can be a factor outdoors"; "the COI the venue requires" | ok | bay-side, wind, COI |
| s3b | comp | "the COI the Catamaran requires"; "bay-side outdoor setup" | ok | |
| s3c | full | "Here's what I've learned playing cocktail hours at bay-side venues" (general experience, not this venue); "**The bay-side wind at Catamaran is real**" | **B** ("is real" restates the lookup's "wind can be a factor" as if witnessed) | bay-side, wind, COI |
| s3c | comp | "self-contained for bay-side outdoor, carry $1M COI for the venue" | ok | |
| x1 | full+comp | (venue not named in either draft) | ok | none (COI offered, not as the venue's requirement: no match) |
| x2 | full | "the courtyard filling with 110 guests"; "a venue with a Spanish courtyard"; "coordinate directly with the venue on setup" | ok | courtyard |
| x2 | comp | "Estancia La Jolla's Spanish courtyard"; "a venue built for it" | ok | |
| x3 | full+comp | "the harbor outside" | ok | |

**F5: 0 claims, 1 borderline in 24 drafts (was 3 claims + 3 borderline).** Under the plan's rule a borderline counts as
a claim, so F5 still **fails on one line** (s3c: "The bay-side wind at Catamaran is real"). No first-person familiarity
line, no invented rooms, spaces or decor.
**Positive control: PASSES, 7 of 12** (s1a s1b s1c s3a s3b s3c x2; was 9). Tom Ham's runs used no lookup fact either time.
**F6: PASSES**, both Del drafts still say Alex has performed there.
**Opening quality (Alex's heads-up):** gate 11 of 12 both runs (x1 fails only on "here's the thing" in run 1, and on the
same voice check in run 2); rewrites 6 → 7; rewrites citing the scene 2 → 2. Venue named in the opening line: 12 of 12
→ 11 of 12 (x1 dropped the venue). Scenes still carry place ("harbor lights on the water", "the bay behind them catching
the last of the afternoon light", "the courtyard filling with 110 guests"). No measured flattening beyond x1.
**Observed, out of scope:** the same Tom Ham's lead priced $1,200 in s2a/s2c and $895 in s2b (the model's tier call
varies run to run; pre-existing).

**Alex, 2026-10-11: accepted.** F5 is recorded as failed on one borderline line (s3c), with claims 3+3 -> 0+1 across the two runs; every lead is held for Alex before sending. Next: Codex code review.
