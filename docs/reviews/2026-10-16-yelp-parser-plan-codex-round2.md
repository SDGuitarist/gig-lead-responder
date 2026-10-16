# Codex plan review round 2: Yelp parser plan Revision 1, 2026-10-16

**Verdict: NO-GO** (0 P0, 0 P1, 2 P2, both executable), pasted by Alex. **Reviewed:** the plan, Revision 1 at HEAD `abe05ab2630f...`.
**This is the second NO-GO: automatic iteration stops.** Round 3 needs the literal `Round 3 authorized by Alejandro: YES`; a third NO-GO is the hard cap.
Round-1 findings P2-2, P2-3 and P3-4 are confirmed resolved by Codex.

| # | Codex finding | My check | Status |
|---|---|---|---|
| P2-1 | D1 accepts malformed tails: with the display name missing, "San Diego" after "92104" is taken as the name and the lead is `high`; a fourth form question between known labels is absorbed with no policy and no test | CONFIRMED by reading D1: the name rule checks that a paragraph LOOKS like a name, not that it IS the display name. I did not execute it (the parser does not exist yet) | open, Alex to choose |
| P2-2 | "unchanged legacy fallback" does not give safe `rawText`: on an HTML-only quote request the legacy capture keeps display name, address and footer; SQLite stores `rawText` before the low-confidence exit (`orchestrator.ts:96`) | REPRODUCED 2026-10-16 with my own synthetic HTML-only quote request on the existing parser: confidence low, but `rawText` kept the raw HTML, the display name "Jordan T." and the footer "Don't miss out on future leads" (the business address was NOT kept in mine: it depends on where the trigger phrase "sent you" falls in the text; Codex's variant put it earlier). The login token was removed. Root cause as Codex says: the capture start rule (`yelp.ts:~160-163`) looks at line starts with HTML tags still in place, and any client sentence containing "sent you" starts capture | open, Alex to choose |

Round-1 fix attempts so far: plan fix attempts 2 (Revision 1 was 1; none made after this verdict); Codex plan reviews 2 (R1 NO-GO, R2 NO-GO).

Codex's own recommendation: resolve the D1/D3 boundary before implementation; do not spend a third review rediscovering what the existing code execution already shows.
