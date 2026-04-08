# PRICING.md
## Pacific Flow Entertainment — Pricing Router & Qualification Tools

**Purpose:** Bridge between lead classification (PROTOCOL.md) and rate cards. Contains tier mapping, budget qualification language, and quote formatting guidance. **No dollar amounts live here — all rates are in the rate cards.**

---

## Tier Bridge: Lead Classification → Rate Card Tier

The lead response system classifies leads by response behavior (how to write). The rate cards classify by buyer type (what to charge). This bridge connects them.

### Step 1: Determine Delivery Mode

Before selecting a rate card tier, determine how the lead will be fulfilled. Delivery Mode (from PROTOCOL.md → Step 0.5) determines which rate card rows apply.

| Delivery Mode | Rate Card Rows | Pricing Logic |
|---|---|---|
| **Alex Performs** (solo) | Solo rows in Rate_Card_Solo_Duo.md | 100% margin. Alex keeps everything. |
| **Alex Performs** (duo) | Duo rows in Rate_Card_Solo_Duo.md | 60/40 split. Alex keeps 60%. |
| **Alex Sources** (sourced solo/duo) | Sourced rows in Rate_Card_Solo_Duo.md | $200/hr per musician cost. $150 minimum profit enforced. |
| **Alex Sources** (trio/quartet/5-piece) | Rate_Card_Trio_Ensemble.md | Tradition-specific pricing. $150 minimum profit enforced. |
| **Alex Sources** (bolero trio) | Rate_Card_Bolero_Trio.md | Scarcity pricing. See Bolero_Trio_Negotiation_Playbook.md. |
| **Alex Sources** (mariachi) | Rate_Card_Trio_Ensemble.md (mariachi section) | Mario Eguia's ensemble. Weekend vs weekday pricing differs. |
| **Hybrid** (Alex + sourced) | Ensemble rate card for full configuration | Alex's performance built into ensemble pricing. |

**Sourced pricing rule:** The client pays the client-facing rate regardless of delivery method. Internal economics (musician cost, margin) are invisible to the client. Never present sourced pricing as a markup, coordination fee, or breakdown. Quote the number with the same confidence as a solo guitar quote.

### Step 2: Determine Buyer Tier

| Lead Classification (PROTOCOL.md) | Rate Card Tier | Why |
|---|---|---|
| **Premium** (or Stealth Premium = Yes) | **T3** | Luxury venue, corporate at upscale property, affluent signals — evaluating fit, not price |
| **Standard** | **T2** | Private parties, social events, one-off celebrations — price-conscious, comparing options |
| **Qualification** | **T2** (lower end) | Budget mismatch or vague request — right-size and reframe before quoting |
| **Relationship/Strategic** | **T1** | Recurring revenue potential or strategic venue access — flat rate, investment pricing |

**T4 (Ensemble product tier):** Not a buyer tier. Clients requesting duo/ensemble signal budget capacity — consider whether other signals push them to T3.

### Step 3: Determine Pricing Column

| Lead Source | Column | Why |
|---|---|---|
| **Direct** (alexguillenmusic.com, referral, word-of-mouth) | **D** (Direct) | 80%+ close rate, near-zero competition — anchor high |
| **Platform** (GigSalad, The Bash) | **P** (Platform) | Artificial competition built in — quote toward platform column regardless of other signals |

### Step 4: Calibrate Quote Point (Anchor vs Floor)

Every rate card price is shown as **Anchor / Floor**. Competition level determines where you land.

| Competition Level | Quote Point | Negotiation Room |
|---|---|---|
| **Low (0-3)** | Anchor | Full room to hold |
| **Medium (4-5)** | Anchor | Willing to move toward floor if pushback |
| **High (6-10)** | At or near Floor | Limited room — speed matters more than margin |
| **Extreme (11+)** | Floor | Hold the line — below floor only for T1 strategic value |

### Step 5: Apply Context Modifiers

| Context | Effect |
|---|---|
| **Wedding ceremony** | Use ceremony-specific rates (see Rate_Card_Solo_Duo.md) |
| **Wedding-adjacent** (rehearsal dinner, welcome party, farewell brunch, engagement party) | Carries wedding emotional weight — both families watching. Quote at tier or above. |
| **Premium Venue + Wedding-adjacent combined** | Use the higher of the two rate implications |
| **Holiday/peak dates** (Valentine's, Cinco de Mayo, NYE) | Quoted separately above standard rates. Solo/duo 10-15%, trio/ensemble 10%, full ensemble 5-10%. Total addition should never exceed $250. |
| **Travel outside SD County** | +$250-300 (solo/duo), +$500-800 (LA County). See rate cards for details. |

### The Complete Bridge (Examples)

> Lead: Platform lead, Standard classification, Medium competition, no stealth premium, Alex Performs (solo)
> → Delivery Mode: Alex Performs → Rate_Card_Solo_Duo.md (solo rows)
> → T2 buyer tier + P column + Anchor quote point
> → Find T2P row → Quote the Anchor number

> Lead: Direct lead, Premium classification, Low competition, Stealth Premium = Yes, Alex Sources (mariachi)
> → Delivery Mode: Alex Sources → Rate_Card_Trio_Ensemble.md (mariachi section)
> → T3 buyer tier + D column + Anchor quote point
> → Find T3D row → Quote the Anchor number

> Lead: Platform lead, Standard classification, High competition, Alex Sources (bolero trio)
> → Delivery Mode: Alex Sources → Rate_Card_Bolero_Trio.md
> → T2 buyer tier + P column + Near Floor quote point
> → Find T2P row → Quote near Floor. See Bolero_Trio_Negotiation_Playbook.md for positioning.

---

## Competition-Weighted Pricing Matrix

Use competition level (from PROTOCOL.md Step 2.5) to calibrate price point within the rate card tier.

| Competition | No Premium Signals (T2) | Stealth Premium Present (T3) |
|---|---|---|
| **Low (0-3)** | T2 Anchor | T3 Anchor |
| **Medium (4-5)** | T2 Anchor (flex toward floor) | T3 Anchor |
| **High (6-10)** | T2 near Floor | T3 Anchor (flex toward floor) |
| **Extreme (11+)** | T2 Floor | T3 near Floor |

→ For specific rates: See Rate_Card_Solo_Duo.md, Rate_Card_Trio_Ensemble.md, or Rate_Card_Bolero_Trio.md

---

## Pricing Rules

1. **$500 minimum booking floor.** No booking under $500 regardless of tier, duration, or configuration. T1 relationship rates at $500 require documented strategic value justification.
2. **$150 minimum profit on every booking, no exceptions.** Especially relevant for sourced configurations where musician costs reduce margin. If the math doesn't clear $150, raise the quote or decline.
3. **Quote full hours only.** No 30-minute increments (exception: Bolero Trio 1.5-hour option — see Rate_Card_Bolero_Trio.md).
4. **T3 = single confident number** (the Anchor), not ranges.
5. **T2 = Anchor number presented confidently.** Floor is your walkaway, not your opening offer.
6. **Below Floor only for T1 strategic value.** Never for a one-time client.
7. **Never quote until availability confirmed** (operational — Alex handles).
8. **Sourced pricing is invisible.** Never reveal musician costs, margin structure, or coordination fees to the client. The client-facing rate is the rate. Period.

---

## Sourced Pricing Presentation

**When Delivery Mode = Alex Sources or Hybrid, these rules govern how pricing appears in the response.**

### The Rule

Sourced pricing is tradition-specific, not a subcontracting fallback. The client pays for an experience. The internal economics are invisible.

| Wrong | Right |
|---|---|
| "The mariachi charges $1,400 and my coordination fee brings it to $1,900." | "Traditional mariachi for a 2-hour performance: $1,900." |
| "I'd need to check what the musicians charge and get back to you." | "$2,013 for two hours of authentic bolero trio." |
| "There's an additional fee because I'm coordinating rather than performing." | State the number. No breakdown. No explanation. |
| "I can get you a trio for around $1,500-$2,000 depending on availability." | "$1,750 for a three-piece ensemble, two hours." Single number. |

### When Sourcing Subcontractors

Withhold premium signals from musicians to avoid inflating their pricing:
- Do NOT share venue name (especially luxury venues)
- Do NOT share guest count (especially 150+)
- Do NOT share corporate context or event budget
- DO share: date, time, duration, location (city/neighborhood only), configuration needed

---

## Sourced Configuration Decision Guidance

When a lead requests a sourced configuration, recommend the right format based on event context. This guidance supplements the flamenco trio/duo table below.

### Mariachi: Full Ensemble vs 4-Piece

| Recommend Full Ensemble (8-10) When | Recommend 4-Piece When |
|---|---|
| Weekend event | Weekday event |
| 75+ guests | Under 50 guests |
| Outdoor with space | Indoor or tight space |
| Client said "full mariachi" or "traditional" | Client said "a few mariachi musicians" or "small group" |
| Budget signals $2,000+ | Budget signals under $1,500 |
| Cinco de Mayo, heritage celebration at scale | Intimate dinner, corporate weekday |
| Cultural event where full sound matters | Background ambiance with cultural flavor |

**Position 4-piece as right-sized, not budget alternative:** "For a weekday dinner with 40 guests, a 4-piece mariachi fills the room perfectly without overwhelming conversation. Full ensemble is built for outdoor celebrations at scale."

### Bolero Trio vs Solo Instrumental

| Recommend Bolero Trio When | Recommend Solo Guitar (Bolero Repertoire) When |
|---|---|
| Anniversary, romantic milestone | Cocktail hour background |
| Client specifically said "trio" or "bolero trio" | Client said "romantic guitar" or "Latin background" |
| Budget signals $1,500+ | Budget signals under $1,000 |
| Intimate guest count (under 50) with cultural connection | Mixed audience, no specific cultural connection |
| Lyrics carry emotional weight for this audience | Instrumental warmth is the goal |

**Bridge language:** "If the lyrics are what matters — Bésame Mucho at your parents' table with everyone listening — that's a trio. If it's the warm sound filling the room while people talk, solo guitar with bolero repertoire delivers that beautifully."

### Flamenco Configuration

| Recommend Trio When | Recommend Duo When |
|---|---|
| "Flamenco Group" or "Flamenco Band" requested | Background music emphasis |
| Guests will dance (participatory) | Space under 15' x 6' |
| Spanish/European guests mentioned | Budget is primary concern |
| Two-phase event (dinner → dance) | Cocktail hour or dinner-only |
| "Gypsy Kings" + energy emphasis | |
| Juerga signals present (see CULTURAL_SPANISH_LATIN.md) | |

---

## Budget Qualification Language

### When You Need to Surface Budget

**Vibe question (reveals budget indirectly):**
> "Are you picturing something more intimate and romantic, or livelier with energy to get people moving?"

**Duration question:**
> "Is the [X hours] meant to be a featured moment within a bigger party, or is there flexibility if the right package made sense?"

**Direct budget question (when appropriate):**
> "What range were you hoping to stay within? I might have some options."

### When Budget Is Lower Than Expected

> "I understand—live music is an investment. What range were you hoping for? I might have some options, or I can point you in the right direction either way."

### Reframe Language (Never Say "Cheaper")

| Instead of | Say |
|---|---|
| "That's outside your budget" | "For [their context], [simpler format] actually works better" |
| "Here's a cheaper option" | "A solo fills the space perfectly without overwhelming" |
| "A band is too expensive" | "You don't need a full band to get that warm Latin vibe" |
| "A full mariachi is too much for this space" | "A 4-piece fills a room this size perfectly — full ensemble is built for outdoor celebrations at scale" |

→ See PRINCIPLES.md → "Reframe, Don't Downgrade"

---

## Quote Formatting

### T3 / Premium (Structured, Confident)

Present as a single number with included value:

```
[Format Description] — $[Anchor Number]
Includes professional sound system, all setup/breakdown, and curated repertoire.
```

For trio/ensemble, add extension option:

```
[Ensemble Description] — $[Anchor Number]
Includes [hours], professional sound calibrated for [context], and flexibility for pauses during speeches.
Extension available at $[rate]/half hour.
```

### T2 / Standard (Conversational, Approachable)

Present with confidence but in natural language:

> "For [format] at an event like yours, that typically runs around $[Anchor] for [duration]. Does that work for what you're planning?"

### Sourced / Ensemble (Confident, No Breakdown)

Present identically to Alex-performs pricing. No coordination fee. No musician cost breakdown. Single number.

> "Traditional mariachi (4-piece) for a 2-hour performance: $1,350."

> "Authentic bolero trio for two hours of romantic repertoire: $2,013."

> "A flamenco trio — guitarist, cajón, and dancer — for the evening: $2,100."

**The test:** If the quote reads differently because Alex is sourcing instead of performing, rewrite it. The client should not be able to tell from the pricing format whether Alex is performing or coordinating.

---

## Rate Card Directory

| What You're Quoting | Open This |
|---|---|
| Solo guitar (any style) | Rate_Card_Solo_Duo.md |
| Duo (standard or flamenco) | Rate_Card_Solo_Duo.md |
| Sourced cultural solo or duo | Rate_Card_Solo_Duo.md |
| Flamenco Trio (full or hybrid) | Rate_Card_Trio_Ensemble.md |
| Mariachi (full ensemble or 4-piece) | Rate_Card_Trio_Ensemble.md |
| Sourced cultural trio/quartet/5-piece | Rate_Card_Trio_Ensemble.md |
| Bolero Trio | Rate_Card_Bolero_Trio.md |
| Bolero Trio negotiation/positioning | Bolero_Trio_Negotiation_Playbook.md |
| B2B residency pricing (any format) | Rate_Card_Solo_Duo.md or Rate_Card_Trio_Ensemble.md |

---

## Cross-References

| Need | Location |
|------|----------|
| Lead classification (Steps 0-5) | PROTOCOL.md |
| Delivery Mode assessment | PROTOCOL.md → Step 0.5 |
| Stealth Premium signals | PROTOCOL.md → Step 2.75 |
| Competition level | PROTOCOL.md → Step 2.5 |
| Tier determination | PROTOCOL.md → Step 4 |
| Pre-draft analysis (Steps 6-8) | RESPONSE_CRAFT.md |
| Quote placement in response | DRAFT_METHOD.md → Step 9 |
| Sourced lead drafting rules | DRAFT_METHOD.md → Sourced Lead Drafting |
| Quality gate + output (Steps 10-11) | VERIFICATION.md |
| Flamenco configuration signals | CULTURAL_SPANISH_LATIN.md → Juerga Dynamic |
| Solo & Duo rates | Rate_Card_Solo_Duo.md |
| Trio & Ensemble rates | Rate_Card_Trio_Ensemble.md |
| Bolero Trio rates | Rate_Card_Bolero_Trio.md |
| Bolero negotiation strategy | Bolero_Trio_Negotiation_Playbook.md |

---

*Pricing router and qualification tools. All dollar amounts live in rate cards. For lead classification, see PROTOCOL.md. For response assembly, see RESPONSE_CRAFT.md → DRAFT_METHOD.md → VERIFICATION.md.*
