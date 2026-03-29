# Review Context — Gig Lead Responder

## Agent Team History

| Date | Team | What | Result |
|------|------|------|--------|
| 2026-03-29 | Gig Lead Response | Heather Thomas birthday party lead (GigSalad) | Response drafted, QA'd, pricing recommended ($1,100-$1,400). PFE booking framing validated. Shared output doc gap discovered and fixed. |

## Agent Team Learnings (for future lead response runs)
- GigSalad emails have minimal data — don't assume the email has everything (confirmed earlier brainstorm lesson)
- QA reviewer must check artist substitution framing (bait-and-switch risk when PFE books someone else)
- Always check for scheduling conflicts before drafting response
- PF-Intel has venue data for Temecula area (Wilson Creek, Danza del Sol)
- Pricing strategist should reference Pricing_Architecture.md but note it explicitly excludes PFE coordination quotes

## Risk Chain

**Current initiative:** Spiral Voice Integration — bringing Spiral's response quality (22 knowledge docs, 8 references, 17 tests, 18/18 capabilities at 90%+) into the pipeline's automation.

**Key risk:** The pipeline's generate stage loads RESPONSE_CRAFT.md as context but was never trained on real converted responses. Spiral was trained on 8 real/verified references and produces higher-quality, more consistent output. The integration must preserve Spiral's voice quality while keeping the pipeline's deterministic pricing and automation.

**Seven patterns to apply during integration:**
1. Style teaches voice, knowledge teaches judgment (references vs knowledge docs serve different purposes)
2. Soft rules get ignored, mandatory rules fire (prompt wording matters for overrides)
3. Every fix needs a control test (genre correction must not over-fire)
4. Style guide controls format, knowledge base controls content (output structure vs domain logic)
5. AI writing tools model rhetorical structure, not surface features (em dash saga)
6. Negative examples are as important as positive ones (anti-patterns section needed)
7. Reference corpus defines the ceiling, not the knowledge base (add references for 95% capabilities)

**Previous cycle resolution:** LLM pipeline injection hardening complete (PR #17). 0 P1, 2 P2 (documentation/deferred), 3 P3 (accepted). No code changes required.

## Files to Scrutinize

| File | What changed | Risk area |
|------|-------------|-----------|
| `HANDOFF.md` | Added Spiral Voice Integration initiative | Integration questions and pattern references |
| `docs/research/2026-03-22-spiral-methodology-report.md` | Full Spiral methodology report synced from every-outreach | Reference doc for integration work |

## Integration Reference

`docs/research/2026-03-22-spiral-methodology-report.md` — full methodology, 17 tests, 7 patterns

## Plan Reference

No plan yet. Next step: brainstorm session for Spiral voice integration.
