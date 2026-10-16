---
status: pending
priority: p2
issue_id: "096"
tags: [yelp, parser, hold, module-1, phase-0]
dependencies: []
unblocks: []
sub_priority: 1
---

# 096: the Yelp parser reads an old email format, so every Yelp lead is held

## Problem Statement

`parseYelpEmail` (`src/automation/parsers/yelp.ts`) was written for a Yelp email that says "<name> sent you a message" and
carries a truncated message. It always returns `parseConfidence: "low"` ("ALWAYS low until portal enrichment") and, in
`orchestrator.ts` step 5, a low-confidence lead is held without running the pipeline.

The current Yelp email is a "requested a quote" notice (template `request_a_quote_first_message_v4`). Its plain text holds
question and answer pairs: "When do you require this service?", "Are there any other details you'd like to share?" (when the
client answered it), "In what location do you need the service?". `extractTruncatedMessage` only starts capturing after a line
matching /sent you|new message|wrote:/, which that email does not contain, so the lead text comes out as the placeholder
"(truncated — awaiting portal enrichment)" (lead #17, 2026-10-15: `raw_email` was 40 characters).

Measured 2026-10-16 (see todo 094): across 11 recent Yelp leads, 0 had client content on the Yelp Biz page that the email lacked.
I read one full email myself (Jade, 2026-08-22): it holds the event type, hours, budget, guest count and location in the
"other details" answer. So the portal login (094) is not needed for these leads; the parser is what throws the text away.

## Proposed approach (a plan to write; this touches lead intake, so the Codex loop applies)

1. Write the plan: parse the Q and A pairs from the plain text, build the lead text from them, and set confidence from what is
   present (a lead with only a date and a zip is still a vague lead, which the pipeline already handles; Sophia is the example).
2. Keep a fixture per case: free text present, free text absent (Sophia), a later "updated project details" version (Madalyne's
   page was newer than her first email: decide whether to re-read), and the old "sent you a message" format if it still occurs.
3. Keep the credential-URL stripping (`stripCredentialUrls`): the email's "Reply on Yelp Biz" links carry login tokens and must never
   reach the model.
4. Decide with Alex what a Yelp lead does at route time once it is no longer low confidence (the router still holds vague leads).

## Owner and trigger

Claude plans; Alex approves scope. Trigger: before the 20-lead ramp (Yelp is one of the main sources).
