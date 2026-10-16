# Codex code review round 3: Yelp parser quote/legacy detection, 2026-10-16

**Verdict: (c) NARROWING same-class residue landing on ONE surface.** 1 P2, executable, 1 file (`src/automation/parsers/yelp.ts`, `isQuoteRequest`), pasted by Alex. Authorization used: `Round 3 authorized by Alejandro: YES` (typed by Alex 2026-10-16, with a stray leading quote mark).
**THE CAP HAS FIRED. There is no round 4.** Claude Code stops automatic fixing and reviewing; Alex chooses a different approach, a revert, or acceptance of the named residue.
Codex ran 63 focused tests and the full suite (1,195 pass / 0 fail / 1 skip outside the sandbox).

| Codex finding | My check |
|---|---|
| `htmlToText` replaces every tag with a newline, so nested inline tags (`<b><span>...</span></b>`) create false paragraph boundaries BEFORE the positional detector runs. Undershoot: an HTML-only quote notice whose sentence, heading and labels are split by inline markup defeats every marker, so the old capture stores the display name and footer (the same input returned the safe placeholder at `20c776f`). Overshoot: `You asked <strong><span>When do you require this service?</span></strong> The wedding ...` becomes a standalone label during detection and a genuine legacy message is replaced by the placeholder | BOTH REPRODUCED 2026-10-16 on the current parser with synthetic HTML-only messages: undershoot returned legacy text with the display name and the footer (not the placeholder); overshoot returned the placeholder and lost the wedding text. Both need `bodyText` empty or an HTML tag structure that the plain-text pass does not have. All 11 real emails carry a plain-text part, and all 11 parse as complete |

Class (Codex): quote/legacy classification inferred from text paragraphs. Surface: `isQuoteRequest` plus `htmlToText`. My reading: three rounds each found a different way the TEXT of a message can be made to look like, or not look like, the template. The common root is that detection infers "is this a quote request" from content that a client or markup can shape.

Counters: Codex code reviews 3 (R1 NO-GO, R2 NO-GO, R3 (c)); my fix attempts 2; the cap has fired.
Options for Alex are recorded in `HANDOFF.md` Update 23 addendum once he chooses. No code was changed after this verdict.

## Alex's decision after the cap (2026-10-16): "Different approach: decide by subject (Recommended)"

Fix `09eb1c4` (a NEW change; the review loop for the old detector is closed): `isQuoteRequest` is now only `!/^\s*re:\s/i.test(subject)`. A subject starting with "RE:" (a reply notice) keeps the legacy capture; every other Yelp lead goes through the form parser or becomes the placeholder. The text detector, `canonicalText` and the HTML-to-paragraph detection are deleted, so neither a client's words nor inline markup can switch the path: the whole class Codex named (inferring quote-or-legacy from text paragraphs) is gone, not patched.
Why this is safe in production: the source validator already drops replies (`RE:` subject or the body marker "has replied to your message") before the parser runs, so every message that reaches the parser is a quote request; the subject test only matters for direct callers and tests.

Tests (all fail on the old detector or on a wrong subject rule): Codex's undershoot case (HTML-only, nested inline tags, no plain text: placeholder), Codex's overshoot case (a legacy RE: message with a label quoted inside inline tags keeps its text), "a client's words cannot change the path" (quote text under RE: stays legacy; legacy-looking prose under a lead subject is the placeholder); the round 2 legacy fixtures now carry a RE: subject, which is what a real legacy message is. The round 2 storage-consequence test changed meaning and is rewritten: a lead-kind message is now ALWAYS the quote path, so `processLead` stores the placeholder or the form text, never a legacy-style capture. Mutation checks: restore the previous detector: 4 tests fail; ignore the subject (always quote): 8 fail; invert it (always legacy): 45 fail.
Results: Yelp tests 66 pass / 0 fail; full suite 1198 pass / 0 fail / 1 skip; `tsc` exit 0; leak check exit 0; the 11 real emails 11 of 11 high.
Accepted limit, named: a legacy-FORMAT lead (the old "sent you a message" notice) that is not a reply would now show the placeholder and be held. No lead in the 11 real emails (Aug to Oct 2026) or in the repo fixtures is in that format; it fails safe.
Not reviewed by Codex: this change has had no independent review (the loop capped at R3 on the old approach). A fresh code round 1 would be allowed as a new change if Alex wants it. Counters: Codex code reviews 3 on the old detector; my fix attempts 3 (the third is this redesign).
