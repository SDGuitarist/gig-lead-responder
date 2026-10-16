---
title: "fix: the Yelp parser reads an email format Yelp no longer sends, so every Yelp lead is held with no text"
date: 2026-10-16
status: plan, Revision 0 (not yet plan-reviewed)
branch: feat/hub-phase0
---

# Yelp parser: read the "requested a quote" form that the email already carries

### Prior Phase Risk

No brainstorm: skip gate, the input is a measurement with a record (`todos/096-...md`, `todos/094-...md`). The previous
phase's "least confident" answer, quoted from `HANDOFF.md` Update 23 (Three Questions): "That the Yelp block matters at
all: one lead checked, and it had no hidden text." Todo 094 then measured it: "These counts come from the helper's
report and are not re-checked by me beyond Jade." This plan accepts that risk and makes the first work step re-check the
two real emails already in hand (Sophia and Jade) by running the parser on them, so the fix does not rest on the helper's
word.

## Problem (measured, not assumed)

Every Yelp lead is held at parse time and never reaches the pipeline.
- `parseYelpEmail` (`src/automation/parsers/yelp.ts:43,62`) always returns `parseConfidence: "low"` and `enriched: false`,
  with the warning "Yelp emails truncate client messages — portal enrichment required".
- `orchestrator.ts` step 5 holds any low-confidence lead without running the pipeline; step 4 first tries
  `yelpClient.fetchLeadDetails`, which fails because Yelp Biz blocks the app's browser (403, DataDome; todo 094).
- Lead #17 (Sophia, 2026-10-15): `raw_email` was 40 characters (the placeholder), status failed.
- The email Yelp sends today is the `request_a_quote_first_message_v4` notice. Its plain text holds the form: "When do you
  require this service?", "Are there any other details you'd like to share?" (only when the client answered), "In what
  location do you need the service?". Read in full for two emails this session (Sophia 2026-10-14, Jade 2026-08-22): Jade's
  carries the occasion, hours, budget, guest count and place in the details answer.
- 11 recent Yelp leads compared against their Yelp Biz pages (helper, in Alex's logged-in browser; Sophia by me): 0 had
  client content the email lacked. One difference: a client who edited her details after the first email (Madalyne).

## What is true today (read 2026-10-16)

- `extractTruncatedMessage` (`yelp.ts:146`) starts capturing only after a line matching `/sent you|new message|wrote:/i`.
  The quote-request email has none of those, so the captured text is empty.
- `src/yelp-parser.test.ts` has no lead fixture at all: its one email is a client REPLY ("Kimberly has replied to your
  message", 2026-07-14), the format the parser was written against. The parser has never been run on a real lead email.
- `extractYelpPortalUrl` (`yelp.ts:~80`) accepts only `/messaging/<id>/thread/<id>`. The quote-request email's
  `return_url` is `/leads_center/<id>/leads/<id>`, so `portalUrl` is empty and `router.ts:56` adds "Missing portal URL".
- `router.ts:47` holds every Yelp lead that is not `enriched`; `orchestrator.ts:106` calls the portal only when
  `!lead.enriched`. So a lead marked complete skips the portal read with no orchestrator change.
- `source-validator.ts` decides lead versus reply by `/has replied to your message/i` in the body, or a `RE:` subject. A
  quote request has neither, so it is "lead" (lead #17 reached the parser).
- Credential containment is already in `yelp.ts`: `CREDENTIAL_URL`, `ANY_URL`, `stripCredentialUrls`, `normalizeLine`.
  Yelp's "Reply on Yelp Biz" links carry a passwordless login token (a bearer credential). It must never reach the
  database, the dashboard or the model (memory: `project_yelp-allowlist-capture-bug.md`).
- Nothing sends in Phase 0: the poller forces dry run (`poller.ts:203`), `autoSendEnabled` is false. `submitReply`'s
  selectors are marked "[VERIFY LIVE]" and the login is blocked; no Yelp send path has ever worked.

## Decision

D1. **Parse the form, not a message.** In `parseYelpEmail`, from `msg.bodyText` (fallback `msg.bodyHtml`, tags stripped):
find the question lines (a line that, after `normalizeLine`, ends in `?`) between the line `You have a new <x> request.`
and the first "Reply to <name> on Yelp Biz" line. An answer is the paragraphs after a question up to the next question;
after the LAST question only its first paragraph is kept (the lines after it are the client's display name and three
`0` counters, which must not enter the text). Every answer line goes through `normalizeLine` and `ANY_URL` removal, and
the whole text through `stripCredentialUrls`.

D2. **The text the pipeline sees** = the sentence `"<First name> requested a quote from Alex Guillen Music for a <service>."`
(taken from the email's first line) followed by each `question` / `answer` pair, blank-line separated. NOT included: the
business's own address ("Sent to Alex Guillen Music, 444 Anita St…"), the client's display name line, the counters, any URL.
Reason: the address would read as the event's venue; the name line and counters are noise.

D3. **Completeness, and what it changes.** The lead is `parseConfidence: "high"` and `enriched: true` only when BOTH the date
question and the location question were parsed. Anything else keeps today's behavior (`low`, `enriched: false`, the old
warning, the old placeholder text). The `enriched` field keeps its name; its meaning becomes "the lead text is complete"
(comment in `types.ts` updated). A lead whose client answered nothing beyond date and zip (Sophia) is still `high`: it is a
vague lead, which the pipeline already routes (the vague-lead quote route).

D4. **Router: an explicit Yelp hold replaces the accident.** Add one mandatory hold reason for EVERY Yelp lead: "Yelp portal
reply not verified live (todo 094): Alex sends from Yelp". It keeps Yelp from ever reaching auto-send while `submitReply` is
unproven and the login is blocked, and it is the reason a parsed, complete Yelp lead still shows as a held draft in the
dashboard. The "not enriched" hold stays for incomplete parses. Lifting the new hold is Module 1 work with Alex's yes.

D5. **Portal URL.** `extractYelpPortalUrl` additionally accepts `^/leads_center/[\w-]+/leads/[\w-]+/?$` from `return_url`
(token discarded, same rule as the thread path). A different path is still refused.

D6. **A parse-only mode for the ingest script.** `scripts/ingest-one.ts <id> --parse-only` fetches the message, runs the
source validator and `parseLeadEmail`, and prints the parsed lead with the text shown in full and `portalUrl` shown as
shape only. No database write, no model call, no portal call. It is how a human sees the result on real mail with no API spend.

## What must not change

The credential containment (`CREDENTIAL_URL`, `ANY_URL`, `stripCredentialUrls`, `normalizeLine` behavior and every existing
test in `yelp-parser.test.ts`); the reply detection in `source-validator.ts`; GigSalad and Squarespace parsing and routing;
the poller's forced dry run; every pipeline prompt; the portal client; `submitReply` and `dispatchReply`.

## Out of scope (each its own item)

- A client who edits her details after the first email (Madalyne's page was newer than the email): the later version is not
  read. Recorded in todo 096; revisit only if it recurs.
- Yelp Biz login and the portal client (todo 094, parked). The Yelp reply template ("travel to Idyllwild", todo 095).
- A client's free text that happens to contain "has replied to your message" would be classed a reply by the validator
  and dropped. Not measured, not fixed here; listed under risks.
- Phone numbers: the Yelp page shows them for some leads, the email does not; not needed for a draft.

## Plan Quality Gate

1. **What exactly is changing?** `src/automation/parsers/yelp.ts` (form parsing, completeness, leads_center portal path), one
   router hold reason, a comment in `src/automation/types.ts`, `scripts/ingest-one.ts` (`--parse-only`), and tests with
   fixtures that copy the REAL structure of a quote-request email with invented names and text.
2. **What must not change?** See the section above.
3. **How will we know it worked?** The EARS tests below; then `--parse-only` on the two real messages (Sophia, Jade) shows the
   expected text; then, after the API limit is cleared and with Alex's go, one dry-run ingest of a future-dated real lead.
4. **Most likely way this plan is wrong?** (a) The question/answer split is wrong for a form shape I have not seen: I have
   read two full emails; the other nine come from a helper's report. Mitigation: `--parse-only` on all 11 real messages is
   a work step, and an unparseable shape falls back to `low`. (b) A client's answer can look like a question line ("Is
   Saturday ok?"): D1 treats a line ending in `?` as a question. Mitigation: only a line that EXACTLY equals one of the known
   form labels, or that follows a blank line and precedes a non-empty answer in the label position, counts; the plan's
   test E4 pins a free-text answer containing a question mark. (c) A held draft is not a quality draft: this only lets the
   pipeline run, it says nothing about draft quality (todo 087). (d) The Yelp text may carry a phone number or email typed by
   the client into the model prompt, like any platform's lead text.
5. **How will a human RUN this, and when?** See Execution Path.

## Acceptance Tests (EARS)

Fixtures are invented text in the exact line structure of the two real emails (blank lines, headings, counters, CTA links
with a placeholder token of the real shape). No real client text, name or contact detail is committed (public repo).

Happy path
- H1. WHEN a quote-request email has only the date and location answers THE SYSTEM SHALL return `parseConfidence: "high"`,
  `enriched: true`, and a `rawText` holding the first sentence, the date question and answer, the location question and
  answer, and none of: the business address, the counter lines, the client display-name line, any URL.
- H2. WHEN the email also has a details answer THE SYSTEM SHALL include that answer verbatim between the date and the location.
- H3. WHEN the first line reads "<Name> requested a quote…" THE SYSTEM SHALL set `clientName` to that first name.
- H4. WHEN `return_url` carries `/leads_center/<a>/leads/<b>` THE SYSTEM SHALL set `portalUrl` to
  `https://biz.yelp.com/leads_center/<a>/leads/<b>` containing neither "passwordless" nor the token.
- H5. WHEN a quote-request lead is routed THE SYSTEM SHALL hold it with the reason "Yelp portal reply not verified live".
- H6. WHEN the orchestrator receives a complete Yelp lead THE SYSTEM SHALL run the pipeline without calling
  `yelpClient.fetchLeadDetails`.
- H7. WHEN the message is a quote-request email THE SYSTEM SHALL validate it as `kind: "lead"`; WHEN it has a `RE:` subject or
  "has replied to your message" THE SYSTEM SHALL still validate it as `kind: "reply"`.

Error cases
- E1. WHEN the email is the old reply-shaped fixture (no form labels) THE SYSTEM SHALL return `low`, `enriched: false` and the
  placeholder text, exactly as today (every existing test passes unchanged).
- E2. WHEN only one of the date and location questions is present THE SYSTEM SHALL return `low`.
- E3. WHEN an answer contains a URL, a markdown link, or a passwordless login URL THE SYSTEM SHALL remove it from `rawText`.
- E4. WHEN the details answer has two paragraphs, or contains a question mark in a sentence, THE SYSTEM SHALL keep the whole
  answer and not start a new pair.
- E5. WHEN the location answer is followed by a name line and `0` counters THE SYSTEM SHALL drop those lines.
- E6. WHEN `return_url` is any other path THE SYSTEM SHALL leave `portalUrl` empty.

Mutation checks (each test fails if the named change is made; recorded by running them): H1 (drop the trailing-paragraph
rule, the counters appear); H2 (ignore the details label, the answer vanishes); H4 (return the login URL, the token
appears); E1 (mark every parse high); H5 (delete the router reason); H6 (remove the `enriched` skip).

## Verification Commands

- `node scripts/run-tests.mjs --match yelp` passes; `npm test` shows 0 fail; `npx tsc --noEmit` exits 0.
- `npx tsx scripts/ingest-one.ts 1a13bd8fa0454331 --parse-only` (Sophia): confidence high, text has the date and zip
  questions and answers, no "Anita St", no "0" lines.
- `npx tsx scripts/ingest-one.ts 1a02a69016f40bb2 --parse-only` (Jade): the details answer contains "birthday party".
- The same on the nine other ids in todo 094's sample; any `low` result is listed with its reason, not hidden.
- Leak check unchanged: `npx tsx scripts/check-venue-history.ts` exit 0.

## Work steps (one concern per commit; failing test first)

1. Fixtures plus H1-H3, E1-E5 failing tests, then the parser change (D1-D3).
2. D5 plus H4, E6.
3. D4 router reason plus H5; `types.ts` comment.
4. H6 and H7 tests (no production change expected; if H6 fails the orchestrator needs one line).
5. D6 `--parse-only`.
6. Run the verification commands on the 11 real messages; update `todos/096`, `docs/END-TO-END-STATUS.md`, `HANDOFF.md` in
   the same commit as the result (the status file's own rule).

## Execution Path

- **Target:** Alex's MacBook, this repo, real Gmail (read-only) for the parse-only runs.
- **Mechanism:** `npx tsx scripts/ingest-one.ts <gmail-id> --parse-only` (no API spend). The one end-to-end dry run is the
  same command without the flag on a future-dated real lead, Yuli (`1a10e18804db9034`, event 2026-10-25), writing a row to
  `data/leads.db` and running the pipeline (about $0.10 to $0.35; the usage log records it).
- **Prerequisites:** ALREADY HAVE: Gmail token (refreshed 2026-10-14), the ingest script, Node. MUST OBTAIN (verified
  needed): an Anthropic key that is accepted again. Alex set the limit to $190 on 2026-10-16 and a call afterwards was still
  rejected ("regain access on 2026-11-01"). Before the end-to-end run Claude makes one tiny probe call; if it is refused, Alex fixes the limit in the Console and the run waits. It blocks only the end-to-end run, not steps 1-6.
- **Who:** Claude Code runs it; Alex says "go" for the model call. **Trigger:** after the code and its Codex code review.
- Lead #17 (Sophia) stays as the record of the old failure; it is not reset without Alex's yes (it is a data change).
- What this does NOT show: that a Yelp draft is good enough to send (item 087), or that a Yelp reply can be sent (item 094).

## Feed-Forward

- **Hardest decision:** whether to mark a parsed lead `enriched: true` (one word, no orchestrator change, but a changed
  meaning) or add a new field and change two call sites; chose the one word with a comment, and a new router hold so the
  meaning change cannot arm a send.
- **Rejected:** repairing the portal login (blocked by bot protection and email verification, and 0 of 11 leads needed it);
  rewinding the poller cursor; letting the model parse the form; reading the Yelp page for the newer version of an edited
  lead.
- **Least confident:** that the question and answer split holds for every form shape. I read two emails in full; the rest is a
  helper's report. The parse-only run on all 11 is the first thing to run, and an unrecognized shape falls back to a hold.

## Three Questions

1. **Hardest decision in this session?** Keeping `enriched` and changing its meaning, against a new field.
2. **What did you reject, and why?** Fixing the Yelp login (not needed), and reading edited details from the page (one case).
3. **Least confident about going into the next phase?** Form shapes I have not read myself; and that a held Yelp draft will
   be read by Alex as a quality signal when it is only a pipeline that now runs.
