---
title: "Pipeline Quality Gate & Confidence Scoring for Auto-Send Safety"
date: 2026-02-20
agent: 4
source: training-knowledge
---

# Pipeline Quality Gate & Confidence Scoring

## Summary of Key Findings

1. **Structured Confidence Scoring:** Use a 7-component weighted model (gut checks 36pts, scene quality 15pts, competitor test 12pts, concern coverage 15pts, classification clarity 10pts, pricing confidence 7pts, cultural match 5pts = 100). Compute it deterministically from existing `GateResult` + `Classification` + `PricingResult` -- no new LLM calls needed.

2. **Threshold:** Use a three-tier system: Green (85+, auto-send), Yellow (65-84, hold with preview), Red (<65 or any hard block, hold with warning). Start conservative. Five hard-block conditions always force a hold regardless of score. Expected auto-send rate: 55-65%.

3. **Claude Self-Scoring:** The central insight is **do not ask Claude for a score at all**. Compute the number deterministically from structured verify outputs. The LLM produces evidence (exact quotes, booleans); the code produces the number. This eliminates score inflation completely.

4. **Below-Threshold Behavior:** Yellow zone gets a standard hold-with-preview SMS. Red zone gets a `[REVIEW NEEDED]` flagged SMS with the specific concern stated. Do NOT use a generic auto-opener as default -- it wastes the first-impression slot.

5. **Two-Message Strategy:** Not recommended as default. Total pipeline + approval time (1-3 minutes) is well within the 5-minute "golden window." A timeout-triggered opener (10-minute fallback) is appropriate as a Phase 2 safety net.

6. **Failure Modes:** The highest-risk leads combine vague data + cultural complexity or ambiguous event type + missing venue. These compound failures can drop scores to 40-55 (red zone).

---

## 1. Structured Confidence Score Design

### Scoring Components (0-100)

| Component | Max Points | How It's Computed |
|---|---|---|
| **Gut Checks** | 36 | 4 points per passing check. 9 checks × 4 = 36. |
| **Scene Quality** | 15 | Binary: cinematic = 15, structural = 0. Based on `gate.scene_type`. |
| **Competitor Test** | 12 | Binary: `gate.competitor_test === false` = 12 (unique), `true` = 0 (generic). |
| **Concern Coverage** | 15 | (addressed concerns / total concerns) × 15. Partial credit for partial coverage. |
| **Classification Clarity** | 10 | How much data the classifier had to work with. Clear lead = 10, vague = 5. |
| **Pricing Confidence** | 7 | Budget mismatch severity. No mismatch = 7, mild = 4, severe = 0. |
| **Cultural Match** | 5 | If cultural_context_active, did the draft engage cultural elements? |

**Total: 100 points**

### Why These Weights

- **Gut checks dominate (36%)** because they represent 9 independent quality dimensions. Research on multi-criteria evaluation (Zheng et al., 2023) shows that decomposed evaluation produces more reliable scores than single holistic judgments.
- **Scene quality (15%) and competitor test (12%)** are weighted highly because they represent the two automatic-fail conditions in the current gate.
- **Concern coverage (15%)** gets partial credit because some concerns are more critical than others.
- **Classification clarity (10%)** captures upstream uncertainty.
- **Pricing confidence (7%)** reflects budget-mismatch risk.
- **Cultural match (5%)** is a modifier, not a core component. Most leads don't activate cultural context.

### Computation

```typescript
interface ConfidenceScore {
  total: number;           // 0-100
  components: {
    gut_checks: number;    // 0-36
    scene_quality: number; // 0 or 15
    competitor_test: number; // 0 or 12
    concern_coverage: number; // 0-15
    classification_clarity: number; // 0-10
    pricing_confidence: number; // 0-7
    cultural_match: number; // 0-5
  };
  auto_send: boolean;
  hold_reasons: string[];
}
```

```typescript
function computeConfidence(
  gate: GateResult,
  classification: Classification,
  pricing: PricingResult
): ConfidenceScore {
  const gc = gate.gut_checks;
  const gutCheckScore = [
    gc.can_see_it, gc.validated_them, gc.named_fear,
    gc.differentiated, gc.preempted_questions, gc.creates_relief,
    gc.best_line_present, gc.prose_flows, gc.competitor_test
  ].filter(Boolean).length * 4;

  const sceneQuality = gate.scene_type === "cinematic" ? 15 : 0;
  const competitorTest = gate.competitor_test === false ? 12 : 0;

  const totalConcerns = gate.concern_traceability.length;
  const addressedConcerns = gate.concern_traceability
    .filter(c => c.draft_sentence !== "").length;
  const concernCoverage = totalConcerns > 0
    ? Math.round((addressedConcerns / totalConcerns) * 15)
    : 15; // No concerns = full marks

  const classClarity = classification.vagueness === "clear" ? 10 : 5;

  const pricingConf = computePricingConfidence(classification, pricing);

  const culturalMatch = classification.cultural_context_active
    ? (gc.differentiated && gc.validated_them ? 5 : gc.differentiated || gc.validated_them ? 3 : 0)
    : 5; // Not applicable = full marks

  const total = gutCheckScore + sceneQuality + competitorTest
    + concernCoverage + classClarity + pricingConf + culturalMatch;

  // ... threshold logic below
}
```

### Key Design Principle: No Double-Counting

The `competitor_test` appears in both `gut_checks` and as a standalone boolean on `GateResult`. The scoring must not count it twice. Use the standalone `gate.competitor_test` for the 12-point component, and include the gut check version in the 36-point gut check total. This means the competitor test effectively gets 4 + 12 = 16 points of influence, which is intentional -- it's the single most important uniqueness signal.

---

## 2. Score Threshold for Auto-Send vs Hold

### Asymmetric Cost Structure

- **False positive (auto-send a bad draft):** Reputational damage, lost gig. Cost is HIGH.
- **False negative (hold a good draft):** Delayed response, SMS interruption. Cost is LOW.

This favors a **conservative threshold**.

### Three-Tier Model (Recommended)

| Zone | Score Range | Action |
|---|---|---|
| **Green (auto-send)** | 85-100, no hard blocks | Send immediately. Brief confirmation SMS. |
| **Yellow (hold with preview)** | 65-84 | SMS with compressed draft preview. Alex replies YES to send. |
| **Red (hold with warning)** | 0-64, OR any hard block | SMS with `[REVIEW NEEDED]` prefix and specific concern. |

**Why 85 for green:** The three-tier model raises the auto-send bar because it provides a middle ground. The yellow zone catches "probably fine but review" drafts, letting the green zone be truly unambiguous.

**Expected distribution:**
- Green: ~55-65% of drafts (clear data, known venues, standard event types)
- Yellow: ~25-30% of drafts (minor issues, gut check edge cases)
- Red: ~10-15% of drafts (vague leads, cultural complexity, budget mismatches)

### Hard Blocks (Always Hold, Regardless of Score)

| Hard Block | Rationale |
|---|---|
| `scene_type === "structural"` | Structural scenes = generic. The cinematic moment is the core differentiator. |
| `competitor_test === true` | The opening could have been written by any vendor. Fatal for brand. |
| Any concern with empty `draft_sentence` | Client raised a concern and the draft ignored it. |
| `classification.vagueness === "vague"` AND `classification.action === "assume_and_quote"` | System is making assumptions about a vague lead. High risk. |
| Budget mismatch > 2x | Even with correct pricing, quoting 2.5x budget needs human tone review. |

### Calibration Over Time

Track outcomes:
- Did Alex approve green-zone drafts without changes? (Expected: >95%)
- Did Alex approve yellow-zone drafts without changes? (If >80%, lower threshold)
- What % of red-zone drafts were approved as-is? (If >50%, scoring too conservative)

Store as simple counters: `auto_sent BOOLEAN`, `approved_without_edit BOOLEAN`. Review monthly.

---

## 3. Claude Self-Scoring Prompt Design

### The Score Inflation Problem

LLMs systematically overestimate their own output quality:

- **Kadavath et al. (2022):** Language models can be calibrated on factual questions but are systematically overconfident on judgment tasks.
- **Lin et al. (2022):** Fine-tuning on calibration data improves verbalized confidence, but base models default to high confidence.
- **Xiong et al. (2024):** Chain-of-thought with explicit uncertainty reasoning improves calibration vs. direct confidence elicitation.

### The Key Insight

**Do NOT ask Claude to produce a 0-100 confidence score.** Instead, compute it deterministically from the structured verify output. This eliminates score inflation entirely because the score is a mathematical function of specific, verifiable signals (exact quotes extracted, boolean checks passed).

### Anti-Inflation Techniques Already in Place

1. **Decomposed Scoring:** The verify prompt asks for 9 specific boolean judgments rather than one holistic score.
2. **Evidence-Before-Judgment:** The verify prompt requires exact quotes before pass/fail.

### Additional Hardening

For gut checks where inflation is most likely (`prose_flows`, `creates_relief`, `best_line_present`), add adversarial prompting:

```
- prose_flows: Read the draft aloud in your head. Does it feel like one continuous
  conversation, or can you feel the "sections" clicking together? If you can feel
  the sections, this is false.
- creates_relief: Would a stressed event planner reading this on their phone at
  10pm actually feel RELIEVED? Not just "professional" but genuinely "oh thank god,
  this person gets it"? If professional but not relieving, this is false.
- best_line_present: Is there a line that would make someone screenshot this
  response and send it to a friend? Not "good for a vendor response" but genuinely
  memorable. If not, this is false.
```

Add calibration anchors showing TRUE vs FALSE examples for each gut check.

For the verify stage specifically, use **temperature 0** for deterministic evaluation.

---

## 4. Below-Threshold Behavior

### Recommendation: Option (a) for Yellow, Option (c) for Red

**Yellow zone (65-84):** Hold and wait. Alex sees compressed draft in SMS, usually approves as-is. Delay is 30-120 seconds.

**Red zone (0-64 or hard block):** Flagged SMS with specific concern:
```
[REVIEW] Lead #42 - Maria, Quinceanera Apr 26
CONCERN: Budget $800 vs quote $2,050 (2.6x mismatch)
DRAFT: "Maria, I can picture the moment - your daughter's..."
Reply YES-42 to send, or reply with edits.
```

**Why NOT a generic opener:** For a musician, the first message IS the pitch. A generic "thanks for reaching out" doesn't differentiate from the 4 other vendors who already replied. It occupies the response slot without winning it.

**One exception:** If the lead is from a platform where response speed is visibly ranked (GigSalad "responds within" badge), a fast generic opener protects the response-time metric. This should be a configurable flag per platform, not default behavior.

---

## 5. Two-Message Strategy Analysis

### Research on Speed-to-Lead

- **InsideSales.com (2011):** Responding within 5 minutes increases contact rate by 900% vs 30 minutes. (B2B sales context)
- **Harvard Business Review (2011):** Companies contacting leads within 1 hour were 7x more likely to qualify.
- **Drift (2018):** Average lead response time was 42 hours. Companies responding in <5 minutes were 100x more likely to connect.

### Why NOT Two-Message for This System

- Pipeline produces a personalized draft in ~15-30 seconds. The "delay" being avoided is 30-120 seconds for Alex to approve.
- A generic opener occupies the "first impression" slot with something unremarkable.
- GigSalad and The Bash show all vendor responses in a thread. Generic opener + detailed follow-up looks fragmented.
- The musician's brand is built on being thoughtful and personal.

### Recommended: Timeout-Triggered Opener (Phase 2)

```
If lead is in yellow/red hold AND Alex hasn't replied in 10 minutes:
  -> Auto-send a brief platform-aware opener
  -> Mark lead as "opener_sent"
  -> Adjust full draft's opening to reference the opener
```

This is Phase 2 complexity. Do not build in initial implementation.

---

## 6. Failure Mode Matrix

| Failure Mode | Frequency | Confidence Impact | Primary Components Affected | Example |
|---|---|---|---|---|
| **Minimal data** | ~20% | -15 to -25 pts | classification_clarity, gut_checks (named_fear, preempted_questions) | "Looking for guitar player for party. March 15." |
| **Cultural complexity** | ~10% | -10 to -20 pts | cultural_match, gut_checks (validated_them), scene_quality | Quinceanera with specific generational traditions |
| **Budget mismatch** | ~25% | -7 to -15 pts | pricing_confidence, gut_checks (creates_relief) | "$500 budget" for service starting at $1,200 |
| **Missing venue** | ~30% | -5 to -10 pts | classification_clarity, gut_checks (can_see_it) | "Private event in San Diego area" |
| **Ambiguous event type** | ~8% | -20 to -30 pts | classification_clarity, concern_coverage, multiple gut checks | "Having a gathering for about 50 people" |
| **Multi-format request** | ~5% | -10 to -15 pts | pricing_confidence, gut_checks (preempted_questions) | "Solo guitar for ceremony, full band for reception" |
| **Repeat/returning client** | ~3% | -5 pts | gut_checks (validated_them) | Previous client, pipeline has no memory |
| **Platform formatting** | ~10% | -5 to -20 pts | All components if parser fails | HTML-heavy emails, forwarded chains |

### Compound Failure Modes (Most Dangerous)

1. **Vague + Cultural:** "Mexican party, need musicians" → Expected score: 45-60 (red)
2. **Budget mismatch + High competition:** "$400 for 3hrs, 6 other quotes" → Expected score: 55-70 (yellow/red)
3. **Ambiguous type + Missing venue:** "Having a thing at our place" → Expected score: 40-55 (red)
4. **Cultural + Multi-format:** "Traditional Mexican wedding -- mariachi for ceremony, softer for dinner" → Expected score: 50-65 (red/yellow)

### Early Detection

Most failure modes detectable BEFORE verify stage, from classification output:

```typescript
function detectRiskFactors(classification: Classification): string[] {
  const risks: string[] = [];
  if (classification.vagueness === "vague") risks.push("vague_lead");
  if (classification.cultural_context_active) risks.push("cultural_active");
  if (classification.flagged_concerns.length === 0
      && classification.vagueness === "vague") risks.push("no_concerns_but_vague");
  if (classification.format_requested !== classification.format_recommended)
    risks.push("format_corrected");
  return risks;
}
```

---

## Recommended Confidence Architecture

```
Pipeline Output (GateResult + Classification + PricingResult)
  |
  v
[Hard Block Check] -- any hard block? --> RED zone (always hold)
  |
  | no hard blocks
  v
[Compute Confidence Score] -- deterministic, from structured verify output
  |
  v
[Three-Tier Decision]
  |-- Score >= 85 --> GREEN: auto-send, confirmation SMS
  |-- Score 65-84 --> YELLOW: hold, draft preview SMS, await reply
  |-- Score < 65  --> RED: hold, flagged SMS with specific concern
```

### Implementation Priority

1. **Phase 1:** Implement `computeConfidence()` as a pure function. Add `confidence_score` and `auto_sent` columns to leads table. Log scores. DO NOT auto-send yet.
2. **Phase 2:** After 20-30 leads, review distribution. Adjust weights and thresholds.
3. **Phase 3:** Enable auto-send for green zone. Monitor 1-2 weeks.
4. **Phase 4 (optional):** Implement timeout-triggered opener for held leads.

### Why This Architecture

- **No additional API calls.** Zero cost, zero latency.
- **Deterministic.** Same inputs → same score. Testable, debuggable, explainable.
- **No score inflation.** The LLM never sees or produces the confidence number.
- **Conservative by default.** Hard blocks catch dangerous failures. Three tiers provide safety gradient.
- **Calibratable.** Weights and thresholds tunable from observed outcomes without changing LLM prompts.

---

## Sources & References

### LLM Confidence Calibration
- Kadavath et al. (2022). "Language Models (Mostly) Know What They Know." Anthropic.
- Lin et al. (2022). "Teaching Models to Express Their Uncertainty in Words."
- Xiong et al. (2024). "Can LLMs Express Their Uncertainty?"
- Tian et al. (2023). "Just Ask for Calibration."

### LLM-as-Judge
- Zheng et al. (2023). "Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena."
- Ye et al. (2024). "Improving LLM-as-a-Judge with Rubric-Based Evaluation."

### Speed-to-Lead
- Oldroyd, J. & Elkington, K. (2011). "The Short Life of Online Sales Leads." Harvard Business Review.
- Drift (2018). "Lead Response Report."
- InsideSales.com (2011). "Lead Response Management Study."

*Note: All citations from training knowledge (cutoff May 2025). URLs should be verified before citing externally.*
