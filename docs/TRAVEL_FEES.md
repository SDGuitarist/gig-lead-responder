# TRAVEL_FEES.md
## Pacific Flow Entertainment — Travel Fee Lookup

**Purpose:** Deterministic travel fee calculation for lead responses. Removes travel pricing from AI judgment. Code reads a precomputed lookup file; no live API calls at runtime.

**Architecture:** Distance data is precomputed once into `zip_distances.json` and checked into the Claude Code repo. Lead processing reads the file directly. Zero runtime API cost, zero latency, fully deterministic.

---

## Origin Point

**91911 (Chula Vista, CA)**

All distances are one-way driving miles from this ZIP, calculated once via Google Maps Distance Matrix API during the build step. See `build_zip_distances.py`.

---

## Distance Bands (Authoritative)

| Band | Miles (one-way) | Solo | Duo (client-facing) | Trio (starting) | Quartet+ (starting) |
|------|----------------|------|---------------------|-----------------|---------------------|
| Local | 0–40 | $0 | $0 | $0 | $0 |
| Near | 41–75 | $150 | $275 | $400 | $550 |
| Regional | 76–110 | $300 | $500 | $700 | $950 |
| Far | 111–140 | $500 | $800 | $1,100 | $1,400 |
| Very Far | 141–200 | $750 | $1,150 | $1,500 | $2,000 |
| Overnight | 200+ mi OR total-day-hours >9 | Custom quote + lodging | Custom | Custom | Custom |

**Rule:** One-way distance determines the band. No exceptions, no soft rules, no county overrides.

---

## The Lookup File: `zip_distances.json`

**Format:**
```json
{
  "92101": {"miles": 8.2, "band": "Local"},
  "90210": {"miles": 140.1, "band": "Far"},
  "92253": {"miles": 135.4, "band": "Far"},
  "93101": {"miles": 231.7, "band": "Overnight"}
}
```

**Coverage:** All ZIP codes within ~250 miles of 91911 across CA, NV, and AZ. Roughly 600–800 ZIPs. See build script for generation.

**Rebuild cadence:** Once every ~5 years or when you change origin address. ZIP-to-distance relationships are stable.

---

## Named City Reference (Human Cross-Check Only)

This table is for sanity-checking output during QA. Claude Code reads `zip_distances.json`, not this table.

| City | Approx. miles from 91911 | Band |
|------|-------------------------|------|
| Most of SD County (downtown, La Jolla, Coronado, Del Mar) | 0–35 | Local |
| North County SD (Carlsbad, Oceanside, Encinitas) | 35–55 | Local / Near border |
| Fallbrook | ~65 | Near |
| Temecula | ~70 | Near |
| Dana Point | ~80 | Regional |
| Borrego Springs | ~90 | Regional |
| Laguna Beach | ~90 | Regional |
| Newport Beach | ~95 | Regional |
| Anaheim / Huntington Beach | ~105 | Regional |
| LA (downtown) | ~132 | Far |
| Palm Desert | ~130 | Far |
| Beverly Hills / Pasadena | ~149 | Very Far |
| Palm Springs | ~148 | Very Far |
| Malibu | ~165 | Very Far |
| Santa Barbara | ~230 | Overnight |
| Las Vegas, NV | ~335 | Overnight |
| Phoenix, AZ | ~360 | Overnight |

---

## Duo Travel Split (Fair Version)

Travel fee is charged in addition to base. The 60/40 split on base is unchanged. Travel is handled separately:

**1.** Client pays travel fee from the Duo column above.
**2.** Musician receives a fixed travel stipend off the top:
- Near: $50
- Regional: $100
- Far: $150
- Very Far: $200
**3.** Alex keeps the remainder of the travel fee.

**Worked example — Regional duo, Newport Beach (~95 mi):**
- Client pays: $1,300 base + $500 travel = $1,800 total
- Travel: Musician $100, Alex $400
- Base: 60/40 split → Alex $780, Musician $520
- **Totals: Alex $1,180, Musician $620**

---

## Ensemble Travel (Starting Point + Adjustments)

Trio and Quartet+ figures in the matrix are **starting points**, not firm quotes.

**Adjustments to the starting point:**
- All musicians carpool in one vehicle: no adjustment
- Separate vehicles required: +$75 per additional vehicle
- 5+ musicians OR Very Far band: always custom quote (do not use table)

**Mariachi full ensemble (8 players): always custom quote.**

---

## Overnight Rule

Overnight is required when **any one** of the following is true:

1. One-way distance > 200 miles
2. Total day hours > 9

**Total day hours formula:**
> (round-trip drive time) + (gig duration including setup/breakdown) > 9 hours → overnight required

**Examples:**
- 4-hour gig at Palm Springs (155 mi, ~5.2 hr round-trip): 5.2 + 4 = 9.2 → **overnight**
- 2-hour gig at Palm Springs: 5.2 + 2 = 7.2 → no overnight
- 2-hour gig at Santa Barbara (230 mi, ~7.5 hr round-trip): 7.5 + 2 = 9.5 → **overnight**
- 3-hour gig at Malibu (165 mi, ~5.5 hr round-trip): 5.5 + 3 = 8.5 → no overnight

**When overnight triggers:** Route to custom quote mode. Lodging, per diem, and day rate negotiated per event.

---

## Hard Stops

**Mexico:** Out of scope. Rosarito, Valle de Guadalupe, Ensenada, Tijuana, any Mexican destination → decline or refer. Mexican postal codes are not in `zip_distances.json` by design — lookup failure on a Mexican address should trigger auto-decline.

**Distance > 200 mi without overnight budget:** If client refuses overnight on a 200+ mi gig, decline.

---

## Integration Logic for Claude Code

**Expected input:** Venue address or venue ZIP.

**Sequence:**

1. **Extract ZIP.** If input is a full address, extract the 5-digit ZIP (regex or light geocoding).
2. **Country check.** If address is Mexico or non-US → return `auto_decline: mexico_or_foreign`.
3. **Lookup.** Open `zip_distances.json`. Read entry for the ZIP.
4. **If ZIP found:** Return `{miles, band, solo_fee, duo_fee, trio_starting, quartet_starting}`.
5. **If ZIP not found:** Return `manual_review: zip_not_in_lookup`. Do not guess. Do not hit a live API.
6. **If band = Very Far:** Also check total-day-hours rule. If gig duration known, calculate. If rule triggers, return `overnight_required: true` alongside the fee (so AI knows to flag it in the quote).
7. **If band = Overnight (>200 mi):** Return `custom_quote_required: true`. Do not auto-calculate.

**What the AI does with this:** Takes the returned travel fee, adds it to the base quote, presents one total number to the client. The AI does not recalculate, re-band, or second-guess the lookup.

**What the AI does NOT do:**
- Call Google Maps or any geocoding service at runtime
- Estimate distance from city names
- Override the band based on "feel"

---

## Fallback for Unknown ZIPs

A lead arriving with a ZIP not in `zip_distances.json` is rare but possible (rural destinations, new developments, data entry errors).

**Default behavior:** Flag for manual review. Alex decides.

**Do not:**
- Call the live API from the pipeline (defeats the architecture)
- Estimate from nearby ZIPs (the whole point is determinism)
- Default to "Local / $0 travel" (silent fail mode)

If a missing ZIP keeps coming up, add it to the lookup file and rebuild. Don't add runtime API calls.

---

## Change Log

**v1.1 — April 2026**
- Switched from live API architecture to precomputed `zip_distances.json` lookup
- Eliminated runtime API costs and dependency
- Added explicit fallback rules for unknown ZIPs

**v1.0 — April 2026**
- Initial deterministic travel fee structure
- Origin: 91911 Chula Vista
- 6 distance bands, hard boundaries
- Duo fair split (musician stipend)
- Ensemble starting-point approach
- Overnight rule: 200+ mi OR 9+ total day hours
- Mexico out of scope
