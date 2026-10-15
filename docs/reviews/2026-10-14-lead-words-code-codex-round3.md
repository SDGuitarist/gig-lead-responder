# Codex code review, round 3: lead_words build

Reviewed HEAD: e22daa6069aa0b69e5cb9ce2f5f1bb03f098d7f2. Round 3 authorized by Alex's selection of "Run round 3
(Recommended)" (chosen from the options, not typed). Classification: **(b) SAME finding still unfixed**.
**The cap has fired. There is no round 4.** Claude Code stops fixing and reviewing and escalates to Alex.

## The finding

`src/lead-words-measure.ts:17` joins every content block of the response (`(res.content ?? []).map(c => c.text).join("")`).
Production's `callClaude` reads only `response.content[0]` and throws if it is not a text block (`src/claude.ts:63-67`).
A multi-block response can be accepted by production and measured differently by the seam.

Codex also reported: the computed-key scanner limitation is documented, and no such raw read exists in `src/` or `scripts/`.

## My check table

| Claim | Checked | Verdict |
|---|---|---|
| Production reads `content[0].text` only | Read `src/claude.ts:63-67`: `const block = response.content[0]; if (block.type !== "text") throw; return block.text` | True |
| The seam concatenates all blocks | Read `src/lead-words-measure.ts:17` | True |
| Same class as round 2 P1-1 (the seam reads what production did not) | Round 2 fixed the cleaning step; the block-selection step is the next divergence on the same path | Valid, and Codex's (b) is fair: round 2's fix made the cleaner shared but left the extractor separate |

## Not done, by the cap

No fix was made in this round. The change would be small (read `content[0]` and require `type === "text"`, or export
production's extractor so the seam shares it, as was done for `stripCodeFences`), but the cap says a human decides.

## Honest weight

Whether it can matter: a real classifier call returns one text block (no tools, no thinking blocks requested), so the
divergence is unlikely on live output. It is the same shape as round 2's P1-1, though, and the seam's purpose is to
equal production exactly.
