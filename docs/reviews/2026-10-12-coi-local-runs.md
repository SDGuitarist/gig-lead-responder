# COI sentence: real-model runs (plan Execution Path, step 6), 2026-10-12

**Code:** `25691b5` (steps 1-5 built). **Plan:** `docs/plans/2026-10-12-feat-coi-sentence-by-request-plan.md`
(Revision 3c). Real model, scratch `DATABASE_PATH`, today pinned to 2026-10-12, one run per lead. Nothing was sent,
`data/leads.db` was untouched (mtime unchanged), the clipboard was not touched. The leads are made up. The runner and
raw JSON are in the session scratchpad (not committed).

The lead-5 venue is named here only as **"venue A"**: PF-Intel's policy for it says COI required (a boolean; no
`coi_details` and no venue claim is copied into this record). Three of the fifteen venues probed returned `coi_required: true`
from the lookup; one was used.

## Results

| Lead | What it is | `coi_required` | Sentence chosen | COI sentence in drafts | Other COI wording | COI flags |
|---|---|---|---|---|---|---|
| l1 | first inquiry, backyard birthday, 35 guests, no COI mention | false | default | once, in both | 0 | none |
| l2 | corporate dinner: "We will need a certificate of insurance naming the venue" | **true** | required | once, in both | 0 | none |
| l3 | later reply: "the venue needs proof of insurance before the date" | **true** | required | once, in both | 0 | none |
| l4 | "Do you carry liability insurance?" (the boundary case) | **false** | default | once, in both | 0 | none |
| l5 | T4 corporate dinner at venue A (PF-Intel policy: COI required), no COI mention | false | default | once, in both | 0 | none |
| l6, l6b | a vague "what do you suggest?" lead (should be clarification mode) | false | none (clarification) | 0 in both (l6b) | 0 | none |

- **The trigger behaved as Alex set it:** requirement or need stated by the client or about the venue is true (l2, l3);
  the capability question is false (l4); no mention is false (l1, l5).
- **No model-written COI timeline** in any quoted draft (sets 1-4 of the T4 runs had "a day", "within 24 hours",
  "within a few days"). Each draft carries the app's exact sentence once and no other COI or insurance word.
- **Venue-context risk (plan Revision 1, lead 5):** with venue A's "COI required" policy in the prompt, the draft
  used only the app's sentence and did not restate the venue's policy (0 other COI words, 0 flags, verified). One run;
  it does not say how often the model would restate it. The post-check would FAIL such a draft (Alex 2026-10-12).
- **The payment sentence** is unchanged in every quoted draft (post-check raised no payment flag).
- **Other fail reasons** are unrelated to COI: l1, l2, l3 each tripped the voice kill list on the single word
  "lands" (the model's own prose); l6b failed `lead_specific_opening`.

## Limits and one finding outside this plan

- **One run per lead.** It shows the path works and the sentence is held; it does not bound how often a model
  restates a venue policy or paraphrases the sentence. The Codex code review and the post-check carry that.
- **l6 never produced a draft, and neither does it on the code before this plan** (checked on `72490b7` in a temp
  worktree, 2 of 2 runs, and 3 of 3 here): `GenerationError: Clarification mode full_draft must not include pricing
  language` (`src/pipeline/generate.ts`, `PRICE_SIGNAL_PATTERN`: a `$` figure or the words rate, quote, anchor, floor,
  investment). l6b gave the same error once (compressed draft) and succeeded once. **That is an existing intermittent
  failure of clarification-mode generation, not caused by COI,** and is NOT fixed here. It means a vague lead can
  surface an error instead of a draft; it belongs in its own item. The clarification case for COI is covered by the
  deterministic tests (C3, C8, C10) and by l6b's one successful run (no COI line, no COI words).
- **Not exercised:** a run where the model restates a venue policy (so no real example of the fail path), the edit
  path with a real model, the platform lead path with a real model (covered by C8 and C10 with stubs).
