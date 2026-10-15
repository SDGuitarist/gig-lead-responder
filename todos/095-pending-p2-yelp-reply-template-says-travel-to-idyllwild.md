---
status: pending
priority: p2
issue_id: "095"
tags: [yelp, reply-template, client-facing, money]
dependencies: []
unblocks: []
sub_priority: 1
---

# 095: Yelp reply to a San Diego lead says "All rates include travel to Idyllwild"

## Problem Statement

On Yelp Biz, the reply already sent to Sophia (lead created 2026-10-14 12:17, replied 2026-10-14 3:03 PM, status
Delivered) listed four options (Solo $650/2hrs, Duo $850, Trio $1,200, Mariachi $1,600, with links) and ended
"All rates include travel to Idyllwild." Sophia's lead location is San Diego, CA 92104.

If that text is a saved Yelp reply or an auto-response, it may go to every Yelp lead with the wrong town, and it quotes
prices that differ from the app's (the app quoted solo $700 for the same lead). Not verified: whether the text is a saved
reply, an auto-response, or typed by hand. This repo does not send it (the poller is dry-run only).

## Proposed approach

1. Alex checks in Yelp Biz (Settings, saved replies / auto-response) whether this is a saved reply, and fixes the town.
2. Decide whether the Yelp template prices should match the app's rate card or stay a separate "starting at" list; if
   they stay separate, say so in the status file so the app's drafts and the template are not read as contradicting.
3. Claude can read the app's own Yelp lead text for any "Idyllwild" or other fixed town (grep `src/` and the prompts) to
   make sure the app never writes it.

## Owner and trigger

Alex (Yelp Biz settings; price intent). Trigger: now, because every Yelp lead may be affected.
