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

(filled in at work step 6)
