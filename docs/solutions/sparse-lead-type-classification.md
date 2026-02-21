# Sparse Lead Type Classification for Response Generation

**Category:** Prompt engineering
**Tags:** llm, sparse-data, lead-classification, bundling, response-strategy
**Module:** src/prompts/generate.ts
**Related:** [testable-constraints-for-prompt-compliance.md](./testable-constraints-for-prompt-compliance.md), [platform-policy-enforcement.md](./platform-policy-enforcement.md)

## Problem

Sparse leads (minimal information from the client) received the same treatment
as rich leads. The model tried to write 145-word responses with cinematic
openings, named fears, and concern resolution — but had nothing to work with.
Results were either generic filler or hallucinated details.

**Symptoms:**
- Opening sentences that could apply to any lead
- Concerns listed individually with no substance ("I'll handle the details")
- Genre/style left unaddressed when the lead didn't specify
- Short-timeline events treated identically to events 6 months away
- Repeated verification gate failures requiring 2-3 retries

**Root cause:** The prompt assumed every lead had enough data for all 5 draft
steps. Sparse leads have different *intent* behind the sparsity — a price
shopper needs a different response than someone overwhelmed by event planning.

## What Was Tried

1. **Shorter word count for sparse leads** — Helped but didn't address the core
   issue. A shorter generic response is still generic.

2. **Telling the model to "infer from context"** — Too vague. The model inferred
   poorly or not at all. "Not sure on details" got treated as "no concerns."

3. **Fixing the classifier to flag fewer concerns on sparse leads** — Rejected.
   A strict classifier that flags everything + a capable generator that handles
   it is better than a lenient classifier that misses issues on richer leads.

## What Worked

A 4-type classification system with matched strategies, plus three supporting
rules for common sparse lead failure modes.

### The 4-Type System

```
Type 1 — Pre-planning price shopper
Signals: Very early date (6+ months out), no venue, no budget, no detail.
Strategy: Be memorable, not exhaustive. Short response, one strong
cinematic line, validate briefly, quote confidently, soft close.

Type 2 — Overwhelmed or busy
Signals: Sparse form but emotionally loaded event (wedding, milestone
birthday, quinceañera). They care, they just didn't have bandwidth.
Strategy: Remove all friction. Fewer words, clearer path. Make the next
step effortless.

Type 3 — Impatient minimum-viable filler
Signals: Category-only request, short lead time, no explanation. They know
what they want, just didn't type it.
Strategy: Demonstrate you figured it out without asking. Assume, state it
confidently, quote. If wrong, they'll correct you.

Type 4 — Still figuring out entertainment
Signals: Vague genre request ("music," "entertainment," "not sure").
Strategy: Ask ONE binary question that demonstrates expertise.
Default: "Are you picturing something intimate and in the background,
or more of a featured moment people stop to watch?"

When ambiguous: Default to Type 4.
```

**Analogy:** A doctor doesn't give the same speech to every patient. A patient
who says "just checking my options" (Type 1) gets different treatment than one
who says "I'm in pain but I don't know where it hurts" (Type 2). Matching the
response strategy to the *why* behind the sparsity produces better output than
matching it to the amount of data available.

### Supporting Rule 1: Concern Bundling (Type 3)

When the classifier flags 4-5 concerns on a lead with almost no info, addressing
each one separately sounds robotic. Bundle them:

```
BAD (addressing each concern separately):
"I'm happy to discuss duration options. I can accommodate various guest
counts. The genre will be tailored to your preferences."

GOOD (bundled into one confident sentence):
"I'm quoting for a 2-hour solo set with warm instrumental repertoire — if
your headcount or venue changes the picture, just say the word and I'll
adjust."
```

That one sentence covers duration, genre, guest count, and venue in Type 3
voice. **Bundling beats enumeration for sparse leads:** one confident sentence
covering 5 gaps is better than 5 sentences covering 1 gap each.

### Supporting Rule 2: Genre Default Rule

When style/genre is unspecified, the model either left it unaddressed or
hedged ("whatever you prefer"). Fix: always state the default.

```
For corporate events: "I default to fingerstyle jazz and light acoustic pop
for corporate rooms."

For private events: "I lean toward warm acoustic covers and instrumental
standards unless you have something specific in mind."
```

This must appear as its own clause or sentence in the draft. The model was
already seeing genre in bundling *examples* and ignoring it — making it an
explicit standalone rule fixed the behavior.

### Supporting Rule 3: Date Proximity Rule

Events within 6 weeks got no urgency acknowledgment, which felt tone-deaf
on leads with "March 22" when today is mid-February.

```
Date proximity rule: If the event date is within 6 weeks, the draft MUST
contain one sentence that acknowledges the timeline — offer to hold the
date, note that confirming soon helps with availability, or frame it as
"March 22 is coming up."
```

### Supporting Pattern: Sparse Scene Strategy

When the lead gives no venue, no guest count, no vibe — build the cinematic
moment from what the *experience* looks like, not from lead details:

```
"Halfway through the first hour, the conversation at the long table gets
louder — that's the cue to drop the guitar down a half step, and the whole
room settles without anyone noticing why."
```

Guests at a table, glasses in hands, a specific time of night, music doing
something observable in response to the room. The scene comes from the
experience, not the lead.

## Test Results

| # | Lead | Type | Gate | Attempts | Confidence |
|---|------|------|------|----------|------------|
| 1 | Wedding @ Hilton La Jolla | Rich | PASS | 2 | 90 |
| 2 | Birthday March 22 ("not sure on details") | Sparse (Type 2) | PASS | 1 | 70 |
| 3 | October 2026 birthday ("just getting pricing") | Type 1 | PASS | 2 | 70 |
| 4 | Corporate March 14 downtown | Type 3 | PASS | 1 | 80 |

All 4 leads achieve 10/10 gut checks.

## Reusable Pattern

1. **Classify the intent behind sparsity, not just the amount of data** — A
   price shopper and an overwhelmed planner both submit sparse forms but need
   completely different responses. Build a type system around *why* the data is
   missing.

2. **Bundling beats enumeration** — When you have many concerns to address but
   little data to work with, one confident sentence covering multiple gaps reads
   better than addressing each concern separately.

3. **State defaults explicitly** — When data is missing and you're using a
   default (genre, duration, format), say so in the output. "I default to X"
   is better than silently using X or asking the client to specify.

4. **Date proximity creates implicit urgency** — A short timeline is a concern
   even when the client doesn't mention it. Acknowledge it proactively.

5. **Build scenes from the experience, not the data** — When you have no venue
   or guest count, describe what the *event feels like* — people, sounds,
   moments. The cinematic quality comes from universal experience, grounded by
   the one or two details you do have.

6. **Fix the generator, not the classifier** — When sparse leads cause too many
   concerns to address, the fix is teaching the generator to handle many
   concerns gracefully (bundling), not teaching the classifier to flag fewer.
   A strict classifier + capable generator is more robust than a lenient one.
