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
