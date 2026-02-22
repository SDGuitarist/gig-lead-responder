# Batch 2 — Per-Section Research

**Date:** 2026-02-21
**Sections researched:** 3

---

## Section: Fix 1 — Past-Date Detection

**Research focus:** How to inject today's date into LLM prompts, code-based vs LLM-based date validation, conditional prompt injection patterns.

**Best Practices:**

- **Inject today's date as a natural-language sentence, not a label.** Anthropic's own system prompt uses `{{currentDateTime}}` in a sentence. The Goose project found that `Datetime: 2025-12-10` (label format) failed while `It is currently 2025-12-10` (sentence format) succeeded — assertive sentences register as ground truth, field-value pairs get ignored. *(source: Goose issue #6066, Anthropic system prompts)*
- **Use ISO 8601 (YYYY-MM-DD) for all date injection.** Avoids locale ambiguity (`03/14` is day/month or month/day depending on locale). *(source: Medium — Best Practices for Handling Dates in Structured Output)*
- **Deterministic checks belong in code, not in prompts.** Date comparison is pure syntax — zero ambiguity, zero interpretation. The LLM should receive the result, not compute it. This is "Schillace's Law 3: code is for syntax and process; models are for semantics and intent." *(source: Explore agent research, OpenAI community forum)*

**Performance Considerations:**

- TypeScript date comparison is a single-line operation with zero API cost. Delegating this to the LLM adds latency and hallucination risk for no benefit.
- The `past_date_detected` flag should be computed in TypeScript *after* classify returns `event_date_iso`, not inside the LLM call.

**Common Pitfalls:**

- **Year rollover assumption bug.** Without an injected date, LLMs assume the current year is near their training cutoff. "March 14" in a February 2026 lead gets interpreted as March 14, 2025 (past) rather than 2026 (upcoming). This is the exact failure the Goose project documented. *(source: Goose issue #6066)*
- **UTC midnight timezone rollover.** `new Date("2026-03-14")` parses as UTC midnight, which becomes the previous calendar day in US Pacific time. Fix: append `T12:00:00` to anchor to local noon. *(source: Explore agent, MDN documentation)*
- **Relative date ambiguity.** Leads saying "next Saturday" need the classify prompt to know today's date to resolve. Without injection, the LLM may pick any plausible Saturday.

**Implementation Patterns:**

Two-layer architecture (recommended):

```typescript
// Layer 1: TypeScript computes the deterministic boolean
const eventDateISO = classification.event_date_iso; // LLM extracted this
const today = new Date().toISOString().split('T')[0];
const pastDateDetected = eventDateISO
  ? new Date(`${eventDateISO}T12:00:00`) < new Date(`${today}T12:00:00`)
  : false;

// Layer 2: Inject into generate prompt conditionally
const pastDateBlock = pastDateDetected
  ? `## PAST DATE WARNING
This lead's event date appears to be in the past. Address this politely —
ask to confirm the year, assume they meant the next occurrence, and frame
it as a quick clarification rather than an error.`
  : "";
```

Prompt injection format:

```
Today's date is 2026-02-21.
```

Placed at the TOP of the classify prompt (before classification schema), per the Prompt Placement for Hard Constraints learning.

**References:**
- [Goose — Make datetime info more explicit (GitHub #6066)](https://github.com/block/goose/issues/6066)
- [How do we make LLM understand context of time (OpenAI Community)](https://community.openai.com/t/how-do-we-make-llm-understand-the-context-of-time/328978)
- [Best Practices for Handling Dates in Structured Output (Medium)](https://medium.com/@jamestang/best-practices-for-handling-dates-in-structured-output-in-llm-2efc159e1854)
- [Anthropic System Prompts — Release Notes](https://platform.claude.com/docs/en/release-notes/system-prompts)
- [Context Engineering Guide (Prompt Engineering Guide)](https://www.promptingguide.ai/guides/context-engineering-guide)
- [Temporal Awareness — Open WebUI docs](https://docs.openwebui.com/features/chat-features/temporal-awareness/)

---

## Section: Fix 2 — Anchor-High Mariachi Pricing (Format Routing)

**Research focus:** Day-of-week parsing, signal-based routing, anchor-high pricing presentation, multi-format LLM drafts.

**Best Practices:**

- **Two-stage date parsing: LLM extracts ISO string, TypeScript computes day-of-week.** LLMs are unreliable at computing weekdays from dates — they will confidently say "Saturday" for a Thursday. Claude is reliable at string normalization (extracting `YYYY-MM-DD` from "March 14th"), so let it do that. Then `new Date().getDay()` in TypeScript for the arithmetic. *(source: Explore agent, MDN)*
- **Enumerate signals explicitly in the prompt, not vague "determine intent."** List concrete signal words for "background" (`cocktail hour, ambient, dinner music, while we eat`) and "performance" (`entertainment, high energy, Las Mañanitas, serenade, entrance`). LLMs can pattern-match against a concrete list; they cannot reliably make holistic judgments from implicit tone. *(source: Explore agent, Intent Classification research)*
- **Anchor-high means show the premium first, then frame the alternative with a positive identity.** The Williams-Sonoma study found that introducing a $429 premium machine nearly doubled sales of the $279 machine — the anchor makes the target feel justified. *(source: HBR Good-Better-Best, Simon-Kucher, Shopify)*
- **Frame the down-sell as complete for its use case, not stripped.** The 4-piece is not "mariachi without extra musicians" — it's "the format designed for weekday events and intimate rooms." This is the HBR "fence attribute" principle. *(source: HBR)*

**Performance Considerations:**

- Add `event_date_iso: string | null` to Classification type — the LLM already extracts the date for timeline_band, just make it output a canonical ISO string.
- Day-of-week computation is a single `new Date().getDay()` call — no library needed for this alone.
- For natural language fallback ("this Saturday", "next Friday"), `chrono-node` is a lightweight parser with full TypeScript/ESM support.

**Common Pitfalls:**

- **Never ask the LLM to output `day_of_week` directly.** Under structured output constraints and full context pressure, it makes arithmetic errors. Ask for `event_date_iso` instead. *(source: Explore agent)*
- **UTC midnight rollover.** Same pitfall as Fix 1 — `T12:00:00` anchor prevents timezone drift.
- **Structured output constraints enforce format, not content correctness.** The field will always be filled (valid JSON), but the value can be wrong. Validate in TypeScript: is it a real date? Is it a future date? Null-fallback if not.
- **Don't use consolation language for the down-sell.** Avoid: "instead of", "budget option", "if cost is a concern", "normally." Use: "Two formats fit this event", "built for weekday events", "same energy, designed for the room." *(source: HBR, Explore agent)*
- **Conflicting signals are a signal themselves.** A lead with both "background" and "entertainment" cues hasn't decided. Present both formats (anchor-high) rather than forcing a guess. *(source: uncertainty-based routing research)*

**Implementation Patterns:**

Signal-based routing hierarchy (for classify prompt):

```
Priority 1 — Day-of-week (operational constraint, overrides all):
  Mon-Thu → 4-piece available; full requires explicit request
  Fri-Sun/holiday → full ensemble only (4-piece not available)

Priority 2 — Guest count:
  150+ guests → mariachi_full regardless of day/signals

Priority 3 — Explicit request:
  "full ensemble" / "big mariachi" → mariachi_full
  "small mariachi" / "compact" → mariachi_4piece

Priority 4 — Energy signal (when no explicit request):
  Performance signals → mariachi_full
  Background signals → mariachi_4piece

Priority 5 — Ambiguous (no clear signal or conflicting):
  Weekday → mariachi_4piece + ambiguous_mariachi_signals: true
  Weekend → mariachi_full + ambiguous_mariachi_signals: true
```

Anchor-high prompt block (for generate prompt):

```
## MARIACHI DUAL-FORMAT MODE

Present BOTH formats, full ensemble first (anchor-high).

Full ensemble: Name it, describe the moment it creates, quote price.
  "A full mariachi — 8 musicians — for [duration]hr runs $[price]."

4-piece: Frame with positive identity tied to event context.
  "The 4-piece is built for [weekday / cocktail hour / intimate space] —
  same energy, designed for the room. [duration]hr — $[price]."

Do NOT use: "instead", "budget option", "if cost is a concern", "normally"
Do use: "Two formats fit this event", "here's how I'd think about it"
```

Day-of-week TypeScript:

```typescript
function isWeekendOrHoliday(isoDate: string | null): boolean {
  if (!isoDate) return true; // Default to full ensemble when unknown
  const d = new Date(`${isoDate}T12:00:00`);
  if (isNaN(d.getTime())) return true;
  const day = d.getDay(); // 0=Sun, 1=Mon... 6=Sat
  return day === 0 || day === 5 || day === 6; // Fri, Sat, Sun
}
```

**References:**
- [The Good-Better-Best Approach to Pricing (HBR)](https://hbr.org/2018/09/the-good-better-best-approach-to-pricing)
- [Price Anchoring: Unlock Growth with Behavioral Pricing (Simon-Kucher)](https://www.simon-kucher.com/en/insights/price-anchoring-unlock-growth-behavioral-pricing)
- [Price Anchoring: What It Is, How It Works (Shopify)](https://www.shopify.com/enterprise/blog/44331971-6-scientific-principles-of-persuasion-all-smart-ecommerce-founders-know)
- [Price Anchoring in 2025 (Impact Analytics)](https://www.impactanalytics.ai/blog/price-anchoring)
- [chrono-node — Natural Language Date Parser (GitHub)](https://github.com/wanasit/chrono)
- [Intent Classification: 2025 Techniques (Label Your Data)](https://labelyourdata.com/articles/machine-learning/intent-classification)
- [Date.prototype.getDay() (MDN)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/getDay)

---

## Section: Fix 3 — Cultural Vocabulary Mapping

**Research focus:** Few-shot example design, conditional vocabulary injection, cultural term accuracy in LLMs, the deletion test pattern.

**Best Practices:**

- **Contrastive FAIL/PASS pairs outperform standard few-shot by 12 percentage points (76% vs 64%).** The AAAI 2024 paper on contrastive in-context learning found that negative examples communicate what to avoid, not just what to follow. The brainstorm's FAIL/PASS structure is the optimal approach. *(source: AAAI 2024 — Contrastive In-Context Learning)*
- **2 FAIL/PASS pairs is the sweet spot, not 5+.** A 2024 paper on over-prompting warns that too many examples degrades performance. For a bounded domain like Spanish/Latin cultural vocabulary, two contrastive pairs teach the principle without flooding context. *(source: arXiv — The Few-Shot Dilemma)*
- **Annotate WHY the FAIL is wrong — this is what enables generalization.** Models that understand *why* the negative example fails generalize to new error cases, not just the specific one shown. The WHY annotation should state the underlying rule: "Adjacent cultural terms from the same tradition are NOT interchangeable — each names a distinct event." *(source: Large Language Models are Contrastive Reasoners, arXiv 2024)*
- **Restructure the vocab table as a decision tree, not just a glossary.** Map event signals to terms: `"Christmas Eve" / "Dec 24" → NOCHEBUENA`, `"Dec 16-23" / "posada party" → LAS POSADAS`. This converts the lookup from a word bank into a routing instruction. *(source: Explore agent)*
- **Self-contained injection > pointer to external doc.** Instead of "See CULTURAL_SPANISH_LATIN.md in context above," embed the critical 5-6 mappings inline. The model may have compressed or deprioritized the doc by the time it reaches the rule. *(source: Context Engineering Guide 2025)*

**Performance Considerations:**

- The few-shot examples add ~150-200 tokens to the prompt when cultural context is active. This is negligible cost for high-accuracy cultural term usage.
- No second-pass semantic validation needed. For a bounded vocabulary (<20 terms per tradition), prompt-side constraints with FAIL/PASS examples are more reliable than a validation LLM call — and zero additional latency.

**Common Pitfalls:**

- **LLMs perform worst on holidays/celebrations/leisure.** The BLEnD benchmark (NeurIPS 2024) found a 57% performance gap between high-resource and low-resource cultures. Spanish/Latin Christmas terminology (Nochebuena vs Las Posadas vs Navidad) is a textbook failure case — three semantically adjacent terms from the same training cluster. *(source: BLEnD, NeurIPS 2024)*
- **Vague instructions ("use cultural terminology") fail because they don't narrow the retrieval space.** The model retrieves the most statistically common Spanish Christmas term from training data — "Las Posadas" appears most in English-language sources about Mexican Christmas, so it gets recalled first, even when the lead says "Christmas Eve dinner." *(source: Explore agent, BLEnD)*
- **The deletion test IS a recognized pattern (under different names).** It maps to the "specificity constraint" in prompt engineering literature and the "functional testing / fixture approach" in Towards Data Science (2024). The codebase's existing PASS/FAIL cinematic hook examples already use this pattern. *(source: Towards Data Science, Explore agent)*
- **Adjacent-tradition confusion is not unique to Spanish/Latin.** Common LLM confusions: Diwali vs Navratri (Hindu), Chinese New Year vs Tết/Seollal (East Asian), Hanukkah vs Shabbat vs Simcha (Jewish), Simbang Gabi vs Nochebuena (Filipino), Eid al-Fitr vs Eid al-Adha (Arabic). These are the highest-priority traditions for future expansion. *(source: BLEnD, Explore agent)*

**Implementation Patterns:**

Optimized conditional injection:

```typescript
const culturalBlock = classification.cultural_context_active
  ? `## CULTURAL VOCABULARY — MANDATORY

When this lead involves a Spanish/Latin celebration, use the EXACT term
from this table. Adjacent terms are NOT interchangeable.

| Event signal in lead | Use THIS term | Do NOT use |
|---------------------|---------------|------------|
| Christmas Eve, Dec 24, evening dinner | Nochebuena | Las Posadas, Navidad |
| Dec 16-23 nightly events | Las Posadas | Nochebuena |
| Birthday song tradition | Las Mañanitas | "Happy Birthday" |
| Romantic serenade, anniversary | Serenata | "serenade" |
| Family gathering warmth | Compadres | "friends and family" |

FAIL: "the mariachi opens with the first notes of Las Posadas"
WHY: Las Posadas is a 9-day procession (Dec 16-23). Christmas Eve is
Nochebuena. Adjacent terms from the same tradition are NOT interchangeable —
each names a distinct event. Match the term to the event signal in the lead.

PASS: "Nochebuena in Chula Vista — the mariachi opens and someone stops
mid-sentence"
WHY: Nochebuena is the precise term for this family's Christmas Eve.

FORCING RULE: After writing, locate every cultural term in your draft.
For each: does this term match the event signal in the lead? If the term
could be swapped for a different holiday term without making the sentence
inaccurate, it is wrong. Replace it.`
  : "";
```

Generalization payload (add to WHY annotation):

```
GENERALIZATION: This rule applies to ALL cultural terms. "Quinceañera"
is not "confirmation party." "Las Mañanitas" is the birthday serenade,
not "feliz cumpleaños." Exact term, exact event.
```

**References:**
- [BLEnD: A Benchmark for LLMs on Everyday Knowledge in Diverse Cultures (NeurIPS 2024)](https://arxiv.org/abs/2406.09948)
- [Customizing Language Model Responses with Contrastive ICL (AAAI 2024)](https://ojs.aaai.org/index.php/AAAI/article/view/29760/31308)
- [Large Language Models are Contrastive Reasoners (arXiv 2024)](https://arxiv.org/html/2403.08211v1)
- [The Few-Shot Dilemma: Over-prompting LLMs (arXiv 2024)](https://arxiv.org/pdf/2509.13196)
- [CultureLLM: Cultural Differences in LLMs (NeurIPS 2024)](https://proceedings.neurips.cc/paper_files/paper/2024/hash/9a16935bf54c4af233e25d998b7f4a2c-Abstract-Conference.html)
- [Context Engineering Guide (Prompt Engineering Guide)](https://www.promptingguide.ai/guides/context-engineering-guide)
- [Mastering Prompt Engineering with Functional Testing (Towards Data Science)](https://towardsdatascience.com/mastering-prompt-engineering-with-functional-testing-a-systematic-guide-to-reliable-llm-outputs/)
- [Few-Shot Prompting Guide (PromptHub)](https://www.prompthub.us/blog/the-few-shot-prompting-guide)
- [Semantic Validation with Structured Outputs (Instructor)](https://python.useinstructor.com/concepts/semantic_validation/)
