# Brainstorm: Three Fixes from Rubric Comparison (Pipeline vs Projects)

**Date:** 2026-02-21
**Status:** Ready for planning
**Origin:** Ran the same lead (Alex R. — mariachi, Dec 24 2025, Chula Vista) through
both the pipeline and Claude Projects. Scored both on a formal rubric. Pipeline scored
24/40, Projects scored 37/40. Three gaps drove the difference.

## Enhancement Summary

**Deepened on:** 2026-02-21
**Sections enhanced:** 3 (+ Open Questions + Cross-Cutting)
**Sources:** 0 skills, 4 learnings, 3 research queries, 2 Context7 lookups, 14 review agents, 5 research agents

### Key Improvements
1. **Date comparison moved to TypeScript** — 4 review agents independently flagged that asking the LLM to compare dates is fragile. Compute `past_date_detected` in code after the LLM extracts `event_date_iso`.
2. **Signal hierarchy simplified from 6 rows to 1 rule** — "Default full ensemble. Exception: weekday + corporate background signals -> 4-piece." Code-simplicity and DHH reviewers converged on this independently.
3. **Vocab table deferred, few-shot examples are sufficient** — Research confirms 2 contrastive FAIL/PASS pairs outperform glossaries (+12% accuracy, AAAI 2024). Ship examples only, add table later if needed.

### New Considerations Discovered
- `event_date_iso: string | null` is a shared dependency for Fix 1 AND Fix 2 — must be added to Classification as Step 0
- UTC midnight timezone rollover bug: `new Date("2026-03-14")` becomes Dec 23 in Pacific time — use `T12:00:00` noon anchor
- `past_date_detected` must be optional (`?`) for backward compatibility with existing SQLite JSON blobs
- Quinceañera factual error in vocab table: it's a girl's 15th birthday, not a "godmother celebration"
- Three new gut checks suggested: `past_date_acknowledged`, `mariachi_pricing_format`, `cultural_vocabulary_used`

### Batch Coverage

| Batch | Source | Findings |
|-------|--------|----------|
| batch1 | Skills | 0 |
| batch1 | Learnings | 12 recommendations from 4 learnings |
| batch2 | Per-section research | 3 sections, 18 recommendations |
| batch2 | Context7 docs | 2 libraries (date-fns: skip, Anthropic SDK: informational) |
| batch3 | Review agents | 17 findings from 13/14 agents |
| batch3 | Research agents | 5 agents, 15 recommendations |

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

### Research Insights

**CRITICAL — Date comparison belongs in TypeScript, not the LLM** *(4 review agents: kieran-ts, pattern-recognition, dhh, architecture + batch2 research + best-practices-researcher)*

The brainstorm says the LLM compares dates. Every research source says this is wrong. Date comparison is deterministic — zero ambiguity, zero interpretation. "Prompt for judgment, code for facts" (Schillace's Law 3). The LLM should extract `event_date_iso: string | null` (it already parses dates for `timeline_band`), and TypeScript computes the boolean:

```typescript
// Layer 1: LLM extracts the date string (already does this for timeline_band)
// Layer 2: TypeScript computes the deterministic boolean
const today = new Date().toISOString().split('T')[0];
const pastDateDetected = eventDateISO
  ? new Date(`${eventDateISO}T12:00:00`) < new Date(`${today}T12:00:00`)
  : false;
```

**Shared dependency: `event_date_iso` (Step 0)** *(kieran-ts, pattern-recognition)*

Fix 1 needs `event_date_iso` for past-date detection. Fix 2 needs it for day-of-week computation. Neither fix calls this out. Add `event_date_iso: string | null` to Classification as a prerequisite for both fixes.

**`buildClassifyPrompt()` must accept `today` parameter** *(architecture-strategist, repo-research-analyst)*

Currently takes zero arguments. Injecting today's date forces a new signature: `buildClassifyPrompt(today: string)`. Pass from `runPipeline` with default `new Date().toISOString().slice(0, 10)`. Inject at TOP of classify prompt as a natural-language sentence: `Today's date is 2026-02-21.` *(Goose #6066: assertive sentences register as ground truth, field-value pairs get ignored.)*

**Backward compatibility: make field optional** *(data-integrity-guardian, data-migration-expert)*

Existing `classification_json` blobs in SQLite lack this field. `JSON.parse` produces `undefined`, not `false`. Declare as `past_date_detected?: boolean`. All downstream code uses `?? false`. Only one deserialization site today: `twilio-webhook.ts` line 133.

**Add to formatted CLI output** *(agent-native-reviewer)*

Flag is in `--json` mode but not default formatted output. Add: `if (classification.past_date_detected) console.log('** WARNING: Event date appears to be in the past **');`

**UTC timezone pitfall** *(kieran-ts, batch2-research)*

`new Date("2026-03-14")` parses as UTC midnight = previous calendar day in US Pacific. Fix: `T12:00:00` noon anchor. Create shared utility: `function parseLocalDate(isoDate: string): Date { return new Date(\`${isoDate}T12:00:00\`); }`

**Two-layer enforcement with new gut check** *(learnings-researcher, testable-constraints learning)*

Layer 1: generate prompt injects flagged concern. Layer 2: verify gate catches drafts that miss it. New gut check `past_date_acknowledged`: if `past_date_detected === true`, draft must contain urgency/clarification language. Deletion test: "If you remove the urgency and the sentence still works for a September 2026 event, it fails."

**References:**
- [Goose — Make datetime info more explicit (GitHub #6066)](https://github.com/block/goose/issues/6066)
- [Best Practices for Handling Dates in Structured Output (Medium)](https://medium.com/@jamestang/best-practices-for-handling-dates-in-structured-output-in-llm-2efc159e1854)
- [Context Engineering Guide (Prompt Engineering Guide)](https://www.promptingguide.ai/guides/context-engineering-guide)

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

### Research Insights

**CRITICAL — Simplify signal hierarchy from 6 rows to 1 rule** *(code-simplicity-reviewer, dhh-rails-reviewer)*

The 6-row signal table resolves to one rule: "Default full ensemble. Exception: weekday + corporate background or low-key signals -> 4-piece." Five of six rows resolve to the same answer (full ensemble). Replace the table with two lines. Estimated savings: 20-30 lines of classify prompt never written.

**Operational constraints belong in deterministic code, not the LLM** *(pattern-recognition, dhh, architecture-strategist)*

"4-piece is weekday only" is a hard constraint. Putting it in prompt instructions is fragile. Split: (1) LLM classifies energy/context signals, (2) `resolveFormatRouting()` in `enrich.ts` applies day-of-week + signal rules deterministically. Same pattern as `enrichClassification()`.

```typescript
function resolveFormatRouting(
  classification: Classification,
  eventDateISO: string | null
): { format: Format; showAlternative: boolean } {
  const isWeekend = isWeekendDay(eventDateISO); // Fri, Sat, Sun
  if (isWeekend) return { format: 'mariachi_full', showAlternative: false };
  // Weekday: default full, exception for corporate background
  const isCorporateBackground = /* check signals */;
  if (isCorporateBackground) return { format: 'mariachi_4piece', showAlternative: true };
  return { format: 'mariachi_full', showAlternative: true };
}
```

**CONFLICT — Remove holidays from routing condition** *(pattern-recognition, dhh-rails-reviewer)*

The brainstorm says "holiday premium is a separate feature" but includes holidays in the routing condition (`Friday-Sunday OR holiday`). This is a contradiction. **Resolution: remove holidays from routing for now.** Weekend detection alone handles the Dec 24 2025 case (it's a Wednesday in 2025... but if they meant 2026, Dec 24 is a Thursday). Add holiday detection when you have real holiday data.

**Split Fix 2 into Phase A (routing) + Phase B (presentation)** *(kieran-ts-reviewer)*

These touch different files (classify.ts vs generate.ts), serve different purposes, and can be tested independently. Phase A: fix the routing rules. Phase B: add dual-format prompt injection.

**Dual-format breaks single-format pipeline assumption** *(architecture-strategist, pattern-recognition)*

Pipeline assumes one format, one price, one draft. Add `alternative_format_pricing: { format: Format, quote_price: number } | null` to PricingResult. Mirrors the existing `scoped_alternative` pattern from the budget feature.

**Day-of-week: LLM extracts ISO string, TypeScript computes** *(batch2-research, dhh, kieran-ts)*

Never ask the LLM to output `day_of_week` directly — under structured output constraints it makes arithmetic errors. Use `event_date_iso` (shared with Fix 1), then `new Date().getDay()` in TypeScript.

**Add explicit signal word lists** *(kieran-ts, batch2-research)*

Enumerate concrete signals: `Background: "cocktail hour", "ambient", "dinner music", "while we eat"`. `Performance: "entertainment", "high energy", "Las Mañanitas", "serenade", "entrance"`. LLMs can pattern-match against concrete lists; they cannot make holistic judgments from implicit tone.

**Add `format_routing_signals: string[]` for traceability** *(agent-native-reviewer)*

Only the final `format_recommended` is visible today. No field shows what drove the decision. Mirrors the existing `stealth_premium_signals` pattern.

**Anchor-high framing: premium first, positive identity for alternative** *(batch2-research, HBR, Simon-Kucher)*

Williams-Sonoma study: introducing a $429 premium machine nearly doubled sales of the $279 machine. The 4-piece is not "mariachi without extra musicians" — it's "the format designed for weekday events and intimate rooms." Never use: "instead of", "budget option", "if cost is a concern."

**FAIL/PASS examples for format routing** *(testable-constraints learning)*

```
FAIL: "We could do 1 hour instead, which would be $450."
PASS: "A confident 1-hour solo set at $450, fully self-contained."
```

**New gut check: `mariachi_pricing_format`** *(learnings-researcher)*

If dual-format context, first price presented must be the higher of the two. Deletion test: "If you remove the context signals, does the high anchor still make sense?"

**References:**
- [The Good-Better-Best Approach to Pricing (HBR)](https://hbr.org/2018/09/the-good-better-best-approach-to-pricing)
- [Price Anchoring (Simon-Kucher)](https://www.simon-kucher.com/en/insights/price-anchoring-unlock-growth-behavioral-pricing)
- [chrono-node — Natural Language Date Parser (GitHub)](https://github.com/wanasit/chrono)

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

### Research Insights

**Few-shot examples are the right approach — research validates it** *(batch2-research, AAAI 2024)*

Contrastive FAIL/PASS pairs outperform standard few-shot by 12 percentage points (76% vs 64%, AAAI 2024). The brainstorm's structure is optimal.

**2 FAIL/PASS pairs is the sweet spot, not 5+** *(batch2-research, arXiv 2024)*

A 2024 paper on over-prompting warns that too many examples degrades performance. For a bounded domain like Spanish/Latin cultural vocabulary, two contrastive pairs teach the principle without flooding context. The brainstorm has 3 pairs — consider reducing to 2 (drop the serenata pair, which is less likely to be confused).

**Annotate WHY the FAIL is wrong — this enables generalization** *(batch2-research, arXiv 2024)*

The brainstorm already does this. Enhancement: add a GENERALIZATION annotation to the WHY block:

```
GENERALIZATION: This rule applies to ALL cultural terms. Adjacent terms from
the same tradition are NOT interchangeable — each names a distinct event.
Match the term to the event signal in the lead.
```

**CONFLICT — Defer vocab table, ship few-shot only** *(code-simplicity-reviewer, dhh-rails-reviewer)*

Multiple agents independently concluded: the few-shot examples already cover Nochebuena, Las Mañanitas, and Serenata. If examples teach the *principle* so Claude can generalize (the brainstorm's own reasoning), the table is redundant. Ship few-shot only. Add vocab table later only if Claude still picks wrong terms in production. **Saves 10-15 lines.**

**Fix factual error: quinceañera** *(kieran-ts-reviewer)*

The vocab table says "Godmother celebration -> Quinceañera." A quinceañera is a girl's 15th birthday celebration, not a godmother celebration. Change to: "15th birthday celebration -> Quinceañera."

**Clarify relationship with existing CULTURAL_SPANISH_LATIN.md** *(kieran-ts, pattern-recognition)*

The context pipeline already injects `CULTURAL_SPANISH_LATIN.md` when cultural context is active. The new few-shot examples add a second set of vocabulary instructions. Plan should state: context doc provides general cultural framing, few-shot examples enforce vocabulary precision. They're complementary, not competing.

**Self-contained injection beats pointer** *(batch2-research, Context Engineering Guide 2025)*

Instead of "See CULTURAL_SPANISH_LATIN.md in context above," embed the critical mappings inline. The model may have compressed or deprioritized the doc by the time it reaches the forcing rule. The brainstorm already does this — validated.

**LLMs perform worst on holidays/celebrations** *(batch2-research, BLEnD NeurIPS 2024)*

57% performance gap between high-resource and low-resource cultures. Spanish/Latin Christmas terminology is a textbook failure case — three semantically adjacent terms (Nochebuena, Las Posadas, Navidad) from the same training cluster. The vague instruction "use cultural terminology" triggers retrieval of the most statistically common term, not the correct one.

**Cultural deletion test** *(best-practices-researcher)*

Extension of the existing deletion test: "If you remove the cultural reference and the sentence still works for any generic event, it's decorative, not accurate." Already captured in the WHY annotations.

**New gut check: `cultural_vocabulary_used`** *(learnings-researcher)*

If `cultural_context_active === true`, draft must use specific cultural terminology. Deletion test applies: "If you swap the cultural term for a generic English equivalent and the sentence still works, it fails."

**Adjacent-culture confusion is not unique to Spanish/Latin** *(batch2-research, BLEnD)*

Common LLM confusions for future expansion: Diwali vs Navratri (Hindu), Chinese New Year vs Tet/Seollal (East Asian), Hanukkah vs Shabbat vs Simcha (Jewish), Simbang Gabi vs Nochebuena (Filipino), Eid al-Fitr vs Eid al-Adha (Arabic).

**References:**
- [BLEnD: Benchmark for LLMs on Everyday Knowledge in Diverse Cultures (NeurIPS 2024)](https://arxiv.org/abs/2406.09948)
- [Contrastive In-Context Learning (AAAI 2024)](https://ojs.aaai.org/index.php/AAAI/article/view/29760/31308)
- [Large Language Models are Contrastive Reasoners (arXiv 2024)](https://arxiv.org/html/2403.08211v1)

---

## Open Questions

1. **How does the pipeline currently inject today's date?** The classify prompt
   needs it for past-date detection. Does `buildClassifyPrompt()` already receive
   the current date, or do we need to add it?

   > **RESOLVED** *(repo-research-analyst, architecture-strategist):* `buildClassifyPrompt()` takes zero arguments. Must change to `buildClassifyPrompt(today: string)`. Propagates to `classifyLead` and `runPipeline`.

2. **Does the pipeline parse day-of-week from the event date?** Format routing
   now depends on whether the event is Mon–Thu vs Fri–Sun. If the pipeline only
   has the raw date string, we need date parsing in classify or price.

   > **RESOLVED** *(repo-research-analyst, batch2-research):* No "weekend", "weekday", "dayOfWeek" anywhere in codebase. Entirely new infrastructure. Use `event_date_iso` + native `Date.getDay()` with `T12:00:00` noon anchor. No library needed. Add `resolveFormatRouting()` to `enrich.ts`.

3. **Should the vocab table be exhaustive or illustrative?** Current approach is
   illustrative (5 common terms + few-shot examples for the pattern). If Claude
   keeps picking wrong terms in production, we can expand.

   > **RESOLVED** *(code-simplicity, dhh, batch2-research):* Defer the vocab table entirely. Ship few-shot examples only (2-3 FAIL/PASS pairs). Research shows 2 contrastive pairs is the sweet spot. Add vocab table later only if Claude still picks wrong terms.

---

## Cross-Cutting Research Insights

### Shared Infrastructure (Step 0)

Both Fix 1 and Fix 2 depend on `event_date_iso: string | null` on Classification. Add this field before implementing either fix. The classify prompt already parses dates for `timeline_band` — just make it output a canonical ISO string alongside the qualitative bucket.

Shared utility for date parsing: *(kieran-ts, batch2-research)*

```typescript
function parseLocalDate(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00`); // Noon anchor avoids UTC rollover
}
```

### Types First, Then Prompts *(git-history-analyzer)*

Established codebase pattern: modify `types.ts` -> update classify prompt -> update generate prompt -> update verify. Both `lead_specific_opening` and `stated_budget` followed this order.

### Three New Gut Checks *(learnings-researcher)*

Dynamic gut check counting (`Object.keys(checks).length`) already handles auto-increment:

1. `past_date_acknowledged` — if `past_date_detected`, draft must contain clarification
2. `mariachi_pricing_format` — if dual-format, first price is the higher option
3. `cultural_vocabulary_used` — if cultural context active, draft uses specific terminology

### Existing Issues Flagged (not blocking, track separately)

- `enrichClassification` shallow copy shares array references *(kieran-rails)*
- `pricing.budget` mutation contradicts pure function principle *(julik-races, kieran-rails)*
- Unauthenticated `/api/analyze` endpoint *(security-sentinel)*
- Dashboard auth bypass when env vars missing *(security-sentinel)*
- `PipelineOutput.classification` leaks un-enriched version *(kieran-python)*

### Future Enhancement: Structured Outputs *(framework-docs-researcher)*

The Anthropic SDK now has Structured Outputs (GA) that guarantee valid JSON via constrained decoding. Could replace manual `JSON.parse` + retry + `stripCodeFences()` in `callClaude`. Not blocking for these fixes — separate enhancement.

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
