# Yelp parser: BEFORE and AFTER parse-only runs on the 11 real quote-request emails, 2026-10-16

Sample: `~/Data/gig-lead-responder/yelp-sample-manifest.json` (private; Gmail ids only). Command: `npx tsx scripts/ingest-one.ts <id> --parse-only`
(no database, model or portal). Counts and shapes only: no client text is recorded here (public repo).

## BEFORE the parser change (HEAD `545a348` plus the `--parse-only` script)

| Measure | Result (11 messages) |
|---|---|
| validator verdict | 11 of 11: valid, platform yelp, kind lead |
| `parseConfidence` | 11 of 11 `low`; `enriched` false in 11 |
| `rawText` | 11 of 11 are the 40-character placeholder "(truncated — awaiting portal enrichment)"; the client's details answer reached the pipeline in 0 of 6 that had one |
| `clientName` | empty in 11 of 11 |
| `portalUrl` | NOT empty in 11 of 11: the parser's direct-link fallback matched the email's "I'm not interested" / "I already replied" link, `https://biz.yelp.com/messaging/mark_as_replied_autosubmit/<token>?reply_type=...`, an ACTION link, not a thread link |

The last row is new (found while building the parse-only mode; the plan had assumed `portalUrl` was empty). `YelpPortalClient.fetchLeadDetails` navigates to `portalUrl`,
so with a working Yelp session the app would visit a link that marks the lead as replied or not needed. The plan's D5 is corrected: the direct-link fallback is restricted to
the real thread path, and a mark-as-replied link must never become `portalUrl` (test E8b).

## AFTER

Run on code `2cfce4b` (the parser change) after two fixes the first AFTER pass forced; each is a test now:
1. **First pass: 11 of 11 fell back to the placeholder.** Real Gmail plain text uses CRLF line ends and zero-width characters (U+034F with U+200C) in the preheader; my paragraph split used LF only and the test fixtures were LF, so the tests passed and the real mail did not. Fixed in `toParagraphs`; test E14.
2. **Second pass: 8 of 11 high, 3 fell back.** The three counters are not always `0,0,0`: real mail had `0,4,0` and `0,1,0`. The end marker is now three consecutive paragraphs of 1 to 3 digits; test E15. Plan D1 text updated.

Final pass, 11 of 11 messages:

| Measure | Result |
|---|---|
| `parseConfidence` / `enriched` | 11 of 11 `high` / `true` |
| `clientName` | the first name (or full name, for one) in 11 of 11 |
| `portalUrl` | the clean `leads_center` URL in 11 of 11, shape `<id>/<id>/leads/<id>`, no query, no token; no mark-as-replied URL |
| details answer | present in the email for 6 of 11; included in `rawText` for all 6; the date answer and the zip are in `rawText` for 11 of 11 |
| leaks | 0 of 11 contain the address, "Sent to", a link paragraph, a URL, a token, footer text, a counter line, or the display-name paragraph (display names equal to the first name appear only inside the rebuilt first sentence) |
| `rawText` length | 134 to 385 characters |

Checked by comparing each extracted text with its email's own form, field by field, with a script that prints booleans only; client text is not recorded here.
Not covered: a client's edited details (Madalyne's page was newer than the first email; the first email's version is what is read); form shapes outside these 11; HTML-only mail (falls back by design).
Full suite after the change: 1175 pass, 0 fail, 1 skip (baseline 1143); `tsc` clean; leak check exit 0. Mutation checks, each made one test fail and was reverted: router reason removed (1 test), display-name evidence removed (3), failed quote request on the legacy capture (25), mark-as-replied fallback restored (2).
Also: the repo's own redacted Yelp fixture `examples/emails/yelp-001.json` is a quote request; its test asserted "low" and now asserts the complete parse (commit `1294619`).
