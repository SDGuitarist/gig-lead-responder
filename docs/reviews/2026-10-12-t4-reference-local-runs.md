# T4 reference lead: real-model runs (plan Execution Path, step 4), 2026-10-12

**Reader and trigger:** the Codex CODE review round-1 prompt for this work (not written yet; blocked on these runs
passing, per the plan's FAIL rule); HANDOFF. **Plan:** `docs/plans/2026-10-11-feat-t4-reference-lead-plan.md`
(Revision 1b). **Mechanism:** a scratch script (kept outside the repo) calls
`runPipeline(text, undefined, undefined, undefined, "2026-10-12")`: real model, scratch `DATABASE_PATH`, nothing
sent, clipboard untouched; `data/leads.db` mtime identical before and after every run. Lead texts: the plan's table,
verbatim. **No private text is quoted here:** venue claims in drafts come from Alex's private venue file and are
described, never copied, in this public repo.

**Instrument checked first:** the copy check (30-character windows of the reply, whitespace collapsed), the phrase
list and the D6 word check each fired on a known positive and stayed quiet on a known negative (self-test PASS)
before they touched a draft.

## Set 1: code at `57504d6` (block as shipped in steps 1 to 3)

| Lead | Classification (expected) | Price line | Payment sentence (expected) | Verdict |
|---|---|---|---|---|
| t1 | T4, **short** (urgent), solo 2 h, 40 | $1,350 (OK) | full x1 in both drafts (OK) | **FAIL** |
| t2 | T4, urgent, solo 2 h, 30 | $1,350 (OK) | full x1 in both (OK) | **FAIL** |
| t3 | T4, comfortable, solo 3 h, 70 | $1,800 (OK) | twoMonths x1 in both, not the example's sentence (OK) | **FAIL** |
| t4 control | T2 (not T4), no block in the prompt (OK) | $700 | twoWeeks x1 in both (OK) | PASS |

**Threshold (Alex, 2026-10-12): any ONE copied sentence or window, invented venue claim, or untraceable time/number
fails the run.** What was found, by hand read plus the attribution test (a window counts as a copy only if it is not
also mandated by other prompt text):

- **t1 copied** (both drafts): the example's clause "so I set levels from where your guests ...", its physical
  problem "surf and wind swallowing the guitar", its distinctive phrase "putting the agenda down", and its genre
  default "Spanish guitar, bossa nova, and familiar ... covers" (the app's own genre default is fingerstyle jazz and
  light acoustic pop; the no-block run said that).
- **t2 copied:** "I set levels from where your guests sit" (39 characters, verbatim). **t2 invented physical
  detail:** "wind, ambient noise from the water" for a terrace the lead gives no setting detail for (the plan's
  `NO INVENTED FACTS` rule is in the block). Step 4 of the block ("one physical problem of this setting") invites it.
- **t3 venue claim past the fact:** the history entry for this venue is fact-only (it records that Alex has played
  there and nothing more); the draft added a claim of knowing the venue's spaces. The no-block run added a similar
  overreach (a claim of knowing what the room calls for), so the block neither caused nor prevented it.
- **Not findings (attributed):** "Full payment holds the date." (mandated by Quote Terms); "Want me to lock it in?"
  (Alex's standard close, `docs/LEAD_RESPONSE_VOICE.md`, `docs/DRAFT_METHOD.md`); the liability-insurance and COI
  wording (`docs/RESPONSE_CRAFT.md`); t1's statements about having played that venue, which come from the confirmed
  entry in the private venue file (checked by boolean; the content is deliberately not described here), and the
  no-block run made the same kind of statement too. A 30-character window made only of mandated sentences (payment sentence + close + sign-off)
  fires the mechanical copy check without being a copy; the check is not changed in response to a FAIL (plan), and
  this is listed for Alex below.

**What the block did well:** t2 (urgent) opens "I'm available Friday, October 16." as the plan intends (the no-block
run put availability last); t3 took the payment sentence from Quote Terms, not from the example; t2 made no
played-here claim at the unknown venue (the no-block run did not either); t4 carries no T4 structure.

**Found, not caused by this work (no-block run reproduces it):** t1's event is 6 days out, the classifier's own
Step 5 says "Urgent: under 2 weeks", and it returned `short` in both runs. The block then used its non-urgent
opening, correctly for the band it was given. The band is a classifier defect that changes which opening T4 leads
get; it needs its own item.

**Result: Set 1 FAILS the smoke test. Per the plan: no code review; the block's wording changes (never the check)
and all four leads re-run; a second FAIL is shown to Alex before a third set (it happened: see set 2).**

## Set 2: code at the wording iteration (block instructions changed; the example, the tests' word lists and the copy check are NOT changed)

**What changed in the block:** the example now comes BEFORE the rules (the rules are the last thing read); step 4
("one physical problem") applies only when the lead's own details give one; a `DO NOT REUSE` paragraph names the
example's own moves (sunset line, "agenda" line, surf-and-wind line, its way of setting levels, its genre list); a
venue statement is capped at what the history section says. Tests, 13 step-1 mutations and the full suite re-run
green (839 pass, 1 skip).

| Lead | Classification | Payment sentence | Verdict |
|---|---|---|---|
| t1 | T4, **short** (urgent expected; same classifier miss) | full x1 in both drafts (OK) | **FAIL** |
| t2 | T4, urgent, solo 2 h, 30 | full x1 in both (OK) | PASS on copying; one note (below) |
| t3 | T4, comfortable, solo 3 h, 70 | twoMonths x1 in both, not the example's sentence (OK) | PASS |
| t4 control | T2, no block in the prompt | twoWeeks x1 in both (OK) | PASS |

- **t1 still copies (full draft):** "I set levels from where your guests are sitting" (the example's clause, one word
  changed; the 36-character window still matches), and "shedding the day's agenda around a fire" (the example's
  "put the agenda down" image, which the phrase list missed because the wording moved). "The sky going amber" adds a
  light condition the lead did not give. The compressed draft repeats the image ("the fire takes over as the light
  drops"). **This fails the threshold; set 2 fails.**
- **t2 is copy-clean this time:** the only shared windows are the mandated payment sentence and the standard close.
  Note, not a copy: the draft promises a COI "within a day of booking" where `docs/RESPONSE_CRAFT.md` says "within a
  few days" (also in set 1).
- **t3 is clean:** no shared windows; the venue statement stops at the fact that Alex has played there, plus a skill
  claim about reading a room; the set 1 overreach (a claim of knowing the venue's spaces) is gone.
- **Retracted:** t1's load-in line (service entrance, golf cart) is real PF-Intel setup data for that venue (a live
  read, 2026-10-12), not an invented fact.
- **`verified=false` on t2, t3 and the t4 control (set 2 only):** the app's own voice kill-list rejected one word
  ("land"/"lands") after the gate's retries. The t4 control has no block, so this is existing model variance, not this
  feature; set 1 verified on all four.

**Result: two sets, two FAILs (both on t1).** A third set ran only after Alex's decisions (Revision 1c); see set 3.

**Open for Alex (decisions, not mine):**
1. **The copy check's noise:** a 30-character window built only of mandated sentences (payment sentence + the
   standard close + sign-off) fires the mechanical check without being a copy (t1, t2, t3 in both sets). The plan
   forbids changing the check after a FAIL; it needs a decision made with no draft in front of it.
2. **t1's band:** a 6-day event comes back `short`; the classifier's own rule says urgent. Separate item.
3. **Whether t1 can pass at all:** the lead is the example's own setting (a beach bonfire at the same hotel), so the
   physical problem and the image are legitimately the same; "never copy a clause" and "same setting" pull against
   each other. A different t1 setting would test the block, not the example's venue.

## Set 3: code at `ead1814` (block wording of set 2; t1 replaced; mandated text cut before copy windows)

**Pre-registered in the plan BEFORE the run** (Revision 1c, `ead1814`, Alex 2026-10-12): t1 is now a terrace
reception for 60 at The Lodge at Torrey Pines on Wednesday, October 21 (9 days out; a history venue; not the
example's hotel or beach); "mandated text" (payment sentences, "Want me to lock (it) in ...?", the sign-off) is cut
out of a draft before 30-character windows are taken. The check self-tested first (mandated-only text reports 0; a
copied clause reports it). **Re-count of the earlier sets under the new rule** (windows, full / compressed): set 1:
t1 19 / 12, t2 11 / 0, t3 0 / 0; set 2: t1 12 / 0 (the retired Del lead), t2 0 / 0, t3 0 / 0.

| Lead | Classification (expected) | Price | Payment sentence | Copy windows (full / compressed) | Verdict |
|---|---|---|---|---|---|
| t1 | T4, **urgent**, solo 2 h, 60 (all OK) | $1,350 | full x1 in both (OK) | 0 / 0 | **FAIL: one untraceable time (below)** |
| t2 | T4, urgent, solo 2 h, 30 (OK) | $1,350 | full x1 in both (OK) | 0 / 0 | PASS (notes) |
| t3 | T4, comfortable, solo 3 h, 70 (OK) | $1,800 | twoMonths x1 in both (OK) | 0 / 0 | PASS (note) |
| t4 control | T2 (not T4), no block in the prompt | $700 | twoWeeks x1 in both (OK) | 0 / 0 | PASS |

- **t1 finding (both drafts):** the draft says "By 5:15" (full) and "By 5:15, the terrace is filling" (compressed). The
  lead states 5 to 7pm; 5:15 is not in it. It is a scene time inside the stated window, not a looked-up fact (the
  example's sunset was that), but the threshold Alex set is "any ONE time or number not traceable to the lead".
  **Recorded as a FAIL under that rule.**
- **t1 passes everything else:** no shared windows; opens "I'm available October 21." (urgent band, now classified
  correctly at 9 days); the venue statements trace to the confirmed entry in the private venue file
  (checked by boolean; the content is deliberately not described here); payment sentence from Quote Terms.
- **t2 notes, not copies:** "within a day of booking" for the COI (the app text says "within a few days"; same
  drift as sets 1 and 2); "Spanish classical and bossa nova" echoes the example's genre list (the attribution test
  finds "bossa nova" elsewhere in the prompt too, so it is not exclusively the example's). No claim about the
  unknown venue.
- **t3 note:** "talk to each other" appears (the example has "talk to each other"); a common phrase, four words, no
  window match. The set 1 overreach (a claim of knowing the venue's spaces) did not recur; the claim stops at the fact that Alex has played there.
- **`verified=false` on t3 and the t4 control:** the app's own voice kill-list ("lands"/"land"); the control has no
  block. t1 and t2 verified.

**Result: Set 3 still FAILS under the pre-registered rule, on one item in one lead, and the failure has changed
kind: copying is gone (0 windows in 8 drafts); what remains is a scene time the model put inside the stated window.**
A fourth set is Alex's call (HANDOFF).

## Set 4: code at `c5a1272` (block gains "use only the times the lead states; put no clock time of your own on a moment inside their window")

Pre-registered in the plan (Revision 1d) before the run; same four leads, same copy check (Revision 1c exclusion),
same threshold. Self-test PASS.

| Lead | Classification | Price | Payment sentence | Copy windows (full / compressed) | Verdict |
|---|---|---|---|---|---|
| t1 | T4, solo 2 h, 60; band **short** (urgent expected) | $1,350 | full x1 in both (OK) | 0 / 0 | PASS |
| t2 | T4, urgent, solo 2 h, 30 | $1,350 | full x1 in both (OK) | 0 / 0 | **literal FAIL: one untraceable number (below)** |
| t3 | T4, comfortable, solo 3 h, 70 | $1,800 | twoMonths x1 in both (OK) | 0 / 0 | PASS |
| t4 control | T2 (not T4), no block in the prompt | $700 | twoWeeks x1 in both (OK) | 0 / 0 | PASS |

- **t1 PASS:** no clock time of its own ("five o'clock" is the lead's own 5pm start; set 3's "5:15" is gone); no
  window shared with the reply; its statements about having played the venue and knowing its spaces trace to the
  confirmed entry in the private venue file (boolean check, text not printed; the draft's words are not quoted here).
- **t2 literal FAIL:** "can send the resort a COI within 24 hours of booking". The app text says "within a few
  days" (`docs/RESPONSE_CRAFT.md`); sets 1 to 3 said "within a day"; the number drifts a little further each run.
  It is not from the example and not the block's rule: it is the model writing its own COI timeline, which is
  Alex's separate COI item (2026-10-12: COI "available upon request"). Recorded as a FAIL under the literal rule, and
  attributed to that item.
- **t3 PASS:** "load-in through the service road" and "the venue requires a COI" are real PF-Intel setup and policy
  data for that venue (live read 2026-10-12), not inventions; the venue claim stops at the fact that Alex has played there; the
  payment sentence is the lead-time one, not the example's.
- **Band:** t1 (9 days out) returned `short` here and `urgent` in set 3, same text, same date. The classifier miss is
  intermittent (6 days `short` in sets 1 and 2; 9 days `urgent` then `short`), which makes it a classifier item, not a
  property of this block.
- **`verified=false` on t2 and the t4 control:** the app's voice kill-list ("land", "here's the thing"); the control
  has no block.

**Result: Set 4 has no copy, no invented time, no unsupported venue claim in any T4 draft. One literal FAIL (t2's COI
number) belongs to the COI item. Smoke test status: the block's own rules pass; the COI wording is open.**

## No-block control (code at `1b353f8`, before the block existed; t1 to t3)

Run to separate what the block caused from what the model does anyway. Same leads, same date, scratch DB. Findings
above marked "no-block run" come from here. Its drafts used the app's own genre default and generic scene lines, and
none of the example's clauses.
