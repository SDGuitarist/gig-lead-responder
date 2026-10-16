---
title: "fix: the Yelp parser reads an email format Yelp no longer sends, so every Yelp lead is held with no text"
date: 2026-10-16
status: plan, Revision 2 (plan review R1 NO-GO 0 P1 / 3 P2 / 1 P3 answered by Revision 1; R2 NO-GO 0 P1 / 2 P2 answered by Revision 2; Alex chose "fix both, build with tests, no round 3" on 2026-10-16; the tests are the executable check and Codex reviews the CODE)
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
- `src/yelp-parser.test.ts` has no TEST fixture that is a lead email: its one email is a client REPLY ("Kimberly has replied to your
  message", 2026-07-14), the format the parser was written against, and the legacy capture rule keeps that client's message
  (the test at line 79 requires it). A real lead did reach the parser once, through `processLead` (lead #17, Sophia), and came out as the
  placeholder.
- `extractYelpPortalUrl` (`yelp.ts:~85-107`) accepts a `return_url` path only if it is `/messaging/<id>/thread/<id>`, and separately a direct
  `href="https://biz.yelp.com/messaging/..."` link (`yelp.ts:102`, not a credential URL). The quote-request email's `return_url` is
  `/leads_center/<id>/leads/<id>` and it has no direct messaging link, so `portalUrl` is empty and `router.ts:56` adds "Missing portal URL".
- `router.ts:47` holds every Yelp lead that is not `enriched`; `orchestrator.ts:106` calls the portal only when
  `!lead.enriched`. So a lead marked complete skips the portal read with no orchestrator change.
- `source-validator.ts` decides lead versus reply by `/has replied to your message/i` in the body, or a `RE:` subject. A
  quote request has neither, so it is "lead" (lead #17 reached the parser).
- Credential containment is already in `yelp.ts`: `CREDENTIAL_URL`, `ANY_URL`, `stripCredentialUrls`, `normalizeLine`.
  Yelp's "Reply on Yelp Biz" links carry a passwordless login token (a bearer credential). It must never reach the
  database, the dashboard or the model (memory: `project_yelp-allowlist-capture-bug.md`).
- Nothing sends in Phase 0: the poller forces dry run (`poller.ts:203`); `autoSendEnabled` is configurable and false by default
  (`config.ts:46`), not hardcoded. `submitReply`'s selectors are marked "[VERIFY LIVE]" and the login is blocked; no Yelp send has ever worked.
  `dispatchReply` (`orchestrator.ts:~305`) still calls the Yelp sender directly when reached; the router is what keeps a lead from reaching it.
- The hold branch (`orchestrator.ts:~241`) stores `status: "sent"` and writes the reasons only to the log; the dashboard labels `sent` "Sent"
  (`dashboard.html:245`). So a held lead already reads "Sent" and shows no reason (todo 097).
- `rawText` reaches SQLite (`insertLead`, step 3b) and the model (step 6) BEFORE routing, so a router hold cannot contain a text leak:
  exclusion of tokens and footer content must be done in the parser.

## Decision

D1. **A deterministic form contract (answers P2-1).** Input is `msg.bodyText` ONLY. If it is empty (HTML-only mail) the parser takes the legacy
path (D3). Work on paragraphs (blocks separated by a blank line), each passed through `normalizeLine` per line. The SUPPORTED structure, read
from the two real emails:

```
<Name> requested a quote from Alex Guillen Music for a <service>. <more sentences>     (first non-empty paragraph)
## You have a new <service> request.                                                   (START marker, required)
[Reply to <Name> on Yelp Biz](https://...)                                              (link paragraph, ignored)
Sent to Alex Guillen Music / <business address>                                         (ignored: before the first label)
<LABEL 1>                                                                               (paragraph equal to a known label)
<answer: one or more paragraphs>
<LABEL ...> / <answer>
<display name paragraph>                                                                (dropped)
0 / 0 / 0                                                                               (three consecutive paragraphs, each exactly "0": END marker, required)
[Reply to ...](...) ...                                                                 (CTA, ignored)
```

Known labels (matched EXACTLY after trimming and case-folding, nothing fuzzy): date `When do you require this service?`; details
`Are there any other details you'd like to share?`; location `In what location do you need the service?`.

The form is SUPPORTED, and the lead is `complete`, only when ALL hold; any failure leaves the lead on the legacy path (D3), never high:
1. exactly one START marker and exactly one END marker (the first run of three `0` paragraphs after it), START before END;
2. the date label occurs exactly once and the location label exactly once; the details label at most once; no label occurs twice; order is
   date, then details (if present), then location;
3. every present label has a non-empty answer;
4. the paragraph immediately before the END marker is the display-name paragraph, and it is accepted as that ONLY if it is one line of at most 40
   characters (letters, spaces, `.`, `'`, `-`) AND, compared case-insensitively, it equals or begins with the name taken from the first sentence ("Jade S."
   begins with "Jade"; "Sophia" equals "Sophia"). A paragraph that merely looks like a name ("San Diego") fails this, so a missing display name makes the lead fall
   back (answers R2 P2-1); it is dropped when accepted. The location answer is the paragraphs between the location label and that name paragraph and MUST be exactly one
   paragraph of at most 80 characters (a zip or a short place);
5. the first paragraph matches `^(.{1,40}?) requested a quote from .+? for an? (.{1,40}?)\.` with the name made of letters, spaces, `.`, `'`, `-`.

What `high` guarantees, stated narrowly: the date and location answers exist, and nothing outside the span from the first known label to the display-name
paragraph (the address, link paragraphs, display name, counters, CTA, footer) enters `rawText`. It does NOT guarantee that every paragraph inside an answer was
typed by the client: a fourth form question Yelp might add between known labels is kept, in order, as part of the preceding answer (it is Yelp form text inside the
span, not a leak); a fourth question after the location label makes the location answer more than one paragraph and the lead falls back. Pinned by E10.

Everything between two known labels is the earlier label's answer, so a client paragraph such as "Is Saturday okay?", or two paragraphs, stays
inside the details answer; a line that merely ends in `?` is NEVER a label. A client who types a known label exactly makes that label occur twice, so
the lead falls back (ambiguity is not guessed). Every answer line goes through `normalizeLine` and `ANY_URL` removal and the whole text through
`stripCredentialUrls`.

D2. **The text the pipeline sees** = `"<Name> requested a quote for a <service>."` (rebuilt from the validated name and service, not copied from the
email) followed by each `label` / `answer` pair, blank-line separated. NOT included, by construction (only label-delimited answers and the rebuilt
sentence are used): the business address, the display-name paragraph, the counters, link paragraphs, footer, any URL.

D3. **Complete, safe fallback, and legacy (answers R1 P2-2 and R2 P2-2).** When D1 holds the lead is `parseConfidence: "high"`, `enriched: true`. When it
does not, three cases, decided in this order:
 (a) **The message is a quote request** (its text, or its HTML with tags stripped, contains `requested a quote from`, or the HTML carries
     `request_a_quote`): NO email text is kept. `rawText` is the fixed placeholder "(Yelp quote request: form not recognized, held for Alex)", `low`, `enriched: false`,
     `clientName` only if the first-sentence name validates. This covers HTML-only mail and any quote request that fails D1, so a client sentence such as "I sent you
     the timing yesterday" cannot start the old capture and drag in the display name, address or footer. SQLite stores `rawText` before the low-confidence exit
     (`orchestrator.ts:96`), so the placeholder is what is stored.
 (b) **Not a quote request, `bodyText` present:** the EXISTING legacy path, byte-identical (`extractClientName`, `extractTruncatedMessage`, `low`, `enriched: false`, the
     old warning, the placeholder only if it captures nothing). This is what keeps the genuine old reply fixture's client message (`yelp-parser.test.ts:79`).
 (c) **Not a quote request, `bodyText` empty:** the legacy path runs on `bodyHtml` with tags stripped and entities decoded first, so tags cannot defeat its stop rule.
`enriched` keeps its name; its meaning becomes "the lead text is complete" (comment in `types.ts`).

D4. **Router: an explicit Yelp hold, and its limit (answers P2-3).** Add one mandatory hold reason for every Yelp lead that reaches `routeLead`:
"Yelp portal reply not verified live (todo 094): Alex sends from Yelp". It keeps a Yelp lead out of auto-send while `submitReply` is unproven; low-confidence
leads already exit earlier. This plan is LIMITED to pipeline access and routing. It does NOT change what the dashboard shows: a held lead is
stored as `sent`, labelled "Sent", with no reason on the row. That is an existing limitation, filed as todo 097; nothing here claims a visible hold.

D5. **Portal URL.** `extractYelpPortalUrl` additionally accepts `^/leads_center/[\w-]+/leads/[\w-]+/?$` from `return_url` (token discarded). Any other path
is still refused. The direct-link fallback is untouched.

D6. **A parse-only mode for the ingest script, built FIRST.** `scripts/ingest-one.ts <id> --parse-only` fetches the message, runs the source validator and
`parseLeadEmail`, and prints confidence, enriched, clientName, the full `rawText`, the warnings, and `portalUrl` as shape only. No database write, no
model call, no portal call, and the printed text stays on Alex's screen (it holds client words). It runs on the sample in the private manifest (below).

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

1. **What exactly is changing?** `src/automation/parsers/yelp.ts` (the D1 contract, completeness, `leads_center` path), one router hold reason, a comment in
   `src/automation/types.ts`, `scripts/ingest-one.ts` (`--parse-only`), tests with fixtures that copy the REAL line structure with invented names and text.
2. **What must not change?** See the section above. Plus: for a non-quote-request message with `bodyText`, the legacy path's output is byte-identical to today's (case (b)).
3. **How will we know it worked?** The EARS tests below; the 11-message baseline BEFORE the change and the same run AFTER it, with complete extracted
   answers inspected; then, with Alex's go, one dry-run ingest of a future-dated real lead.
4. **Most likely way this plan is wrong?** (a) A form shape I have not read: I have read two emails in full; the sample run reads all 11 first and a
   shape that fails D1 stays on the legacy path and is listed. (b) The three-`0` end marker or the display-name paragraph moves in a later Yelp template: the
   lead then falls back to legacy (low) rather than guessing. (c) A complete lead is not a quality draft (todo 087). (d) The Yelp text may carry a phone
   number or email the client typed, like any platform's lead text. (e) The hold is invisible on the dashboard (todo 097).
5. **How will a human RUN this, and when?** See Execution Path.

## Sample for the real-email runs (answers P3-4)

Private manifest: `~/Data/gig-lead-responder/yelp-sample-manifest.json` (outside the repo, public-repo rule): the 11 Gmail message ids, dates, and whether
a details answer was given, no client text. Exact retrieval if it is lost: Gmail search `from:messaging.yelp.com "requested a quote" newer_than:90d`; the first
message of a thread has the thread's id. The run reads each id with `--parse-only`, and for each one Claude compares the extracted answers with the email's
visible form, field by field (not only confidence or one keyword), and records counts and shapes, never client text, in the review doc.

## Acceptance Tests (EARS)

Fixtures are invented text in the exact line structure of the two real emails (blank lines, the `##` heading, link paragraphs with a placeholder token of
the real shape, the display-name paragraph, three `0` paragraphs, the CTA and footer). No real client text, name or contact detail is committed (public repo).

Happy path
- H1. WHEN the email has the date and location answers only THE SYSTEM SHALL return `high`, `enriched: true`, and a `rawText` holding the rebuilt first
  sentence, the date label and answer, the location label and answer, and none of: the business address, the display-name paragraph, a counter, a URL.
- H2. WHEN the email also has a details answer THE SYSTEM SHALL include it between the date and the location, paragraphs preserved, subject to the
  existing URL removal, markdown stripping and credential redaction.
- H3. WHEN the first paragraph reads "<Name> requested a quote from ... for a <service>." THE SYSTEM SHALL set `clientName` to the name.
- H4. WHEN `return_url` carries `/leads_center/<a>/leads/<b>` THE SYSTEM SHALL set `portalUrl` to `https://biz.yelp.com/leads_center/<a>/leads/<b>` with
  neither "passwordless" nor the token.
- H5. WHEN `routeLead` receives a complete Yelp lead with an otherwise auto-sendable pipeline output (verified, small price, no flagged concerns, high
  confidence, a portal URL) THE SYSTEM SHALL hold it with the reason "Yelp portal reply not verified live".
- H6. WHEN the orchestrator receives a complete Yelp lead, with `autoSendEnabled` true and a spy for the Yelp client, THE SYSTEM SHALL run the pipeline,
  not call `fetchLeadDetails`, and not call `submitReply`.
- H7. WHEN the message is a quote-request email THE SYSTEM SHALL validate it `kind: "lead"`; WHEN it has a `RE:` subject or "has replied to your message" it
  stays `kind: "reply"`.

Error cases (each falls back to the legacy path: `low`, `enriched: false`, never `high`)
- E1. WHEN the email is the old reply-shaped fixture (not a quote request, `bodyText` present) THE SYSTEM SHALL return exactly today's output (the client's message
  captured, low, enriched false); every existing test passes unchanged. WHEN the legacy path captures nothing THE SYSTEM SHALL use the old placeholder.
- E2. WHEN a required label (date or location) is missing, duplicated, out of order, or has an empty answer.
- E3. WHEN the START marker, the END marker (three `0` paragraphs), or the display-name paragraph is missing, or the display-name paragraph is longer than 40
  characters or has other characters.
- E4. WHEN the location answer is two paragraphs, empty, or longer than 80 characters.
- E5. WHEN the mail is HTML-only (empty `bodyText`), even if the HTML holds the same words.
- E6. WHEN any known label occurs twice or out of order (including a client paragraph equal to a label) THE SYSTEM SHALL fall back, and WHEN a details answer contains
  "Is Saturday okay?" as its own paragraph or a question mark mid-sentence, or two paragraphs, THE SYSTEM SHALL keep the whole answer and stay `high`.
- E7. WHEN an answer contains a URL, a markdown link or a passwordless login URL THE SYSTEM SHALL remove it from `rawText`.
- E8. WHEN `return_url` is any other path THE SYSTEM SHALL leave `portalUrl` empty.
- E10. WHEN the display name is missing and the location is followed by a second short paragraph ("92104", "San Diego", then the counters) THE SYSTEM SHALL fall back;
  WHEN a fourth form question sits between the details and location labels THE SYSTEM SHALL stay `high` with its paragraphs in order and no address, name or footer;
  WHEN a fourth question sits after the location label THE SYSTEM SHALL fall back.
- E11. WHEN the message is a quote request that fails D1, or is HTML-only, THE SYSTEM SHALL return the fixed placeholder as `rawText` and none of: the display name, the
  business address, footer text, HTML tags; this holds when the client's own text contains "sent you", "new message" or "wrote:" (a synthetic HTML-only fixture with
  "I sent you the timing yesterday", reproduced as a failure on the existing parser 2026-10-16).
- E12. WHEN `processLead` receives a quote request that fails D1 THE SYSTEM SHALL store the placeholder, not email text, in the lead row's `raw_email`.
- E13. WHEN the mail is not a quote request, has an empty `bodyText`, and its `bodyHtml` holds the old reply shape THE SYSTEM SHALL strip tags before the legacy capture.
- E9. (negative assertions on every supported fixture) `rawText` never contains the token, `passwordless`, "Anita St", the business name line, the footer
  text, a bare `0` line, or the display-name.

Mutation checks (each test fails if the named change is made; recorded by running them): H1 (drop the name-paragraph rule: the name appears); H2 (ignore
the details label: the answer vanishes); H4 (return the login URL: the token appears); E1 (always parse as complete: the legacy fixture turns high); E6
(split on any line ending in `?`: the client question starts a pair); E10 (accept any short paragraph as the display name: "San Diego" is accepted); E11 (use the
legacy path for a failed quote request: the footer comes back); H5 (delete the router reason); H6 (remove the `enriched` skip: the portal is called).

## Verification Commands

- `node scripts/run-tests.mjs --match yelp` passes; `npm test` shows 0 fail (baseline 1143 pass, 0 fail, 1 skip at `882dfea`); `npx tsc --noEmit` exits 0.
- BEFORE the parser change (step 2): `npx tsx scripts/ingest-one.ts <id> --parse-only` for each id in the manifest; record the current confidence and text
  shape per id (expected: every one low, the text empty or a placeholder for the quote-request format).
- AFTER (step 6): the same on all 11. Expected: every id either `high` with the complete answers matching the email's form field by field, or `low` carrying only the placeholder, with a
  stated reason; Sophia has no details answer; Jade's details contain "birthday party". An unexpected `low` is investigated, not tuned away.
- Leak check unchanged: `npx tsx scripts/check-venue-history.ts` exit 0.

## Work steps (one concern per commit; failing test first)

1. D6 `--parse-only` in `scripts/ingest-one.ts` (shows today's behavior).
2. Run it on the 11 messages and record the BEFORE results in `docs/reviews/2026-10-16-yelp-parser-sample-run.md` (counts and shapes, no client text).
3. Fixtures plus H1-H3, E1-E9 failing tests, then the parser change (D1-D3).
4. D5 plus H4, E8.
5. D4 router reason plus H5, H6, H7; `types.ts` comment.
6. Rerun the 11 and record AFTER next to BEFORE; update `todos/096`, `docs/END-TO-END-STATUS.md`, `HANDOFF.md` in the same commit as the result.

## Execution Path

- **Target:** Alex's MacBook, this repo, real Gmail (read-only) for the parse-only runs.
- **Mechanism:** `npx tsx scripts/ingest-one.ts <gmail-id> --parse-only` (no API spend), on the ids in the private manifest. The one end-to-end dry run is the
  same command without the flag on a future-dated real lead, Yuli (`1a10e18804db9034`, event 2026-10-25), writing a row to
  `data/leads.db` and running the pipeline (about $0.10 to $0.35; the usage log records it).
- **Prerequisites:** ALREADY HAVE: Gmail token (refreshed 2026-10-14), the ingest script, Node. MUST OBTAIN (verified
  needed): an Anthropic key that is accepted again. Alex set the limit to $190 on 2026-10-16 and a call afterwards was still
  rejected ("regain access on 2026-11-01"). Before the end-to-end run Claude makes one tiny probe call; if it is refused, Alex fixes the limit in the Console and the run waits. It blocks only the end-to-end run, not steps 1-6.
- **Who:** Claude Code runs it; Alex says "go" for the model call. **Trigger:** after the code and its Codex code review.
- The held draft will read "Sent" on the dashboard until item 097 is done: say so when showing Alex the result.
- Lead #17 (Sophia) stays as the record of the old failure; it is not reset without Alex's yes (it is a data change).
- What this does NOT show: that a Yelp draft is good enough to send (item 087), or that a Yelp reply can be sent (item 094).

## Feed-Forward

- **Hardest decision:** how strict the form contract is. Strict (exact labels, three-`0` end marker, one-paragraph location, every rule a fallback) loses a
  lead to the legacy hold when Yelp changes its template; loose guesses and can put a client's words in the wrong field. Chose strict: a fallback is today's
  behavior, a wrong field is a new one.
- **Rejected:** treating any line ending in `?` as a question (Codex R1 P2-1); the placeholder for the old reply fixture (R1 P2-2, my wrong assumption); a third plan review (Alex chose to build with tests: the findings are about runtime behavior, which the tests execute); a name-shaped tail check (R2 P2-1: it accepts "San Diego"); claiming the
  dashboard shows a hold (P2-3); repairing the portal login; rewinding the poller cursor; letting the model parse the form.
- **Least confident:** the form shapes I have not read: two emails in full, nine from a helper. The BEFORE/AFTER run on all 11 is steps 2 and 6, and a shape the
  contract rejects stays on the legacy path and is listed.

## Three Questions

1. **Hardest decision in this session?** How strict to make the form contract, with a fallback to today's behavior as the price of strictness.
2. **What did you reject, and why?** A `?`-based question rule, a placeholder for the old fixture, and any claim about the dashboard: each was my assumption and
   a reviewer read the code.
3. **Least confident about going into the next phase?** Template shapes not yet read, and that a held "Sent" card on the dashboard will be misread (todo 097).
