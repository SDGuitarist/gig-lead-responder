# Alex's own reply to the made-up vague lead, against what the app owns and enforces, 2026-10-13

**Source:** Alex's chat message ("this is the appropriate response"), 2026-10-13, written for the made-up lead "Hi, we
want live music for my parents' 30th anniversary in the spring. Not sure what kind of music would work or how many
players. Any ideas?". **Not yet approved as a reference reply**: it is the owner's example of the right answer, and
the questions below are open. Observational: 3 verifier calls, one made-up lead, one model.

## What his reply is

A cinematic opening, one validating sentence, a named failure mode, a default format recommendation (solo Spanish
guitar, a second musician for a bigger crowd or dancing), ONE binary question, **a price ($700, two hours solo)**,
setup needs (own sound, one outlet, an armless chair), the payment sentence, and a contact footer (name, business,
phone). It is a quote with an assumed format and one question, not a no-price clarification.

## Against the app

| Point | His reply | The app today |
|---|---|---|
| Price | "$700" for two hours solo | clarification mode forbids any price (validator and prompt); my lookup for a solo 2h private test classification returned T2P quote $595, floor $550 (the tier this lead gets is not known) |
| Route | quote + one question | the classifier rule is "Vague + Low competition -> one_question; Vague + Medium/High/Extreme -> assume_and_quote" (`src/prompts/classify.ts:67-68`); the made-up lead classified `one_question`, competition low |
| Payment | "A 50% deposit holds the date." then "Send it over and I'll check it." | the first sentence is the app's no-date sentence exactly; the second is not an app sentence, and its meaning is unclear |
| COI | none | the default sentence is "COI available upon request." and Alex's 2026-10-12 rule says a first reply always states it |
| Sign-off | name, business, phone | the generate prompt's Sign-Off block says "Alex Guillen" only, no business name or phone (non-GigSalad); the verify prompt's section 8 and `sounds_like_alex` reject the footer; the same prompt also lists "contact block" under the compressed draft's Must retain |
| Voice mechanical | `voice-mechanical.py`: 0 hard fails, 0 warnings, 0 em dashes | -- |

## Through the real verify gate (3 runs, as `assume_and_quote`, solo, $700)

`fail, fail, fail`, scene **cinematic** x3, competitor test **false** x3, the only false check `sounds_like_alex` x3.
Its reasons: the business name and phone in the sign-off block (x3, "draft must end with only 'Alex Guillen'"), and
"most families go with ..." read as hedged consensus rather than his own call (x2). Every other check passed.

## Reading

1. Alex's own reply fails the app's gate on the footer. The app's prompts disagree with his practice on the contact
   block, and the verifier follows the prompt. That is a defect of the prompts or of the example, to be decided by him.
2. His reply is the shape of the app's `assume_and_quote` route plus one question, so the clarification-mode work of
   today (no price, 70-100 words) was solving a different case from the one he calls appropriate.
3. The scene, the competitor test and every other check passed: his words clear the gate except where the app's own
   rules contradict them.

## Open for Alex (none decided)

1. Should a vague, low-competition lead get his shape (a quote with an assumed format and one question) instead of a
   no-price question?
2. The contact footer: keep it (then the prompt and the verifier change), or drop it from the reference?
3. The price: $700 or the table's $595; which tier does this lead get?
4. COI: does the reference include "COI available upon request."?
5. What does "Send it over and I'll check it." mean?
