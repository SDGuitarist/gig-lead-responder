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
