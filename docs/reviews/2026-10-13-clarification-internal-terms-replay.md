# Clarification internal terms: the offline replay (plan step 4), 2026-10-13

**Plan:** `docs/plans/2026-10-13-fix-clarification-internal-terms-plan.md` (Revision 1b). **Code:** `7598b81` (the
narrowed alternatives), `scripts/clarification-validator-replay.ts`. **Method:** no model call, no network: the
script loads the stored result files, takes every distinct `full_draft` / `compressed_draft` of every logged generate
call, and counts matches of the OLD internal-term alternative (`\banchor\b|\bfloor\b|\binvestment\b`, copied into the
script as a labelled constant) and of the CURRENT exported pattern. **Observational: drafts the model wrote under the
validator and prompts of their day; session-local files, not reproducible by a reviewer.**

## Result

| | Count |
|---|---|
| input files / runs / distinct drafts | 19 / 154 / 816 |
| drafts the OLD internal-term alternative matches | **4** (`anchor` x3, `floor` x1) |
| drafts the CURRENT pattern rejects for an internal term | **0** |
| drafts the CURRENT pattern rejects for the number grammar | 3 (not this change; the price-grammar rejections already in the corpus) |
| drafts holding a pricing compound (`anchor price`, `price floor`, plural forms) | 0 |

The four old matches, each now passing:

- "...which part of the day they want live music to **anchor**." (the verb)
- "...whether you want the music to blend or to gently **anchor** the evening." (the verb)
- "...the wrong call either disappears when it should **anchor** the room..." (the verb)
- "...a solo guitar disappear under the noise of a dance **floor**." (a noun)

This is the plan's stated hypothesis, confirmed on the corpus: old 4, new 0, no pricing compound present.

## Input provenance (SHA-256 of each result file)

```
  9cb256df4829eb808d3cfd696973ec9e14b0e15456191690a41eb7cec55d6c4f  q1/clarification-q1a.json
  3db697a6e66cf8ba83c5a82c38d19402f1d0ea94decf8ceb489403398e2d07da  q1/clarification-q1b.json
  e2666b4b4bc112ced4b9bd5bcfa51ddd586783126bcb1bced80cd50c922d93d2  q1/clarification-q1c.json
  ade74898ecc373f40650efd7ef36583b3ec28154a6946abfeb4e89a1a444c903  q2/clarification-q2a.json
  7e3bf4dd1e7b2d3bd06516777fb44f3bb7d558d6f8f30721b072d7b503b6a393  q2/clarification-q2b.json
  f6fe3790f4f008d845c18ac332f88dadce5d65774b2e840b60bdfbb3d210a63f  q2/clarification-q2c.json
  2113e5b8f8db793f50eb87832dad390c980c20e4fb00b1d3fe1998cfc358411b  q3/clarification-ga.json
  d965820b30dae9db4e2d4615c665a08264802262b803880b5d419b80109532ac  q3/clarification-gb.json
  27e33667b61de9037fc9c8aaf32e8abc9653580881e411372f86ae0128bb8f83  q3/clarification-gc.json
  936ec955bc6cc6104eeb8315d7d7658d151b634d0de34ae2f0c724063ffe0caf  armA/clarification-A1.json
  c899617688e00ab23d3dc1688e6a7d27df02ec7018de241d316b03f052c3f638  armA/clarification-A2.json
  b1acd10abeeae8383a27667303765aa26914ec7f67682abc7f0dcc55f16357ac  armA/clarification-A3.json
  7a4eda49704ae00e1f87f533d187ae20c3941e134bd1184a6e85b69705647a63  armA/clarification-A4.json
  79cf50b85fa20616c114133dd1eba71496ac9d2e160c75c3fda5207a1fb7d2ba  armA/clarification-A5.json
  335585d8971fa1f8ca0420cc43e033dfb15d3ac3299f062bf2e0631fedc5a818  armB/clarification-B1.json
  8b70d890cfd7a06c55d5d4534d1237b15d11c770d01b72d78fff0433830f246a  armB/clarification-B2.json
  ed5e79f9547228be84cd21cc76930e6630c792bef035fc0bc51ba160bedb698e  armB/clarification-B3.json
  d76e16081f974b789fe1dd3c9d852bdf84aba538650b2358fb93075adbc6bfaf  armB/clarification-B4.json
  ec226cbc9b8da8bbf5ade1621c347f2594c129fdb64b4d6731da98fbc0dcb7b0  armB/clarification-B5.json
```

## Limits

- The corpus is the 154 runs of five measurement directories in the session scratchpad. The earlier 18-run re-run (an
  older file format) is not in it; its record shows no internal-term hit.
- The stored drafts were written under the old validator, and under two generate prompts (arm A before plan 2's
  change, arm B after). They show what the model wrote, not what it will write.
- 0 pricing compounds in 816 drafts means the two forms are a reasoned list, not an observed one.
