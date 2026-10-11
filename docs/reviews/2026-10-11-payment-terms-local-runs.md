# Payment terms by lead time: real-model runs (plan Execution Path, step 4), 2026-10-11

**Reader and trigger:** the Codex CODE review round-1 prompt for this work; HANDOFF. **Code under test:** `0fb78c2`
(steps 0-3b, 5 built). **Command:** a scratch script calls `runPipeline(text, undefined, platform, undefined,
"2026-10-12")` (real model; scratch `DATABASE_PATH`; nothing sent; `data/leads.db` mtime identical before and after).
Lead texts and expected sentences: the plan's Execution Path. **Counting rule** (`action` "quote" or
"assume_and_quote" AND the expected kind) proven first: self-test PASS (exit 0); the same rule without the action
check self-test FAIL (exit 1).

| Lead | Platform passed | Model column | Event | Kind (expected) | Counted | Sentence in full / compressed | `payment_terms_` flags |
|---|---|---|---|---|---|---|---|
| a | none | D | 2026-10-18 (6 days) | sentence (sentence) | yes | full payment 1 / 1 | 0 |
| b | gigsalad | D | 2026-11-14 | platform (platform) | yes | no payment wording | 0 |
| c | none | D | 2027-03-20 | sentence (sentence) | yes | two months 1 / 1 | 0 |
| d | none | D | none | sentence (sentence) | yes | no-date 1 / 1 | 0 |
| e | yelp | D | 2026-11-10 (29 days) | sentence (sentence) | yes | two weeks 1 / 1 | 0 |
| f (extra) | none | **D** | 2026-11-14 | **sentence** (unknown_platform) | no | two weeks 1 / 1 | 0 |

**Result:** the fail-closed sample PASSES: 5 of 5 counted, 10 drafts, each with the expected sentence exactly once
(or, for GigSalad, no payment wording), 0 payment flags. The model copied every sentence verbatim and put it right
after the price line, as asked (placement is not enforced).

**Stated limit, now observed (f):** the GigSalad-format text run WITHOUT `--platform` was marked "D" (direct) by the
model, as was lead b, so it got the dated deposit sentence and no `payment_terms_platform_unknown` flag. The fallback
only fires when the model says "P", and for this text it did not. **For hand-run GigSalad / The Bash leads, pass
`--platform gigsalad` (or `thebash`).** The intake paths set the platform themselves.

**Side observations (pre-existing, not this work):** the price-line tail says "repertoire shaped to their event" (third
person to the client); b shows the em-dash fixer's " , " spacing defect; both already known.
