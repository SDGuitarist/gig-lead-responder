# HANDOFF -- Gig Lead Responder

> **READ FIRST: `docs/END-TO-END-STATUS.md`** — the end-to-end plan, checklist and critical path, each row with its source. Update it in the same commit as any work that changes a row.

**Date:** 2026-10-11
**Branch:** `feat/hub-phase0` (cut from `docs/booking-hub-brainstorm` at `c644210`; pushed; not merged)
**Phase:** Work, Phase 0 **in progress**. 0.1, 0.2 (code), 0.3 (all but the alert half of `invalid_grant alerts`), 0.4, S1, S1-adv done. **0.5 port: 10 TO PORT, 2 BLOCKED** (venues PORTED 2026-10-11; recount with `docs/END-TO-END-STATUS.md` V1). 0.6 DONE, approximate (calendar, both GigSalad accounts, Yelp numbers from Alex; `docs/research/2026-10-02-booking-hub/baseline.md`). S3 PASSED; G1 FAILED (10-03, repeated 10-09) → redesign plan 1.2. **GigSalad portal reading BUILT.** Module 1 not started.


## START HERE — COI + T4 cycles COMPLETE (2026-10-13): COI plan, work, review (code R2 GO), compound done; clarification fix is at plan; band miss, force-push open

**State:** branch `feat/hub-phase0`, **pushed 2026-10-12 (Alex said push)**; origin = local HEAD (0 ahead). Suite **839 pass / 0 fail / 1 skip**, tsc clean, leak check exit 0. Manifest: 197 present, **171 PORTED,
35 NOT PORTED, 3 TO PORT** (R006, R398, R403), 406 total (`docs/END-TO-END-STATUS.md` V1).

**What was done:** HANDOFF State line fixed (`1e4a70a`). Plan: Codex R1 re-run NO-GO 5 P1/2 P2 (`4c41fa6`, record
`docs/reviews/2026-10-12-t4-reference-plan-codex-round1.md`), Revision 1 (`30311a6`), R2 NO-GO 1 P1 that Revision 1
itself introduced (T5 banned "familiar" but the approved reply says "familiar songs"; record `...-round2.md`),
Revision 1b (`1f3414b`, `1b353f8`). **Alex chose to stop reviewing after R2 (2nd NO-GO) and build.** Example reply
ends "Full payment holds the date." (Alex's yes 2026-10-12). Code: `src/data/t4-reference.ts` + `src/t4-reference.test.ts`
(27 tests; 21 mutations, each fails its test) (`6beba33`), inserted in `buildGeneratePrompt` (`d071aa2`), manifest
rows (`57504d6`). Real-model runs: `docs/reviews/2026-10-12-t4-reference-local-runs.md`: set 1 FAIL (`f300fea`),
wording iteration + set 2 FAIL on t1 only (`16e0e4c`). **Per the plan's FAIL rule there is no Codex code review yet.**

**Deviations from the plan (all small, all flagged in the commit messages):**
1. A T4 lead that gets no quote (clarification, no_viable_scope redirect, residency) carries no block, via the
   existing `quoteTermsOff`; the reference ends in a price and payment line those prompts forbid. Tested.
2. T5 asserts the greeting is exactly "Hi Dana," and the sign-off is the name only, instead of embedding the source
   client's real first name in a public test file.
3. The block's wording changed once after set 1 (example before the rules, step 4 conditional on a setting problem
   the lead gives, a DO NOT REUSE paragraph, venue statements capped at the history section). The example, the tests'
   word lists and the copy check were NOT changed.

**Alex's answers, 2026-10-12 (applied):** t1 replaced by a terrace reception at The Lodge at Torrey Pines (Plan
Revision 1c, pre-registered `ead1814`); mandated text (payment sentences, "Want me to lock (it) in", sign-off) is
cut before copy windows are taken; set 3 run; push done. **Set 3** (`docs/reviews/2026-10-12-t4-reference-local-runs.md`,
`af35e74`): **0 copied windows in all 8 drafts**; t1 classified urgent (9 days); venue statements trace to the
confirmed private entry; **t1 still fails the pre-registered rule on one item: "By 5:15" (a scene time inside the
stated 5 to 7pm window, in both drafts)**. t2, t3 and the t4 control pass (notes: COI "within a day"; "bossa nova"
echo; "talk to each other").

**Update 2026-10-12 (pre-compact save, after the State line above was written):** route (a) of decision 1 was
APPLIED by a peer session in `c5a1272` ("fix(t4): block forbids clock times the lead did not state"; plan Revision
1d). CHECKED this save: that commit changes only the NO INVENTED FACTS paragraph in `src/data/t4-reference.ts`, one
new test in `src/t4-reference.test.ts`, and a Revision 1d paragraph in the plan; `src/t4-reference.test.ts` runs
27 pass / 0 fail. NOT re-run here: the full suite and tsc. The plan paragraph quotes Alex as "do it, your
recommendation" (FROM THE PLAN DOC, not heard in this save session). **State is now: HEAD `c5a1272`, 1 commit
unpushed (the State line's "0 ahead" is stale), set 4 NOT run yet.** Decision 1 below is therefore answered; 2-4 are
still open.

**Update 3 (session gig-lead-responder-22, after set 4; supersedes the two statements above that are wrong):**
`c5a1272` was written by THIS session, not a peer, and **set 4 HAS run** (`96650d2`, runs doc; was `ddc3d79` before the 2026-10-12 history rewrite): 0 copied windows and
no clock time of the draft's own in all T4 drafts; t1 and t3 PASS (their venue statements trace to the confirmed
private entry and to real PF-Intel setup/policy data); **t2 is a literal FAIL on one number: the COI "within 24
hours of booking"** (the model's own COI timeline; "a day" in sets 1-3), which is the COI item below, not the block.
t1's band came back `short` again at 9 days (it was `urgent` in set 3): the classifier miss is intermittent.
State: **local HEAD is {N} commits ahead of origin (`e000182`); the new commits are NOT pushed** (Alex's "then push"
covered the set 3 batch; push again only when he says).

**Update 4 (session gig-lead-responder-22, history rewrite + COI plan):** a phrase quoted in the set 4 record
repeated a confirmed private venue claim (leak check exit 1, caught locally before any push). With Alex's yes
("rewrite the local, unpushed commits so the text never existed in them") the 6 unpushed commits after `e000182` were
rebuilt; tree byte-identical to the leak-free tip; leak check exit 0 at each commit; none of the old text reachable
from the branch or `origin`. **Hashes changed:** set 4 record `96650d2` (was `ddc3d79`), handoff `9b07b3d` (was
`feea76e`), COI plan `dd9b05d` (was `10ad506`). Old tip kept as LOCAL tag `backup/pre-leak-rewrite-2026-10-12`; it
holds the leaked text: **never push tags or `--all`; delete the tag after Alex confirms** (`git tag -d`). COI plan:
`docs/plans/2026-10-12-feat-coi-sentence-by-request-plan.md` (Alex 2026-10-12: first reply always "COI available upon
request."; a timeline only when the client requires one). It waits on two answers: the first-message edge case
(timeline sentence vs always the default) and his yes on the exact words incl. the T4 example's COI sentence.
A narrow Codex code-review round-1 prompt for the T4 work was prepared (scratch file; HEAD is pinned in it).

**Update 5 (session gig-lead-responder-22):** **Codex CODE review round 1 = NO-GO (1 P1, 2 P2), all fixed**
(record `docs/reviews/2026-10-12-t4-reference-code-codex-round1.md`): P1 the reference was still on in the
large-budget-gap, graceful-decline and past-date modes (`378b790`, 3 regression tests + mutations + positive
controls; the SMALL-gap mode is deliberately kept: it has one price); P2 T7 now ties each PORTED row's marker to a test
body (`4d43084`); P2 T5 asserts a structural proper-noun boundary instead of embedding the private name (`ffbeba0`).
A round-2 prompt (narrow, named fixes only) is the next step. **Privacy finding (Alex's heads-up):** the leak check
only sees 30-character windows; a shingle scan found a few short quoted fragments of venue statements in the runs
record, some ALREADY PUSHED (they sit in `e000182`, `af35e74`-era text and in `3009cb6`). They are plain descriptions
now (`8f7f5c7`). **Alex's call:** force-push to remove them from GitHub history (rewrites shared history; I recommend
NOT, since the fragments are 2-4 words describing the kind of statement and the same repo already carries his public
voice examples), or leave. Nothing was pushed after `3009cb6`.

**Open decisions for Alex:**
1. **The 5:15 finding. [ANSWERED and applied in `c5a1272`; set 4 passes it.]** It is not a looked-up fact (the example's sunset was). Two honest routes: (a) one more
   wording iteration of the block ("use only the times the lead states; put no clock time of your own on a moment
   inside their window"), then set 4; (b) amend the rule to "no looked-up facts" and accept scene times. I recommend
   (a): it keeps the rule you set, and the failure is one sentence of wording. Your call; I did not change anything.
2. **Codex code review. [ANSWERED 2026-10-12: "yes, narrow".]** A narrow round-1 prompt (the block, its insertion
   and gate, its tests, the manifest rows) is drafted; run it and bring the verdict. The one open smoke item
   (t2's COI number) is attributed to decision 3 and stated in the prompt as known.
3. **COI [Alex 2026-10-12: "COI should be only when requested. On leads it should be similar to 'COI available upon
   request.'"]** Still needs one answer before a plan can be exact: (A) say nothing about COI unless the lead or the
   venue's policy raises it, and then use the sentence; or (B) every quote ends with "COI available upon request."?
   Note the approved T4 example reply says "I can send the Del a COI." and RESPONSE_CRAFT says "within a few days":
   both change if the app owns the sentence. Original note: needs YOUR exact sentence. The app text says "within a few
   days"; the safe design is the payment pattern (app writes the fixed sentence, post-check confirms exact text), and
   a sentence Alex says is his. What is the COI sentence, and for which leads?
4. **Classifier band miss (you said "yes"):** queued as its own cycle, not started; the miss is intermittent (same
   9-day lead: `urgent` then `short`), so the first step is a repeat-run measurement, not a one-shot reproduction. First step: reproduce 6 days
   out returning `short` on the real model with the plain `classify` prompt, then fix Step 5 wording and add a
   fixed-date test. Say "go" to start it.

**Next phase:** ~~Work~~ **DONE: see Update 9** (smoke test passed in sets 3-4 except the COI item; code review closed at
the cap; compound written).

**Update 6 (session gig-lead-responder-22, after the pre-compact save below):** **Codex CODE review round 2 = GO,
"no new defects"** on all three named fixes (run 1 of 2 pasted by Alex, label not confirmed; record
`docs/reviews/2026-10-12-t4-reference-code-codex-round2.md`). **Run 2 not yet received: the stricter verdict wins.**
If both are GO the review loop for the T4 work is closed (round 1 NO-GO fixed, round 2 GO; no round 3 needed) and the
next phase is Compound (solution doc in `docs/solutions/` + `/update-learnings`). Codex's only non-T4 note is a
sandbox `EPERM` on `src/payment-terms-approve.test.ts` (it cannot bind a local port there; passes here). The
"Open decisions" item 1 in the pre-compact block below ("Codex round 2 ... waiting") is now answered by this line.


**Update 7 (session gig-lead-responder-22, after the pre-compact save):** Codex CODE review round 2 run 2 =
**NO-GO, 1 P2** (T7 matched test titles by prefix; R020 and R025 each had two bodies holding the marker); the stricter
verdict governs, so R2 is NO-GO and was the 2nd NO-GO on this change. Reproduced by counting, then fixed test-only in
`8536db1` (exact title per row + positive assertion; old test stayed green under the R020/R025 mutations, new one kills
all six). Alex authorized round 3 in words ("you are authorised for round three, yes"); the round 3 prompt (narrow, T7
fix only, `Round 3 authorized by Alejandro: YES`) was linted ACCEPT and put on the clipboard; its verdict is NOT
received. Local only, NOT pushed: `a4999c7`, `8536db1` (origin = `c2f9aba`). Suite 851 pass / 0 fail / 1 skip.
**Process correction (Alex, 2026-10-12):** "run every Codex prompt twice (run A / run B)" was never his rule; it was an
inference written into a memory file, which is deleted. One run per round; if he pastes more than one verdict, record
each and the stricter governs. Older lines in this file that say "run twice" are historical, not instructions.

**Update 8 (session gig-lead-responder-22):** **Codex CODE review round 3 = NO-GO, classification (c)**: the T7 fix
(`8536db1`) binds each row to its exact title correctly, but `assertsPositively` accepts a marker typed in a trailing
comment on an assert line (P2, test-only, no production defect). **The cap has fired: no round 4, automatic fixing and
reviewing stopped.** Record `docs/reviews/2026-10-12-t4-reference-code-codex-round3.md`. Alex decides: (i) different
approach (export markers as constants and import them in T7), (ii) revert T7 to the round 1 version, (iii) accept the
residue with a comment naming the limit. **ANSWERED: Alex chose (iii) ("iii"); the comment is in the test, the T4
code-review loop is CLOSED; the next phase is Compound.** Nothing pushed after `c2f9aba` (local: `a4999c7`, `8536db1`, `05d25a1`, and
the round 3 record).

**Update 9 (session gig-lead-responder-22, compound phase):** the code-review loop is CLOSED (R3 NO-GO class (c);
Alex chose "iii", accept the residue; the limit is a comment in `src/port-manifest.test.ts`). Pushed: origin =
`9dff893`. **Compound written:** `docs/solutions/architecture/2026-10-12-t4-reference-lead-example-structure-not-copy.md`
(`b51f35f`); `/update-learnings` ran: `compound-engineering.local.md` replaced, memory pair
`project_t4-reference-lead.md` + `feedback_dont-promote-one-rerun-to-a-rule.md`, agent-pitfalls builds-hit + log row,
journal 2026-10-13. Suite 851 pass / 0 fail / 1 skip at `8536db1` (`9dff893` is a comment).
**This file was edited in place, not replaced** (the update-learnings skill says FULL REPLACE; this file holds earlier
cycles, so the START HERE block, this Update and the prompt below were changed instead).

**Open, none started, each needs Alex:** (1) COI plan, two answers: a first message that already says "we require a
COI" (timeline sentence or always the default?) and his yes on the exact words incl. the approved example's "I can
send the Del a COI."; (2) classifier `timeline_band` intermittent `short` for 6-9 day events: first step a repeat-run
measurement; (3) force-push to drop short venue fragments from pushed history (recommend no); (4) other earlier items:
nonprofit prices (Alex's numbers), Saturday/peak-day rule, Module 1 (plan review first), R006/R398/R403 TO PORT.
(5) **Clarification-mode generation fails outright on some vague leads** (found by the COI runs, 2026-10-12;
pre-existing, reproduced on `72490b7`): `GenerationError: Clarification mode full_draft must not include pricing
language` (`src/pipeline/generate.ts`, `PRICE_SIGNAL_PATTERN`: a `$` figure or the words rate, quote, anchor, floor,
investment). **MEASURED 2026-10-13** (`docs/reviews/2026-10-13-clarification-failure-measurement.md`): 17 of 18
runs ended with no draft; the token is the bare word "quote" in 16 of 17 failing calls ("Before I quote, one
question ...") and "rate" in 1; 0 dollar figures, 0 anchor/floor/investment. The validator rejects words the model uses
as a bridge, not prices; the prompt itself says "No quote yet". Candidate fixes are listed there (narrow the validator,
change the prompt, or both). **FIXED 2026-10-13 in `1750cd6`** (plan review R1-R2 NO-GO at the cap, wording fixed in Revision 1b; the validator now
rejects a supported price grammar plus the internal terms, not the words quote and rate; 17 mutations killed). **Re-run
(`docs/reviews/2026-10-13-clarification-failure-rerun.md`): no draft in 3 of 18 runs, down from 17, and 0 are pricing
language.** The 3 now fail the separate "exactly one question" rule (the model splits the binary question over two
sentences): own item, not started. Codex CODE review: not run yet.

##### Prompt for Next Session (after compound; supersedes the older prompts in this section)
```
Work in /Users/alejandroguillen/Projects/gig-lead-responder.
FIRST gate (stop and ask Alex if anything differs):
  pwd; git branch --show-current                  # expect: feat/hub-phase0
  git rev-parse --short HEAD; git status --short  # expect: 9dff893 or later (docs-only commits); clean
  git fetch origin; git log --oneline origin/feat/hub-phase0..HEAD | wc -l   # expect: 0-3 (unpushed docs commits)
Read: HANDOFF.md "START HERE - T4 reference-lead cycle COMPLETE" incl. Update 9,
docs/solutions/architecture/2026-10-12-t4-reference-lead-example-structure-not-copy.md,
docs/plans/2026-10-12-feat-coi-sentence-by-request-plan.md, CLAUDE.md.
Ask Alex which open item to start (COI answers, band-miss measurement, force-push call, or an older item) BEFORE
touching code. Do not read or enter the Sandbox directory while Autopilot Run 104 is going (Alex, 2026-10-12).
Rules: never invent a price; never commit a venue sentence or a fragment of one (describe, never quote); one Codex
run per round; no round 3 without the literal approval; never push tags or --all.
```

**Update 10 (session gig-lead-responder-22, COI cycle plan phase):** COI plan (`docs/plans/2026-10-12-feat-coi-sentence-by-request-plan.md`):
Alex answered both questions (text route; exact words; T4 example change). Codex plan review R1 NO-GO (6 P1/3 P2),
R2 NO-GO (2 P1/2 P2), R3 (authorized via his "b") **NO-GO class (b): the cap has fired, no round 4.** Records
`docs/reviews/2026-10-12-coi-plan-codex-round1.md`, `...round2.md`, `...round3.md`. Revision 3b also corrected the
wording after a heads-up: a COI post-check violation FAILS the draft; Alex decided a restated venue policy fails and
the prompt tells the model not to restate it. **Open: Alex chooses (accept with the two text fixes, accept as is, or a
different approach); no COI code written.** Local only (not pushed): `60a6185`..`0a8f8f4` and the round 3 record.

**Update 11 (session gig-lead-responder-22, COI cycle work phase):** the COI plan was built test-first from
Revision 3c (Alex: "Accept, apply the 2 text fixes, build"): `61977e7` classifier field `coi_required`, `41be68d`
`src/pipeline/coi.ts` (mode matrix, exact sentence, post-check contract), `1f937bb` the Quote Terms COI line,
`8341484` post-check wired in BOTH pipelines, `25691b5` docs and the T4 example (`COI available upon request.`).
Suite 895 pass / 0 fail / 1 skip, tsc clean, leak check exit 0; ~40 mutations each fail a named test. Real-model
runs (`docs/reviews/2026-10-12-coi-local-runs.md`): the trigger and the sentence held in 5 of 5 quoted leads, no model
COI timeline, no restated venue policy at a COI-policy venue (one run each). **A COI violation FAILS the draft**
(Alex's decision after the heads-up). **Deviation from plan R2-1 (flagged in the commit):** `buildGeneratePrompt`
computes `coiTermsFor` itself instead of taking a parameter. **Outside this plan, found by the runs:** a vague lead
can raise `GenerationError: Clarification mode ... must not include pricing language` (pre-existing, reproduced on the
pre-COI code; own item). **Next: Codex CODE review round 1 for the COI work; nothing pushed after `72490b7`.**

**Update 12 (session gig-lead-responder-22, COI code review closed):** Codex CODE review R1 NO-GO (1 P1: the dashboard
approve route sent a stored draft with no COI sentence), fixed in `2837845` after Alex's decision "Refuse, like
payment" (409 `coi_sentence_unverifiable`, before the claim, nothing saved; pre-COI stored drafts are refused until
re-run); **R2 = GO, no new defects** (`docs/reviews/2026-10-13-coi-code-codex-round1.md`, `...round2.md`). The COI
review loop is CLOSED. Suite 902 pass / 0 fail / 1 skip. **Next: Compound for COI** (solution doc +
`/update-learnings`), then the clarification-validator plan review
(`docs/plans/2026-10-13-fix-clarification-pricing-validator-plan.md`, prompt in the scratchpad, not yet run), then the
classifier band miss. Local only, not pushed: see `git log origin/feat/hub-phase0..HEAD`.

**Update 13 (session gig-lead-responder-22, COI compound):** the COI cycle is complete and **pushed** (origin
`856eea7`; the solution doc and this update are local until pushed). Compound written:
`docs/solutions/architecture/2026-10-13-coi-sentence-owned-by-the-app-and-every-send-surface.md`;
`/update-learnings` ran (local review context replaced, memory `project_coi-sentence-app-owned.md`, agent-pitfalls
FC45 + log row, journal 2026-10-13). This file was edited in place, not replaced. **Open, in order:**
(1) the clarification-validator PLAN review (`docs/plans/2026-10-13-fix-clarification-pricing-validator-plan.md`, a
prompt exists in the scratchpad and needs a repin; direction approved by Alex "1 yes": narrow the validator, leave the
prompt); (2) the classifier `timeline_band` miss (own cycle, repeat-run measurement first); (3) Alex's force-push
call; (4) older items: nonprofit prices, Saturday/peak-day rule, Module 1 (plan review first), R006/R398/R403 TO PORT.
**Coordination note:** another session (autopilot Run 104) edits `~/.claude/docs/agent-pitfalls.md` and the shared
journal; this session committed only its own hunks and left that session's changes uncommitted.

##### Prompt for Next Session (after the COI compound; supersedes the earlier prompts in this section)
```
Work in /Users/alejandroguillen/Projects/gig-lead-responder.
FIRST gate (stop and ask Alex if anything differs):
  pwd; git branch --show-current                  # expect: feat/hub-phase0
  git rev-parse --short HEAD; git status --short  # expect: 856eea7 or later (docs-only commits); clean
  git fetch origin; git log --oneline origin/feat/hub-phase0..HEAD | wc -l   # expect: 0-4 (unpushed docs commits)
Read: HANDOFF.md "START HERE - COI + T4 cycles COMPLETE" incl. Update 13,
docs/solutions/architecture/2026-10-13-coi-sentence-owned-by-the-app-and-every-send-surface.md,
docs/plans/2026-10-13-fix-clarification-pricing-validator-plan.md,
docs/reviews/2026-10-13-clarification-failure-measurement.md, CLAUDE.md.
Do: ask Alex which open item next. For the clarification fix: run its Codex PLAN review round 1 (repin the prompt),
then build test-first, then the 18-run re-run. Do not read or enter the Sandbox directory while Autopilot Run 104 runs.
Rules: never invent a price; never commit a venue sentence or a fragment of one; one Codex run per round; no round 3
without the literal approval; never push tags or --all; a post-check "flag" FAILS the draft.
```

**Update 14 (session gig-lead-responder-22, clarification validator, code review closed):** the validator fix
(`1750cd6`, regex bound `d1c5941`) is **pushed** (origin `d1c5941`). Codex CODE review R1 = **GO, no findings**
(`docs/reviews/2026-10-13-clarification-code-codex-round1.md`). Re-run: no draft 17 of 18 -> 3 of 18; 0 pricing-language
errors. Suite 919 pass / 0 fail / 1 skip. **Open, in order:** (1) Compound for the clarification fix (solution doc +
`/update-learnings`); (2) the "exactly one question" failure (3 of 18 runs, the model splits the binary question over
two sentences; the runner should also capture `verified`); (3) the classifier `timeline_band` miss; (4) Alex's
force-push call; (5) older items (nonprofit prices, Saturday/peak-day rule, Module 1, R006/R398/R403 TO PORT).

**Update 15 (session gig-lead-responder-22, clarification validator compound):** the cycle is complete. Compound
written: `docs/solutions/architecture/2026-10-13-clarification-validator-rejects-stated-prices-not-vocabulary.md`;
`/update-learnings` ran (local review context replaced, memory `project_clarification-validator-stated-prices.md`,
agent-pitfalls log row, journal 2026-10-13). Local only, not pushed (see `git log origin/feat/hub-phase0..HEAD`).
**Open, in order:** (1) the "exactly one question" failure (3 of 18 runs; capture `verified` in
`scripts/clarification-measure.ts` first); (2) the classifier `timeline_band` miss (repeat-run measurement first);
(3) Alex's force-push call (I recommend no); (4) older items (nonprofit prices, Saturday/peak-day rule, Module 1 plan
review, R006/R398/R403 TO PORT). Do not read or enter the Sandbox directory while Autopilot Run 104 runs.

**Update 16 (session gig-lead-responder-22, clarification gate opening rule, compound):** the cycle is complete and
reviewed to the cap. Code: `ead7385` (scoped rule), tests `3fc16e2`, fixes `d00f378` (voice block pinned by hash) and
`90318c7` (`openingOf`). Plan review R1/R2 NO-GO (answered, Alex fixed and built); code review R1 NO-GO (2 P2, fixed),
R2 NO-GO (1 P2 prose, fixed at the cap with Alex's choice, no round 3). Re-run: 0 of 17 verified -> 2 of 16; the
decision table's stop row fired (4 runs still fail the opening alone, 3 of them correctly). Suite 946 pass / 0 fail /
1 skip. Compound: `docs/solutions/architecture/2026-10-13-verify-gate-asked-a-vague-lead-for-a-detail-it-never-gave.md`;
`/update-learnings` ran. **Open, in order:** (1) plan 2: the generate-side scene gap (4 of 16 drafts structural or
competitor-test failures; recommended first a length ceiling and shape instruction, no words from Alex needed; a
reference reply only with his exact words); (2) the "exactly one question" rule (6 of 72 runs; no change); (3) the
classifier `timeline_band` miss; (4) Alex's force-push call (I recommend no); (5) older items (nonprofit prices,
Saturday/peak-day rule, Module 1 plan review, R006/R398/R403 TO PORT). Do not read or enter the Sandbox directory while
Autopilot Run 104 runs. A legitimate edit to the verify prompt's voice references needs a `snapshot refresh:` commit.

**Update 17 (session gig-lead-responder-22, clarification draft shape, compound):** plan 2 is built, measured and
reviewed. Change `f762e23` (clarification-mode generate prompt: steps 1-3 reshaped, 70 to 100 words, no price in the
compressed retain list); tooling `arm-manifest`, `assessArms`, a gated aggregate report, held-out leads h1-h4. Plan
review R1/R2 NO-GO (answered, Alex fixed and built); code review R1 NO-GO (2 P1 / 1 P2, all the report path, fixed
and reproduced), R2 GO. **Measurement (50 runs per arm, exploratory, power about 55-60% for 15 points): unusable
38% -> 34% (p 0.42), verified 16% -> 25%, sentences 8 -> 5, competitor failures 4 -> 1, structural scene 10 -> 11.**
The pre-registered stop row fired. Suite 980 pass / 0 fail / 1 skip. Compound:
`docs/solutions/architecture/2026-10-13-a-shorter-instruction-shortens-the-reply-not-the-scene-two-arm-measurement.md`;
`/update-learnings` ran. **Open, in order (Alex chose "both" at the measurement):** (1) a SMALL cycle for the
validator's internal terms: `anchor` (the verb) and `floor` (a dance floor) rejected ordinary prose in 4 of 172
runs; (2) plan the reference reply for the structural-scene failures: it needs Alex's EXACT words for one sample
clarification reply (show him the words in chat and get his yes; T4-style copy check); (3) the "exactly one
question" rule (12 of 122 runs); (4) the classifier `timeline_band` miss; (5) Alex's force-push call (I recommend
no); (6) older items (nonprofit prices, Saturday/peak-day rule, Module 1 plan review, R006/R398/R403 TO PORT). Do
not read or enter the Sandbox directory while Autopilot Run 104 runs. A legitimate edit to the generate prompt or
the verify prompt's voice references needs a `snapshot refresh:` commit.

**Update 18 (session gig-lead-responder-22, clarification internal terms, compound):** the `anchor`/`floor` cycle is
complete. Code `7598b81` (the internal-term alternative narrowed to pricing compounds; Alex's decision 2026-10-13
"Pricing-noun compounds only"; V4a/V4b amended), replay `6bafe0c`. Plan review R1/R2 NO-GO (answered, Alex fixed and
built); code review R1 GO, no findings. Offline replay over 816 stored drafts: old alternative 4 matches, new 0, no
pricing compound present. Suite 997 pass / 0 fail / 1 skip. Compound:
`docs/solutions/architecture/2026-10-13-internal-pricing-terms-are-rejected-as-compounds-not-as-words.md`;
`/update-learnings` ran. **Open, in order:** (1) the reference reply for the structural-scene failures (10 of 43 and
11 of 44 drafts): it needs Alex's EXACT words for one sample clarification reply, shown to him in chat for his yes,
with a T4-style copy check; (2) a fresh clarification measurement to confirm the no-draft rate with the narrowed
pattern (unexecuted); (3) the "exactly one question" rule (12 of 122 runs); (4) the classifier `timeline_band` miss;
(5) Alex's force-push call (I recommend no); (6) older items (nonprofit prices, Saturday/peak-day rule, Module 1
plan review, R006/R398/R403 TO PORT). Do not read or enter the Sandbox directory while Autopilot Run 104 runs.

**Update 23 (session gig-lead-responder-22, real-lead trial: app opened, usage log, ingest script, Yelp findings, 2026-10-15/16):**
STATE (CHECKED 2026-10-16): branch `feat/hub-phase0`, base HEAD `cf6ec2c`, pushed (this save commit adds one, not pushed); tree clean; the app server is RUNNING in dry run (started again 2026-10-16 with Alex's yes, http://localhost:3000; stop with `pkill -f "tsx src/server.ts"`); suite 1198 pass / 0 fail / 1 skip, `tsc` and leak check exit 0 at `cf6ec2c`; Anthropic API works (monthly spend limit now $190, about $14 headroom).
- Alex asked to open the app. Starting it also starts the Gmail poller, so I asked first; Alex chose "Start it, poller included". It ran in DRY RUN (review-only, 60 s) from 2026-10-14 evening PDT until Alex said "stop the server" on 2026-10-16. Status row 0.2 step 5 records this.
- `b26b107`: `src/claude.ts` appends one line per real API call to `logs/usage.jsonl` (gitignored; tokens only, no prompt text); `scripts/usage-report.ts` sums it. Prices in the report are from memory: verify. Not tested against a real call by me; the report was checked on a hand-made file.
- `0d97efd`: `scripts/ingest-one.ts <gmail-message-id>` runs one Gmail message through `processLead`, dry run forced; `fetchMessage` is now exported. Reason: the poller only reads mail newer than its cursor.
- Real lead trial (Alex: "Pull a real lead from Gmail", then "Run Sophia's Yelp lead"): the GigSalad lead emails hold only a name, type and date (details are behind the expired GigSalad logins). Sophia's Yelp lead (Gmail id `1a13bd8fa0454331`) became lead #17, status failed: the Yelp portal login returned 403 (DataDome) headless and headed, and Yelp's 2-step email verification opens outside the automated browser. My first CLI run on the bare text was NOT a valid test (gate failed 3 times; about $0.34).
- Read in Alex's regular browser (read-only): Sophia's Yelp lead holds only date 10/17/26 and zip 92104, no event type, no message, so nothing was truncated. A reply was already sent to her the day before (template with four options; ends "All rates include travel to Idyllwild", wrong town for San Diego).
- Alex's decisions: "Add the usage log", "Push it and then restart", "Add a one-off ingest script", "Try option 1" (visible browser; it was blocked), "File both as todos", "push", "stop the server".
- Todos filed (`2455b63`): 094 p2 Yelp portal login blocked (measure first: how many Yelp leads have hidden text); 095 p2 Yelp reply template says Idyllwild (Alex, Yelp Biz settings).
- Status file updated in the same stretch (header, row 0.2 step 5, two risk rows, critical path, usage-log note). Rows not named there were NOT re-verified.
- Still open and Alex's: 095 (urgent, client-facing), 090 (check whether `95f3dda` passes control B2: needs his "go", about $0.50 to $1), 089, 087, 088, 094; unchanged from Update 22: 091-093.
- Not verified: whether the Yelp text is a saved reply or typed by hand; whether the usage log writes on a real call.
- Later 2026-10-16: API limit was a $175 monthly spend limit (spent $175.10), not the $190 Alex meant; Alex fixed it, key works again. Todo 090 CHECKED on the real model: control B2 passes under `95f3dda`, HEAD and the strict `openingRule:"default"` (6 of 6 each), so neither the scoping nor lead_words caused it (`882dfea`). 0 of 11 Yelp leads had content hidden from the email; the real bug is the parser (todo 096). Yelp parser plan written (`86d4f7e`), Codex plan review R1 NO-GO (0 P1, 3 P2, 1 P3; `docs/reviews/2026-10-16-yelp-parser-plan-codex-round1.md`), plan Revision 1 `4f5f070` answers all four; todo 097 filed (held leads show as "Sent"). Round 2 prompt is ready (not yet sent to Codex). Private sample manifest: `~/Data/gig-lead-responder/yelp-sample-manifest.json`. Server is RUNNING in dry run (started 2026-10-16 with Alex's yes). Counters: plan fix attempts 1, Codex plan reviews 1.
- Same day, later: Codex plan review R2 NO-GO (2 P2); second NO-GO stopped automatic iteration; Alex chose "Fix both, build with tests, no round 3". Plan Revision 2 `545a348`. BUILT: `--parse-only` (`scripts/ingest-one.ts`), parser form contract, safe placeholder for unrecognized quote requests, clean portal URL, explicit Yelp router hold (code `2cfce4b`, fixture test `1294619`); suite 1175 pass / 0 fail / 1 skip, tsc clean, leak check 0. 11 of 11 real emails parse high with no leaks (`docs/reviews/2026-10-16-yelp-parser-sample-run.md`). Found while building: the old parser saved the Yelp "I'm not interested" link as `portalUrl` for all 11 leads (fixed; do NOT get the app's Yelp login working on any older commit). Codex CODE review R1 NO-GO (2 P2: premature END via forged label/counters in an answer; quote detection vs form parsing normalized differently): both reproduced as failing tests, fixed in `5e1dd5c`, recorded in `docs/reviews/2026-10-16-yelp-parser-code-codex-round1.md`; suite 1190 pass / 0 fail / 1 skip; 11 of 11 real emails still high. Codex CODE R2 NO-GO (1 P2, my own F2 overshoot: a legacy message quoting a form label lost its text): second NO-GO, Alex chose "Authorize the fix, then ask for round 3"; fixed (positional detection, see `docs/reviews/2026-10-16-yelp-parser-code-codex-round2.md`), suite 1195 pass / 0 fail / 1 skip, 11 of 11 real emails still high. Round 3 WAS authorized and ran: (c) narrowing residue on `isQuoteRequest` (inline tags create false paragraph boundaries; both directions reproduced); the CAP FIRED, no round 4. Alex chose "Different approach: decide by subject": the text detector is deleted, the path is chosen by the RE: subject only (`docs/reviews/2026-10-16-yelp-parser-code-codex-round3.md`); suite 1198 pass / 0 fail / 1 skip, 11 of 11 real emails high. This redesign has NOT been reviewed by Codex. Codex code round 1 of the subject-only redesign: GO (one P3, wording only: comments overstated the reply filter's guarantee; fixed, no behavior change; `docs/reviews/2026-10-16-yelp-parser-code-codex-redesign-round1.md`). The Yelp parser loop is CLOSED. NEXT: Alex's go for one end-to-end dry run of a real Yelp lead (Yuli `1a10e18804db9034`, event 2026-10-25; about $0.10 to $0.35; it will read "Sent" on the dashboard until todo 097). Todo 097 open.
- END-OF-SESSION (CHECKED): Yelp parser chain, all decided by Alex in chat: "Plan the Yelp parser fix"; plan R1 NO-GO answered in Revision 1, plan R2 second NO-GO -> Alex: "Fix both, build with tests, no round 3"; code R1 NO-GO (F1 forged boundary, F2 detection normalization) fixed `5e1dd5c`; code R2 NO-GO (my F2 overshoot) -> Alex: "Authorize the fix, then ask for round 3" -> fixed `98659ec`; Alex: "Round 3 authorized by Alejandro: YES" -> code R3 = (c), CAP FIRED, no round 4 -> Alex: "Different approach: decide by subject" -> `09eb1c4` (path chosen by the RE: subject only; text detector deleted); Alex: "1" (fresh Codex review of the redesign) -> GO with one P3 wording finding, fixed `cf6ec2c`. The Yelp parser loop is CLOSED. Records: `docs/reviews/2026-10-16-yelp-parser-*.md` (plan R1/R2, code R1/R2/R3, redesign round 1, sample run). Also fixed on the way: the old parser saved Yelp's mark-as-replied link as `portalUrl` for all 11 real emails (now refused; do NOT get the app's Yelp login working on any commit before `2cfce4b`).
- Alex: "go push" -> pushed `cf6ec2c` and ran the END-TO-END DRY RUN on Yuli (`1a10e18804db9034`): lead #20 in `data/leads.db`, full form text stored (no address/token), pipeline read her details and flagged the Oct 24 vs Oct 25 conflict, solo $700 T2D, held by the router ("Yelp portal reply not verified live"), gate FAILED 3 of 3 attempts (`lead_specific_opening`, `validated_them`, `competitor_test`, `compressed_validation_present`), 7 calls, 80,854 in / 7,360 out, about $0.35 (usage log). Draft weaknesses: invents "Saturday evening" with October 25th (Oct 25 2026 is a Sunday; Oct 24 is the Saturday), stray spaces before commas. The dashboard shows it as "Sent" (todo 097).
- Other decisions this session: Alex confirmed the API fix ("done"), "copy"/"push" habits, "File both as todos" (094, 095), later 096 and 097 filed by me from findings. Alex told me (mid-turn) the dismiss-link finding: matches what I had found and fixed.
- OPEN, all Alex's: 095 (Yelp reply template says "travel to Idyllwild", wrong town, may hit every Yelp lead: fix in Yelp Biz settings); 087 (define "draft quality done enough"); 089 (L1 wedding $1,495 vs $1,595); 088; 090 next step (B2 passes under all three verifiers: record the verifier's reasoning on B2, then write more controls); 091-093; 097 (held leads shown as Sent, reasons not stored); 094 parked (p3).
- NOT done: no further Codex review is owed on the Yelp parser. Never ran: a real Yelp send (dry run forced), edited-details reading (Madalyne), GigSalad logins (expired; `npm run gigsalad:login -- music` and `-- business`, Alex only).
Three Questions (real-lead trial and Yelp parser, final): 1. Hardest decision? How to classify quote-vs-legacy: three rounds of text-based detectors each failed a different way, and the fix that closed it was to stop inferring from text and decide by the RE: subject only (Alex's choice at the cap). 2. Rejected? Repairing the Yelp login (blocked, and 0 of 11 leads needed it), rewinding the poller cursor, a fourth patch to the text detector, and a dashboard change inside the parser task (todo 097). 3. Least confident? Unseen Yelp email templates (I read 11, all from Aug to Oct 2026, and Codex could not rerun them), and that a held Yelp draft will be read as a quality signal when the one real lead's gate failed 3 of 3 and its draft invents a weekday and an evening.
Prompt for next session: `Read HANDOFF.md Update 23 and docs/END-TO-END-STATUS.md. pwd, branch feat/hub-phase0, expect cf6ec2c or later (this save commit adds one), git status clean. The app server may still be running in dry run (pgrep -fl "src/server.ts"): do not start or restart it, and do not run real-model measurements, without Alex's yes. Ask Alex first whether he fixed the Yelp reply template (todo 095). Suggested next: todo 097 (held leads display as Sent) or 090's next step or 087 (the draft quality bar), Alex picks. Do NOT read the Sandbox directory. Do NOT get the Yelp portal login working without reading docs/reviews/2026-10-16-yelp-parser-sample-run.md first.`

**Update 22 (session gig-lead-responder-22, lead_words BUILT, MEASURED, STOPPED, REVERTED, COMPOUND DONE, 2026-10-14):**
State: branch `feat/hub-phase0`, **pushed** (origin = local = `69e54ad`, 0 unpushed, worktree clean; this save commit adds one). Suite 1143 pass / 0 fail / 1 skip,
tsc clean, leak check exit 0. The `lead_words` field is built and INERT: `src/prompts/classify.ts` is back to its
73fd38e bytes (SHA-256 eb8c9b54, the original pin), so the model is not asked for it and every classification reads
all-null, which equals today's text (LW5). Why: the real-model measurement hit two pre-registered stops and a rerun
reproduced both: (1) L1 wedding `format_recommended`/`quote_price` moved (before 8 duo / 7 flamenco_duo over 15 runs,
after 15 of 15 flamenco_duo, price 1495 to 1595); (2) control B2 (all-null words, "Spring private event, no venue yet, and
the guitar is already the one thing you've decided on.") passed `lead_specific_opening` 6 of 6 verifies. Arm (informational,
controls not ok): verified 20 of 50 (was 9 to 11), opening-false 10 of 50 (was 32), copying 40 drafts above zero windows.
Code review: R1 NO-GO 2 P1/1 P2, R2 NO-GO 1 P1/1 P2, R3 (b) 1 finding, all in the measurement tooling, all fixed
(Alex: "Fix it, no more review"). Records: `docs/reviews/2026-10-14-lead-words-code-codex-round1..3.md`,
`...-lead-words-measurement.md`. Solution doc: `docs/solutions/architecture/2026-10-14-lead-words-field-measured-stopped-and-reverted-and-the-gate-scoping-that-did-not-help.md`.
**Open decisions for Alex:** (1) a new route for the lead's own words (not a classifier-prompt paragraph; options: a
code-side extractor, or a small separate extraction call), measured against the regression gate first; (2) the verifier
anchor B2 passes through (a separate plan; cell B is new, so whether the old verifier also passed it is unknown); (3) the
carried items: `assume_and_quote` and non-solo/duo formats under the same rule, "exactly one question", length (median
~197 words vs ~100), copying. **Next phase:** plan (Alex picks 1 or 2) or park. Nothing is sent; the router still holds
every vague `one_question` lead.
Three Questions: 1. Hardest: reverting rather than planning a fix, because a price shift on a rich wedding is the harm
and the controls could not clear the arm. 2. Left alone: the inert code (a later route can use it; LW5 pins today's
text). 3. Least confident: that the lead's words can reach both stages without a classifier-prompt paragraph; B2 shows
the verifier's anchors may pass an opening that cites nothing.
After the compound (same session, all pushed): **`docs/END-TO-END-STATUS.md` refreshed** (`a6ca1de`): new "Draft-quality
work inside Phase 0" section, COI and vague-hold notes under Module 1, critical-path item 2b; the Phase 0 and spike rows
were NOT re-verified (still dated 10-09/10-11). V1 port count re-run: 197 / 171 / 35 / 3 (unchanged). **Todos filed
(`todos/`, `69e54ad`):** 087 (p2: define and score "draft quality done enough" before Module 1; Alex sets the bar),
088 (p3: make "status file in the same commit" checked), 089 (p2: L1 wedding $1,495 or $1,595 by run; 8 duo / 7
flamenco_duo over 15 runs on the UNCHANGED prompt; money, Alex decides the rule), 090 (p2: verifier passes control B2;
FIRST check whether 95f3dda passes it too), 091 (p2: a route for the lead's own words; options code-side extractor,
separate extraction call, accept), 092 (p3: exactly one question 38 of 50, median 197 words, 40 of 50 drafts share
windows), 093 (p3: assume_and_quote and non-solo/duo formats). Suggested order: 090, then 091; 089 is independent and
must precede the 20-lead ramp. A second session (`ea02da41`) was active in this repo late in the session; nothing of its
was uncommitted when checked. Standing constraint from Alex: do not read or go into the Sandbox directory (Autopilot Run
104). Unrelated: `~/.claude/docs/agent-pitfalls.md` carries a peer's uncommitted hunk (my row is committed, `600a68b`).
Prompt for next session: `Read HANDOFF.md Update 22 and docs/solutions/architecture/2026-10-14-lead-words-field-measured-stopped-and-reverted-and-the-gate-scoping-that-did-not-help.md. pwd, branch feat/hub-phase0, expect 69e54ad or later (this save commit adds one), git status clean. Plan the next route for the lead's words only if Alex asks. Do NOT edit src/prompts/classify.ts without the regression gate (npx tsx scripts/classifier-regression.ts --compare). Do NOT read the Sandbox directory.`

**Update 21 (session gig-lead-responder-22, vague-gate plan BUILT, 2026-10-14):** the verify-gate opening rule for a
quoted vague lead is planned (`docs/plans/2026-10-14-fix-vague-quote-gate-opening-plan.md`, Revision 1b; plan review R1
and R2 both NO-GO, accepted without a round 3) and built (`vagueQuoteMode`, the `openingRule` seam, snapshots S13-S18, tests
VG1-VG11, GP, GC); Codex code review R1 and R2 both NO-GO (R1: 3 P1 / 1 P2 fixed; R2: one P2, fixed in the parsed
VG10 guard), no round 3 (Alex's choice). Suite 1108 pass / 0 fail / 1 skip. **NOT run: the paired arm and the planted
controls (API spend, Alex's "go")** -- command in the plan's Execution Path (`--paired`, then `vague-gate-controls.ts`).
**Named risk:** the verifier sees only the classification, not the lead's words; the controls test it. Decision table:
a generic planted opening passing in either verify, or 2+ specific ones failing, STOPS. Local only: ~15 commits
unpushed since `ac8685d`. Earlier open items from Update 20 stand.

**Update 20 (session gig-lead-responder-22, vague-lead route: COMPOUND DONE, 2026-10-14):** arm B ran (attempt 1 void
on the API spend limit; rerun 50/50; final-prompt arm on `2aa57e1`), Codex code review R1 and R2 both NO-GO and fixed
(no round 3, Alex's choice), pushed to origin at `ac8685d`, then `78a54e0` (false-check read) and the solution doc
`docs/solutions/architecture/2026-10-14-vague-lead-quote-route-default-in-code-and-the-gate-it-left-behind.md` are
local. **Open, top item:** the verify gate's opening rule fails 33 of 40 unverified vague-lead drafts (17 on it alone):
the route moved the lead out of clarification mode, so the plan-1 relaxed rule no longer applies. It needs its own plan
(`src/prompts/verify.ts`) and a measured arm; the router still holds every vague lead for Alex. Also open: length
(median 203 vs about 100), copying (30 of 50 clause windows), "exactly one question" (33 of 50), the conditional
setup sentence is unmeasured (no contradicting lead), stored pre-change leads keep the old route. Earlier items from
Update 18 still stand. Next: Alex decides whether to plan the verify-gate change; push the 2 local commits on "push".

**Update 19 (session gig-lead-responder-22, vague-lead route: MID-PHASE, pre-compact save 2026-10-13):** the route
change is BUILT and TESTED; arm B (the real-model measurement), the Codex code review and the compound are NOT done.

**State (CHECKED this session):** branch `feat/hub-phase0`, base HEAD `19bff9e` (this save commit adds one), **20 commits
unpushed** (origin = `3952397`), working tree clean. `npm test` **1057 pass / 0 fail / 1 skip**, `tsc` clean, leak check
exit 0. Nothing is running; arm B has NOT been started.

**Plan:** `docs/plans/2026-10-13-feat-vague-lead-quote-with-question-plan.md`, **Revision 2**. Plan review R1 NO-GO (5 P1,
1 P2), R2 NO-GO (1 P1, 1 P2) at the cap, Alex chose "Accept, fix the 2 items, build". **Revision 2 changed D1's
mechanism after the classifier regression and has NOT had a Codex plan review**: say so in the code-review prompt.

**Alex's decisions this stretch (FROM CONVERSATION, quoted):** route "yes" (a vague low-competition lead gets an assumed
default format, its price and terms from the app, and one binary question: his Claude.ai Project's shape); footer
"Drop the footer from the reference"; COI "1 yes" (the reference carries "COI available upon request."); the date
sentence "Send me the date once you have it and I'll check my calendar. A 50% deposit holds the date."; volume "no
that's not a guarantee" (read as: NO new volume rule; correct me if wrong); salutation "a" (the reference opens "Hi
Dana,", the nameless-lead "omit salutation" rule is unchanged); and, after the classifier regression, "A
deterministic default in code (Recommended)" (the classifier PROMPT stays untouched).

**What was built (CHECKED):**
- `defaultVagueFormat` in `src/pipeline/classify.ts`, called at the end of `classifyLead`: a vague `one_question` +
  `unresolved` lead with no ensemble word (`band`, `ensemble`, `orchestra`, `trio`, `quartet`, `quintet`, `sextet`,
  `group` not followed by "of"; "players" is NOT one) gets `solo`, or `duo` for dinner/cocktail/dancing. `classify.ts`
  prompt pinned by SHA-256 (V6b).
- `src/data/vague-quote-reference.ts` (Alex's reply, footer dropped, `[QUOTED_PRICE]`, the app's payment and COI
  constants) and `buildVagueQuoteReferenceSection` in `src/prompts/generate.ts`, gated like T4 plus: payment kind must be
  `sentence`, not nonprofit, not cultural/sourced, not T4; `coi_required` is NOT withheld.
- Tests `src/vague-quote-reference.test.ts` (V1-V9), hash inventory C13-C17 (`snapshot refresh:` commit `504d15e`),
  `src/route-metrics.ts` (pre-registered formulas, `sharedWindows`), runner/report fields, manifest `probeCase`
  (`--probe C8` for this experiment), mutation map 14 rows each killed.
- Records: `docs/reviews/2026-10-13-clarification-reference-candidates-verifier.md`,
  `...-clarification-alex-reference-reply-vs-app.md`, `...-vague-quote-plan-codex-round1.md`, `...round2.md`,
  `...-classifier-regression-baseline.md`, `...-classifier-regression-after.md`.

**Results (CHECKED, observational, one model):** Alex's own reply through the real gate as a quote: footer: fail x3
(`sounds_like_alex`); footer dropped: pass x3. Price is the app's: T2D $700 / $650 direct, T2P $595 / $550 platform.
**Classifier regression** (7 leads, 5 runs): at baseline L2-L4 (three of the four registered test leads) ALREADY get no
price 5 of 5; the prompt-wording attempt moved L1 `flamenco_duo` 7/15 -> 14/15 (p 0.007) and L7 `quote` 0/15 -> 4/15
(p 0.05), so it was rejected and `classify.ts` restored; the code default moved L2-L4 to `solo` $595 x5 each and left
L1, L5, L6 ("Latin band" stays `unresolved`) and L7 inside their baselines.

**Open decisions / next action for Alex (in order):**
1. **Say "go" for arm B**: 5 processes x the 10 vague leads = 50 real runs, about 25 minutes, the spend of one arm of
   plan 2. Command (plan, Execution Path): `OUT=$(mktemp -d /tmp/vague-quote.XXXXXX); for t in 1 2 3 4 5; do npx tsx
   scripts/clarification-measure.ts --arm B --probe C8 --runs 1 --tag B$t --out "$OUT" --today 2026-10-12 & done; wait`
   then `npx tsx scripts/clarification-arm-report.ts <armA dir> "$OUT" --pre-hash <fixture C8> ...` (descriptive; no causal
   claim). Then record `docs/reviews/2026-10-13-vague-quote-measurement.md`.
2. Codex CODE review round 1 (prompt not yet written), then compound + `/update-learnings`, then push (say "push").
3. Still open from earlier: fresh no-draft measurement for the narrowed anchor/floor pattern (unexecuted); the "exactly
   one question" rule (12 of 122 runs); the classifier `timeline_band` miss; Alex's force-push call (I recommend no);
   older items (nonprofit prices, Saturday/peak-day rule, Module 1 plan review, R006/R398/R403 TO PORT).

**Not done / at risk:** compound docs, memory, journal and pitfalls rows for THIS cycle are not written. Peer sessions
have uncommitted changes in `~/.claude` and `~/Documents/dev-notes` (not touched; stage only own hunks by blob). Do not
read or enter the Sandbox directory while Autopilot Run 104 runs. Note a wrong claim I made and corrected: I first
called C8 "unchanged" in the V7 table because I read `lead_source_column`; the gate reads the `paymentTerms` argument
(C8 is CHANGED).

**Three Questions (work phase):**
1. **Hardest implementation decision?** Moving the default format out of the classifier prompt into a tested function
   after a before/after regression showed the wording edit shifted ordinary leads.
2. **What did you consider changing but leave alone?** Deleting clarification mode (it still serves an explicit
   ensemble), changing the SALUTATION rule, a code check forcing exactly one question (it ends in no draft).
3. **Least confident about going into review?** The ensemble word match (a false match or a miss changes the route),
   that the block's example is not copied (arm B reports shared windows), and that Revision 2 had no plan review.

##### Prompt for Next Session (after the pre-compact save; supersedes the earlier prompts in this section)
```
Work in /Users/alejandroguillen/Projects/gig-lead-responder.
FIRST gate (stop and ask Alex if anything differs):
  pwd; git branch --show-current                  # expect: feat/hub-phase0
  git rev-parse --short HEAD; git status --short  # expect: 19bff9e or later (this save commit adds one); clean
  git fetch origin; git log --oneline origin/feat/hub-phase0..HEAD | wc -l   # expect: about 21 (unpushed)
Read: HANDOFF.md "Update 19", docs/plans/2026-10-13-feat-vague-lead-quote-with-question-plan.md (Revision 2),
docs/reviews/2026-10-13-classifier-regression-after.md, CLAUDE.md.
Do: ask Alex for "go" on arm B; do not run it without it (real API spend). Then the Codex code review prompt (say
Revision 2 had no plan review), compound, push when he says so.
Rules: never invent a price; never commit a venue sentence; one Codex run per round; no round 3 without the literal
approval; the classifier PROMPT stays untouched (V6b); do not read or enter the Sandbox directory.
```

#### Pre-compact save 2026-10-12 22:47 (appended; text above NOT modified, may be stale)

**State (CHECKED this session):** branch `feat/hub-phase0`, base HEAD `2ae6936` (this save commit adds one), **pushed**:
origin = `2ae6936` at save time (`git fetch`, 0 ahead / 0 behind), branch only, no tags. Suite **849 pass / 0 fail /
1 skip**, `tsc` clean, leak check exit 0 (all at `2ae6936`). Peer session `gig-lead-responder-73` is live in this repo.

**What was done since the text above was written:**
- Codex CODE review round 1 on the T4 work = **NO-GO (1 P1, 2 P2), all fixed**; record
  `docs/reviews/2026-10-12-t4-reference-code-codex-round1.md` (run label A/B not confirmed; run 2 not received).
  P1 gate (`378b790`), P2 T7 (`4d43084`), P2 T5 (`ffbeba0`, then `2ae6936` pinning EVERY capitalised word after
  finding that sentence-initial names slipped past the first version).
- Privacy: the leak check sees only 30-character windows. Short quoted fragments of venue statements in the runs
  record were reworded to descriptions (`8f7f5c7`). Some fragments are still in already-pushed history; Alex has not
  decided whether to force-push (I recommended not).
- Local backup tag `backup/pre-leak-rewrite-2026-10-12` DELETED at Alex's word (CHECKED: no local tag, 0 on remote).
- Pushed twice at Alex's word ("push it"): `e000182..3009cb6` (after the history rewrite), `3009cb6..2ae6936`.

**Alex's words this session (FROM CONVERSATION, not re-verified):** COI rule: "when I first reply to a gig lead, we
always state that COI is available upon request. And then if they respond and only if they respond that they require a
COI on a subsequent reply, then yes, it's okay to say something similar to within a few days." Review scope: "yes,
narrow". "delete the backup tag, then copy Codex Round Two Prompt to Clipboard." "push it" (twice).

**Open decisions / waiting on Alex:**
1. **Codex CODE review round 2** on the three fixes: prompt written (narrow, named fixes only, `Prior Codex verdicts`
   cites the round 1 record). It lives in the session scratchpad
   (`/private/tmp/claude-501/-Users-alejandroguillen-Projects-gig-lead-responder/d92dc97e-5fe9-4d8a-a27e-41a8b53a7a33/scratchpad/t4-code-r2-prompt.md`,
   may not survive); regenerate from this section if lost. **Its first gate pins HEAD `2ae6936`; this save commit
   moves HEAD, so Codex will stop at the gate: edit the "Expected starting HEAD" line to the new HEAD (docs-only
   difference) before running.** Alex runs it once per round; a 2nd NO-GO stops automatic iteration; round 3 needs the literal
   `Round 3 authorized by Alejandro: YES`; a 3rd NO-GO is the hard cap.
2. **COI plan** `docs/plans/2026-10-12-feat-coi-sentence-by-request-plan.md` (Revision 0, not built, not reviewed):
   (a) a FIRST message that already says "we require a COI": timeline sentence (plan default, text-based
   `coi_required` classifier field) or always "COI available upon request." on the first reply (needs a reply-stage
   flag, larger)? (b) Alex's yes on the exact words: `COI available upon request.`, the required sentence from
   `docs/RESPONSE_CRAFT.md:101`, and changing the approved T4 example's "I can send the Del a COI." to the default
   sentence.
3. **Force-push** to drop the short venue fragments from pushed history: yes or no (recommend no).
4. **Classifier band miss** (Alex said "yes" to starting it; NOT started): a 6-day and a 9-day event returned `short`
   intermittently where Step 5 says urgent; first step is a repeat-run measurement.
5. T4 smoke test: sets 1-4 recorded; the only literal FAIL left is t2's model-written COI timeline ("within 24 hours"),
   which the COI plan (item 2) is meant to remove.

**In flight:** nothing running. No uncommitted files (CHECKED `git status`). Subagent reports are all delivered.

**Lines above that are stale (quoted, not fixed):**
- Update 5: "Nothing was pushed after `3009cb6`." (now pushed to `2ae6936`).
- Update 3: "local HEAD is 4 commits ahead of origin (`e000182`); the new commits are NOT pushed" (now 0 ahead).
- Update 4: "delete the tag after Alex confirms" (done) and "A narrow Codex code-review round-1 prompt ... was prepared"
  (it ran: NO-GO, fixed).
- Open decisions 2 ("Codex code review ... prompt is drafted") and the older "Prompt for Next Session" below (reads
  "expect: 0 (pushed 2026-10-12)", "Revision 1c", "the four open decisions"): superseded by this block.
- The preserved peer save above says "1 commit unpushed" and "set 4 NOT run yet": both superseded.

**Not verified (FROM CONVERSATION):** the content of Alex's words above; the claim that a peer is live (from
`ListAgents`, earlier today).

**Next action (one):** Alex runs the round 2 prompt and pastes the verdict; fix only the named findings
under the fix contract; do NOT write a round-3 prompt without his literal approval.

##### Prompt for Next Session (pre-compact save)
```
Work in /Users/alejandroguillen/Projects/gig-lead-responder.
FIRST gate (stop and ask Alex if anything differs):
  pwd; git branch --show-current                    # expect: feat/hub-phase0
  git rev-parse --short HEAD; git status --short    # expect: 2ae6936 or later (one docs-only save commit); clean
  git fetch origin; git log --oneline origin/feat/hub-phase0..HEAD | wc -l   # expect: 0 or 1 (the save commit)
Read: HANDOFF.md newest START HERE (T4 reference-lead) incl. the appended pre-compact block,
docs/reviews/2026-10-12-t4-reference-code-codex-round1.md, docs/reviews/2026-10-12-t4-reference-local-runs.md,
docs/plans/2026-10-11-feat-t4-reference-lead-plan.md (Revision 1d), docs/plans/2026-10-12-feat-coi-sentence-by-request-plan.md.
Do: wait for Alex's Codex round 2 verdicts; record them in docs/reviews/ (verbatim, with your own check of each
finding); fix only the named findings test-first. Ask Alex the COI questions before any COI code.
Rules: never commit a venue sentence or a fragment of one (describe, never quote: the leak check misses anything
under 30 characters); never invent a price; no round 3 without the literal approval; never push tags or --all.
```

### Three Questions (T4 reference-lead work phase)
1. **Hardest implementation decision?** Gating the block on `quoteTermsOff`, which the plan never mentioned: without
   it a T4 clarification lead would get a "price, then payment" reference its own prompt forbids. Chose gate + test +
   flag in the commit.
2. **What did you consider changing but leave alone?** The copy check and the example reply, after set 1 failed.
   Both were pre-registered or Alex-approved; changing either after a FAIL is tuning the test to pass.
3. **Least confident about going into review?** Whether any instruction wording can stop a model copying an example
   when the lead sits in the example's own setting. t1 may be unpassable as written; sets 1 and 2 do not settle it.

### Prompt for Next Session

```
Work in /Users/alejandroguillen/Projects/gig-lead-responder.
FIRST gate (stop and ask Alex if anything differs):
  pwd; git branch --show-current                            # expect: feat/hub-phase0
  git rev-parse --short HEAD; git status --short            # expect: HANDOFF's last commit; clean
  git log --oneline origin/feat/hub-phase0..HEAD | wc -l    # expect: 4 (not pushed since e000182) unless Alex pushed
Read: HANDOFF.md "START HERE — T4 reference-lead cycle", docs/reviews/2026-10-12-t4-reference-local-runs.md,
docs/plans/2026-10-11-feat-t4-reference-lead-plan.md (Revision 1c), CLAUDE.md.
Ask Alex for his answers to the four open decisions in that HANDOFF section BEFORE touching anything. Then, by answer:
  - 5:15 / wording: ALREADY EDITED in `c5a1272` (do not re-edit); run the full suite + tsc, then set 4 with the
    scratch runner pattern in the runs doc (real model,
    scratch DATABASE_PATH, today pinned 2026-10-12, self-test the checks first; the t1 lead is in the plan).
  - Only when the smoke test passes, or Alex says "review anyway": write the Codex CODE round-1 prompt (run
    ~/.claude/tools/check_handoff_prompt.py round1 on it yourself, with the mode argument, and read it by eye).
  - COI post-check: only with Alex's exact sentence. Classifier band: his "go".
Rules: never invent a price; never commit venue sentences or private claims; a round-3 NO-GO is the hard cap.
```

## START HERE — Tier B venue-pricing cycle COMPLETE (2026-10-12): plan, work, review (R1-R2 GO, R3 NO-GO, R4 at the cap), compound done

**State:** branch `feat/hub-phase0`, **pushed** (origin = local `039d38d`, 0 unpushed, verified 2026-10-12 with
`git log origin/feat/hub-phase0..HEAD`). Suite **811 pass /
0 fail / 1 skip** at the Tier B compound (812 / 0 / 1 after the post-cap fix), tsc clean, leak check exit 0. ~/Data
unchanged this cycle (Estancia `4bc6b09` already pushed).

**What shipped:** at Coasterra, Tom Ham's Lighthouse, Marina Village and Brick, **100+ guests is premium automatically;
under 100 or unknown is always held with both rate-card prices** (the AI's corporate call shown only in the note;
Tom Ham's and Coasterra 50-99 add "waterfront 50+ buyout rule may apply"). Scripps Seaside Forum and Martin Johnson
House always premium. No day or time trigger. The app never writes the tier; notes use `tier_b:` (hidden from drafts,
shown in the dashboard Concerns row). Plan `docs/plans/2026-10-12-fix-tier-b-venue-rule-conflict-hold-plan.md`
(Revisions 1-5b, every rule change Alex's). Code `2ece142`, `ca49e11`, `62929e0`, `69ae3ae`, `61e60a6`. Runs
`docs/reviews/2026-10-12-tier-b-local-runs.md` (9/9 + 6/6, pre-registered). Reviews: plan R1-R3 NO-GO (hard cap);
code R1 GO both, R2 GO both (`docs/reviews/2026-10-12-tier-b-*`). Solution
`docs/solutions/architecture/2026-10-12-tier-b-venue-rules-from-facts-hold-with-both-prices.md`. Memory
`project_tier-b-venue-holds`, `feedback_anchor-scripted-doc-edits`; journal 2026-10-12; agent-pitfalls log row
(candidate FC99 not minted: the registry has a pre-existing FC57 gap).

**After compound (same day):** Revision 6/6b + a post-cap fix: every note names what the draft offers (`1ead7a2`,
`fa1c481`, `22e9f37`); code review R3 NO-GO both runs, R4 run A NO-GO and run B refused (round 3 NO-GO is the hard cap;
Claude Code had miscounted); Alex: fix the last finding test-first, no further review. Suite **812 / 0 / 1**. Open: a
Module 1 "use this price" action (END-TO-END-STATUS); the general "Saturday evening at named venue" premium line, kept
until the peak-day decision.

**Also found:** Tom Ham's rule had been mis-ported on 10-03 (source: "Large party, sunset timing"). Alex's source file
for rules: `~/Data/gig-lead-responder/Gig_Lead_Response_System_4.0_Extraction.md` (read; never copy into the repo).

**Open, Alex's call:** a Saturday / peak-day price as its own rule (with his calendar data); nonprofit prices (NP1,
NP3, NP2 3-4h, NP duo); the T4 example's "Full payment holds the date." wording. (Push: done, see State.)

**Next:** Alex picks: (a) the T4 reference-lead plan, (b) nonprofit prices once he has numbers, (c) the peak-day
question.

### Three Questions (Tier B cycle; from the solution doc's Feed-Forward)
1. **Hardest decision?** What the app may decide alone: only the copied number; every judgment goes to Alex with both
   prices.
2. **What was rejected?** App override of the tier; prompt-only precedence; corporate as an automatic trigger.
3. **Least confident about?** Hold volume at the four venues; Alex's picks on those holds are the data for a better rule.

### Prompt for Next Session

```
Work in /Users/alejandroguillen/Projects/gig-lead-responder.
FIRST gate (stop and ask Alex if anything differs):
  pwd; git fetch origin; git branch --show-current          # expect: feat/hub-phase0
  git rev-parse HEAD; git status --short                    # expect: HANDOFF's last commit; clean
  git log --oneline origin/feat/hub-phase0..HEAD | wc -l    # expect: 0 (pushed 2026-10-12)
Read: docs/END-TO-END-STATUS.md (known risks + Module 1 checklist), HANDOFF.md "START HERE — Tier B venue-pricing
cycle COMPLETE", CLAUDE.md.
Alex wants to tackle ALL open items. List them for him and let him pick the order (one compound cycle each):
  (1) T4 reference-lead plan: docs/plans/2026-10-11-feat-t4-reference-lead-plan.md (its Codex plan R1 run A text is
      only in the 2026-10-11 transcript: ask Alex to re-run R1 if needed); show Alex the example's
      "Full payment holds the date." wording first.
  (2) Nonprofit prices (NP1, NP3, NP2 3-4h, NP duo): Alex gives the numbers; never invent one.
  (3) Saturday / peak-day price rule, incl. the general "Saturday evening at named venue" premium line
      (src/prompts/classify.ts Step 2.75): decide with Alex's calendar data.
  (4) Module 1 (send gate, approvals incl. the Tier B "use this price" action and the payment refresh on every send
      path): plan review first.
Rules: run made-up leads locally before any review of drafted text (PF-Intel lookups are live reads); scripted doc
edits anchor on "\n## Heading\n" with one-match asserts; the Codex review cap counts rounds (a round-3 NO-GO ends
review: never write round 4).
```

## START HERE — PF-Intel venue-facts cycle COMPLETE (2026-10-11): plan, work, review (closed by Alex), compound done

**State:** branch `feat/hub-phase0`, **NOT pushed** (origin at `f554fac`; push only when Alex says). Suite **796 pass /
0 fail / 1 skip**, tsc clean, leak check exit 0. `~/Data` has a local commit `4bc6b09` (Estancia La Jolla, fact only),
not pushed to the encrypted backup.

**What happened today, in order:**
1. **PF-Intel was dead locally** (Railway-internal URL + stale key in `.env`; every lookup failed silently). Fixed with
   Alex's yes: production URL + the Railway key (copied without printing), backup `.env.bak-2026-10-11`.
2. That switched on a never-run instruction ("insider edge ... I've played this room before"); 2 of 3 made-up leads
   claimed venues. Plan `docs/plans/2026-10-11-fix-pf-intel-facts-are-not-alexs-experience-plan.md` (Revisions 1-3).
3. Built: `e573f6c` (no past events or contacts in the prompt), `c3a6d28` + `a7e28eb` (`PF_INTEL_USAGE`), `15f521e`
   (voice guide :12/:137/:141 reworded, Alex's words). Pre-registered runs: claims 3+3 → 0+1 (accepted by Alex).
4. Review: plan R1-R2 NO-GO (fixed; no R3, Alex); code R1 A GO / B NO-GO → fixed; R2 A NO-GO / B GO → settled by Alex
   (Starikov example is true; Estancia added to the venue file). Records `docs/reviews/2026-10-11-pf-intel-*`.
5. Compound: `docs/solutions/architecture/2026-10-11-venue-facts-are-not-experience-and-a-silent-dependency.md`;
   memory `project_pf-intel-facts-not-experience`; agent-pitfalls FC84 builds-hit; journal 2026-10-11.

**Also today:** S2 (Alex has never emailed GigSalad; no evidence either way), S6 (Mac stays awake; the app's catch-up
never ran, stays open), both in `docs/END-TO-END-STATUS.md`. Terminal font 12 → 13 (Clear Dark profile).

**OPEN, Alex's call (prices):** the same made-up lead priced $895 (T2) in 5 runs and $1,200 (T3) in 2: the model's
`stealth_premium` flips at exactly 50 guests ("50+ waterfront private buyout"). Own work item, END-TO-END-STATUS
known risks. Until fixed, check the price line on every draft.
**Waiting on Alex:** nonprofit prices (NP1, NP3, NP2 3-4h, NP duo; the table was shown in chat 2026-10-11), push both
repos, the T4 example's "Full payment holds the date." wording.

**Next:** Alex picks: (a) resume the T4 reference-lead plan (record its R1 run A, Revision 1, show Alex the example's
payment sentence), (b) plan the price-flip fix, (c) nonprofit prices once he gives numbers.

### Three Questions (PF-Intel cycle; from the solution doc's Feed-Forward)
1. **Hardest decision?** No detector (D3), twice. Prompt text was the root cause; a detector repeats the price-block loop.
2. **What was rejected?** Removing PF-Intel from the prompt; labelling past events instead of dropping them; editing
   Alex's real replies without his yes.
3. **Least confident about?** That borrowed claims from the kept examples (Lodge, Starikov) stay rare; 24 drafts is a
   smoke test.

### Prompt for Next Session

```
Work in /Users/alejandroguillen/Projects/gig-lead-responder.
FIRST gate (stop and ask Alex if anything differs):
  pwd; git branch --show-current                            # expect: feat/hub-phase0
  git rev-parse HEAD; git status --short                    # expect: HANDOFF's last commit; clean
Read: docs/END-TO-END-STATUS.md (known risks: the price that flips), HANDOFF.md "START HERE — PF-Intel venue-facts
cycle COMPLETE", CLAUDE.md.
Ask Alex which next: (a) resume docs/plans/2026-10-11-feat-t4-reference-lead-plan.md, (b) plan the stealth_premium
price-flip fix (prices: Alex's call), (c) nonprofit prices if he has numbers. Never invent a price; never commit venue
sentences; run made-up leads locally before any review of drafted text (PF-Intel is live now: lookups are real reads).
```

## START HERE — payment-terms cycle COMPLETE (2026-10-11): plan, work, review (R3 GO), compound all done

**State:** branch `feat/hub-phase0`, **22 commits ahead of origin (`f554fac`); NOT pushed (push only when Alex says).**
Suite **791 pass / 0 fail / 1 skip**, tsc clean, leak check exit 0 (at `53f9f59`; later commits are docs).
Plan `docs/plans/2026-10-11-fix-payment-terms-by-lead-time-plan.md` (Revisions 1-4; plan R1-R3 NO-GO, all fixed).
Alex's exact sentences, by lead time: >2 months "A 50% deposit holds the date, and the balance is due two months
before the event."; >14 days to 2 months "...two weeks before the event."; 14 days or less "Full payment holds the
date."; no date "A 50% deposit holds the date." Edges in the shorter band. GigSalad / The Bash (intake platform):
no payment sentence. Yelp, Thumbtack, Knot, WeddingWire, direct: dated. Hand-run "P" with no platform: none + flag;
CLI `--platform`. Approve swaps the sentence at send and refuses (409) unless every present draft has exactly one.
Real-model runs 10/10 drafts right (`docs/reviews/2026-10-11-payment-terms-local-runs.md`).
**REVIEW:** code R1 NO-GO (both runs; approve checked only the compressed draft) → `df6b2b0`; R2 NO-GO (run A; `""`
full draft read as absent) → `53f9f59`; R3 (authorized by Alex) **GO both runs**
(`docs/reviews/2026-10-11-payment-terms-codex-round{1,2,3}.md`). **COMPOUND:** solution doc
`docs/solutions/architecture/2026-10-11-payment-terms-by-lead-time-and-send-time-swap.md`; learnings propagated
(compound-engineering.local.md, memory `project_payment-terms-send-time-swap`, journal 2026-10-11, agent-pitfalls
FC83 builds-hit, no new FC).

**Module 1 obligation:** every send path must call `refreshPaymentSentence` on the stored drafts before sending
(`docs/END-TO-END-STATUS.md`). Nothing enforces it yet: grep `claimLeadForSending` and every sender call when Module 1 lands.

**Next: resume the T4 reference-lead plan** (`docs/plans/2026-10-11-feat-t4-reference-lead-plan.md`, paused for this
work). Its Codex plan R1 run A was NO-GO (3 P1, 3 P2, 1 P3) and is NOT yet recorded in docs/reviews: the text is in
the 2026-10-11 session transcript only, so ask Alex to re-run the R1 prompt (or re-run run A) if it is lost. Revision 1
must change the approved example's "A 50% deposit holds the date." to "Full payment holds the date." (6 days out):
**show Alex the exact words first.** Then the other TO PORT rows (R006 own plan; R398 is Module 1; R403 NP prices need
Alex's numbers).

### Three Questions (payment-terms cycle; from the solution doc's Feed-Forward)
1. **Hardest decision?** Where the rule is enforced: the app owns the exact sentence, and the send step must re-own it
   because time passes between draft and send.
2. **What was rejected?** The model picking the band from the date (prose inference again); keying platform on the
   model's `lead_source_column` (wrong for Yelp and Thumbtack, which pay Alex).
3. **Least confident about?** That Module 1 will call `refreshPaymentSentence` on every send path. It is written down,
   and nothing enforces it.

### Prompt for Next Session

```
Work in /Users/alejandroguillen/Projects/gig-lead-responder.
FIRST gate (stop and ask Alex if anything differs):
  pwd; git branch --show-current                            # expect: feat/hub-phase0
  git rev-parse HEAD; git status --short                    # expect: HANDOFF's last commit; clean
Read: docs/END-TO-END-STATUS.md, HANDOFF.md "START HERE — payment-terms cycle COMPLETE", CLAUDE.md,
docs/plans/2026-10-11-feat-t4-reference-lead-plan.md.
Task: resume the T4 reference-lead plan. Record its Codex plan R1 (ask Alex for the run A/run B texts if not in
docs/reviews), write Revision 1 fixing every finding, and change the example's deposit sentence to "Full payment holds
the date." after showing Alex the exact words. Then Codex plan review (both runs). Never invent a price; never commit
venue sentences; run made-up leads locally before any review of drafted text.
```

## START HERE — venue-history cycle COMPLETE (2026-10-11): plan, work, review (R3 GO), compound all done

**State:** branch `feat/hub-phase0`, **pushed to origin 2026-10-11 (Alex said push)**. Suite
**760 pass / 0 fail / 1 skip**, tsc clean (at `dca2aab`; later commits are docs). S5 PASSED 2026-10-11 (`2cf4f4c`).
Plan `docs/plans/2026-10-11-feat-venue-history-private-file-plan.md` (Revision 3; plan R1-R3 NO-GO, all fixed).
Built: `111f47b` loader + one-direction matcher; `ae1a30f` `selectContext` adds "ALEX HAS PERFORMED HERE"; `bc267e0`
`scripts/check-venue-history.ts` + manifest rows + V15. Real-model runs + borrowed-claim runs: true claims 3/3, false
claims 0/8, "add nothing" slipped twice (recorded) (`docs/reviews/2026-10-11-venue-history-local-runs.md`).
**REVIEW:** code R1 NO-GO (P1) → `233eb1e`; R2 NO-GO (2 P2) → `dca2aab`; R3 (authorized by Alex) **GO both runs**
(`docs/reviews/2026-10-11-venues-codex-round{1,2,3}.md`). **COMPOUND:** solution doc
`docs/solutions/architecture/2026-10-11-private-venue-claims-and-an-exact-leak-sentinel.md`; learnings propagated
(compound-engineering.local.md, memory `project_venue-history-leak-check`, journal 2026-10-11, agent-pitfalls FC98).

**Private data (never in this repo):** `~/Data/gig-lead-responder/venue-history.json`, 11 venues, 4 with sentences
(Del, Lodge, Coasterra, La Valencia). **Every sentence is a placeholder until Alex rewrites them all from the
venue-database pull (his call, 2026-10-11); do not polish them before that.**, committed in ~/Data and **pushed to the encrypted backup** 2026-10-11 (Alex said push; `bd8b037`).
Before any commit touching venue work: `npx tsx scripts/check-venue-history.ts` must print PASS (exit 0), and read
the staged diff yourself (the check misses paraphrases and copies under 30 characters).

**Open questions for Alex:** Q1 ANSWERED 2026-10-11 (Grand Del Mar stays fact only: Alex's details were about the Del, whose sentence now carries them); Q2 La
Valencia ANSWERED (yes, R085 PORTED, template praise for now), Scripps ANSWERED (yes, R089 PORTED, fact only, alias "Scripps Forum"); Q3 ANSWERED (pushed 2026-10-11).

**Idea filed (Alex, 2026-10-11):** a definitive venue database (he has played ~80% of San Diego venues) from his
memory, Google Calendar, Gmail and venue websites: `docs/brainstorms/2026-10-11-venue-database-seed.md`. A future
brainstorm, after the port rows.

**Next:** the **10 TO PORT** rows (`docs/END-TO-END-STATUS.md` 0.5 row; recount with V1 first). Prices (NP1/NP3/NP2
3-4h/NP duo) need Alex's numbers. Other open items: S6 overnight (Alex picks a night); PF-Intel production URL
(Alex, in Railway); the pre-existing " , " em-dash spacing defect seen in every draft.

### Three Questions (venue-history cycle; from the solution doc's Feed-Forward)
1. **Hardest decision?** Fingerprints versus deleting the exemption: deleting it fails on text public since
   February, and editing Alex's voice examples to remove it is his call, not a check's.
2. **What was rejected?** A guard on the env override (removed instead); quoting public windows in the script (it
   would flag itself); a prose claim detector for added detail.
3. **Least confident about?** The fingerprint list going stale: if a voice example is edited to carry more of a
   sentence, the check fails and someone must decide whether those words are public. Only the solution doc owns that.

### Prompt for Next Session

```
Work in /Users/alejandroguillen/Projects/gig-lead-responder.
FIRST gate (stop and ask Alex if anything differs):
  pwd; git fetch origin; git branch --show-current          # expect: feat/hub-phase0
  git rev-parse HEAD; git status --short                    # expect: HANDOFF's last commit; clean
  git log --oneline origin/feat/hub-phase0..HEAD | wc -l    # expect: 0
Read: docs/END-TO-END-STATUS.md (re-check any row you act on at its source), HANDOFF.md "START HERE — venue-history
cycle COMPLETE", CLAUDE.md, docs/research/2026-10-02-booking-hub/port-manifest.md.
Task: port the remaining TO PORT rows (recount with the V1 command in END-TO-END-STATUS first; expect 10). Group
them into one plan (compound loop: plan, Codex plan review x2 runs, work, code review, compound). Rows that need a
price (NP1/NP3/NP2 3-4h/NP duo): STOP and ask Alex for his numbers; never invent one.
Venue work: run `npx tsx scripts/check-venue-history.ts` (must PASS) and read the staged diff before each commit;
never commit Alex's venue sentences; never add a fingerprint or override to widen that check.
HARD GATE: never start the Mac poller or server against real mail. Never open data/leads.db from a test.
STOP and ask Alex before: any real send; any GigSalad click or opening GigSalad/Yelp lead pages; Full Disk Access;
any change to .env or production data; any new or changed price; any push. Do not start Module 1. Update HANDOFF.md before stopping.
```

## Earlier: org-venue cycle COMPLETE (2026-10-10): plan, work, review (GO), compound all done

**State:** branch `feat/hub-phase0`. Suite **733 pass / 0 fail / 1 skip**, tsc clean (at `bfafbc0`; later commits
are docs only). Plan `docs/plans/2026-10-09-fix-organization-name-is-the-venue-plan.md` (plan R1 NO-GO, 7 findings
accepted; R2 GO). Built: `e0ab871` guard + tests (O1-O8, O10); `eb56333` `runEditPipeline` re-applies the guard
(O9); `bef0bf2` classify prompt line (O7). Real-model runs 3/3 null, control kept
(`docs/reviews/2026-10-09-org-venue-local-runs.md`). **REVIEW:** Codex code R1 = GO on both runs, no findings
(`docs/reviews/2026-10-09-org-venue-codex-round1.md`, `e724fc3`). **COMPOUND:** solution doc
`docs/solutions/logic-errors/2026-10-10-organization-name-is-never-the-venue.md` (`0a36879`); learnings propagated
(compound-engineering.local.md, auto-memory `project_drafter-never-sees-lead-text` updated, journal 2026-10-10,
agent-pitfalls). Not merged; merging is Alex's step.

**Also this session (2026-10-09/10):** 0.6 baseline done (approximate: ~415 inquiries vs 24 paid gigs, no source
attribution yet); S3 iMessage-to-self PASSED; G1 FAILED twice (Gmail replaces a supplied Message-ID) → plan §1.2
must redesign its recovery key (a body token is searchable); `docs/END-TO-END-STATUS.md` created as the living
checklist.

**Next (agreed: "B"):** port the remaining **19 TO PORT** rows (`docs/END-TO-END-STATUS.md` 0.5 row; recount with
V1 first). Fresh session recommended. **Any new or changed price needs Alex's numbers.** Other open items: S5 Gmail
token check on/after 2026-10-11 (Claude); S6 overnight (Alex picks a night); PF-Intel production URL (Alex, in
Railway).

### Three Questions (org-venue cycle; from the solution doc's Feed-Forward)
1. **Hardest decision?** How wide "match" is: equality misses the longer hotel name, substring drops real
   organizations; whole-word containment with 2+ words sits between them.
2. **What was rejected?** A verifier model call; matching against the lead text; always using `[organization]`.
3. **Least confident about?** The venue in `organization_name` while `venue_name` is empty or worded differently.
   Not observed in 3 runs; nothing measures it.

### Prompt for Next Session — SUPERSEDED 2026-10-11, DO NOT RUN

```
Work in /Users/alejandroguillen/Projects/gig-lead-responder.
FIRST gate (stop and ask Alex if anything differs):
  pwd; git fetch origin; git branch --show-current          # expect: feat/hub-phase0
  git rev-parse HEAD; git rev-parse origin/feat/hub-phase0  # expect: identical
  git status --short                                        # expect: clean
Read: docs/END-TO-END-STATUS.md (re-check any row you act on at its source), HANDOFF.md "START HERE — org-venue
cycle COMPLETE", CLAUDE.md, docs/research/2026-10-02-booking-hub/port-manifest.md.
Task: port the remaining TO PORT rows (recount with the V1 command in END-TO-END-STATUS first; expect 19). Group
them into one plan (compound loop: plan, Codex plan review x2 runs, work, code review, compound). Rows that need a
price (NP1/NP3/NP2 3-4h/NP duo): STOP and ask Alex for his numbers; never invent one.
If today is on/after 2026-10-11, also run S5 (the getProfile call in spikes.md row "S5 step 2") and record it.
HARD GATE: never start the Mac poller or server against real mail. Never open data/leads.db from a test.
STOP and ask Alex before: any real send; any GigSalad click or opening GigSalad/Yelp lead pages; Full Disk Access;
any change to .env or production data; any new or changed price. Do not start Module 1. Update HANDOFF.md before stopping.
```

## Earlier: price-block cycle COMPLETE (2026-10-09): plan, work, review (GO), compound all done

**State:** branch `feat/hub-phase0`, pushed. Suite **728 pass / 0 fail / 1 skip**, tsc clean. Plan
`docs/plans/2026-10-09-feat-app-inserted-price-and-in-kind-lines-plan.md` (plan review closed by Alex after 2
NO-GOs, all findings fixed). Built, steps 0-7: `9c78924` golden capture; `45dea5a` price-block module; `f4be3a1` NP2
prompt marker; `679062f` insertion order; `57c58eb` post-check `hasPriceBlock` (prose detector deleted; both
round-3 NP2 gaps closed); `45f2ed6` wiring tests; `38d2555` prompt line "format name only"; `a5ab8fc` golden
full-prompt checks expired (Alex). Every new test mutation-checked (in commit messages). Step 4's code was written
before its tests; all 5 tests were then shown to FAIL on the old code.
**Real-model runs** (`docs/reviews/2026-10-09-price-block-local-runs.md`): first texts 0/3 NP2-priced (all T2;
STOP fired); re-worded texts 3/3 priced, block in both drafts 2/3 (c2 put hours in the marker name: held); after the
one wording fix (Alex) 3/3. Sample 6 runs; real-lead false-hold rate unmeasured.
**REVIEW DONE:** Codex CODE review round 1 = **GO on both runs, no findings**
(`docs/reviews/2026-10-09-price-block-codex-round1.md`). **COMPOUND DONE:** solution doc
`docs/solutions/architecture/2026-10-09-app-writes-fixed-lines-model-writes-a-marker.md`; learnings propagated
(compound-engineering.local.md, auto-memory `project_app-writes-fixed-lines-marker`, journal 2026-10-09,
agent-pitfalls). Not merged: the branch is still `feat/hub-phase0`; merging is a separate step for Alex.
**Next: Alex chooses** — (1) plan the "organization_name = venue" item; (2) check PF-Intel's production URL in
Railway; (3) the other items from the pricing session list (sourced formats; NP1/NP3/NP2 3-4h/NP duo prices,
Alex's numbers only; other TO PORT rows in `docs/research/2026-10-02-booking-hub/port-manifest.md`).

**NEW items found this session (not in this work):**
- **[FIXED + REVIEWED: org-venue cycle complete 2026-10-10, see START HERE]** **organization_name = the venue** (2/2 runs, lead (c)): the classifier put "Example Grand Hotel" in
  `organization_name` when the lead named no organization. A priced draft would thank the hotel and no check holds
  it. Alex: SEPARATE work item (likely: hold when organization_name equals venue_name + classify prompt wording).
- **PF-Intel unreachable locally:** `.env` has `PF_INTEL_API_URL=http://pf-intel.railway.internal:8000`, which
  only resolves inside Railway (curl exit 6). Every local run had no venue facts. UNKNOWN whether PRODUCTION uses
  the internal URL too (different Railway projects cannot use private networking; audit `batch3-deployment.md:25`
  says use the public URL). Alex to check Railway → industrious-elegance → Variables. A failed lookup is silent: it
  reads the same as "no venue notes" (a hold note on lookup error would make it visible). No .env change made.
- `ensureSignOff` skips the sign-off when "Alex Guillen" appears anywhere in the body (pre-existing).
- The em-dash fixer leaves "its job , present" (space before the comma; pre-existing).

### Three Questions (price-block work session)
1. **Hardest implementation decision?** Splitting step 4: the option rename forced the run-pipeline call sites into
   it, so the wiring tests (step 5) passed on first run and had to be proven by mutation instead.
2. **Considered changing but left alone?** Letting the app strip a trailing ", 1 hour" from the marker name (Alex
   chose a prompt line instead), and fixing `ensureSignOff`'s mid-body match (pre-existing, outside the plan).
3. **Least confident going into review?** The marker on real, varied leads: 6 runs on 3 texts, and the classifier's
   T2/T3 call decides whether NP2 fires at all; plus organization_name filled with the venue, which no check sees.

### Prompt for Next Session

```
Work in /Users/alejandroguillen/Projects/gig-lead-responder.
FIRST gate (stop and ask Alex if anything differs):
  pwd; git fetch origin; git branch --show-current          # expect: feat/hub-phase0
  git rev-parse HEAD; git rev-parse origin/feat/hub-phase0  # expect: identical
  git status --short                                        # expect: clean
Read: docs/END-TO-END-STATUS.md (re-check any row you act on at its source), HANDOFF.md "START HERE — price-block cycle COMPLETE", CLAUDE.md,
docs/plans/2026-10-09-feat-app-inserted-price-and-in-kind-lines-plan.md,
docs/reviews/2026-10-09-price-block-local-runs.md, and docs/reviews/*price-block-codex-round1.md if it exists.
The price-block cycle is complete (plan, work, review GO, compound). Ask Alex which to do next, then follow the
compound loop: (1) plan the "organization_name = venue" item (the classifier returns the venue as the
organization when the lead names none; see docs/reviews/2026-10-09-price-block-local-runs.md); (2) check the
PF-Intel production URL (Alex, in Railway; never change .env or production settings without asking); (3) sourced
formats, NP1/NP3/NP2 3-4h/NP duo prices (Alex's numbers only), or other TO PORT rows in
docs/research/2026-10-02-booking-hub/port-manifest.md.
HARD GATE: never start the Mac poller or server against real mail. Never open data/leads.db from a test.
STOP and ask Alex before: any real send; any GigSalad click or opening GigSalad/Yelp lead pages; Full Disk Access;
any change to .env or production data; any new or changed price. Do not start Module 1. Update HANDOFF.md before stopping.
```

## Earlier: price-block plan session (2026-10-09, plan phase)

**UPDATE (later the same session): PLAN REVIEW ROUNDS 1 AND 2 BOTH NO-GO ON BOTH RUNS; AUTOMATIC ITERATION
STOPPED.** Records: `docs/reviews/2026-10-09-price-block-plan-codex-round1.md`, `...-round2.md`. Every finding of
both rounds was accepted and fixed in the plan (Revision 1, Revision 2). The plan is at its latest commit on this
branch. **OPEN DECISION FOR ALEX:** (A, Claude Code's recommendation) close plan review and start WORK at plan
step 0; or (B) authorize a plan round 3 (`Round 3 authorized by Alex: YES`). Reason for A: the round-2 residue is
plan wording, and every fix is now a failing-first EARS test (E12, E12b, E15, E15b, H3b, H7, step-0 provenance),
which checks real code; a round-3 NO-GO would hit the hard cap with nothing built. Do not start work or write a
round-3 prompt until Alex answers.

**State (plan first written):** branch `feat/hub-phase0`. Plan committed `7a35753`:
`docs/plans/2026-10-09-feat-app-inserted-price-and-in-kind-lines-plan.md`. No code changed. Suite unchanged
(720 pass / 0 fail / 1 skip at `2820b71`). **Next phase: Plan Review (Codex round 1 of the PLAN)**, then Work.

**Alex's decisions this session (asked before writing the plan):**
- Next item = (1), the app inserts the price line + in-kind line (brainstorm skipped; input = NP2 round-3 record).
- **"[standard]" is DECIDED: keep the normal price lookup** (no venue-level T3 rate). No longer open.
- Scope: **NP2 drafts only** (every other draft keeps today's model-written price line).
- Format name: **the model names it** in a `[[PRICE: <name>]]` marker line; the app writes the numbers, the
  included clause and the in-kind sentence.
Plan gate READY (4 gaps fixed in the plan before commit); EARS 14/14 well-formed.
The NP2 known gaps below (prose price line, "in  kind") were un-flagged in plan step 7 (FIXED by `57c58eb`).

### Three Questions (price-block plan session)
1. **Hardest decision?** Where to insert: inside `generateResponse` (after the 2000-char cut, before the sign-off) so
   the LLM verify gate, rewrites and SMS edits all see the real block, not at post-check time.
2. **Rejected?** Another narrowing of `hasInKindLine`; an app-owned format-name table (new client wording); every
   draft in scope; throwing on a missing marker (crash instead of hold).
3. **Least confident going into plan review?** Whether the model writes the marker exactly once in BOTH drafts
   (the compressed draft especially); the plan's step 6 measures it on 3 made-up NP2 leads with a STOP rule.

### Prompt for Next Session

```
Work in /Users/alejandroguillen/Projects/gig-lead-responder.
FIRST gate (stop and ask Alex if anything differs):
  pwd; git fetch origin; git branch --show-current          # expect: feat/hub-phase0
  git rev-parse HEAD; git rev-parse origin/feat/hub-phase0  # expect: identical
  git status --short                                        # expect: clean
Read: HANDOFF.md "START HERE — price-block plan session" (the UPDATE paragraph first), CLAUDE.md,
docs/plans/2026-10-09-feat-app-inserted-price-and-in-kind-lines-plan.md (Revision 1 + 2),
docs/reviews/2026-10-09-price-block-plan-codex-round1.md and ...-round2.md.
Plan review rounds 1 and 2 were NO-GO on both runs; all findings are fixed in the plan; automatic iteration has
STOPPED. First ask Alex: (A) close plan review and start WORK at plan step 0 (golden capture), or (B) a plan
round 3 (only with "Round 3 authorized by Alex: YES"). Then follow that path.
Work rules: failing test first, mutation-check each new test, one concern per commit, commit only on a green
suite + tsc, git fetch before every commit (peer sessions use this branch).
HARD GATE: never start the Mac poller or server against real mail. Never open data/leads.db from a test.
STOP and ask Alex before: any real send; any GigSalad click or opening GigSalad/Yelp lead pages; Full Disk Access;
any change to .env or production data; any new or changed price. Do not start Module 1. Update HANDOFF.md before stopping.
```

## START HERE — pricing session (2026-10-05..09)

**State:** branch `feat/hub-phase0`, pushed. Suite: **720 pass / 0 fail / 1 skip**.

**NP2 (R403) — BUILT 2026-10-09; Codex round 1 = NO-GO (both runs, 5 distinct real findings, all fixed);
round 2 = NO-GO (4 P2, fixed `a14821b` `5e954d4` `083d8ca` `e33902e`); round 3 = (c) on BOTH runs, THE CAP HAS FIRED
(`docs/reviews/2026-10-09-np2-codex-round3.md`): the post-check's prose price-line detector is the wrong shape; residue
= a prose sentence stating the NP amount + hours passes as the price line; "in  kind" (two spaces) not counted
[BOTH FIXED by the price-block work, `57c58eb`]. ALEX
DECIDED (2026-10-09): ACCEPT + PLAN THE FIX. NP2 review CLOSED; both residues are known gaps (comment at
`hasInKindLine`).
LOCAL RUNS done before round 2** (`docs/reviews/2026-10-09-np2-local-runs.md`: the drafter never
saw the organization's name, 0/3; fixed by classifier `organization_name` + app-written name, `43ba208`, `fc35d66`,
`6d40b8a`; re-run 2/2 priced drafts exact; NP2 at 1h flips with the T2/T3 call) (build `8008311`..`1cc4402`; fixes `9f93a75`, `e9a6696`, `ace188b`, `de074a3`, `1037ad4`; record
`docs/reviews/2026-10-09-np2-codex-round1.md`). A 2nd NO-GO stops automatic iteration. Residual: "my usual rate is
$800" (no "standard"/"in-kind") is not checked; placement rule may hold a good draft; 6+ word venue dropped. Alex's
decisions this session (asked before code):
- Tell NP tiers apart with a classifier field `np_tier` (NP1 grassroots / NP2 established foundation / NP3
  institutional; unsure = null), Alex-approved definitions in `src/prompts/classify.ts`.
- A priced NP2 lead is STILL HELD (Alex reviews every nonprofit lead before sending). Classify note text changed
  from "until the NP rates are set" to "Alex reviews every nonprofit lead before it is sent".
- NP2 price only when the standard price (the normal lookup, without the NP track) is **at least $100 above** it
  (Alex, after seeing that most 2h nonprofit leads sit at T1/T2 = $500-$700 and a $700 standard gives a $5 line).
  In practice: only T3 leads get NP2 (1h T3P/T3D, 2h T3P/T3D at low/medium competition). Most NP leads are priced
  by Alex by hand. `NP_MIN_IN_KIND` in `src/pipeline/price.ts`.
- In-kind line, Alex's words: the app writes the amount (clientTotal: same travel rule as the price) AND the
  organization's name ("the <organization_name>", classifier field; Alex 2026-10-09 after the local runs showed the
  drafter cannot see it). No name: [organization] stays, held with `in_kind_org_missing`. [venue] dropped when unknown. One-price drafts only: a scoped alternative or
  minimum-set redirect has no single standard, so no line and the hold note says "Alex adds it".
- Post-check holds a draft whose line is missing, changed, or has [organization] unfilled (both drafts; both
  drafting paths incl. SMS edit).
**NEW planned work item (Alex 2026-10-09, after the NP2 cap fired):** the app inserts the price line and the
in-kind line into both drafts itself (after generation), and the post-check only confirms that block is intact.
Replaces prose inference of "the price line" (the (c) surface). Touches how every draft is assembled: needs its own
plan (brainstorm skippable: `docs/reviews/2026-10-09-np2-codex-round3.md` is the input) and review.
**Known gaps (NP2), updated by the price-block work (`57c58eb`..`a5ab8fc`):** FIXED: a prose sentence stating the
NP amount + hours no longer passes (the app writes the block; E1), and "in  kind" with two spaces is counted (E3).
FIXED: the post-check wiring is tested (H3b, SMS edit, H7). MEASURED: real model drafts carried the app's block
in 5 of 6 NP2 runs and the verify gate passed them (`docs/reviews/2026-10-09-price-block-local-runs.md`).
STILL OPEN: `nonprofitPriceNote`'s wiring is not tested; an SMS edit asking to drop the price is held; NP1, NP3,
NP2 3-4h, NP duo: no price (held). [was: prose price line passes; "in  kind" not counted; wiring untested; no real
draft has carried the line]

**CLOSED reviews this session (all of them; none open):** R358 competition count (R3 GO, authorized); R292
holiday/peak hold (R2 test fix, no R3 per Alex); $150 minimum profit R295/R362 (R2 GO); written-price check
(R3 GO, authorized); duo $600 minimum profit (R2 unreachable, closed with pinning test per Alex); no 1-hour duo
(R3 GO, authorized). Records in `docs/reviews/2026-10-05-*` and `docs/reviews/2026-10-07-*`.

**Built:**
- R358: GigSalad's displayed competition count is authoritative only on a parsed page (`gigsaladPage`).
- R292: Valentine's, Cinco de Mayo, Mother's Day, Fourth of July, NYE leads HELD (`holiday_peak:`), no price.
- R058/R072/R104: no T1 below-floor exception; **written-price check** (`src/pipeline/post-check.ts`
  `belowFloorPrices`/`dollarAmounts`): a draft stating a dollar figure below the floor that the app did not supply
  is held; the client's stated budget is NOT exempt (Alex); budget gap exempt; both drafting paths.
- R295 (+ R362 half): `minimumProfitHold` (`src/pipeline/price.ts`): sourced profit = price + travel fee
  (unless included) - $200/hr x musicians - stipend, < $150 held, scoped alternative too; T1 duo / flamenco duo
  3h+ held. Trio/mariachi/bolero NOT checked (no cost data). Note kept out of drafting prompts.

**Written-price check — CLOSED (R3 GO, authorized by Alex).** Threshold is the price the client is told (quote, or
quote+travel): any unsupplied figure below it is held (Alex option c, 2026-10-07); a malformed amount is held as
unreadable. Records `docs/reviews/2026-10-07-draft-price-codex-round{1,2,3}.md`. R362 subcontractor half NOT
PORTED (Alex).

**Duo minimum profit at Alex's $600 — DONE, review CLOSED** (R1 NO-GO fixed; R2 NO-GO verified unreachable, closed
by Alex with pinning test `port manifest R295: a scoped alternative is always shorter`, mutation-proven, no R3).
At 2-3h a duo / flamenco duo (and its scoped alternative) is held when price + travel fee - $600 - stipend < $150;
T1 4h+ held. Records `docs/reviews/2026-10-07-duo-profit-codex-round{1,2}.md`.

**No 1-hour duo — DONE, review CLOSED (R3 GO, authorized by Alex).** Alex 2026-10-07: "just like the mariachi"
(both duos). 1-hour rows removed from `DUO_RATES` / `FLAMENCO_DUO_RATES` (`a85930b`): a 1-hour request is booked
and priced as 2 hours (duo T2P $1,100 anchor; no-viable-scope minimum $1000 for 2hr). Sourced duo and solo keep
1 hour. New post-check rule `priced_hours_` (`e03816e`, narrowed `81d1568`): on an ordinary quote where pricing
rounded the request up, both drafts must state the priced hours, or the lead is held (skips residency, graceful
decline, no-viable-scope, clarification; asked hours must be > 0). Records `docs/reviews/2026-10-07-duo-2h-*`.

**R300-R302 structured price line — DONE, review CLOSED.** Alex 2026-10-09 chose his own replies' format
("[Format], $[price], [hours] hours", included clause only on formats he performs, every tier, no extension price).
`clientTotal()` (price.ts) is the one client-facing total everywhere (header, budget modes, price line, residency
series, post-check). R1/R2/R3 NO-GO (R2 and R3 each run twice: Claude + Alex); the HARD CAP fired after R3; Alex
chose to fix the last finding (residency series + travel, `1fba7c4`) and ship with no further Codex round. Then Alex chose travel-arranged-separately for series (`7cb816a`).
Records `docs/reviews/2026-10-09-price-line-codex-round{1,2,3}.md` (round 2 carries a correction: Claude wrongly
called the residency-series case unreachable). Dual-format mariachi with a fee: unreachable, left as is.

**T4 (R403) — DONE, review CLOSED** (R1-R3; hard cap after R3; Alex chose to fix and ship, `f3c44a2`). Alex-approved T4
rows (solo 1-4h; duo and flamenco duo 2-4h; every sourced format 1-3h; 1.5x T3D). The classifier may emit T4 (luxury
corporate). A T4 lead is CLEARED only when every condition holds: direct (source column D, not a platform), corporate
event, private engagement, not a nonprofit, no ceremony; anything else is held, naming why (`t4:`). A format with no
T4 row is priced at its T3 reference and held. Records `docs/reviews/2026-10-09-t4-codex-round{1,2,3}.md`.

**NEW planned work item (out of the fix loop, Alex to decide):** the five sourced_cultural_* formats are UNREACHABLE.
The classifier's format list and Instrument Rule only route to mariachi or bolero_trio when Alex cannot play the gig;
no code path ever picks a sourced_cultural_* format, so their price tables (old and new T4) are dormant. Making them
reachable means deciding which leads become sourced bookings (traditions, ensembles): a feature, not a review fix.

**Known gaps:** trio/mariachi/bolero minimum profit unchecked (no cost data); holiday hold reads the model's
`event_date_iso`; written amounts spelled out in words are not read.

**Remaining TO PORT (19):** T4/NP (R403, then F1 R020-R025). Other: R006, R081-R089 + R405 (PF-Intel
production data, ask first), R329, R398 (later module).

### Three Questions (NP2 work session, 2026-10-09)
1. **Hardest implementation decision?** What "[standard]" means. The app's normal price for a nonprofit is
   T1/T2 (the who-pays rule removed venue premium), but Alex's line says "my standard [venue] rate": the two
   decisions conflict. Alex chose the $100 minimum, so NP2 rarely fires; the conflict itself is still open. **DECIDED 2026-10-09 (price-block plan session): keep the normal lookup.**
2. **Considered changing but left alone?** Computing a standard for the scoped 1h alternative so the two-price
   budget draft could carry the line too: more plumbing for a rare case that is held anyway.
3. **Least confident going into review?** Whether the drafting model writes the in-kind sentence word for word
   (the post-check holds it if not, but a high false-hold rate would make NP2 useless), and whether the LLM verify
   gate penalises the second dollar figure.
   **Answered by the local runs:** wording and placement were exact on every priced draft and the verify gate
   passed them; the real gap was one nobody reviewed for (the drafter cannot see the lead text). Still unmeasured:
   the false-hold rate across many varied real leads (sample: 4 priced drafts).

### Three Questions (pricing session)
1. **Hardest implementation decision?** The written-price exempt list: every exemption is a hole, and the two most
   tempting ones (the client's budget, a floor-only threshold) were exactly where Alex found the gaps.
2. **Considered changing but left alone?** Parsing amounts spelled out in words, and checking above-quote figures:
   both trade many false holds for rare catches.
3. **Least confident going into the next phase?** None of these checks has met a real model draft; the dollar
   reader's false-hold rate on real replies is unmeasured.

### Prompt for Next Session

```
Work in /Users/alejandroguillen/Projects/gig-lead-responder.
FIRST gate (stop and ask Alex if anything differs):
  pwd; git fetch origin; git branch --show-current          # expect: feat/hub-phase0
  git rev-parse HEAD; git rev-parse origin/feat/hub-phase0  # expect: identical
  git status --short                                        # expect: clean
Read: HANDOFF.md "START HERE — pricing session" (NP2 block), CLAUDE.md,
docs/reviews/2026-10-09-np2-codex-round3.md, docs/reviews/2026-10-09-np2-local-runs.md.
No Codex review is open. NP2 (R403) is CLOSED: the cap fired after round 3 and Alex accepted the residue
(known gaps at hasInKindLine in src/pipeline/post-check.ts) and planned the fix.
Ask Alex which to do next, then follow the compound loop for it:
  (1) plan the work item "the app inserts the price line + in-kind line into the drafts itself" (HANDOFF;
      brainstorm skippable, the round-3 record is the input); plan doc in docs/plans/ with EARS tests;
  (2) plan the sourced-formats work (no code path chooses a sourced_cultural_* format);
  (3) NP1 / NP3 / NP2 3-4h / NP duo prices (Alex's numbers only; never invent a price);
  (4) other TO PORT rows in docs/research/2026-10-02-booking-hub/port-manifest.md.
[DECIDED 2026-10-09: keep the normal lookup] Also open for Alex: whether "[standard]" should be a venue-level (T3) rate rather than the normal lookup.
Before Codex review of anything that drafts text: run made-up leads locally first
(DATABASE_PATH=<scratch> npx tsx src/index.ts --json < lead.txt; nothing is sent; it overwrites the clipboard).
Work rules: failing test first, mutation-check each new test, one concern per commit, commit only on a green
suite + tsc. Codex prompts: scratchpad + pbcopy, run both Alex's and yours, record every run in docs/reviews/.
HARD GATE: never start the Mac poller or server against real mail. Never open data/leads.db from a test.
STOP and ask Alex before: any real send; any GigSalad click or opening GigSalad/Yelp lead pages; Full Disk Access;
any change to .env or production data; any new or changed price. Do not start Module 1. Update HANDOFF.md before stopping.
```

## Earlier: R358 + holiday/peak session (2026-10-05)

### Three Questions (R358 + holiday session)
1. **Hardest implementation decision?** What counts as trusted provenance for the competition count: line text,
   then the caller's platform, then "this text is a parsed page". Each Codex round narrowed it one step.
2. **Considered changing but left alone?** The parser accepting any client-typed `Label:` line (a fake
   `Competition:` line can still reach the MODEL; the check now holds that case). A label allow-list is broader work.
3. **Least confident going into the next phase?** The holiday hold depends on the model extracting the event date;
   nothing checks the date on non-GigSalad leads.

### Prompt for Next Session

```
Work in /Users/alejandroguillen/Projects/gig-lead-responder.
FIRST gate (stop and ask Alex if anything differs):
  pwd; git fetch origin; git branch --show-current          # expect: feat/hub-phase0
  git rev-parse HEAD; git rev-parse origin/feat/hub-phase0  # expect: identical
  git status --short                                        # expect: clean
Read: HANDOFF.md "START HERE — R358 + holiday/peak session", CLAUDE.md, docs/reviews/2026-10-05-holiday-codex-round2.md.
Two questions are with Alex (HANDOFF): the drafted-price check design (a/b), and the $150 minimum profit
(duo cost model, T1 duo 3-4h, formats covered). Get his answers before any code. No new or changed price without his explicit OK.
One concern per commit, failing test first, commit only on a green suite; npm run test:match (exit 3 = zero matches).
Codex: `codex exec -s workspace-write "..." < /dev/null` (without </dev/null it waits on stdin forever); check git status after.
HARD GATE: never start the Mac poller or server against real mail. Never open data/leads.db from a test.
STOP and ask Alex before: any real send; any GigSalad click or opening GigSalad/Yelp lead pages; Full Disk Access;
any change to .env or production data; any new or changed price. Do not start Module 1. Update HANDOFF.md before stopping.
```

## Earlier: end of the residency + GigSalad session (2026-10-04/05)

**State:** branch `feat/hub-phase0`, pushed. Suite on the Mac: **628 pass / 0 fail / 1 skip / 0 todo** (2026-10-05).
Codex CLI runs reviews with `-s workspace-write` (16 tests sandbox-blocked, Mac-only); check `git status` after.
Commits are gated on a green suite (`a2ee091` was pushed red once; fixed `221c738`).

**Reviews (all records in `docs/reviews/`):**
- **Residency** (`c047b49..fbb00f6`): R1 NO-GO (1 P1, fixed), R2 **GO**. CLOSED.
- **GigSalad portal reading** (`a86b7f4..3828dfb`): R1 NO-GO (5 P1 + P2, all fixed), R2 NO-GO (1 P1 + P2, fixed),
  R3 (authorized by Alex) = **(c) narrowing residue: the HARD CAP FIRED** (slash phones). Alex chose a different
  approach for contact scrubbing (below). Everything else in that range was confirmed fixed by Codex.
- **Contact scrubber, new approach** (`cc96a0e..250b857`): R1 NO-GO (time-line leak, fixed), R2 NO-GO (P2 test only;
  leak CONFIRMED CLOSED). Alex: fix the test, no round 3 → `095cba0` (4 mutation-proven tests, not Codex-reviewed).
  CLOSED.
- **Startup login check + browser-job bounds** (`5c7a9e3`..`2c8db39`): R1 NO-GO, R2 NO-GO, R3 (authorized) **GO**.
  Every GigSalad browser job takes turns per account profile, 60 s limit, a timed-out browser is killed (pgrep/pkill on
  its `--user-data-dir`, with `--`) before release; a whole GigSalad lead read is capped at 90 s.
- **Live login status** (`5649f6d`..`dab4718`): R1 NO-GO, R2 NO-GO, R3 (authorized) **GO**. Every GigSalad lead's
  inbox reads refresh `/health` (ordered by read tickets) and print the loud line once per change.
- **"Mark as unread"** (`ba232b4`..`e8df37f`): R1 NO-GO (one-page proof; opened page not restored), R2 **GO**. After the
  app opens a lead page it clicks that lead's own "Mark as unread" (exact single button in this lead's form) and
  proves it: in `/promokit/inbox-unread`, and the WHOLE `/promokit/inbox-archive` walked without it. Every opened
  (or maybe-opened) page is restored; a failed restore is a notice, never a retried lead. The app's only GigSalad
  click (pinned in `src/send-surface.test.ts`). Proven live on one test lead with Alex's OK.
- **No review is open.** One flaky full-suite failure (1 of 8 runs, not reproduced) led to `92e2358`.

**Built (residency):** R099 setup space; classify `engagement_type`/`residency_tier`/`residency_cadence`/`price_asked`;
`RESIDENCY_RATES` R2/R3 (Alex-approved); every residency HELD; residency drafting states a per-night number only when
the venue asked and a rate exists; non-solo recurring = series at the private price, no discount.

**Built (GigSalad, `docs/research/2026-10-04-gigsalad-lead-page.md`):** a GigSalad lead email (first name, event type,
date, time only) → `findGigSaladLead` matches it in BOTH accounts' inboxes (option A) → `fetchGigSaladLead` reads the
lead page with that account's own app login (landed page must be exactly that lead) → the page must agree with the
email (name, type, date, time window) → the pipeline runs on the page's details. Any doubt HOLDS with the reason on
the dashboard. Contact data: one rule (any letter-free stretch with 7+ digits is a phone; money/times/dates exempt;
emails removed; names letters only). **GigSalad posting is REFUSED** in `dispatchReply` (Alex replies himself).
Startup: the poller checks both logins once and says loudly if one expired; `/health` shows `gigsalad`.

**Alex decided (2026-10-04/05):** GigSalad read from the lead page; app login option 1 (`npm run gigsalad:login --
music|business`, Alex signs in himself, no password stored; **both signed in and verified per account**); matching
option A (no tracking-link click); one expired login does not hold the other account's leads; business pages show no
competition count → kept at anchor; R285 Encuentro NOT PORTED; residency numbers/holds as above; no residency
deposit; after the GigSalad cap: a different scrubber approach; scrubber: no round 3; login alert: startup check only.

**Alex decided 2026-10-05 (answered):** opening a GigSalad lead marks it read (MEASURED); Alex chose option A: the app
puts every lead it opened back to unread (built and reviewed GO, above). Still unknown: whether the client sees a
"viewed" signal when the app opens a lead (not visible from Alex's side). Alex's test lead (business) is unread again.

**Known gaps (owner Claude unless said):**
- **Expired GigSalad login is not pushed to Alex** (startup check + live status on /health and the log; no push).
  Trigger: Module 1's alert channel (named requirement). Same channel: system-skipped follow-ups, invalid_grant.
- A held GigSalad lead is marked processed: not retried after Alex signs in again (stays on the dashboard).
- Remaining identity risk (option A): two leads with the same first name, event type, date AND time window, with
  the real one absent from both inboxes. Closing it needs the tracking link (Alex declined).
- Scrubber residue: a phone number spelled out in words. Fail-closed cost: e.g. "1500-2000" in Details is removed.
- `engagement_type`/`price_asked` and all GigSalad drafting are UNEXECUTED on a real model/lead.
- Poller retry counter not restart-proof (deferred); migration v3 runs on the real data/leads.db at next server
  start (backup first).

**Remaining TO PORT (28 after R358):** pricing group (Alex: Project numbers, shown before commit): holiday/peak + context
modifiers (R058/R072/R104/R292), $150 minimum profit (R295/R362), quote formatting by tier (R300–R302), T4/NP
(R403, then F1 R020–R025). Other: R006 (design + paid model runs), R081–R089 + R405 (PF-Intel production data, ask
first), R329, R398 (later module). R358 PORTED 2026-10-05 (review closed GO, see top).

### Three Questions (residency + GigSalad session)
1. **Hardest implementation decision?** Contact scrubbing. A list of phone separators lost three review rounds in a
   row; Alex chose one rule (letter-free stretch with 7+ digits) whose gaps cost detail instead of leaking, with
   strict allow-listed safe shapes (money, times, dates) so an exemption cannot shield a phone.
2. **Considered changing but left alone?** Posting replies on GigSalad (refused outright instead; Alex replies) and
   retrying held GigSalad leads automatically after a re-login (needs Module 1's hold/alert design).
3. **Least confident going into the next phase?** None of the GigSalad path has run on a real incoming lead email
   end to end (only read-only page checks and synthetic emails); the first real lead may expose an email wording or
   page shape not seen in the 4 leads read.

**Next phase (Claude's recommended first move, Alex agreed 2026-10-05):** R358 first. The chain may already exist:
the GigSalad page parser emits "Competition: N quotes sent by other members" (music account) or "not shown
(unknown)" (business); classify's COMPETITION EXTRACTION RULE reads the displayed count; classify-verify's
parseQuoteCount holds a lead whose model count disagrees (probed 2026-10-05). Prove it with a test from page text
to the hold, then mark R358 PORTED (manifest test must pass). Then the next pricing group (Project numbers shown
to Alex before any code).

### Prompt for Next Session

```
Work in /Users/alejandroguillen/Projects/gig-lead-responder.
FIRST gate (stop and ask Alex if anything differs):
  pwd; git fetch origin; git branch --show-current          # expect: feat/hub-phase0
  git rev-parse HEAD; git rev-parse origin/feat/hub-phase0  # expect: identical
  git status --short                                        # expect: clean
Read: HANDOFF.md "START HERE" section, CLAUDE.md, docs/research/2026-10-02-booking-hub/port-manifest.md (row R358).
No Codex review is open. First move: R358. Write a failing test that goes from a music-account GigSalad page text
(parseGigSaladLeadPage, invented fixture) through classify-verify (verifyClassificationHeuristics): the displayed
"quotes sent" count is in rawText, a matching model count passes, a different one is held, and a business page
("not shown (unknown)") raises nothing. Build only what the test shows is missing, then mark R358 PORTED with its
marker and test (npm run test:match -- "port manifest" must pass). Then the next pricing group: pull the Project's
numbers from ~/Data/gig-lead-responder/ and SHOW ALEX EVERY PRICE BEFORE WRITING CODE.
One concern per commit, failing test first, commit only on a green suite; npm run test:match (exit 3 = zero matches).
For each finished range: Codex round 1 via `codex exec -s workspace-write` (check git status after), record every
verdict in docs/reviews/. Never put source text, client names or contact data into the public repo.
HARD GATE: never start the Mac poller or server against real mail. Never open data/leads.db from a test.
STOP and ask Alex before: any real send; any GigSalad click or opening GigSalad/Yelp lead pages; Full Disk Access;
any change to .env or production data; any new or changed price. Do not start Module 1. Update HANDOFF.md before stopping.
```

## 2026-10-03 evening (session 0153v273) — port review #2, round 2 fixes + two Alex money fixes

- **Codex round 2 = NO-GO** (2 findings), recorded `84eedb3` → `docs/reviews/2026-10-03-port-pricing-codex-round2.md`.
  Second NO-GO: automatic review iteration has STOPPED. Round 3 only with `Round 3 authorized by Alejandro: YES`.
- `e23baf4` **classify**: `stealth_premium`, `competition_quote_count`, `format_requested`, `event_energy`,
  `venue_name`, `client_first_name` now parse or reject (was: `{}` venue → `TypeError ... trim`). Test `classify parse`.
- `e575b0c` **manifest**: a PORTED row's named test must assert its marker; conditional rows must assert absence.
  It caught 16 rows; fixed. R078/R079/R094/R097/R369/R406 are prompt rules the model applies: UNEXECUTED until a real lead.
- `5f4ce51` **(Alex) RESPONSE_CRAFT** no longer names duo/trio/quartet/5-piece prices (T2P-only, wrong for D leads).
  Test `always-loaded docs state no prices except reviewed non-quote figures` ($500, $1M/$2M COI, $4,000 lead size).
- `3ea5e64` **(Alex) Tier A venue hold**: a lead naming a Tier A venue priced below T3 (or without the premium flag)
  is held, naming the venue. One list `src/data/venues.ts` feeds the prompt and the check. Dropped from the old code
  list (not Tier A in the prompt): Westgate, bare "Torrey Pines". Test `tier A venue hold`.
- Suite 495 pass / 0 fail / 4 skip; `tsc` clean; `git diff --check` clean. Not pushed.
- **Open, not reviewed by Codex:** `5f4ce51` and `3ea5e64` (both outside the round-2 fix prompt, both Alex's calls).
  Still open from Claude's mistaken pass, low severity: follow-up prompt and dashboard show requested hours, not
  priced hours (`src/prompts/follow-up.ts:32`, `src/utils/shape-lead.ts:47`); range pattern flags
  "$2,700 — 200 guests" (fails closed: held).

### Three Questions
1. **Hardest implementation decision?** R094/R097: Codex asked for a runtime test of venue signals, but the model
   applies them; no code seam exists. Chose a truthful condition + UNEXECUTED label over a fake-model test.
2. **Considered changing but left alone?** Forcing T3 for Tier A venues in code: it changes prices; Alex chose hold.
3. **Least confident going into review?** The Tier A hold may hold more real leads than expected (any model that
   picks T2 for a Tier A venue); no real lead has been run.

**Round 3 = GO (Alex authorized it). Review #2 is CLOSED** (`docs/reviews/2026-10-03-port-pricing-codex-round3.md`).
The port's files are no longer frozen by review #2.

**BUILT 2026-10-04: requests between card lengths round UP** (`lookupPrice`; test `duration rounds up`). Above the longest
card length it stays at the longest. Also fixed by it: solo/duo have no 1.5 h row, so 1.5 h was priced as 1 h; now 2 h.
Not executed on a real lead or Codex-reviewed.

**2026-10-04, same session: R320 graceful decline PORTED** (`41d1e4c`, `bcc222b`): classify sets `graceful_decline`
(fit mismatch or sensitive moment); the lead is always held; generate gets the GRACEFUL DECLINE MODE block (order:
one-sentence acknowledgment, format honesty, price, specific exit); verify §7d, a "Graceful decline failed" reason
always fails the gate; the post-check lets the two look-elsewhere exit patterns through in decline mode only.
**Also fixed:** hold notes (`classification_verify:`, `graceful_decline:`) rode in `flagged_concerns`, so generate was
told to "address" e.g. "Tier A venue ... priced at T2" in the client draft. Now `withoutHoldNotes` keeps them out of
generate and verify; the router still holds on them. Test `internal hold notes never reach the draft or the gate`.
Suite 504 / 0 / 4, `tsc` clean. Commits `c4273f5` onward are NOT pushed and NOT Codex-reviewed.

**Remaining 56 TO PORT, and why none was built:** R018/R266/R272 (strategic reserve: must be stored with the lead,
`src/db`; was frozen by review #1, UNBLOCKED 2026-10-04); R358 code half (GigSalad parser in `src/automation`; UNBLOCKED
2026-10-04); R006 (needs a
design pass + live drafting runs, per its row); group 5 needs Alex's numbers; group 6 other repos/data.

**2026-10-04, later (session 0153v273): review #1 closed, then R018 + a poller fix. NOT Codex-reviewed, not pushed past `79929a0`:**
- `606b49a` **migration v3** (Alex approved): `leads.strategic_reserve_json`. ⚠ It applies to the REAL `data/leads.db` the next
  time the server starts (backup `data/backups/pre-v3.db` first).
- `7be518e`, `f56aa8f` **R018/R266/R272 strategic reserve PORTED**: generate banks up to 3 unused insights (never a
  price), both save paths store them, follow-up n builds on the n-th one. Model quality UNEXECUTED.
- `e887ec4` **(Alex flagged) auth detection**: the poller stopped for good on ANY error text containing "401"; now it
  reads the HTTP status and `invalid_grant`. Also fixes the reverse (a real 401 without the digits was missed).
- Suite 527 / 0 / 4.
- ⚠ **FINDING (2026-10-04, 3 real GigSalad "New lead" emails, both mailboxes, read-only; HTML checked too):** the
  email holds ONLY the client's first name, event type, date and time window, plus a "View the details & reply" link.
  **No quote count, budget, guest count, genre or message.** `src/automation/parsers/gigsalad.ts` expects those fields
  (its fixtures are hand-written: "Quotes received: 4"), so on a real email the pipeline would classify from one
  sentence. Consequences: R358's code check has no displayed count to compare against (the email never shows one);
  real GigSalad lead details live only on the GigSalad page (portal enrichment = Alex's call: "reading GigSalad
  dashboards" is on the ask-first list). R358 NOT built. Needs Alex's decision before more GigSalad work.
  **Also:** every link in the real email is a `tracking.gigsalad.com` redirect (8 in the one checked; 0 `www.gigsalad.com`
  links), and all three `extractPortalUrl` patterns require `www.gigsalad.com`, so a real lead gets no `portalUrl` and
  `gigsaladClient.submitReply` has nowhere to go. Same root: the parser was written against invented emails.
  **Alex 2026-10-04: there are TWO GigSalad accounts** (music email and business email, separate logins), and leads
  from both land in BOTH inboxes. So the same lead can arrive twice, and any portal read or reply must use the
  account the lead belongs to. Portal reading itself is still undecided.
- **Codex round 1 on `79929a0..07a5376` = NO-GO (2 P1 + 1 P2), all fixed** (`4023ef8`, `b7b4754`;
  `docs/reviews/2026-10-04-reserve-auth-codex-round1.md`). Next: round 2 with `-s workspace-write` so Codex runs the
  tests itself (probe: 515/531 runnable there, the 16 others are sandbox-blocked and need the Mac).
- **Round 2 = NO-GO (3 P1), the SECOND NO-GO: automatic iteration STOPPED** (`docs/reviews/2026-10-04-reserve-auth-codex-round2.md`).
  Codex ran the tests itself (`-s workspace-write`): 515 pass, 16 sandbox-only failures. Remaining: follow-up drafts stored
  unvalidated (they go to Alex for approval first, not to clients); drafts and positive signals reach the verify/rewrite
  prompts raw; the reserve's price filter misses forms like "€900", "USD 900", "for 900", and allows 2 sentences.
  **Round 3 authorized by Alejandro: YES** (2026-10-04). Fixed in `700ecfd`, `aabe142`, `0e3882e`; round 3 = the last:
  a NO-GO fires the cap (no round 4; Alex picks: different approach, revert, or accept).
  ⚠ **Known gap (Alex flagged 2026-10-04):** a follow-up draft that breaks the rules is retried, then the scheduler marks
  the lead `skipped`; its "skipped" alert goes through `alertAlex`, which cannot deliver until Module 1, and the
  dashboard shows `skipped` exactly like a skip Alex pressed himself. So a system-skipped follow-up is silent today.
  Pre-existing for any follow-up failure; this change adds one more route into it. Owner Claude; trigger: Module 1's
  alert channel, or sooner a dashboard label for system skips (reason stored on the lead).
- **The app's Gmail token is `alex.guillen.music@gmail.com`** (checked 2026-10-04 with a read-only `getProfile`). Yelp and
  Squarespace leads arrive ONLY there, GigSalad in both, so the poller does see all three platforms.
- `a484455` real redacted lead emails in `examples/emails/` (GigSalad, Yelp, Squarespace): Yelp and Squarespace parse
  as their tests expect; **GigSalad is a `todo` (known gap)**. `2531024`: the test runner now counts todo apart from
  skip (`LEAF_MATCH {..., "todo":1}`), so a known gap never reads as a harmless skip. Suite 534 / 0 / 1 skip / 1 todo.
- Next also: Alex's call on the GigSalad finding.

**Review #3 (round-up + R320 + hold-note filter, `97eec2b..58352b1`): CLOSED, round 2 GO** (round 1 prompt: session scratchpad
`codex-round1-rounding-decline.md`, gate at `58352b1`). **Round 1 = NO-GO, 1 finding (backstop case-sensitive), FIXED**
(docs/reviews/2026-10-04-rounding-decline-codex-round1.md). **Round 2 = GO: review #3 CLOSED**
(docs/reviews/2026-10-04-rounding-decline-codex-round2.md). Its file freeze is lifted. Also get review #1's verdict (unblocks R018 and R358).

**Next phase:** Review.

## 2026-10-03 (session 33bddb35, ~09:10–15:30) — poller cursor, wake, lease, S1-adv, the whole port review

**Supersedes the "Queued" list and the prompt in the section below.** Results are rows in `spikes.md`; port detail is in `port-manifest.md`.

**Part 1 (`72ad079`..`e1fb163`, runtime; under Codex review):**
- **0.3 poller cursor = migration v1** `poller_state`; `pollOnce()` resumes from it; the Gmail list follows page tokens
  (was: first 20 only). `/health` now has `poller.last_success_at`, `poller.auth` (`never`/`ok`/`failed`), `lease.host`.
- **Failed lead retried, not skipped (Alex caught it):** a failure holds the cursor (3 attempts, then `GAVE UP` in the
  log); `processLead` resumes a half-done `received` row instead of dying on `UNIQUE`.
- **0.3 wake catch-up:** `src/wake-watch.ts` (30 s tick, >2 min jump) → `pollNow()` + `kickFollowUpScheduler()`.
- **0.2 same-host lease = migration v2** `runtime_lease`; every poll needs it; `holdsLease()` ready for Module 1.
  **Send sites pinned** by file and count (7), with a planted-call control.
- **0.7 S1-adv PASSED**; **real server booted** with Gmail disabled (migrations, loopback, `/health` observed).
- ⚠ **Incident (my error):** a failing-first test opened the real `data/leads.db` and applied migration v1 (one empty
  table, data unchanged, backup `data/backups/pre-v1.db`). **Alex kept it.** Guard: tests can never open a non-temp DB.

**Part 2 (`0252977`..`83c2ea9`, the port):** every one of the 406 rows reviewed: 197 ALREADY PRESENT, 102 PORTED,
32 NOT PORTED (all approved by Alex), **75 TO PORT**, 0 BLOCKED. What changed in the app:
- **Loaded for drafts now:** Alex's voice spec (`docs/LEAD_RESPONSE_VOICE.md`, every lead); event-arc theory when
  classify sets the new `event_arc`; Bolero playbook for bolero leads. Merged from the Project: PRINCIPLES (read the
  absences), CULTURAL_SPANISH_LATIN (bolero/trova), CULTURAL_CORE (Vehicle), RESPONSE_CRAFT (graceful decline,
  category vs format).
- **Classify:** competition only from the platform's count (else 0); named venue tiers, premium signals, zip 92091,
  red-flag patterns; `event_arc`; `extended_dancer`.
- **Generate:** every quote states the 50% deposit and setup needs (110V outlet, armless chair).
- **Post-check (`src/pipeline/post-check.ts`):** Alex's voice kill list, at most one `!`, and **any battery mention
  fails** (Alex: never mention battery-powered sound; also removed from everything the model sees). Verify names the
  voice judgment checks (hedges, false binary, triads...).
- **Pricing:** all 208 prices on the three Project rate cards now match `src/data/rates.ts`
  (`npx tsx scripts/port-rate-compare.ts`). Added (Alex): full mariachi 35+ miles out uses the card's outside-SD table
  with travel built in; 3-hour flamenco trio with the dancer for 2 hours when the lead asks.
- **Removed from draft context (Alex):** stale price shorthand (QUICK_REFERENCE), range-quote samples + the ranges
  rule (PRICING_TABLES), battery wording; 7 example lines word-swapped so no loaded example fails the post-check.

**Open for Alex:**
- ⚠ **Public repo holds personal contact data:** `docs/venue_intel_seed_data_v2.csv` (venue contacts' names and email
  addresses), pre-existing. Untouched. Removing it from the history is a history rewrite: his call.
- **0.6 baseline is blocked:** GigSalad was not signed in (Claude can't enter passwords) and the permission system
  refused opening the Yelp business dashboard (client personal data). Options: Alex signs in and allows it, or Alex
  reads the numbers himself.
- Codex round 1 verdict (paste it in; record in `docs/reviews/`). Full Disk Access (S3). Module 1 §1.2 redesign (G1).

**⚠ TWO Codex round-1 reviews OUT, separate change sets (record each verdict in `docs/reviews/`):**
- **Review #1 (poller/lease/wake, `2f2ec7d..e1fb163`): round 1 = NO-GO, 4 P1 + 3 P2** (2026-10-04,
  `docs/reviews/2026-10-04-phase0-runtime-codex-round1.md`). **5 fixed, 2 deferred with owner + trigger** (retry counter
  persistence: before unattended overnight runs; invalid_grant alert: after Module 1's alert channel). **Round 2 = GO:
  review #1 CLOSED** (`docs/reviews/2026-10-04-phase0-runtime-codex-round2.md`). Its file freeze is lifted.
- **Review #2 round 1 = NO-GO** (4 findings, `docs/reviews/2026-10-03-port-pricing-codex-round1.md`), all fixed in
  `2c24998`..`68af85b` with tests, plus two Alex-raised money fixes (quoted hours = priced hours; stale PRICING_TABLES
  prices removed). **Round 2 = NO-GO, 2 findings, both fixed** (see the 2026-10-03 evening section above).
  **Round 3 = GO: review #2 CLOSED** (`docs/reviews/2026-10-03-port-pricing-codex-round3.md`).
- **Review #2 (port, pricing, draft rules, `e1fb163..198d94d`):** prompt in the session scratchpad
  `codex-round1-port-pricing.md`. **CLOSED 2026-10-03 (round 3 GO):** its file freeze is lifted and the port is
  unpaused. Review #1 closed 2026-10-04 (round 2 GO), so its files (src/db, src/app.ts, src/server.ts, src/wake-watch.ts,
  src/follow-up-scheduler.ts) are no longer frozen either. No review is open.
- Since the first handoff, groups 1–2 of the queue were done (`9425cb5`..`198d94d`): delivery mode (derived from
  format), Instrument Rule, sourced drafting + sourced integrity (gate backstop in code), compressed draft keeps a fear
  resolution, qualification block, request type + fears pre-work, urgency phrases, present-vs-excellent rubric.
  Manifest now (2026-10-04): 197 ALREADY PRESENT, 121 PORTED, 32 NOT PORTED, 56 TO PORT.

**⚠ Codex round 1 OUT (~13:15):** reviews `2f2ec7d..e1fb163`. Until the verdict is back, do NOT edit `src/automation/`,
`src/db/`, `src/app.ts`, `src/server.ts`, `src/wake-watch.ts`, `src/follow-up-scheduler.ts` (its gate stops Codex if
they move). Nothing in Part 2 touched them. Prompt: session scratchpad `codex-round1-phase0-runtime.md`.

**Fixed (Alex caught it):** `lookupPrice` now always reports the hours it priced (`e0e11fd`).
**BUILT 2026-10-04 (Alex decided 2026-10-03): a request between card lengths ROUNDS UP** (2.5 h → 3 h). See the top section.

**Queued, no Alex needed (next session):** the 75 TO PORT rows, grouped (each row names its destination):
1. **Delivery mode** (R349–R353, R397, R406, R335, R257): a `delivery_mode` classify field (Instrument Rule: guitar
   any style + ukulele = Alex performs) that the loaded Sourced Delivery layer and a sourced generate/verify block key on.
2. **Small prompt gaps:** request type in the reasoning block (R244/R249/R268); urgency phrases (R369); compressed
   draft must keep a fear resolution (R340); qualification-tier block (R341); verify rubric (R256/R258).
3. **Graceful decline code half** (R320): verify checks + `graceful_decline` hold; exempt its exit line from
   `SOFT_REFUSAL_PATTERNS`. **Strategic reserve** (R018/R266/R272). **CULTURAL_CORE for any tradition** (R006).
4. **Code checks:** competition count must equal the platform's displayed count (R358 code half; parser work).
5. **Needs Alex's numbers:** residency R1–R3 + engagement type (R220, R221, R276–R286, R303, recurring rows), T4 and
   NP tiers + `buyer_track` (R403, then the F1 T4 reference lead), $150 minimum profit (R362/R295), context modifiers
   and holiday/peak pricing (R292, R058/R072/R104), quote formatting by tier (R300–R302).
6. **Other repos/data:** venue profiles and venue history in PF-Intel (R081–R089, R405); setup space table (R099);
   negotiation replies (R398, later module); DRAFT_METHOD banner (R329, only if that file is ever loaded).
Add the plan's "port inventory fully accounted" test only when no row is TO PORT.

### Prompt for Next Session

```
Work in /Users/alejandroguillen/Projects/gig-lead-responder.
FIRST gate (stop and ask Alex if anything differs):
  pwd; git fetch origin; git branch --show-current          # expect: feat/hub-phase0
  git rev-parse HEAD; git rev-parse origin/feat/hub-phase0  # expect: identical
  git status --short                                        # expect: clean
Read: HANDOFF.md "START HERE" section, CLAUDE.md, docs/research/2026-10-02-booking-hub/port-manifest.md.
No Codex review is open. Ask Alex for his decision on the two "Waiting on Alex" items before any GigSalad or pricing work.
Then the remaining TO PORT rows that need neither, one concern per commit, failing test first, verify with
npm run test:match (exit 3 = zero matches). For each finished range: Codex round 1 via the CLI with
`codex exec -s workspace-write` (check git status after), record every verdict in docs/reviews/.
Never put source text, client names or contact data into the public repo (fixtures: redact, then verify).
HARD GATE: never start the Mac poller or server against real mail. Never open data/leads.db from a test.
STOP and ask Alex before: any real send; Full Disk Access; reading GigSalad/Yelp dashboards; any change to
.env or production data; any new or changed price. Do not start Module 1. Update HANDOFF.md before stopping.
```

### Three Questions

1. **Hardest implementation decision in this session?** Which kill-list words become code bans. The voice spec says
   cut "just" and "perfect" on sight, but two of Alex's own converted replies use them ("Just say the word", "perfect
   for that"). His real results won: code bans only words he never uses; context words go to verify as judgment.
2. **What did you consider changing but left alone, and why?** Loading DRAFT_METHOD.md and VERIFICATION.md whole.
   Their rules are mostly already in the generate/verify prompts, the April `1bc9cad` commit unloaded them on purpose,
   and their chat banners ("load the next file") would confuse the model. Gaps became named TO PORT rows instead.
3. **Least confident about going into review?** Behaviour no unit test can show: the new loaded docs (voice spec,
   event arcs, merged files) make the generate context much longer, and the stricter post-check (kill list, battery,
   one `!`) may push more drafts into rewrite-then-hold. Neither has been run on a real lead; that needs the Max
   provider (Module 1). Also from part 1: wake and lease are unit-tested only (S6), and the 3-attempt counter is in
   memory, so a crash loop retries forever.

## 2026-10-03 — Phase 0 work session (supersedes the 10-02 "Prompt for Next Session")

**Done (9 commits on `feat/hub-phase0`; evidence rows in `docs/research/2026-10-02-booking-hub/spikes.md`):**
- **0.1 `test:match`**: `scripts/run-tests.mjs`, `scripts/leaf-reporter.mjs`, `scripts/test-files.mjs`. Exit 0/1/2/3 as planned.
  **Deviation found and fixed:** node:test reports a *skipped* test as a pass, so a skipped-only match would have exited 0;
  skips are now counted apart (sentinel `{"pass","fail","skip"}`). `npm test -- --test-name-pattern=X` is now refused (exit 2).
  The parser scaffold became `tests/parsers/parsers.test.ts` on node:test (5 real tests now run; 3 skip for missing fixtures).
- **Test runner can't bill.** ⚠ **Incident:** a failing-first test ran the real pipeline on the shell's `ANTHROPIC_API_KEY`
  (~6–8 billed calls, dry-run, temp DB, nothing sent). The runner now sets a dead key and `ANTHROPIC_BASE_URL`.
  Gap: `node --test <file>` run directly bypasses the runner.
- **0.3 fixed:** orchestrator passes `platform` (`26228a7`); DKIM → **Gmail DMARC pass for the platform's own domain**, with
  real headers from all 3 platforms as the overshoot control (`bc49c49`); dashboard requires creds in every env, binds
  `127.0.0.1`, trust proxy loopback (`2faeacf`). Full suite: **377 pass, 0 fail, 4 skip**; `tsc` clean.

**Found (all in `spikes.md`):**
- **Railway's poller is probably not running** (inference): `/health` shows `rejectedEmails: 0` after 8 weeks up on
  `edc8cfb` (= `main`), and the poller stops itself on `invalid_grant` while `/health` stays "ok". Unverified until the logs are read.
- **The Mac's Gmail token is dead** (`invalid_grant`, file from 2026-05-31). 0.2 step 4 needs a fresh sign-in anyway.
- `railway` CLI is logged out (`invalid_grant`), so 0.2 step 1 is only half done.
- **Merge caution:** `main` → Railway auto-deploy would now bind `127.0.0.1` and fail health checks. Merge only after 0.2 retires Railway.

**Blocked on Alex (nothing here was attempted):**
1. `! railway login`, so Claude can finish 0.2 step 1 (read `AUTO_SEND_ENABLED`, `DRY_RUN`, `GMAIL_TOKEN_PATH`, poller logs).
2. **Travel-fee ZIP table:** the plan says track `data/zip_distances.json`, but the repo is **PUBLIC** and 1,265 ZIP→miles
   rows let anyone triangulate the origin (likely home). Options: commit it anyway / keep it untracked (works on the Mac
   today) / store it in `~/Data`. Not done.
3. 0.2 steps 2–3 (stop Railway, revoke grant), 0.5 file move, S2/G1 real sends, Full Disk Access (S3) — unchanged, need his yes.

**Update 2026-10-03 (later, same day; details in `spikes.md`):**
- Railway: config read (live auto-send was on), deployment removed (`/health` → 404), **GitHub disconnected**.
- Gmail: no grant existed on either mailbox, so nothing to revoke. App published to **"In production"**; Mac re-signed-in
  at 08:21 and verified (`getProfile` → alex.guillen.music@gmail.com). S5 check due **2026-10-11**.
- ZIP table committed (Alex OK'd public); Desktop extraction files moved to `~/Data/gig-lead-responder/`; direct
  `node --test` runs can no longer bill.
- ⚠ **HARD GATE: do NOT start the Mac poller (0.2 step 5).** Drafting still uses the paid API key (`src/claude.ts`), not
  Max. Unblock only via the §1.6 `claude -p` provider or with drafting disabled. Alex also still owes the C1 call.

**Later still (same day):** Twilio fully removed (poller pinned to dry-run; alerts go through `src/alert.ts`, which
reports not-delivered, so dashboard **Approve returns an error** until Module 1; `twilio` package uninstalled).
**G1 FAILED:** Gmail replaces a supplied Message-ID (`spikes.md` G1), so plan §1.2's duplicate-send recovery must be
redesigned in the Module 1 plan before any auto-send. Open for Alex: port questions (a)(b)(c), Full Disk Access (S3).

**Queued** *(SUPERSEDED by the session-33bddb35 section above)*:
- ~~Twilio delete~~ DONE. ~~0.4 migration runner~~ DONE. ~~port questions a/b/c~~ ANSWERED (plan §0.5).
- 0.3 poller cursor = **migration v1** (`poller_state`), then wake catch-up and `/health` fields
  (`poller.last_success_at`, `poller.auth`, `lease.host`), each with its plan test name.
- 0.2 same-host `runtime_lease` (migration v2) + extend `src/send-surface.test.ts` to pin today's send sites.
- 0.7 S1-adv (the §1.6 allowlisted env only).
- 0.5 port: manifest over the 406 rows in `port-inventory.md`; source is now `~/Data/gig-lead-responder/`.
- 0.6 baseline: read-only GigSalad/Yelp dashboards + calendar in Chrome (Alex's accounts; ask first).
**Still needs Alex:** Full Disk Access for the terminal (S3). **Module 1 plan must redesign §1.2** (G1 failed).

### Prompt for Next Session — SUPERSEDED (see the top section)

```
Work in /Users/alejandroguillen/Projects/gig-lead-responder.
FIRST gate (stop and ask Alex if anything differs):
  pwd
  git fetch origin
  git branch --show-current                      # expect: feat/hub-phase0
  git rev-parse HEAD; git rev-parse origin/feat/hub-phase0   # expect: identical
  git status --short                             # expect: clean
  git log --oneline HEAD..origin/main            # expect: empty
Read: HANDOFF.md (2026-10-03 section, all three updates), CLAUDE.md,
  docs/research/2026-10-02-booking-hub/spikes.md, docs/plans/2026-10-02-feat-hub-phase0-lead-replies-plan.md (Phase 0).

Task: continue Phase 0 from the "Queued" list in HANDOFF.md, in order (poller cursor as migration v1 first).
One concern per commit, failing test first, verify with npm run test:match (exit 3 = zero matches).
HARD GATE: never start the Mac poller or server against real mail (drafting still bills the API key).
Railway is retired and disconnected; do not reconnect it. Record results in spikes.md and commit them.
STOP and ask Alex before: any real send; Full Disk Access; reading his GigSalad/Yelp dashboards; any
change to .env or production data. Run claude -p ONLY with the plan's section 1.6 allowlisted environment.
Do not start Module 1. Update HANDOFF.md before stopping.
```

### Three Questions

1. **Hardest implementation decision in this session?** How strict the DMARC check could be without causing another
   Yelp-style outage. Real headers settled it: Gmail reports the *parent* domain (`yelp.com` for `messaging.yelp.com`),
   so the check matches a per-platform DMARC domain list, not the From address's exact domain.
2. **What did you consider changing but left alone, and why?** Committing `zip_distances.json` (a public repo would leak a
   home location; Alex's call), adding `gigs@gigsalad.com` to the allowlist (the tests show it's rejected on purpose:
   payment notices), and deleting Twilio tonight (its creds check is the live-mode gate, so it needs its own careful commit).
3. **Least confident about going into review?** The Railway inference. If Railway's poller *is* alive, it is a second
   writer right now, and every plan step that assumes "Railway is idle" is wrong until the logs are read.

---

*Previous section (2026-10-02 planning), kept for history. Its "Prompt for Next Session" is SUPERSEDED.*

## 2026-10-02 — Booking hub (supersedes "Current State" below for what to do next)

**Goal (Alex):** grow this app into one system for leads, gigs, reminders, contracts, invoices,
payments and COIs, run on his MacBook and drafted with Claude Max.

**Done this session (all docs, no `src/` change):**
- Brainstorm: `docs/brainstorms/2026-10-02-booking-hub-brainstorm.md`, refined once.
- Research: `docs/research/2026-10-02-booking-hub/`. It holds 6 research reports, 6 deepen
  reviews, and the Trio/Ensemble side-by-side.
- Roadmap: `docs/plans/2026-10-02-booking-hub-roadmap.md`, with the decisions, module order and
  success measures.
- Plan (Phase 0 + Module 1, lead replies, deepened):
  `docs/plans/2026-10-02-feat-hub-phase0-lead-replies-plan.md`. `plan:check` reports
  `manual_only`, the expected result.
- The claude.ai Project "Gig Lead Response System 4.0" was extracted and compared against the
  repo. The extraction sits on `~/Desktop` and must move to `~/Data/` before the port (step 0.5).

**Found today, live in production code (fix in Phase 0, not yet fixed):**
- The auto-send path drops `platform` (`src/automation/orchestrator.ts:~130`).
- The DKIM check accepts any domain (`src/automation/source-validator.ts:79-84`).
- The dashboard binds to every network and turns auth off outside production (`src/server.ts:43`,
  `src/auth.ts`).
- The poller looks back only 5 minutes after a restart (`src/automation/poller.ts:75`).
- **`npm test -- --test-name-pattern=X` runs all tests and exits 0 even when X matches
  nothing**, so name-filtered test runs prove nothing until `test:match` (step 0.1) exists.

### Decision (Alex, 2026-10-03): start Phase 0. No Codex round 3.

The review loop stopped after 2 NO-GOs (both in `docs/reviews/`). Alex chose execution over a
round 3, because every remaining risk (G1, C1, S2, S3, S6, FileVault restarts) is runtime
behaviour that only Phase 0 can settle. The planning branch `docs/booking-hub-brainstorm` is
pushed to origin and is not merged into `main`.

### Prompt for Next Session — SUPERSEDED 2026-10-03, DO NOT RUN

```
Work in /Users/alejandroguillen/Projects/gig-lead-responder.
FIRST gate (stop and ask Alex if anything differs):
  pwd
  git fetch origin
  git branch --show-current                      # expect: docs/booking-hub-brainstorm
  git rev-parse HEAD origin/docs/booking-hub-brainstorm   # expect: the two SHAs match
  git status --short                             # expect: clean
  git log --oneline HEAD..origin/main            # expect: empty (else a peer landed work on main; ask Alex)
Read: HANDOFF.md (2026-10-02 section), CLAUDE.md,
  docs/plans/2026-10-02-feat-hub-phase0-lead-replies-plan.md (Phase 0 only),
  docs/research/2026-10-02-booking-hub/spikes.md, docs/plans/2026-10-02-booking-hub-roadmap.md.

Task: Alex chose to start Phase 0 (2026-10-03). No Codex round 3.
1. Create branch feat/hub-phase0 from docs/booking-hub-brainstorm.
2. Run /workflows:work on the plan, PHASE 0 ONLY, in order: 0.1 test:match first, then 0.2 to 0.7.
   One concern per commit (~50-100 lines), failing test first. Verify with npm run test:match, never with
   npm test -- --test-name-pattern (that form passes on zero matches).
3. Record every spike and known-answer result in spikes.md with committed evidence. Nothing counts
   as "recorded" until it is committed.
STOP and ask Alex before: stopping Railway or revoking its Gmail grant (0.2 steps 2-3); any real send
(S2, G1); granting Full Disk Access; moving the ~/Desktop extraction files into ~/Data (0.5); any change to
Railway, .env or production data. Run claude -p ONLY with the plan's section 1.6 allowlisted environment
(this shell has ANTHROPIC_API_KEY set). Do not start Module 1. Update HANDOFF.md before stopping.
```

### Three Questions

1. **Hardest decision in this session?** What may auto-send. The answer: a slot-allowlist code
   gate plus a 20-lead review-only ramp, instead of an LLM confidence score.
2. **What did you reject, and why?** Twilio (blocked without 10DLC registration), bots on The Bash
   and Yelp (their terms), Railway as a second poller (double sends), one plan for all modules
   (Alex chose to split), and `--test-name-pattern` as a verification command (proven to match
   nothing and still pass).
3. **Least confident about going into the next phase?** The MacBook as the host: sleep, the lid,
   and OS restarts that wait at the FileVault login screen. Spike S6 and the heartbeat monitor
   detect this; neither prevents it.

---

*Earlier state, kept for history:*

**Previous date:** 2026-07-18. **Previous phase:** Real-lead intake completed locally; partial analysis complete and the remaining backlog is blocked by exhausted Anthropic API credits.

## First 60 Seconds: Peer-Session Check

Sessions run in parallel here. On 2026-08-08 one cut a branch at `e339340` while another
landed `197f118` + `4ff91c6` (Yelp credential-leak fix) on `main`; it found out at merge time.

1. **Before cutting a branch:** `git fetch origin && git log --oneline HEAD..origin/main`.
   Fetch first — without it, "up to date" and "stale" both print nothing. Any line = a peer landed work.
2. **Before editing:** `git status --short`. A dirty tree you did not dirty is a live peer; read
   every diff before touching it (global CLAUDE.md → "Parallel Sessions on One Repo").
3. **After merging `main` into your branch:** re-run `npm run typecheck && npm test` locally — a
   clean merge means no textual conflict, not that the combination works. CI only runs once you push.

> **Reconciliation note (2026-06-25):** Phase 2 was implemented and merged on
> 2026-05-31 but the HANDOFF/plan/compound all drifted, leaving a false
> impression that Phase 2 hadn't started. Reconciled from verified git history:
> HANDOFF + plan status corrected (PR #20), and the skipped compound doc written
> + learnings propagated (this cycle). No production code changed.

## Current State

### 2026-07-18 real-lead intake session

- Imported **16 genuine, future-dated gig inquiries** from the authenticated Gmail account into `data/leads.db`: 13 Squarespace inquiries and 3 GigSalad inquiries.
- Excluded reminders, duplicates, tests, obvious spam, and past events. Every imported record has a dated event between 2026-07-20 and 2027-02-13.
- Imported records as raw `received` leads only. No AI analysis or draft generation ran, and no email or SMS was sent.
- Kept `DRY_RUN=true` and `AUTO_SEND_ENABLED=false` throughout the import. The one-time import payload and helper were removed after verification.
- Verified the database contains exactly 16 leads and `git diff --check` passes.
- Investigated the dashboard's long-running “Pipeline running” state. All 16 imported records have `pipeline_completed_at = NULL` and no draft, confirming that no analysis job was active. A sending-disabled test of one lead returned Anthropic HTTP 401 (`API key is invalid`). The test record was restored exactly to its pre-test `received` state and the temporary diagnostic helper was removed.
- Re-tested after the user replaced the `.env` value on 2026-07-20. The file has exactly one well-formed `ANTHROPIC_API_KEY` entry with the expected prefix and no whitespace or placeholder text, but Anthropic still returns HTTP 401. No lead was modified. The credential itself is invalid or revoked and must be regenerated in Anthropic Console.
- After a new key was generated, found that an older inherited shell variable was overriding `.env`; running with that stale value removed validated the new key successfully.
- Saved three no-send analyses: Sydney Lukasezck (confidence 90, gate passed), Samantha V (confidence 70, gate passed), and Lali (confidence 0, gate failed and requires manual review). Johnny Martinez and Jennifer hit clarification-draft validation errors without record changes. The account then returned `credit balance is too low`, leaving the other 11 records untouched.
- All 16 leads remain in `received` status. The three saved drafts have `pipeline_completed_at = NULL` intentionally so startup recovery cannot interpret them as interrupted SMS deliveries. No email, platform reply, or SMS was sent.

### 2026-07-18 dashboard UI/UX session

Completed the full ten-item operational pass in priority order:

- Clarified approval scope and destination; **Approve draft** explicitly sends the phone-ready copy to Alex’s phone, not to the client.
- Rebuilt expanded leads as a focused review workspace with a primary draft, collapsible phone copy, confidence explanation, decision brief, and persistent actions.
- Added urgency-based queue ordering and visible reasons, Follow-Up badges/banner, guided Analyze first use and progress, actionable Insights, retry/loading/error states, keyboard row expansion, and populated mobile layouts.
- Used a temporary, isolated fictional fixture database for visual verification, then stopped the fixture server, detached the database from the project, and removed the generator after confirming the product must display real gigs only.
- Verified fictional populated Queue, expanded lead, Follow-Ups, Insights, Analyze validation, and 390px mobile states in the in-app browser. No live record was touched and no message was successfully sent.
- Saved final evidence in `docs/audits/2026-07-18-ui-ux/` and updated the audit.
- Verification: dashboard script syntax passed; `git diff --check` passed; `npm test` **315 passed, 0 failed**. `npx tsc --noEmit` still reports pre-existing errors in automation/router/Claude typing files not changed in this pass.

Completed a combined desktop/mobile audit and implemented the highest-priority fixes in `public/dashboard.html` and `public/dashboard.css`:

- Fixed document-level horizontal overflow caused by the five-tab mobile navigation.
- Added compact 2×2 mobile metrics, task-oriented empty states, and direct next actions.
- Added a persistent Analyze label and clearer helper copy.
- Added tab semantics, roving focus, arrow-key navigation, visible focus, and reduced-motion support.
- Bumped the dashboard stylesheet URL through `v=5` so the responsive and operational corrections are not masked by the one-hour static cache.
- Saved before/after evidence and the audit at `docs/audits/2026-07-18-ui-ux/`.
- Verified 390px and 1280px layouts in the local dashboard. `npm test`: **315 passed, 0 failed**.

The original empty-state gap was checked with temporary isolated fictional fixtures that are no longer connected to the app. Real approval/follow-up mutations and live AI streaming remain intentionally unexecuted until an inert staging adapter is available.

**Phase 1** (P3 Batch + Gmail Intake) — complete: brainstorm → plan → work → review → compound. 293 tests passing at that baseline.

**Phase 2** (Gmail Intake: Enable Auto-Send + Dashboard done_reason) — **implemented, Codex-reviewed, and merged to `main` via PR #19 on 2026-05-31.** Delivered:
- **P0 fix:** auto-send path calls `completeApproval()` (`src/automation/orchestrator.ts:295`) so auto-sent leads schedule follow-ups atomically.
- **P1:** `autoSendEnabled` mode logged at startup (`9c97fd5`); guards against stale Railway env vars.
- **done_reason** rendered on lead cards (`2d0dd3e`, `public/dashboard.html`) and threaded through orchestrator + DB layer.

`main` is up to date with `origin/main` (pushed). Test count not re-verified in this reconciliation pass.

**Auto-send is NOT live.** `autoSendEnabled` defaults to `false` (review-only). Enabling is a one-way operational change via Railway env `AUTO_SEND_ENABLED=true` — deliberately gated behind a draft-quality monitoring period per the Phase 2 plan's `feed_forward.risk`. This is an operational decision for Alex, not unfinished code.

## Outstanding

| Item | Notes |
|------|-------|
| **Enable auto-send in production** | Operational call: flip Railway `AUTO_SEND_ENABLED=true` after the review-only monitoring period confirms draft quality. |
| **Production-lessons addendum** | Once auto-send runs live, add an addendum to the Phase 2 solution doc (reply quality, false-auto-send rate, follow-up behavior). The solution doc marks production validation as PENDING. |
| **TODO — replace stale Twilio Auth Token** | Dashboard **Approve** (SMS phone-copy to Alex) fails with **500 → Twilio 401 (code 20003)**. Root cause: `TWILIO_AUTH_TOKEN` in `.env` is **31 chars, should be 32** (truncated on paste). Fix: copy the full token from console.twilio.com → Account Info into `.env` line ~20, then verify live before retrying: `curl -s -o /dev/null -w '%{http_code}' https://api.twilio.com/2010-04-01/Accounts/$SID.json -u "$SID:$TOKEN"` must return **200** (per key-rotation rule: verify with a real auth call, not a string match). Until fixed, drafts are still fully usable — copy them from the dashboard directly. Twilio creds live only in `.env` (not `~/.zshrc`), so no shell fix needed. |

## Key Artifacts

| Phase | Location |
|-------|----------|
| Phase 1 Plan | `docs/plans/2026-05-22-feat-p3-batch-gmail-intake-plan.md` |
| Phase 1 Solution | `docs/solutions/architecture/2026-05-22-p3-batch-gmail-intake-phase1-hardening.md` |
| Phase 2 Plan | `docs/plans/2026-05-31-feat-gmail-intake-phase2-auto-send-plan.md` (status: completed) |
| Phase 2 Solution | `docs/solutions/architecture/2026-05-31-gmail-intake-phase2-auto-send-done-reason.md` (production lessons PENDING) |
| Dashboard UI/UX Audit | `docs/audits/2026-07-18-ui-ux/AUDIT.md` |

## Deferred Items (still open from Phase 1)

| Item | Reason |
|------|--------|
| Extract shared esc() to public/shared.js | Two-file duplication (index.html + dashboard.html) |
| Levenshtein fuzzy matching | Not justified by production data |
| OAuth token refresh persistence on Railway | Accepted for Phase 1 |
| full_draft length cap | Pre-existing from Cycle 11 |
| Dual parser unification | Pre-existing |
| Broader soft-refusal patterns | No production data yet |
| Unicode normalization in normalizeFormatText | No production data yet |

_(done_reason in dashboard — completed in Phase 2, removed from this list.)_

## Cross-project reference — FilmCon dashboard patterns (2026-07-18)

The archived FilmCon dashboard (`~/Projects/filmcon/docs/solutions/2026-07-18-filmcon-dashboard-unshipped-patterns.md`, code at git tag `filmcon-dashboard-archived`) generalized two patterns that came *from here* and loop back to open work here:

- **Audit-first, success-only atomic write** is the generalized form of *this project's own* Phase 2 P0 fix — the auto-send path calling `completeApproval()` (`src/automation/orchestrator.ts:295`) so the state change and its follow-up/audit land atomically. When adding any **new state-changing path**, route it through the one canonical atomic function; never re-implement inline (that was the original bug).
- **Deploy fail-open + unenforced-gate + stale-env** lessons speak directly to the **`AUTO_SEND_ENABLED` Railway gating**. Before flipping auto-send live: enforce the safety gate *in code/CI*, not by remembering to check it; log the resolved flag at startup (already done — keep it); and verify the live Railway env with a real check, not an assumption (the "guards against stale Railway env vars" note here is the same class as FilmCon's fail-open-because-ENVIRONMENT-never-wired P0).

### 2026-08-07 security fix + typecheck diagnosis session

**Shipped and verified live.** `public/mockup-hybrid.html` was served **without
authentication** on production. `src/app.ts:68` registers `express.static` *after*
the three `sessionAuth`-protected routes (`/dashboard.html`, `/`, `/index.html`),
so every other real file in `public/` was public. The exposed file publishes quote
figures verbatim ($250–$850).

Moved to `docs/design/` rather than deleted — seven references across
`AGENT_EPISODES.md`, the redesign plan, and the brainstorm cite it as the approved
design reference, and deleting it would have left dangling citations. All
references updated in the same commit. PR #22, squash-merged as `e339340`.

Verified against production with a control, before and after:

| Path | Before | After |
|---|---|---|
| `/mockup-hybrid.html` | **200** (56,506 bytes) | **401** |
| `/health` | 200 | 200 |
| `/dashboard.html` | 401 | 401 |
| `/no-such-file.html` | 401 | 401 |
| `/dashboard.css` | 200 | 200 |

The 401 on a **nonexistent** path is the control that makes the reading
interpretable: it proves the 200 was a genuine static serve of a real file, not a
blanket allow. Scope is limited to files that actually exist in `public/` — this
was not directory traversal. Railway auto-deployed from `main` ~40s after merge.

**Diagnosed, not fixed: `npx tsc --noEmit` fails with 10 errors.** Pre-existing;
this session touched no `.ts`. They are 4 root causes:

| Group | Errors | Root cause | Fix |
|---|---|---|---|
| **A** | 6 | `src/claude.ts:4` — `Awaited<ReturnType<Anthropic["messages"]["create"]>>` resolves to `Message \| Stream` because `create` is overloaded and no literal `stream: false` narrows it. `Stream` has no `.content`. Hits `claude.ts:59,110` + three test mocks. | `type ClaudeMessageResponse = Anthropic.Message;` then add `citations: null` to the three mocks' text blocks (SDK `TextBlock` requires it). |
| **B** | 3 | `types.ts:24` `RecommendedFormat = Format \| "unresolved"` passed where a plain `Format` is required: `router.ts:79`, `generate.ts:429`, and `:434` as a downstream consequence. | Narrowing guard before each lookup so `"unresolved"` is handled explicitly. |
| **C** | 1 | `orchestrator.ts:264` — `AutoSendDeps.sendSms` typed `=> Promise<void>`, real `sendSms` returns `Promise<{success, error?}>`. | Widen the dep type. |
| **D** | 1 | `shape-lead.test.ts:62` — `@ts-expect-error` above `delete (lead as any).done_reason`; the `as any` makes the line legal, so the directive expects an error that no longer occurs. | Delete the directive line. |

**Group B is the only correctness risk** — `"unresolved"` reaching the pricing
lookup returns `undefined` and propagates into a quote. A, C, D are hygiene.

**Why these accumulated: there is no typecheck gate.** No `tsc` in
`package.json` scripts, no `.github/workflows`, no git hooks. `tsx` strips types
without checking them, so the 315-test suite (all passing) has never looked at
them. "Tests pass" and "the code typechecks" are different claims and only one
was being measured.

**Tracker correction found, not applied:** `todos/052-pending-p2-extract-css-from-dashboard.md`
is still `status: pending` but the work is **done** — verified: `public/dashboard.css`
exists (1358 lines), `dashboard.html` has **0** inline `<style>` blocks and links
the stylesheet. Landed in `6baf6cd`. (Its filename says `052`; the heading inside
says `# 047:`.) Flip the status and reconcile the number.

**RESOLVED 2026-08-07** in `54d90bf` — status flipped, file renamed to
`todos/052-done-p2-extract-css-from-dashboard.md`. The sha above was also wrong
(`8641f3b` → `6baf6cd`, corrected in `aa93fa0`).

## Prompt for Next Session — SUPERSEDED, DO NOT RUN

> Completed 2026-08-07 on branch `fix/typecheck-errors` (pushed, head `54d90bf`).
> All 10 errors are fixed. Kept verbatim for the record — the live instructions are
> in **Prompt for Next Session** at the bottom of this file.

```
Project root: /Users/alejandroguillen/Projects/gig-lead-responder

Read HANDOFF.md, section "2026-08-07 security fix + typecheck diagnosis session".
Fix all 10 `npx tsc --noEmit` errors, in this order, each as its own commit on a
branch off main (do NOT commit to main):

1. Group B first — it is the only correctness risk. Add narrowing guards so
   "unresolved" is handled explicitly before the Record<Format, FormatRates>
   lookup. Files: src/types.ts:24, src/automation/router.ts:79,
   src/prompts/generate.ts:429 and :434.
2. Group A — change src/claude.ts:4 to `type ClaudeMessageResponse =
   Anthropic.Message;` then add `citations: null` to the text blocks in
   src/claude-extended.test.ts:10, src/confidence.test.ts:60,
   src/run-pipeline.test.ts:70.
3. Group C — widen AutoSendDeps.sendSms in src/automation/orchestrator.ts to
   match the real sendSms return type.
4. Group D — delete the dead @ts-expect-error at src/shape-lead.test.ts:62.

Then add "typecheck": "tsc --noEmit" to package.json scripts and confirm BOTH
`npm run typecheck` (0 errors) and `npm test` (315 pass) are green before the
final commit. Do not touch data/leads.db or .env.

Also flip todos/052-pending-p2-extract-css-from-dashboard.md to status: resolved
and rename the file — the work landed in 6baf6cd (verified: dashboard.css exists,
0 inline <style> blocks in dashboard.html).
```

### Three Questions — security fix + typecheck diagnosis session

1. **Hardest implementation decision in this session?** Whether to delete `mockup-hybrid.html` (which is what was authorized) or move it. Seven docs cite it as the approved design reference, so deleting would have closed the exposure while creating seven dangling citations — trading one failure class for a worse one. Moving it out of the served directory and updating every reference in the same commit achieves the same security outcome with no collateral damage, so I deviated and said so explicitly rather than executing the literal instruction.
2. **What did you consider changing but leave alone, and why?** The 10 typecheck errors — diagnosed and grouped but not fixed, because Alex drew the line at a fresh session. Also `.claude/agent-memory/` (gitignored this session rather than committed: it is another agent's scratch state, and committing it would make a stale April note about `ukulele_solo` authoritative for future sessions — that specific claim is now false, `ukulele` routes to `sourced_cultural_solo` per `docs/Sourced_Format_Definitions.md:22`). And `todos/052`, left for the next session with the verification already done.
3. **Least confident about going into review?** Group B's fix shape. I know the three sites and the mechanism, but not what the *correct* behavior is when a format is genuinely `"unresolved"` at a pricing lookup — throw, return a clarification-mode sentinel, or fall back to a default tier is a product decision, not a type-system one. Whoever fixes it should decide that deliberately rather than picking whatever silences `tsc`. Separately: `src/error-middleware.test.ts:155-156` asserts a 200 on `/dashboard.html` as proof auth is intact, but the test runs with `DASHBOARD_USER`/`PASS` unset, which takes the dev bypass at `src/auth.ts:118-126` — "auth passed" and "auth was disabled" produce the same 200. Not a live hole (`src/server.ts:18-21` hard-fails in production without those vars), but that test cannot detect its own bypass.

### 2026-08-07 typecheck fix session (10 `tsc` errors → 0)

#### Prior Phase Risk

Previous phase's "Least confident about" answer, verbatim:

> Group B's fix shape. I know the three sites and the mechanism, but not what the
> *correct* behavior is when a format is genuinely `"unresolved"` at a pricing lookup —
> throw, return a clarification-mode sentinel, or fall back to a default tier is a
> product decision, not a type-system one.

**How this phase addressed it:** by investigating reachability before writing a line of
fix. The premise turned out to be false — at neither site was it a product decision.

**Shipped, not merged.** Branch `fix/typecheck-errors`, cut off `main` at `e339340`,
pushed at `54d90bf`. No PR opened, nothing merged, `main` still fails `tsc`.

| # | Commit | Group | Errors |
|---|--------|-------|--------|
| 1 | `c48dbc2` | B — unresolved format | 10 → 7 |
| 2 | `4d79719` | A — ClaudeMessageResponse | 7 → 2 |
| 3 | `12c6721` | C — sendSms return type | 2 → 1 |
| 4 | `726cae8` | D — dead ts-expect-error | 1 → 0 |
| 5 | `54d90bf` | typecheck script + todo 052 | — |

**Gates:** `npm run typecheck` → 0 errors. `npm test` → 315 pass, 0 fail, 52 suites.
Re-run independently twice (review agent, then the orchestrating session) rather than
taken on report from the agents that made the changes.

**Group B was two opposite problems, not one product decision.**

- `router.ts:79` — `"unresolved"` **does** reach it (traced: `prompts/classify.ts:67-72`
  emits it, `pipeline/classify.ts:33-38` allows it, `enrich.ts:35-37` preserves it,
  `orchestrator.ts:153` routes it). But `getFormatFamily` was **already total** — it
  loops the family table, matches nothing, returns `"unknown"`. The type was too narrow
  for a function that already handled the case. Fix: widen the parameter.
- `generate.ts:429/434` — `"unresolved"` **cannot** reach it. `findMinFloor` has exactly
  one caller, gated behind `budget.tier === "no_viable_scope"`; every `PricingResult`
  carrying `"unresolved"` is constructed with `budget.tier: "none"`; and `lookupPrice`
  already throws on `"unresolved"` at `price.ts:57`. Fix: narrow the parameter to
  `Format`, with `as Format` at the call site behind a documented invariant.

No runtime guard was added at either site, deliberately: at the first it would be
redundant, at the second it would be dead code masquerading as a safety check.

`PricingResult.format` was deliberately **left** as `RecommendedFormat`. Narrowing it
would trade these 3 errors for 2 new ones at `run-pipeline.ts:35` and `:138` and force
inventing a replacement sentinel — a behavior change smuggled in as a typecheck fix.

**Verification method worth reusing: emitted-JS diff.** Rather than eyeballing the diff
for smuggled behavior, the review transpiled `main`'s and `HEAD`'s version of all four
changed production files through the repo's own esbuild and diffed the output — identical
for all four. Zero runtime behavior change proven mechanically instead of asserted. The
instrument was checked too: `tsc --listFiles` confirms all four files were actually
typechecked, and the test glob matches all 24 test files — so "0 errors" could not have
quietly meant "nothing ran".

**Two errors in the previous handoff, found and corrected:**

- Group A is **5** errors, not 6. The stated 6+3+1+1 = 11; there are 10.
- Todo 052 landed in **`6baf6cd`**, not `8641f3b` (corrected in `aa93fa0`). `8641f3b` is
  the 07-18 UI/UX pass and touches no CSS at all, so `git show 8641f3b` would have read
  as a falsely-closed todo.

**Unplanned but mechanically required:** `src/orchestrator.test.ts` (the spy mock must
return `{success: true}` once `sendSms` is widened) and `ClaudeMessageRequest` →
`MessageCreateParamsNonStreaming` in `src/claude.ts`.

**The new gate is not wired to anything.** `"typecheck": "tsc --noEmit"` exists in
`package.json`, but there is still no `.github/workflows` and no git hooks. It runs only
when a human remembers to run it — the same unenforced-gate class that let 10 errors
accumulate in the first place.

## Prompt for Next Session — SUPERSEDED 2026-08-08, DO NOT RUN

> The typecheck stream in this block is fully closed (items 1-4 all done as of
> `defe03e`). The lead-processing item is still live and has been carried
> forward verbatim into the current **Prompt for Next Session** at the bottom
> of this file. Kept here for the record only.

```
Project root: /Users/alejandroguillen/Projects/gig-lead-responder

Run the "First 60 Seconds: Peer-Session Check" at the top of HANDOFF.md before any edit.
Two sessions worked this repo on 2026-08-07/08 and both streams are recorded below.

PRIMARY (from the lead-processing stream):
After Anthropic API credits are added, process only the 13 real received leads whose
`full_draft` is NULL. Unset the inherited ANTHROPIC_API_KEY so dotenv loads the current
`.env` value, and keep DRY_RUN=true and AUTO_SEND_ENABLED=false. Isolate
clarification-mode generation failures and do not send email or SMS.
Relevant files: data/leads.db, .env, src/run-pipeline.ts, public/dashboard.html.

TYPECHECK STREAM — items 1-3 are DONE as of 2026-08-08, do not redo them:
  [x] 1. fix/typecheck-errors merged (PR #23, f478239). main typechecks clean.
  [x] 2. CI gate wired (PR #24, 9cfa5f8) — .github/workflows/ci.yml runs typecheck +
         test on PRs and pushes to main. Branch protection on main now REQUIRES the
         "typecheck + test" check, with strict + enforce_admins both on. Verified by
         a real rejected push: "GH006: Protected branch update failed".
  [x] 3. todos/082 filed (PricingResult rehydration unvalidated at the DB boundary).
  [x] BONUS. tsconfig now typechecks scripts/ too (PR #25, 400bb1a) — it previously
         passed a planted error in scripts/ at exit 0.
  [ ] 4. STILL OPEN: src/error-middleware.test.ts:155-156 asserts a 200 on
         /dashboard.html as proof auth is intact, but runs with DASHBOARD_USER/PASS
         unset and so takes the dev bypass at src/auth.ts:118-126. "Auth passed" and
         "auth was disabled" produce the same 200; the test cannot detect its own
         bypass. Not a live hole (src/server.ts:18-21 hard-fails in production).

Also open, not urgent: `npm audit` reports 10 vulnerabilities (1 low, 5 moderate,
4 high), deliberately not gated in CI. No linter is configured.

Do not touch data/leads.db or .env.
```

### Three Questions — typecheck fix session (2026-08-07)

1. **Hardest implementation decision in this session?** Whether to trust the previous
   session's framing of Group B as a product decision. The handoff said the fix shape
   was a product call and implied a runtime guard; the conservative move was to
   implement one. Instead I spent four parallel read-only agents on reachability first.
   That inverted the answer: at `generate.ts` the guard would have been unreachable dead
   code that reads as a safety check, and at `router.ts` it would have duplicated
   behavior the function already had. Taking a well-written handoff at face value would
   have produced a worse codebase than the type errors it replaced.
2. **What did you consider changing but left alone, and why?** `PricingResult.format`
   (narrowing it looks tidy but forces inventing a new sentinel — see above). The
   `twilio-webhook.ts:152` persistence hole, left as a todo rather than fixed here: it is
   pre-existing, it fails loud rather than silent, and folding it in is exactly the scope
   creep the reviewer flagged on commit 5. And `.claude/agent-memory/`, still untracked.
3. **Least confident about going into review?** The `as Format` cast at
   `generate.ts:374`. The unreachability proof is sound today, but it rests on an
   invariant maintained by convention across four files — not by the type system and not
   by any test. Nothing fails loudly if a future edit constructs a `PricingResult` with
   `format: "unresolved"` and `budget.tier: "no_viable_scope"`; the cast just goes quiet.
   A test asserting that combination is unconstructible would convert the comment into an
   enforced invariant. Related: the emitted-JS-identical proof shows behavior did not
   change, which is not the same claim as the types now describing reality correctly.

### 2026-08-08 CI gate, dependency, and deploy-verification session

#### Prior Phase Risk

Previous phase's "Least confident about" answer, verbatim:

> The `as Format` cast at `generate.ts:374`. The unreachability proof is sound today,
> but it rests on an invariant maintained by convention across four files — not by the
> type system and not by any test.

**How this phase addressed it: it did not.** That invariant is still unenforced. It is
recorded in `todos/082`, which covers the same boundary from the read side. Accepted
rather than closed, and named here so it is not mistaken for handled.

**Six PRs, all merged, `main` at `defe03e`.**

| PR | What | Merge |
|---|---|---|
| #26 | land the 2026-08-07 session records on main | `2df70df` |
| #27 | file todos 083, 084, 085 | `1f626cf` |
| #28 | resolve all 10 dependency vulnerabilities | `a8389e5` |
| #29 | audit gate; close 084; file 086 | `5196ff8` |
| #30 | `/health` build identifier | `2550b96` |
| #31 | close 086 | `defe03e` |

**The gate is now enforcing, not advisory.** Branch protection on `main` requires the
`typecheck + test` check, with `strict: true` (branch must be up to date, which is the
direct answer to `main` moving under a session mid-PR) and `enforce_admins: true`.

Proven, not assumed. A real push of an empty commit straight at `main` was rejected:

```
remote: error: GH006: Protected branch update failed for refs/heads/main.
remote: - Required status check "typecheck + test" is expected.
```

A first attempt used `git push --dry-run` and reported success — dry-run never reaches
the server's receive-time checks, so "would be allowed" and "was never evaluated" print
identically. That result was discarded rather than counted.

**Dependency vulnerabilities: 10 → 0** (`npm audit`). Lockfile-only; `package.json` is
byte-identical, no `--force`, no semver-major bump. `npm audit fix` cleared 9. The tenth
could not be fixed that way: it kept printing "fix available via `npm audit fix`" while
changing nothing, because `tsx@4.21.0` pinned `esbuild@0.27.3`. `npm update tsx`
(4.21.0 → 4.23.11) resolved `esbuild@0.28.1`. **The advisory covers `0.27.3 - 0.28.0`,
so landing on `0.28.0` would have looked like an upgrade and fixed nothing** — "newer"
and "patched" are different claims.

**`npm audit` is gated separately, on purpose** (`.github/workflows/audit.yml`). It
queries the registry at run time, so an advisory published overnight can red a
previously-green PR with no code change. Blocking unrelated work at an arbitrary moment
is how a gate stops being read. It runs on PRs touching `package.json`/`package-lock.json`,
weekly for drift, and on demand. `--audit-level=high` fails the run; the step before
prints the full report unfiltered. Verified against a known answer: clean repo exit 0,
scratch project with `lodash@4.17.11` exit 1.

**Deploys are now verifiable.** `/health` previously returned
`{"status":"ok","rejectedEmails":N}` — no build identifier. Railway auto-deploys from
`main`, so the only post-merge signal was a `200` that was equally true before the merge.
It now returns `commit` and `startedAt`. Confirmed end to end: merge commit `2550b96`,
production `/health` returned `"commit":"2550b96"`. First deploy in this repo verified
rather than inferred.

That also settled an open assumption — `RAILWAY_GIT_COMMIT_SHA` is the correct variable
name. It was checkable only because the field returns a literal `"unknown"` on failure
instead of being omitted; a wrong guess stayed visible rather than going silent.

**Coverage gap closed:** `tsconfig.json` was `include: ["src"]`, so `npm run typecheck`
never looked at `scripts/` — 91 files checked, zero from `scripts/`, confirmed by
planting a type error there that passed at exit 0. Now 94 files. `scripts/plan-gate.ts`
is executed code with its own test file and had been unguarded.

**Housekeeping:** 15 merged branches deleted (all verified as ancestors of `main` first,
SHAs recorded). Suite 315 → 351. Five branches remain, four genuinely unmerged.

## Prompt for Next Session — SUPERSEDED 2026-08-09, DO NOT RUN

> The PRIMARY item (13 leads) and all four open todos are still live and have been
> carried forward verbatim into the current **Prompt for Next Session** at the bottom
> of this file. Kept here for the record only.

```
Project root: /Users/alejandroguillen/Projects/gig-lead-responder

Run the "First 60 Seconds: Peer-Session Check" at the top of HANDOFF.md before any edit.
main was defe03e when this was written; this handoff commit sits on top of it, so
check `git log -1` rather than trusting that SHA. CI (typecheck + test) is a REQUIRED
status check with strict and enforce_admins on, so you cannot push to main directly —
branch, PR, let CI pass, merge.

VERIFY A DEPLOY LIKE THIS (new as of 2026-08-08):
  curl -s https://gig-lead-responder-production.up.railway.app/health | jq -r .commit
  It must equal the merged SHA. "unknown" means the build identifier broke.

PRIMARY — carried forward, still open:
After Anthropic API credits are added, process only the 13 real received leads whose
`full_draft` is NULL. Unset the inherited ANTHROPIC_API_KEY so dotenv loads the current
`.env` value, and keep DRY_RUN=true and AUTO_SEND_ENABLED=false. Isolate
clarification-mode generation failures and do not send email or SMS.
Relevant files: data/leads.db, .env, src/run-pipeline.ts, public/dashboard.html.

OPEN TODOS (nothing p1 outstanding):
  083 p2  src/error-middleware.test.ts:155-156 asserts 200 on /dashboard.html as proof
          auth works, but runs with DASHBOARD_USER/PASS unset and takes the dev bypass
          at src/auth.ts:118-126. "Auth passed" and "auth was disabled" are identical.
          Not a live hole. Its acceptance criteria require DEMONSTRATING the fixed test
          goes red when sessionAuth is removed — do not skip that step.
  082 p2  PricingResult rehydrated from the DB with one-field validation, then cast.
          Also the home of the unenforced generate.ts:374 invariant.
  081 p2  advisor tool — Opus on generate/verify.
  085 p3  no linter configured; decide adopt-or-not and record the decision either way.

Do not touch data/leads.db or .env.
```

## Three Questions

1. **Hardest implementation decision in this session?** How to wire `npm audit` into CI.
   The obvious move was adding a step to `ci.yml`, which would have made it a required
   check on every PR. I rejected that: `npm audit` queries the registry at run time, so
   its verdict depends on what advisories exist today rather than on anything in the
   repo, and an advisory published overnight would red a previously-green PR with no code
   change. For a solo maintainer that means being blocked at an arbitrary moment on work
   unrelated to the finding — the precise mechanism by which a gate stops being read. A
   separate workflow, triggered on lockfile changes plus a weekly schedule, keeps the
   signal and drops the false blocking. The reasoning is written into the file so the
   next person does not "simplify" it back into `ci.yml`.
2. **What did you consider changing but left alone, and why?** The `generate.ts:374`
   invariant — still unenforced, deliberately left to `todos/082` rather than folded into
   an unrelated PR. `npm audit` at `--audit-level=moderate` rather than `high`; rejected
   because moderate advisories in dev tooling are a steady trickle and would turn the
   gate into noise. And `enforce_admins` was initially set to `false` as a safety valve
   before I reversed it — a bypassable gate for a sole admin reproduces the exact failure
   this session was closing.
3. **Least confident about going into review?** That the CI gate covers what matters, as
   opposed to what is easy to check. It runs `tsc` and the test suite. It does not run a
   linter (`085`), does not gate on `npm audit` for most PRs by design, and — the real
   gap — **nothing verifies the deployed app actually works.** `/health` returning the
   right SHA proves the right code shipped; it does not prove the pipeline processes a
   lead correctly. 351 tests pass against a suite that has never sent a real message.
   Separately: `--audit-level=high` means moderate advisories now accumulate silently.
   That is a deliberate trade, but it is the kind of threshold that gets set once and
   never revisited, so it is worth a look if the moderate count ever climbs.

---

### 2026-08-09 compound phase — Yelp allowlist capture bug

**Shipped:** `695b62a` (PR #33) — `docs/solutions/logic-errors/2026-08-09-yelp-allowlist-never-matched-production.md`, closing the cycle opened by `197f118` + `4ff91c6` on 2026-08-07.

**What the cycle was.** While pulling real Gmail samples to build a reply parser (roadmap #3), the survey found that `source-validator.ts` allowed `/^(no-reply|biz-alerts)@yelp\.com$/i` while real Yelp mail arrives from `reply+<32 hex>@messaging.yelp.com`. Anchored pattern, so no near-miss: **every Yelp lead had been rejected as "Unknown sender" for months.** Six conversations in the mailbox, three with client replies, none ingested.

**The part that mattered more than the bug.** Fixing the allowlist would have armed `parseYelpEmail`, which had never executed and had no tests. Audited against a real email first, it captured Yelp's passwordless login URL — a bearer credential — into `portalUrl` **and** `rawText`, the field sent to the Claude API. Both fixed before the allowlist change merged.

**Process deviation, recorded not endorsed:** no plan phase and no `/workflows:review` phase this cycle. Verification was 342/342 tests (11 new, proven to fail against the pre-fix parser), a typecheck error set proven byte-identical to `main`, and CI green. **There are no review-agent finding counts — do not read their absence as "review found nothing."**

**Deliberately NOT done:** `gigs@gigsalad.com` was not added to the allowlist. Accepting it without booked-detection turns every payment receipt into a phantom lead.

### Three Questions — compound phase (2026-08-09)

1. **Hardest pattern to extract?** Separating "the allowlist regex was wrong" from the reusable lesson. The typo is not knowledge. The reusable part is that the broken gate was *shielding* an unreviewed code path, so the fix and the audit behind it had to ship together. That only surfaced after tracing what `validateSource` passing actually triggers downstream.
2. **What did you consider documenting but left out?** A redesign making `rejectedEmailCount` persistent and per-platform. Left out because a per-platform counter still cannot distinguish "no Yelp leads arrived" from "Yelp leads were rejected" — the honest instrument is a *positive* liveness assertion (each configured platform has ingested ≥1 lead in N days), and that deserves its own cycle.
3. **Least confident about?** **The fix has never processed a real Yelp email.** Everything green is fixtures. `YelpPortalClient.fetchLeadDetails()` is next in the chain and unexercised by exactly the mechanism that left the parser untested — expect the next defect there. Business impact also remains unmeasured.

## Prompt for Next Session — SUPERSEDED 2026-10-03, DO NOT RUN (current prompt is in the 2026-10-03 section at the top)

```
Project root: /Users/alejandroguillen/Projects/gig-lead-responder

Run the "First 60 Seconds: Peer-Session Check" at the top of HANDOFF.md before any edit.
Check `git log -1` rather than trusting any SHA written here. CI (typecheck + test) is a
REQUIRED status check with strict and enforce_admins on, so you cannot push to main
directly — branch, PR, let CI pass, merge.

VERIFY A DEPLOY LIKE THIS:
  curl -s https://gig-lead-responder-production.up.railway.app/health | jq -r .commit
  It must equal the merged SHA. "unknown" means the build identifier broke.
  NOTE: `rejectedEmails` in that same response is in-memory and resets on restart. It
  cannot distinguish a dead channel from a healthy one. Never read it as evidence.

PRIMARY — carried forward, still open:
After Anthropic API credits are added, process only the 13 real received leads whose
`full_draft` is NULL. Unset the inherited ANTHROPIC_API_KEY so dotenv loads the current
`.env` value, and keep DRY_RUN=true and AUTO_SEND_ENABLED=false. Isolate
clarification-mode generation failures and do not send email or SMS.
Relevant files: data/leads.db, .env, src/run-pipeline.ts, public/dashboard.html.
(Alex's standing rule is to NOT buy usage credits — confirm with him before assuming
this item is unblocked.)

NEW — first real Yelp lead is the open verification:
The 2026-08-07 Yelp fix has never processed a real Yelp email. When one arrives, watch
the whole chain: poller → validateSource (expect kind:"lead") → parseYelpEmail →
YelpPortalClient.fetchLeadDetails() → pipeline. fetchLeadDetails is the next unexercised
stage; treat it as unreviewed. Read
docs/solutions/logic-errors/2026-08-09-yelp-allowlist-never-matched-production.md first.

OPEN TODOS (nothing p1 outstanding):
  083 p2  src/error-middleware.test.ts:155-156 asserts 200 on /dashboard.html as proof
          auth works, but runs with DASHBOARD_USER/PASS unset and takes the dev bypass
          at src/auth.ts:118-126. "Auth passed" and "auth was disabled" are identical.
          Not a live hole. Its acceptance criteria require DEMONSTRATING the fixed test
          goes red when sessionAuth is removed — do not skip that step.
  082 p2  PricingResult rehydrated from the DB with one-field validation, then cast.
          Also the home of the unenforced generate.ts:374 invariant.
  081 p2  advisor tool — Opus on generate/verify.
  085 p3  no linter configured; decide adopt-or-not and record the decision either way.

Do not touch data/leads.db or .env.
```
