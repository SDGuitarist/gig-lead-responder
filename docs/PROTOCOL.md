# PROTOCOL.md
## Pacific Flow Entertainment — Lead Analysis Decision Flow

**Purpose:** Classify leads and determine response parameters. Execute Steps 0-5 before writing.

**Line count target:** ~250 lines

---

## When a Lead Arrives

Execute these steps in order. Each step builds on the previous.

**⚠️ CRITICAL: Steps 0-5 are CLASSIFICATION ONLY. Classification without response craft is worthless. Do not stop after the Analysis Summary.**

---

## Step 0: Capability Check

**If Alex submitted the lead, he can fulfill it.**

Do not question whether Pacific Flow can deliver the requested genre, format, or configuration. This step exists to prevent self-sabotage.

→ See PRINCIPLES.md → "Capability Trust"

**Proceed to Step 0.5.**

---

## Step 0.5: Delivery Mode Assessment

**Determine HOW this lead will be fulfilled before classifying it.**

Pacific Flow operates two delivery models. The delivery mode affects response voice, transparency language, pricing logic, and which rate card rows apply.

### Alex Performs (AGM Delivery)

Alex is the musician (solo) or leads the ensemble (duo with second musician).

**Signals:**
- Solo guitar requested (any style)
- Duo requested (Alex + one musician)
- Flamenco duo requested (Alex + cajón)
- Client specifically references Alex, his videos, or his profile
- Lead arrived through alexguillenmusic.com or Alex's personal GigSalad/Bash profile

**Rate cards:** Solo/Duo rows in Rate_Card_Solo_Duo.md. Alex keeps 100% (solo) or 60/40 (duo).

### Alex Sources (PFE Delivery)

Alex coordinates musicians from his network. He does not perform.

**Signals:**
- Mariachi requested (any size)
- Bolero trio requested
- Cultural tradition Alex doesn't personally perform (Hawaiian, Persian, Celtic, Indian, etc.)
- Ensemble of 3+ musicians requested
- Client requests a format that requires sourcing (e.g., "Latin band," "5-piece group")
- Alex is unavailable on the date but can source

**Rate cards:** Sourced rows in Rate_Card_Solo_Duo.md (sourced solo/duo), Rate_Card_Trio_Ensemble.md (sourced trio+, flamenco trio, mariachi), or Rate_Card_Bolero_Trio.md.

### Hybrid (Alex Performs + Sourced Musicians)

Alex performs AND coordinates additional sourced musicians for the same event.

**Signals:**
- Flamenco trio (Alex on guitar + sourced cajón + sourced dancer)
- Multi-moment event (Alex solo for ceremony, sourced ensemble for reception)
- Client wants Alex specifically but also wants a larger group

**Rate cards:** Use the ensemble rate card for the full configuration. Alex's performance is built into the ensemble pricing.

### Why This Matters

| | Alex Performs | Alex Sources |
|---|---|---|
| **Response voice** | First person: "I'll be there, I'll calibrate..." | Confident coordinator: "I work with a small group of musicians I know personally..." |
| **Transparency** | Not needed — client is hiring Alex | Required — client should know Alex curates, not performs (see RESPONSE_CRAFT.md → Step 6) |
| **Pricing logic** | Rate_Card_Solo_Duo.md (solo/duo rows) | Rate_Card_Trio_Ensemble.md or sourced rows. $150 minimum profit enforced. |
| **Differentiator** | 30 years, personal credibility, venue experience | Network quality, cultural authenticity, curation expertise |
| **Margin per hour of Alex's time** | $175-$237/hr (performing) | $500-$813/hr (coordinating) |

**State:** [Delivery Mode: Alex Performs / Alex Sources / Hybrid]

**Proceed to Step 1.**

---

## Step 1: Surface Data Extraction

List every explicit field from the lead:

| Field | Extract |
|-------|---------|
| Event type | Wedding, corporate, birthday, cultural celebration, etc. |
| Date | Specific date or date range |
| Time/Duration | Start time, end time, or hours requested |
| Location/Venue | Venue name, city, or "private residence" |
| Guest count | Number or estimate |
| Budget | Stated amount or "not specified" |
| Request | Genre, format, specific artists mentioned |
| Equipment needs | Stated or "not sure yet" |
| Performance location | Indoor, outdoor, specific area |
| Song requests | Specific songs or styles mentioned |
| Additional details | Anything else they wrote |
| Flagged concerns | Outdoor/weather, space, equipment, COI, noise |
| **Competition** | X responded, X quoted (critical for calibration) |
| **Delivery Mode** | Alex Performs / Alex Sources / Hybrid (from Step 0.5) |

**State all extracted fields before proceeding.**

---

## Step 2: Mode Assessment

**Confirmation Mode** — They've decided; they want to book YOU.

| Signals |
|---------|
| Specific song requests or artists named |
| Clear style articulation with personality ("steering away from Ed Sheeran") |
| Knows what they DON'T want |
| High detail throughout form |
| Evidence they've reviewed your profile ("love your videos") |
| "We want to book you" language |

**Evaluation Mode** — They're comparing; you're one of many.

| Signals |
|---------|
| Generic category request ("Musician," "Entertainment") |
| "Not sure yet" on key fields |
| No budget or vague budget |
| No specific vision articulated |
| Form feels like intake, not conversation |

**Note on Sourced Leads:** Evaluation Mode is more common for sourced configurations because clients are often shopping a category ("mariachi," "bolero trio") rather than seeking Alex specifically. This is expected, not a negative signal. The response must convert evaluation into trust through demonstrated cultural knowledge and curation credibility.

**State:** [Confirmation / Evaluation]

---

## Step 2.5: Competition + Vagueness Check

### Competition Level

| Level | Quotes | Implication |
|-------|--------|-------------|
| Low | 0-3 | Room to breathe, can ask one question if needed |
| Medium | 4-5 | Tighten up, limit friction |
| High | 6-10 | Speed matters, no discovery questions |
| Extreme | 11+ | Minimum viable response, close immediately |

### Vagueness Assessment

**Lead is VAGUE when:**
- Request is category-only with no detail
- Duration/timing unclear and would change scope
- Event type ambiguous (background vs. featured moment)
- You genuinely cannot recommend format

**Lead is CLEAR when:**
- You can picture what they need
- You could defend your quote
- Assumptions are reasonable and low-risk

### Decision Gate

| | Low (0-3) | Medium (4-5) | High (6+) |
|---|-----------|--------------|-----------|
| **Clear** | Quote | Quote | Quote fast |
| **Vague** | ONE question | Assume + Quote | Assume + Quote |

**If asking a question:** Make it binary, demonstrate expertise.
- Good: "Background during dinner, or a featured moment people stop to watch?"
- Bad: "What's your budget?" / "What songs do you want?"

**State:** [Competition Level] + [Clear/Vague] → [Action]

---

## Step 2.75: Stealth Premium Check

Sparse forms can hide wealthy clients. Check for hidden value:

| Signal | Check |
|--------|-------|
| Venue | Premium per VENUE_INTEL.md? |
| Guest count | 150+? |
| Location | Affluent zip? (La Jolla, Rancho Santa Fe, Coronado, Del Mar, Carmel Valley) |
| Event type | Premium at scale? (Corporate 100+, fundraiser, wedding at named venue) |
| Buried details | Valet, plated dinner, "black tie," executive audience, VIP? |
| Timing | Saturday evening + named venue? |

**If ANY signal present:** Flag Stealth Premium = Yes

*Why this matters:* Sparse form ≠ small budget. Wealthy clients give minimal detail because they're busy, expect you to figure it out, or don't want to anchor high.

**State:** [Stealth Premium: Y/N]

---

## Step 3: Pricing Strategy

### Competition-Weighted Matrix

| Competition | No Premium Signals | Stealth Premium Present |
|-------------|-------------------|------------------------|
| Low (0-3) | Full premium | Full premium |
| Medium (4-5) | Slight premium | Full premium |
| High (6-10) | At market | Slight premium |
| Extreme (11+) | At/below market | At market (hold the line) |

→ For tier bridge (lead classification → rate card tier): See PRICING.md
→ For specific rates: See Rate_Card_Solo_Duo.md, Rate_Card_Trio_Ensemble.md, or Rate_Card_Bolero_Trio.md

**Context Modifiers:** Wedding ceremony, wedding-adjacent events, holiday/peak dates, and travel all affect pricing. See PRICING.md → "Apply Context Modifiers" for rules.

**Sourced Pricing Note:** When Delivery Mode = Alex Sources, use the sourced rows in the appropriate rate card. Enforce $150 minimum profit per booking, no exceptions. When sourcing subcontractors, withhold premium signals (venue name, guest count, corporate context) to avoid inflating their pricing.

**State:** [Price Point] based on [Competition] × [Premium Signals] → [Rate Card Tier + Column]

---

## Step 4: Tier Classification

### Premium Tier (ANY ONE triggers) → Rate Card T3

- Iconic/luxury venue (per VENUE_INTEL.md)
- Corporate at upscale property
- "Ready to book ASAP" + detailed logistics
- 25+ guests at high-end setting
- Stealth Premium signals present

### Qualification Tier (ANY ONE triggers) → Rate Card T2 (lower end, reframe first)

- Budget mismatch (low budget + big request)
- Vague request missing key details (AND low competition)
- Placeholder numbers that don't reflect reality

### Standard Tier → Rate Card T2

- None of the above
- Clear request with realistic expectations

**State:** [Tier] → [Rate Card Tier] + [Lead Source: P/D]

---

## Step 5: Check Urgency and Timeline

### Urgency Signals

- "Ready to book ASAP"
- "Need to book today"
- "Looking to finalize"
- "Original musician cancelled"
- "Last minute"

### Timeline Bands

| Timeline | Approach |
|----------|----------|
| Comfortable (6+ weeks) | Full assembly, room for dialogue |
| Short (2-4 weeks) | Tighten assembly, lead with availability |
| Urgent (<2 weeks) | Availability first, price immediately |

**If urgent:** Direct Close. No discovery questions. No Social Proof technique.

**State:** [Timeline Band] → [Close Type: Direct / Soft Hold]

---

## Classification Checkpoint (NOT a Deliverable)

After completing Steps 0-5, state the following to establish parameters for response writing:

```
CLASSIFICATION CHECKPOINT
-------------------------
⚠️ STATUS: INCOMPLETE — Response craft required

Delivery Mode: [Alex Performs / Alex Sources / Hybrid]
Mode: [Confirmation / Evaluation]
Competition: [Level] ([X] quotes)
Vagueness: [Clear / Vague] → [Action]
Stealth Premium: [Y/N]
Price Point: [Full premium / Slight premium / At market / Below market]
Tier: [Premium / Standard / Qualification] → Rate Card: [T3 / T2 / T2 lower]
Lead Source: [Platform (P) / Direct (D)]
Context Modifiers: [Wedding ceremony / Wedding-adjacent / Holiday-peak / Travel / None]
Timeline: [Band] → [Close Type]
Cultural Signals: [Note any present — detailed in RESPONSE_CRAFT.md Step 6]
Flagged Concerns: [List — addressed in RESPONSE_CRAFT.md Step 7]

→ PROCEED TO RESPONSE_CRAFT.md Steps 6-8
→ THEN DRAFT_METHOD.md Step 9
→ THEN VERIFICATION.md Steps 10-11
→ DO NOT DELIVER until Verification Gate passes
```

**⚠️ THIS IS A CHECKPOINT, NOT A FINISH LINE.**

Classification tells you WHAT to write. It does not write the response. A lead response requires:

1. ✅ Classification (Steps 0-5) — You are here
2. ⬜ Layer Evaluation (Step 6) — RESPONSE_CRAFT.md
3. ⬜ Flagged Concerns (Step 7) — RESPONSE_CRAFT.md
4. ⬜ Wedge Identification (Step 8) — RESPONSE_CRAFT.md
5. ⬜ Response Drafting (Step 9) — DRAFT_METHOD.md
6. ⬜ Quality Verification (Step 10) — VERIFICATION.md
7. ⬜ Gut Check (Step 11) — VERIFICATION.md
8. ⬜ **Verification Gate PASSED** — VERIFICATION.md

**Do not produce output until Step 11 Verification Gate passes.**

---

## Cross-References

| Need | Location |
|------|----------|
| Pre-draft analysis (Steps 6-8) | RESPONSE_CRAFT.md |
| Writing execution (Step 9) | DRAFT_METHOD.md |
| Quality gate + output (Steps 10-11) | VERIFICATION.md |
| Core principles and quality standard | PRINCIPLES.md |
| Word counts, close types, matrices | QUICK_REFERENCE.md |
| Tier bridge (classification → rate card) | PRICING.md |
| Solo & Duo rates | Rate_Card_Solo_Duo.md |
| Trio & Ensemble rates | Rate_Card_Trio_Ensemble.md |
| Bolero Trio rates | Rate_Card_Bolero_Trio.md |
| Venue classification | VENUE_INTEL.md |
| Cultural signal routing | See table in Project Instructions |

---

*This file handles classification ONLY. For tier → rate card bridge, see PRICING.md. Classification without response craft loses deals. Proceed to RESPONSE_CRAFT.md immediately.*
