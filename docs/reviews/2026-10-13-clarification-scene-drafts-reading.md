# Clarification mode: reading the 8 structural-scene drafts (input to plan 2), 2026-10-13

**Source:** `docs/reviews/2026-10-13-clarification-gate-measurement.md` (the 18-run set at `5349825`). 8 of 17 drafts
were judged `scene_type: structural`; 3 of those also failed `competitor_test`. I read the last generate call of each
(model prose on made-up leads). **Observational: 8 drafts, one model.** The verifier's reasons are quoted only where
they name the sentence.

## What the 8 drafts do

| Reading | Drafts |
|---|---|
| Explains why format matters instead of showing a moment ("the music is already doing something to the air", "the processional is a sacred beat, cocktail hour is exhale") | 8 of 8 |
| Length: 4 to 7 sentences over 3 to 6 paragraphs, before the question | 8 of 8 |
| The question is the prompt's own default, word for word or with one word changed ("intimate and in the background, or more of a featured moment people stop to watch") | 6 of 8 (2 ask a wedding-specific one: ceremony, cocktail hour or both) |
| "Most vendors guess" / "most clients don't realize" (a generic contrast; the competitor test fails) | 4 (all 3 competitor-test fails among them) |
| Words the voice rules ban or discourage: "Here's the thing" (2), "land(s)" (1), "sacred beat", "tailored suit" | 4 |
| A sign-off typed "AlexGuillen" (no space) by the model | 1 |

## Reading

1. **On these 8 the verifier is right.** No draft puts the reader in a moment; loosening the scene check for
   clarification mode would pass essays. Plan 2 should not relax `scene_type`.
2. **The generate prompt gives the model no picture of a good clarification reply.** The T4 reference lead is withheld
   in clarification mode (`quoteTermsOff`), the Type 4 strategy says only "one binary question that demonstrates
   expertise", and its default question appears twice. The model fills the gap with an explanatory essay and the
   stock question. The Sparse-lead scene strategy ("build the cinematic moment from what an evening LOOKS like") is
   in the prompt but sits far from the clarification block that says "the question must narrow the musical direction".
3. **The two prompts disagree on the opener** (plan 1 handles that); the scene failure is a separate, generate-side
   gap.

## Options for plan 2 (not decided; needs Alex)

| Option | What it is | Cost / risk |
|---|---|---|
| A. A clarification reference reply | One example in Alex's voice (a short grounded observation, one image, one binary question), shown only in clarification mode, with the T4-style "structure, not copy" framing and the 30-character copy check | Needs Alex's exact words (a rule: his voice is not mine to invent); a copy check like T4's; plan review |
| B. A length ceiling and a shape instruction in the clarification block | e.g. at most N sentences before the question, one concrete image, the question not copied from the default | No new words from Alex; the model may still write the image abstractly; testable only with real runs |
| C. Both | B first, A if B does not move the scene count | Two cycles |
| Not recommended | Relax `scene_type` for clarification | Passes the 8 essays above |

**My recommendation: B first, measured with the same runner, then A only if the scene count does not move.** B needs
no words from Alex, and the 8 drafts show the instructions' absence more than a missing example. Alex decides.
