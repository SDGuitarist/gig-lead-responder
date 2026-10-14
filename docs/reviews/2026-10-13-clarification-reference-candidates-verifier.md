# Clarification reference reply: the three candidates through the real verify gate, 2026-10-13

**Purpose:** input to the reference-reply plan (the lever for the structural-scene failures). **Method:** the real
`classifyLead` on a made-up lead, then the real `verifyGate` (the clarification-mode verify prompt as built at
`f762e23` plus the plan 1 opening rule) on each candidate, 3 runs each, the candidate as both the full and the
compressed draft. Nothing sent. **Observational: 9 verifier calls, one model, one made-up lead; the candidate texts
are DRAFTS offered to Alex and are not approved wording.**

**The lead (made up):** "Hi, we want live music for my parents' 30th anniversary in the spring. Not sure what kind of
music would work or how many players. Any ideas?" The classifier returned `one_question` / `unresolved` / `vague`,
no flagged concerns, no name (the harness set "Maria" for the salutation).

## Result

| Candidate | Gate | Scene | False checks (competitor_test excluded) |
|---|---|---|---|
| A (the toast) | **fail, fail, fail** | cinematic x3 | `validated_them`, `compressed_validation_present` x3 |
| B (two formats, the balance) | **pass, pass, pass** | cinematic x3 | none |
| C (the plainest) | pass, **fail, fail** | cinematic, structural, structural | `can_see_it` on the two fails |

## Why, from the verifier's own reasons

- **A** has the one concrete moment (the toast) and passes the scene check, but "no sentence names what SHE is doing":
  its opening names the event and the open format, not the client. `validated_them` and the compressed-draft
  validation check fail, three runs out of three. The scene was never the problem.
- **B** passes all three: its opening and its "get this right" sentence read as validating her, and its
  "talks over the toasts ... disappears behind the conversation" pair was judged cinematic.
- **C** is borderline: in 2 of 3 runs "a set that crowds the conversation or goes unnoticed" was judged an outcome
  described in process terms, with no visible moment.

## Reading

1. **My prediction was wrong in both directions:** I expected A to be the strongest (it had the clearest moment) and
   B and C to fail the scene check. The gate wanted a client-validating sentence in A, and accepted B's two-sentence
   contrast as a moment.
2. **A reference reply needs two things, not one:** a concrete moment AND a sentence that names what the client is
   doing. This is what the model's own essays lacked in a different way (they had neither a moment nor, often, a
   validation).
3. **Variance is real:** C passed once in three runs on identical text. A candidate must be run several times.

## Limits

- 9 calls, one made-up lead, one model; the compressed draft was the same text as the full draft, which is not how
  the pipeline compresses; `competitor_test` was false everywhere.
- The classification had no flagged concern, so the step 3 / concern traceability path was not exercised.
- Passing the gate says nothing about whether it sounds like Alex; that is his judgment.

## Addendum: A with one validating sentence, three options (same lead, same gate, 3 runs each)

Candidate A failed only on `validated_them` and `compressed_validation_present`. One sentence naming what the host is
doing was inserted after "That's the right thing to settle first." and the result run through the same verifier.
**The sentences are options offered to Alex, not approved wording.**

| Option | Inserted sentence | Words / sentences | Gate | Scene | False checks |
|---|---|---|---|---|---|
| A1 | "You're the one making sure their 30th gets more than a playlist." | 89 / 6 | **pass x3** | cinematic x3 | none |
| A2 | "Asking before you book is how you keep a night like this from being a guess." | 93 / 6 | **pass x3** | cinematic x3 | none |
| A3 | "Putting live music into their 30th is a smart call." | 87 / 6 | **pass x3** | cinematic x3 | none |

All three: 1 question mark, no match in the price grammar, 0 shared 30-character windows with the T4 example, 0 hard
fails and 0 warnings from `voice-mechanical.py`. 9 more calls; the same limits apply (one made-up lead, one model,
compressed = full text, no flagged concern, voice is Alex's judgment).

Reading: the failure of A was exactly the missing client-validating sentence; any of the three fixes it. A3's
sentence shape echoes one in the approved T4 example ("is a smart call"), which shares no 30-character window but is
the same move; A1's is close to the example in the voice specification ("You're the one making sure ...").
