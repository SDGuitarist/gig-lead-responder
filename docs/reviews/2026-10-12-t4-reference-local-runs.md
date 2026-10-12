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
- **t3 venue claim past the fact:** the history entry for this venue is fact-only ("has performed there"); the draft
  adds "know the spaces well". The no-block run added a similar overreach ("know the register this room calls
  for"), so the block neither caused nor prevented it.
- **Not findings (attributed):** "Full payment holds the date." (mandated by Quote Terms); "Want me to lock it in?"
  (Alex's standard close, `docs/LEAD_RESPONSE_VOICE.md`, `docs/DRAFT_METHOD.md`); the liability-insurance and COI
  wording (`docs/RESPONSE_CRAFT.md`); t1's claims "performed there many times" and "knows North Beach", which come
  from the confirmed entry in the private venue file (checked by boolean, text not printed), and the no-block run made
  the first one too. A 30-character window made only of mandated sentences (payment sentence + close + sign-off)
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
- **t3 is clean:** no shared windows; the venue statement stops at "has performed there" plus a skill claim ("I know
  how to read a room"); the set 1 overreach ("know the spaces well") is gone.
- **Retracted:** t1's load-in line (service entrance, golf cart) is real PF-Intel setup data for that venue (a live
  read, 2026-10-12), not an invented fact.
- **`verified=false` on t2, t3 and the t4 control (set 2 only):** the app's own voice kill-list rejected one word
  ("land"/"lands") after the gate's retries. The t4 control has no block, so this is existing model variance, not this
  feature; set 1 verified on all four.

**Result: two sets, two FAILs (both on t1).** Per the plan, a third set is not run without Alex: see HANDOFF.

**Open for Alex (decisions, not mine):**
1. **The copy check's noise:** a 30-character window built only of mandated sentences (payment sentence + the
   standard close + sign-off) fires the mechanical check without being a copy (t1, t2, t3 in both sets). The plan
   forbids changing the check after a FAIL; it needs a decision made with no draft in front of it.
2. **t1's band:** a 6-day event comes back `short`; the classifier's own rule says urgent. Separate item.
3. **Whether t1 can pass at all:** the lead is the example's own setting (a beach bonfire at the same hotel), so the
   physical problem and the image are legitimately the same; "never copy a clause" and "same setting" pull against
   each other. A different t1 setting would test the block, not the example's venue.

## No-block control (code at `1b353f8`, before the block existed; t1 to t3)

Run to separate what the block caused from what the model does anyway. Same leads, same date, scratch DB. Findings
above marked "no-block run" come from here. Its drafts used the app's own genre default and generic scene lines, and
none of the example's clauses.
