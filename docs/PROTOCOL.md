# PROTOCOL.md
## Pacific Flow Entertainment — Lead Analysis Decision Flow

**Purpose:** Classify leads and determine response parameters. Execute Steps 0-5 before writing.

**Line count target:** ~200 lines

---

## When a Lead Arrives

Execute these steps in order. Each step builds on the previous.

---

## Step 0: Capability Check

**If Alex submitted the lead, he can fulfill it.**

Do not question whether Pacific Flow can deliver the requested genre, format, or configuration. This step exists to prevent self-sabotage.

→ See PRINCIPLES.md → "Capability Trust"

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

→ For specific rates: See PRICING.md

**Wedding Modifier:** If wedding/ceremony/reception mentioned, apply wedding pricing tier (per PRICING.md). This applies regardless of competition level—weddings warrant premium positioning even in high-competition scenarios.

**State:** [Price Point] based on [Competition] × [Premium Signals]

---

## Step 4: Tier Classification

### Premium Tier (ANY ONE triggers)

- Iconic/luxury venue (per VENUE_INTEL.md)
- Corporate at upscale property
- "Ready to book ASAP" + detailed logistics
- 25+ guests at high-end setting
- Stealth Premium signals present

### Qualification Tier (ANY ONE triggers)

- Budget mismatch (low budget + big request)
- Vague request missing key details (AND low competition)
- Placeholder numbers that don't reflect reality

### Standard Tier

- None of the above
- Clear request with realistic expectations

**If Qualification Tier:** Response strategy shifts to reframe or pre-qualify. See RESPONSE_CRAFT.md → "Qualification Responses."

**State:** [Tier] + [Wedding Modifier Y/N]

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

## Analysis Summary Format

After completing Steps 0-5, state:

```
ANALYSIS SUMMARY
----------------
Mode: [Confirmation / Evaluation]
Competition: [Level] ([X] quotes)
Vagueness: [Clear / Vague] → [Action]
Stealth Premium: [Y/N]
Price Point: [Full premium / Slight premium / At market / Below market]
Tier: [Premium / Standard / Qualification]
Wedding Modifier: [Y/N]
Timeline: [Band] → [Close Type]
Cultural Signals: [Note any present — detailed in RESPONSE_CRAFT.md Step 6]
Flagged Concerns: [List — addressed in RESPONSE_CRAFT.md Step 7]
```

**Then proceed to RESPONSE_CRAFT.md for Steps 6-10.**

---

## Post-Draft Verification (Step 11)

After drafting, before delivering:

### Verification Checklist

**Classification checks:**
- [ ] Mode correctly identified?
- [ ] Competition level noted and weighted?
- [ ] Stealth Premium signals checked?
- [ ] Tier appropriate to signals?

**Pricing checks:**
- [ ] Price matches competition × premium matrix?
- [ ] Wedding modifier applied if applicable?

**Quality checks:**
→ See PRINCIPLES.md → "Quality Standard" (the 4 checks)

**Format checks:**
- [ ] Full Draft within word count for tier?
- [ ] Compressed Draft under target for competition level?
- [ ] ONE clear close included?
- [ ] Contact block present?

→ For word count targets: See QUICK_REFERENCE.md

---

## Cross-References

| Need | Location |
|------|----------|
| Writing execution (Steps 6-10) | RESPONSE_CRAFT.md |
| Core principles and quality standard | PRINCIPLES.md |
| Word counts, close types, matrices | QUICK_REFERENCE.md |
| Pricing by format | PRICING.md |
| Venue classification | VENUE_INTEL.md |
| Cultural signal routing | See table in Project Instructions |

---

*This file handles classification. For writing the response, proceed to RESPONSE_CRAFT.md.*
