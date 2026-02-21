# Brainstorm: Three Fixes from Rubric Comparison (Pipeline vs Projects)

**Date:** 2026-02-21
**Status:** Ready for planning
**Origin:** Ran the same lead (Alex R. — mariachi, Dec 24 2025, Chula Vista) through
both the pipeline and Claude Projects. Scored both on a formal rubric. Pipeline scored
24/40, Projects scored 37/40. Three gaps drove the difference.

---

## Fix 1: Past-Date Detection

### Problem

The lead says "December 24, 2025" — that date already passed (it's February 2026).
The pipeline classified it as `timeline_band: "comfortable"` and generated a full
draft treating it as a future event. Claude Projects caught it immediately:
"Quick note — your request says December 24, 2025 (already passed). Guessing you
mean 2026?"

**Root cause:** The classify prompt computes `timeline_band` using thresholds
(comfortable/short/urgent) but never checks whether the event date is *before today*.
There's no past-date validation anywhere in the pipeline.

### What We're Building

Two-part fix:

1. **Classification flag:** Add `past_date_detected: boolean` to the Classification
   type. The classify prompt gets an instruction: "If the event date has already
   passed relative to today's date, set `past_date_detected: true`." This makes the
   flag visible in the JSON output so Alex can see it before sending.

2. **Draft injection:** When `past_date_detected === true`, the generate prompt gets
   a flagged concern: "The event date appears to have already passed. Address this
   politely in the draft — ask to confirm the year, assume they meant the next
   occurrence, and frame it as a quick clarification rather than an error."

### Key Decisions

- **Not a hard gate.** The draft still generates — it just includes the date
  clarification conversationally, like Projects did. Rationale: the lead is still
  valuable, just needs one detail confirmed.
- **Flag in classification output.** Alex sees `past_date_detected: true` in the
  JSON so he's aware before copying the draft. Belt and suspenders.
- **Today's date must be injected.** The classify prompt needs to know today's date
  to compare. Currently `timeline_band` is computed by the LLM — this is the same
  mechanism, just one more comparison.

---

## Fix 2: Anchor-High Mariachi Pricing (Full Ensemble Default)

### Problem

The pipeline defaulted to `mariachi_4piece` at $1,350 (T2D anchor). Claude Projects
led with full ensemble at $2,100 (holiday rate) and offered 4-piece at $1,400 as the
down-sell. The rate card explicitly says: "Reserve full ensemble for weekend cultural
events with budget. Position 4-piece as right-sized for weekday corporate."

Christmas Eve is a weekend cultural event. The pipeline's format routing rule says
"Mexican heritage event → defaults to mariachi_4piece, or mariachi_full if 150+
guests." That guest count threshold is the wrong signal — day-of-week + event type
should drive the default.

**Root cause:** Format routing in classify.ts uses guest count as the only trigger
for full ensemble. It ignores day-of-week, event context (participatory vs
background), and the rate card's own strategic guidance.

### What We're Building

Smarter format routing for mariachi leads based on event signals, not just guest
count. Plus: when both formats are viable, present both with anchor-high framing.

### Key Decisions

#### Decision 1: 4-piece is weekday only (Mon–Thu)

The 4-piece mariachi is only available Monday through Thursday. This is a hard
operational constraint that the pipeline currently ignores. If the event is
Friday–Sunday, 4-piece is not an option — full ensemble is the only format.

**New routing logic:**

```
if (event is Friday–Sunday OR holiday):
  format_recommended = mariachi_full
  # 4-piece not available, don't offer it
elif (event is Monday–Thursday):
  # Use signal-based routing (see Decision 2)
```

#### Decision 2: Signal-based routing for weekday events

When the event falls Monday–Thursday and both formats are available:

| Signal | Default To | Why |
|--------|-----------|-----|
| Corporate + background/cocktail/networking | 4-piece | Right-sized, won't overwhelm conversation |
| Corporate + entertainment/featured moment | Full ensemble | They want a show, not ambiance |
| Private party (default) | Full ensemble | Cultural events deserve the full experience |
| "Low key" / "small space" / budget signals | 4-piece | Client signaled they want less |
| "High energy" / "entertainment" / participatory | Full ensemble | They want the full experience |
| No signals either way | Full ensemble | Default high, let them choose down |

#### Decision 3: When to show both options

- **Weekend/holiday:** Full ensemble only (4-piece not available). One price.
- **Weekday + signals point to full ensemble:** Lead with full ensemble, mention
  4-piece as "right-sized alternative if you prefer something more intimate."
- **Weekday + signals point to 4-piece:** Lead with 4-piece, don't mention full
  ensemble unless they ask "what options do you have."
- **Weekday + ambiguous:** Lead with full ensemble, offer 4-piece as alternative.

#### Decision 4: Holiday premium

Christmas Eve, Cinco de Mayo, NYE, Valentine's — the rate card says these are
"quoted separately above standard rates." The pipeline currently has no holiday
detection or premium. Projects quoted $2,100 for the full ensemble (which maps to
T3D anchor). This suggests Projects either detected a stealth premium signal or
applied a holiday uplift.

**For this brainstorm:** Holiday premium is a separate feature. This fix focuses on
format routing. But the plan should note that holiday detection is a future
enhancement.

---

## Fix 3: Cultural Vocabulary Mapping

### Problem

The pipeline wrote "the mariachi opens with the first notes of Las Posadas." Las
Posadas is a 9-day procession tradition leading up to Christmas — it's not Christmas
Eve itself. The word this family uses for Christmas Eve is **Nochebuena**. Claude
Projects nailed it: "Nochebuena sounds the way it should."

The pipeline has `cultural_context_active: true` and `cultural_tradition:
"spanish_latin"` — it *knows* this is a cultural lead. But the generate prompt says
"use cultural terminology" without giving Claude specific vocabulary to draw from.
Claude improvised and picked an adjacent-but-wrong term.

**Root cause:** The instruction "use cultural terminology" is too vague. Claude has
cultural knowledge but no guardrails for which terms to use in which contexts. It
needs either specific mappings or examples showing correct vs incorrect usage.

### What We're Building

**Approach: Few-shot examples (primary) + small vocab table (backup)**

This matches the pipeline's existing prompt engineering pattern — pass/fail examples
are already used for the deletion test and other rules.

#### Few-shot examples in generate.ts prompt

Added when `cultural_context_active === true && cultural_tradition === "spanish_latin"`:

```
CULTURAL VOCABULARY — Use the word the family uses, not an adjacent tradition.

FAIL: "the mariachi opens with the first notes of Las Posadas"
PASS: "Nochebuena in Chula Vista — the mariachi opens and someone stops mid-sentence"
WHY: Las Posadas is a 9-day procession, not Christmas Eve. The family calls it
Nochebuena. Use THEIR word.

FAIL: "a traditional birthday performance with Mexican songs"
PASS: "Las Mañanitas at her table, three generations surrounding her"
WHY: Las Mañanitas IS the birthday song. Name it — the family knows exactly what
it is and hearing it named creates instant recognition.

FAIL: "a romantic serenade for your anniversary"
PASS: "a serenata — the kind your parents would recognize"
WHY: Serenata is the tradition, not just a description. Using it signals cultural
fluency, not tourism.
```

#### Small vocab table (inline backup)

```
| English Term | Cultural Term | Context |
|---|---|---|
| Christmas Eve | Nochebuena | Mexican/Latin Christmas |
| Birthday song | Las Mañanitas | Traditional Mexican birthday |
| Serenade | Serenata | Romantic gesture, proposals, anniversaries |
| Close friends/family | Compadres | Warmth of the gathering |
| Godmother celebration | Quinceañera | 15th birthday milestone |
```

### Key Decisions

- **Few-shot examples are primary.** They teach the principle ("use their word, not
  an adjacent tradition") so Claude can generalize to terms we haven't listed.
- **Vocab table is backup.** Covers the most common mappings explicitly so Claude
  doesn't have to guess.
- **Lives in generate.ts prompt**, injected conditionally when cultural context is
  active. Not in a separate file — keeps it close to where Claude reads it.
- **Only Spanish/Latin for now.** Other cultural traditions can get their own
  vocabulary sections when we add them.

---

## Open Questions

1. **How does the pipeline currently inject today's date?** The classify prompt
   needs it for past-date detection. Does `buildClassifyPrompt()` already receive
   the current date, or do we need to add it?

2. **Does the pipeline parse day-of-week from the event date?** Format routing
   now depends on whether the event is Mon–Thu vs Fri–Sun. If the pipeline only
   has the raw date string, we need date parsing in classify or price.

3. **Should the vocab table be exhaustive or illustrative?** Current approach is
   illustrative (5 common terms + few-shot examples for the pattern). If Claude
   keeps picking wrong terms in production, we can expand.

---

## Three Questions

1. **Hardest decision in this session?** Mariachi format routing. The operational
   constraint (4-piece is weekday only) simplifies the weekend case but makes
   weekday routing signal-dependent. Getting the signal hierarchy right — which
   signals override which — is where the complexity lives.

2. **What did you reject, and why?** Rejected making past-date detection a hard
   gate that blocks generation. The lead is still valuable — they just got the year
   wrong. Also rejected putting cultural vocabulary in a separate context file
   (CULTURAL_SPANISH_LATIN.md) because the pipeline may not inject it, and the
   few-shot pattern is proven in this codebase.

3. **Least confident about going into the next phase?** The signal-based routing
   for weekday mariachi. "Background" vs "entertainment" vs "participatory" are
   inferred from natural language — the classifier has to read signals like "high
   energy" or "cocktail hour" and route correctly. This is LLM judgment, not
   deterministic code, so it could misfire on edge cases.
