# Batch 3 — Research Agent Findings

**Date:** 2026-02-21
**Agents run:** 5

---

## best-practices-researcher

**Type:** compound-engineering:research:best-practices-researcher
**Research output:**

### 1. Date Validation in LLM Pipelines

**Core principle:** LLMs have no awareness of the current date. Inject it as a system prompt constant before any dynamic content.

**Recommended pattern:**
```typescript
const currentDate = new Date().toISOString().split('T')[0]; // "2026-02-21"
// Inject at top of classify prompt: "Today is ${currentDate}"
```

**Key finding:** Compute date proximity in code, not in prompts. LLMs are unreliable at temporal arithmetic. Create a `getDateProximity()` function that returns labels like "past_event", "urgent", "soon", "moderate", "distant" — inject the label, not the math.

**Detect past dates before the LLM sees them** — validate temporal sanity in pipeline code and push to `flagged_concerns`.

**References:**
- [OpenAI Developer Community: LLM Time Context](https://community.openai.com/t/how-do-we-make-llm-understand-the-context-of-time/328978)
- [LLMs Don't Know What Time It Is](https://medium.com/@oruas/llms-dont-know-what-time-it-is-here-is-how-you-fix-it-a3590dbce328)

### 2. Few-Shot Example Patterns

**Anthropic official guidance:** 3-5 diverse, relevant examples. More = better for complex tasks. Claude 4.x replicates naming conventions, formatting, and sentence structure from examples precisely.

**Optimal counts:**
- Classification tasks: 1 example per type sufficient
- Generation quality (PASS/FAIL): 2-3 examples is the sweet spot
- Diminishing returns after 5 examples

**PASS/FAIL format strongly recommended for quality gates.** Wrap in `<example>` tags per Anthropic docs. Make examples diverse (cover different edge cases). Match the exact output format.

**What to avoid:** Beyond 5 examples, you burn context window. Examples that contradict rules (model follows examples over rules). Unintentional patterns (all examples start with same word → model echoes it).

**References:**
- [Anthropic Multishot Prompting Docs](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/multishot-prompting)
- [PromptHub Few-Shot Guide](https://www.prompthub.us/blog/the-few-shot-prompting-guide)
- [Few-Shot Prompting Guide](https://www.promptingguide.ai/techniques/fewshot)

### 3. Signal-Based Routing in LLM Classification

**Three production patterns:**

1. **Pre-generation routing** (what the pipeline already does) — classify input, route to prompt variant. The sparse lead type system is exactly this pattern. Research validates it.

2. **Confidence-based cascade** — route to cheapest solution first, escalate on low confidence. The pipeline already has this with the verify gate. Could make threshold tunable per lead type.

3. **Multi-signal composition** — compose signals into a routing key for more precise behavior selection. Current pipeline captures multiple signals but feeds them into a single template. Improvement: composite routing key drives more targeted prompt blocks.

**For ambiguous signals:** surface the ambiguity (add `ambiguity_flags` field), use the safer default, let the verify gate catch misroutes.

**References:**
- [Multi-LLM Routing Strategies (AWS)](https://aws.amazon.com/blogs/machine-learning/multi-llm-routing-strategies-for-generative-ai-applications-on-aws/)
- [Unified Routing and Cascading (ETH Zurich)](https://arxiv.org/html/2410.10347v1)

### 4. Cultural Sensitivity in AI-Generated Text

**Core risk:** Cultural conflation — treating adjacent-but-distinct traditions as interchangeable. LLMs default to Western-centric norms and blur distinctions between mariachi (Mexican) and flamenco (Andalusian).

**Key techniques:**
- **Hard-coded cultural glossary** with WRONG examples (like rate tables but for vocabulary)
- **Cultural prompting** — one sentence specifying cultural context improved alignment for 71-81% of countries (Cornell research)
- **Cultural deletion test** — extend existing deletion test: "If you remove the cultural reference and the sentence still works for any generic event, it's decorative, not accurate"
- **Adjacent-culture guardrails** — explicit cross-checks: "Mariachi lead mentions castanets → FAIL (that's flamenco)"

**References:**
- [Cultural Bias in LLMs (PNAS Nexus)](https://academic.oup.com/pnasnexus/article/3/9/pgae346/7756548)
- [Reducing Cultural Bias with One Sentence (Cornell)](https://news.cornell.edu/stories/2024/09/reducing-cultural-bias-ai-one-sentence)

### Cross-Cutting Principle

> "Prompt for judgment, code for facts." Move deterministic logic (date math, signal routing, cultural vocabulary validation) out of the LLM and into pipeline code. The LLM's job is creative generation and nuanced judgment.

---

## learnings-researcher

**Type:** compound-engineering:research:learnings-researcher
**Research output:**

Searched `docs/solutions/` — 8 total files, 6 directly relevant.

### Fix 1 Relevant Learnings

**sparse-lead-type-classification.md** — Conditional prompt injection by type is the established pattern. When adding date-awareness, don't list as a separate rule — bundle into existing density/style guidance. "One confident sentence covering multiple concerns reads better than addressing each separately."

**testable-constraints-for-prompt-compliance.md** — Past-date fix needs a verification check. Add `past_date_acknowledged` to gut checks: if `is_past_date=true`, the draft must contain urgency signal. The deletion test applies: "If you remove the urgency language and the sentence still works for a September 2026 event, it fails."

**prompt-placement-for-hard-constraints.md** — When injecting today's date, place at the top of the system prompt (the "kitchen door sign" analogy). The model needs to see date context before reasoning about timeline.

### Fix 2 Relevant Learnings

**platform-policy-enforcement.md** — Opposite routing rules need opposite branches (if/else, not if/if). For mariachi pricing: if high-cultural-resonance context → formal dual-format. Otherwise → compressed quote. The verify gate mirrors this.

**testable-constraints-for-prompt-compliance.md** — The verify gate needs a testable rule for "anchor-high": "If this is a high-anchoring context, the first price presented must be the higher of the two proposed rates." The deletion test: "If you remove the context signals, does the high anchor still make sense?"

### Fix 3 Relevant Learnings

**sparse-lead-type-classification.md (genre default rule)** — When cultural context is active, state vocabulary choice explicitly. Don't nestle it in longer sentences. Make it a standalone confidence-building phrase.

**testable-constraints-for-prompt-compliance.md** — Include FAIL examples in the few-shot vocab. Show a draft using "Spanish guitar" when "flamenco" is accurate, and explain why it fails. Contrast teaches faster than passing examples alone.

**platform-policy-enforcement.md** — Use if/else blocks at the TypeScript level for cultural vocabulary injection. Don't write "If cultural context applies, consider using..." — that's opt-in. Hard constraint branches are opt-out.

### Cross-Cutting: Two-Layer Enforcement

All three fixes benefit from the established pattern: generation prompt prevents bad output (forcing rules + examples), verification gate catches what slipped through. Neither alone is reliable.

### Verification Gate Extension

Three new gut checks suggested:
- `past_date_acknowledged` — if `is_past_date=true`, draft signals urgency
- `mariachi_pricing_format` — if high-anchor context, first price is high
- `cultural_vocabulary_used` — if cultural context active, draft uses specific terminology

Dynamic gut check counting (`Object.keys(checks).length`) already handles auto-increment.

---

## repo-research-analyst

**Type:** compound-engineering:research:repo-research-analyst
**Research output:**

### Fix 1 Implementation Path

- `buildClassifyPrompt()` takes **zero arguments**. Must change to `buildClassifyPrompt(today: string)`. Propagates to `classifyLead` and `runPipeline`.
- No `event_date_iso` field exists on Classification. Only `timeline_band` (qualitative bucket).
- Two injection options for flagged concerns: (A) LLM adds to `flagged_concerns[]` during classification, or (B) TypeScript stamps it post-classification. Option B is more deterministic.
- Insertion point in generate.ts: after line 108 (existing cultural context conditional). Same ternary pattern.

### Fix 2 Implementation Path

- FORMAT ROUTING RULES section at classify.ts lines 80-89 has **never been modified** since initial PR. Current mariachi rule: `mariachi_4piece (default) or mariachi_full (if 150+ guests)`.
- The only signal for `mariachi_full` is guest count. Day-of-week, event type, cultural context are all ignored.
- Rate tables exist for both: `MARIACHI_4PIECE_RATES` (1, 2, 3hr) and `MARIACHI_FULL_RATES` (2, 3, 4hr).
- `enrich.ts` is the natural home for deterministic post-classification format correction.
- No "weekend", "weekday", "dayOfWeek" anywhere in codebase. Entirely new infrastructure.

### Fix 3 Implementation Path

- `cultural_context_active` set by LLM in classify prompt (lines 107-111) based on event type, family mentions, music tradition, and venue signals.
- Three existing cultural injection points in generate.ts: line 108 (direct conditional), lines 157-170 (`getWedgeInstruction`), lines 172-177 (`getValidationTarget`).
- Context pipeline (`context.ts` lines 43-52) already injects `CULTURAL_SPANISH_LATIN.md` and `CULTURAL_CORE.md`.
- Few-shot examples go inline in generate.ts (Pattern A). Vocab table could go either inline or as context doc (Pattern B).
- Insertion point: immediately after existing cultural context block at line 108.

### Cross-Cutting

- Classification fields must be added in three places: `types.ts` (interface), `classify.ts` (prompt output format), downstream consumers.
- Post-classification stamping pattern (like `platform` on line 74) is for runtime-only metadata.
- Verify gate checks 11 gut checks (9/11 to pass). New gut checks auto-counted by `Object.keys(checks).length`.

---

## git-history-analyzer

**Type:** compound-engineering:research:git-history-analyzer
**Research output:**

### types.ts Evolution

- **Initial commit** (Feb 20): Classification shipped with 20+ fields. GateResult had 9 gut checks.
- **`02f1382`** (Feb 20): Added `platform?: "gigsalad" | "thebash" | "direct"` as **optional** (stamped post-classification, not AI-generated). Established pattern for pipeline-managed metadata.
- **`0a114bc`** (Feb 21): Added `lead_specific_opening` (10th gut check) + `confidence_score` to PipelineOutput.
- **`d30dc90`** (Feb 21): Added `stated_budget`, `BudgetGapResult` discriminated union, `ScopedAlternative`, `budget: BudgetGapResult` on PricingResult. Largest single expansion.
- **`e55731d`** (Feb 21): Added `budget_acknowledged` (11th gut check).

**Pattern:** New fields appended with section headers. LLM-populated fields are required. Pipeline-stamped fields are optional (`?`). Following this, `past_date_detected` should be required if LLM populates it, optional if pipeline code stamps it.

### generate.ts Evolution

- 13 commits in two days. The most actively evolved file.
- **Initial PR** (Feb 20): Basic structure — persona, classification dump, pricing, context, writing instructions.
- **Three rapid GigSalad fixes** (Feb 20, 20:35-20:44): Production emergency pattern — 3 commits in 9 minutes.
- **Reasoning stage restructuring** (Feb 21, 08:14): Replaced 7-component framework with reasoning-first 5-step sequence.
- **Five sparse lead refinements** (Feb 21, 08:31-09:14): 5 commits in 43 minutes. Each added a targeted rule. **This is the pattern for the planned fixes: small, targeted additions.**
- **Budget mode block** (Feb 21, 10:40): Added `buildBudgetModeBlock()` — injected at the **top** of prompt template. Established pattern for "override" instructions.

### Conditional Injection Patterns (exactly four exist)

1. **Budget mode block** — helper function returning empty string or full section. Top of prompt.
2. **GigSalad platform policy** — inline ternary. After budget block.
3. **Cultural context** — two locations (Critical Rules section + `getWedgeInstruction()`).
4. **Contact block** — ternary for GigSalad omission.

### Development Patterns

- **Rapid iteration cycle:** Run test lead → observe → add targeted prompt rule → commit → repeat.
- **Helper functions > inline ternaries:** `buildBudgetModeBlock()` pattern is cleaner and more testable.
- **Types first, then prompts:** Both `lead_specific_opening` and `stated_budget` followed: modify types.ts → update classify prompt → update generate prompt → update verify.
- **FORMAT ROUTING section is frozen:** Never modified since initial PR. Fix 2 will be the first change.
- **Generate prompt grows from the middle outward:** New blocks inserted into existing sections, expanding rather than adding separate blocks.

---

## framework-docs-researcher

**Type:** compound-engineering:research:framework-docs-researcher
**Research output:**

### Anthropic SDK: Structured Outputs Can Replace JSON Retry Logic

**Biggest actionable finding.** The current `callClaude()` does manual JSON parsing with retry-on-failure and `stripCodeFences()`. The Anthropic API now has **Structured Outputs** (GA, no beta header) that guarantee valid JSON via constrained decoding.

```typescript
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

const response = await client.messages.parse({
  model: "claude-sonnet-4-6",
  max_tokens: 4096,
  system: systemPrompt,
  messages: [{ role: "user", content: userMessage }],
  output_config: { format: zodOutputFormat(ClassificationSchema) }
});
const classification = response.parsed_output; // type-safe, no JSON.parse
```

**Caveats:** First request with new schema has extra latency (grammar compilation, 24hr cache). Max 24 optional parameters. Not compatible with message prefilling. Adds `zod` dependency (~60KB).

**Recommendation:** Strong upgrade for `callClaude<T>()` path (classify, verify, generate). Eliminates `stripCodeFences()`, JSON parse retry, and "Return ONLY valid JSON" reinforcement prompt.

### Date Handling: No Library Needed

- Current usage: `new Date().toISOString()` for timestamps, `Date.now()` for timing. All correct.
- **Latent bug:** Classify prompt has timeline bands ("6+ weeks out") but never tells Claude today's date. Claude guesses from training cutoff.
- **Fix:** `new Date().toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles', ... })` — native Intl API, no library needed.
- **date-fns recommended only if** code-level date math is needed later. Not needed for prompt injection.

### better-sqlite3: Current Migration Pattern is Fine

- WAL mode + foreign keys correctly configured.
- Column-check migration pattern is solid for additive-only schema changes.
- No migration needed for `past_date_detected` — it lives in `classification_json` TEXT blob.
- If you ever need column renames or type changes, switch to version table pattern.

### Built-in SDK Retry

- Default 2 retries for transient errors (connection, rate limit, 5xx). Not currently configured. Default is fine; consider 3 for production.

### System Prompt Caching

- `system` parameter can accept array of content blocks instead of single string. Static portions get cached, dynamic portions change per request. Potential cost/latency optimization for verify and generate stages.
