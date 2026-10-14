# Vague-lead quote route: arm on the final prompt, 2026-10-14

**Code:** `2aa57e1` (the prompt after Codex R1/R2 fixes; `dirtyPromptFiles` empty). **Method:** as
`2026-10-13-vague-quote-measurement.md`: `--arm B --probe C8 --runs 1`, 5 processes x 10 made-up vague leads (v1-v6,
h1-h4), real model (`claude-sonnet-4-6` per the manifest), today pinned 2026-10-12, nothing sent. **Exploratory,
observational: 50 runs, one model, made-up leads. Descriptive; no comparison statistic** (arm A's raw files are
gone; and this is a second sample of a changed prompt, not a controlled contrast).

No usage-limit errors (0 of 5 logs); 50 of 50 returned a draft.

## Result

| Metric | Final prompt | Earlier arm B (prompt before the setup-sentence changes) |
|---|---|---|
| Classified | solo 45, duo 5 | solo 45, duo 5 |
| Quote at the app's price | 50 / 50 | 50 / 50 |
| No footer | 50 / 50 | 50 / 50 |
| Exactly one `?` | 33 / 50 | 34 / 50 |
| Payment sentence once | 49 / 50 | 49 / 50 |
| COI sentence once | 48 / 50 | 47 / 50 |
| Verified | **10 / 50** | 20 / 50 |
| Unusable (no draft, scene not cinematic, competitor true) | 13 / 50 = 26% (Wilson 16%-40%) | 12 / 50 = 24% |
| Empty traceability entries | 3 drafts | 1 |
| Words / sentences, median | 203 / 11 | 199 / 11 |
| Shared windows above 0 (setup sentence now cut) | **30 / 50**, max 80 | 44 / 50, max 111 (setup counted) |

Per lead (unusable / 5): h1 0, h2 1, h3 0, h4 2, v1 3, v2 1, v3 1, v4 1, v5 3, v6 1.

## Readings (descriptive)

- **Copying fell but did not go away:** 30 of 50 drafts still share a window outside the mandated sentences. My scan
  of whole example sentences found only one reused non-mandated sentence ("Bigger crowd or dancing, I add a second
  musician.", 1 draft) besides the date sentence (16 drafts, allowed when the lead gave no date, per step 6). The rest
  are clause-level overlaps.
- **The setup sentence appeared verbatim in 5 of 50 drafts** (v4, v5, v6 twice, h1). None of those leads gave a venue
  or setup fact that contradicts it, so **the "compatible with this lead" condition was not exercised**: the lead set
  has no contradicting lead. That judgment remains unmeasured.
- **Verified halved (20 to 10 of 50)** while the unusable rate barely moved (24% to 26%). Both arms are single
  samples of 50; the earlier set of identical-prompt samples differed by as much as 28 points (plan 2). I cannot say
  whether the drop is the prompt or variation. The false checks were not read here.
- **Length did not move:** median 203 words against about 100 in Alex's reply. The prompt does not hold the draft to
  the example's length; this is an open item, not a result of the review fixes.
- **Exactly one question 33 of 50** (unchanged); not touched by this plan.

## Limits

- 50 runs, one model, made-up leads, one sample per prompt version, no contradicting-lead case.
- The sentence-level scan is mine (not a pre-registered metric); drafts were not read in full.
