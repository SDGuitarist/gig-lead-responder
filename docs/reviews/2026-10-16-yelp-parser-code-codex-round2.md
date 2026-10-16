# Codex code review round 2: Yelp parser fixes for F1 and F2, 2026-10-16

**Verdict: NO-GO** (0 P0, 0 P1, 1 P2, executable), pasted by Alex. **Reviewed:** `20c776f` (fix `5e1dd5c`). **This is the second code NO-GO: automatic iteration stops.**
Round 3 needs the literal `Round 3 authorized by Alejandro: YES`; a third NO-GO is the hard cap (no round 4). Codex ran 58 focused tests and the full suite (1,190 pass / 0 fail / 1 skip), tsc exit 0.

| # | Codex finding | My check | Status |
|---|---|---|---|
| P2 | F2's broader detector (`isQuoteRequest`) treats ANY form label, or the phrase "you have a new ... request", anywhere in the text as proof of a quote request, so a genuine legacy message that merely QUOTES one is replaced by the placeholder and its text is lost. Also stored: a valid-source `kind=lead` message through `processLead` stores only the placeholder | REPRODUCED 2026-10-16 on both of Codex's examples (a client sentence quoting "When do you require this service?"; a client sentence quoting "you have a new musicians request"): at `9ec3237` the client's paragraph is kept, at `20c776f` the placeholder is returned. The storage consequence follows from `orchestrator.ts:96` storing `rawText`; I did not run `processLead` on it | **open: needs Alex's decision** (my regression, introduced by the F2 fix) |

Confirmed fixed by Codex: F1 (the forged-boundary reproduction now returns the placeholder); the original F2 variants (zero-width, line break, NBSP; the HTML inline-tag case); no additional premature-boundary or normalization leak found in the bounded surface. Codex notes this is bounded evidence, not proof for every email, and that the 11-real-email result is supplied, not reproduced.

Root cause (mine): the F2 fix made detection "any one marker anywhere in the text", to avoid a false negative; markers inside client prose are indistinguishable from markers in the template because detection looked at substrings, not at WHERE they sit. Class: treating quoted client content as authoritative template structure. Bounded surface: `isQuoteRequest`'s four alternatives (sentence, heading, label, `request_a_quote` metadata) and the quote/legacy selection.

Smallest structural fix I would propose if authorized: a marker counts only by position or as a whole paragraph: (a) the sentence must START the canonical message text; (b) the heading and each form label must be a STANDALONE paragraph (the whole paragraph equals it), not a substring; (c) the `request_a_quote` metadata stays (it is in the HTML template, not client prose). Client prose that quotes a label inside a sentence then stays on the legacy path. Tests would add Codex's two reproductions, the storage consequence, a standalone-label-paragraph case, and keep every F1 and F2 test.

Counters: Codex code reviews 2 (R1 NO-GO, R2 NO-GO); my fix attempts 1 so far; no edit made after this verdict.
