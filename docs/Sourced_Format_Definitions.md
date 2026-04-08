# Sourced Format Definitions — Pipeline Implementation Reference

**Purpose:** All sourced/ensemble format types and their rates, structured for implementation in the Claude Code gig lead responder pipeline. Every format the pipeline cannot currently auto-price is defined here.

**For:** Claude Code pipeline — add these as Format types with rate lookup tables.

**Source of truth:** Rate_Card_Solo_Duo.md (sourced solo/duo), Rate_Card_Trio_Ensemble.md (trio+, flamenco trio, mariachi), Rate_Card_Bolero_Trio.md (bolero trio)

---

## Detection Logic

The pipeline already classifies tier (T1/T2/T3) and lead source (Platform/Direct). The missing piece is detecting **sourced format type** from the lead request. Use these signals:

| Lead Request Contains | Format Type |
|---|---|
| "mariachi" + weekend or 75+ guests or "full" | `mariachi_full` |
| "mariachi" + weekday or "small" or under 50 guests | `mariachi_4piece` |
| "bolero trio" or "romantic trio" + Mexican/Latin heritage | `bolero_trio` |
| "flamenco trio" or "flamenco group" or "flamenco band" | `flamenco_trio` (hybrid default) |
| "flamenco" + "dancer for full event" or "dancer the whole time" | `flamenco_trio_full` |
| "Hawaiian" or "ukulele" or "Polynesian" (solo) | `sourced_cultural_solo` |
| "Hawaiian" or "Celtic" or "Indian" etc. (duo/group of 2) | `sourced_cultural_duo` |
| Any cultural tradition + "trio" or "3 musicians" | `sourced_cultural_trio` |
| Any cultural tradition + "quartet" or "4 musicians" | `sourced_cultural_quartet` |
| Any cultural tradition + "5-piece" or "band" or "5 musicians" | `sourced_cultural_5piece` |
| "Latin band" or "ensemble" (ambiguous size) | Default to `sourced_cultural_trio`, flag for review |

**Delivery Mode:** All formats below are `Alex Sources` or `Hybrid`. The pipeline should set `deliveryMode: "sourced"` for all of these.

---

## Guardrails (Apply to All Sourced Formats)

```
minimumBookingFloor: 500
minimumProfitPerBooking: 150
holidayPremium: { solo_duo: "10-15%", trio_ensemble: "10%", full_ensemble: "5-10%", maxAddition: 250 }
travelModifier: { outsideSDCounty: [250, 300], LACounty: [500, 800] }
```

---

## Format: `sourced_cultural_solo`

**Description:** Any cultural tradition sourced at $200/hr per musician. One musician.
**Musician cost:** $200/hr
**Traditions:** Hawaiian, Polynesian, Indian, Persian, Somalian, Italian, Celtic, and any other.

### B2C Rates (Anchor / Floor)

| Duration | T2P | T2D | T3P | T3D |
|---|---|---|---|---|
| 1 hr | 550 / 500 | 600 / 550 | 650 / 575 | 700 / 625 |
| 2 hrs | 595 / 550 | 700 / 650 | 750 / 695 | 895 / 795 |
| 3 hrs | 850 / 775 | 950 / 875 | 1050 / 950 | 1200 / 1100 |

### B2B Residency Rates

| Duration | Weekly | Bi-weekly | Monthly |
|---|---|---|---|
| 2 hrs (cost $400) | 550 | 625 | 700 |
| 3 hrs (cost $600) | 775 | 875 | 975 |

---

## Format: `sourced_cultural_duo`

**Description:** Any cultural tradition sourced at $200/hr per musician. Two musicians.
**Musician cost:** $400/hr
**Traditions:** Same as sourced_cultural_solo.

### B2C Rates (Anchor / Floor)

| Duration | T2P | T2D | T3P | T3D |
|---|---|---|---|---|
| 1 hr | 600 / 550 | 700 / 650 | 750 / 700 | 895 / 800 |
| 2 hrs | 1150 / 1050 | 1300 / 1200 | 1400 / 1275 | 1600 / 1450 |
| 3 hrs | 1650 / 1500 | 1850 / 1700 | 1995 / 1825 | 2295 / 2100 |

### B2B Residency Rates

| Duration | Weekly | Bi-weekly | Monthly |
|---|---|---|---|
| 2 hrs (cost $800) | 1050 | 1175 | 1300 |
| 3 hrs (cost $1200) | 1500 | 1675 | 1850 |

---

## Format: `sourced_cultural_trio`

**Description:** Any cultural tradition sourced at $200/hr per musician. Three musicians.
**Musician cost:** $600/hr

### B2C Rates (Anchor / Floor)

| Duration | T2P | T2D | T3P | T3D |
|---|---|---|---|---|
| 1 hr | 850 / 775 | 950 / 875 | 1000 / 900 | 1100 / 1000 |
| 2 hrs | 1595 / 1450 | 1750 / 1600 | 1800 / 1650 | 2000 / 1850 |
| 3 hrs | 2300 / 2100 | 2500 / 2300 | 2600 / 2400 | 2895 / 2650 |

### B2B Residency Rates

| Duration | Weekly | Bi-weekly | Monthly |
|---|---|---|---|
| 2 hrs | 1550 | 1700 | 1850 |
| 3 hrs | 2200 | 2400 | 2600 |

---

## Format: `sourced_cultural_quartet`

**Description:** Any cultural tradition sourced at $200/hr per musician. Four musicians.
**Musician cost:** $800/hr

### B2C Rates (Anchor / Floor)

| Duration | T2P | T2D | T3P | T3D |
|---|---|---|---|---|
| 1 hr | 1100 / 1000 | 1250 / 1150 | 1350 / 1250 | 1500 / 1375 |
| 2 hrs | 2100 / 1925 | 2400 / 2200 | 2500 / 2300 | 2895 / 2650 |
| 3 hrs | 3100 / 2825 | 3400 / 3100 | 3600 / 3300 | 4100 / 3750 |

### B2B Residency Rates

| Duration | Weekly | Bi-weekly | Monthly |
|---|---|---|---|
| 2 hrs | 2050 | 2250 | 2450 |
| 3 hrs | 2900 | 3175 | 3450 |

---

## Format: `sourced_cultural_5piece`

**Description:** Any cultural tradition sourced at $200/hr per musician. Five musicians.
**Musician cost:** $1000/hr

### B2C Rates (Anchor / Floor)

| Duration | T2P | T2D | T3P | T3D |
|---|---|---|---|---|
| 1 hr | 1395 / 1275 | 1500 / 1375 | 1600 / 1475 | 1800 / 1650 |
| 2 hrs | 2695 / 2450 | 2895 / 2650 | 3100 / 2850 | 3495 / 3200 |
| 3 hrs | 3895 / 3550 | 4200 / 3850 | 4500 / 4100 | 4995 / 4550 |

### B2B Residency Rates

| Duration | Weekly | Bi-weekly | Monthly |
|---|---|---|---|
| 2 hrs | 2550 | 2800 | 3050 |
| 3 hrs | 3600 | 3950 | 4300 |

---

## Format: `bolero_trio`

**Already in pipeline.** No changes needed. See Rate_Card_Bolero_Trio.md.

---

## Format: `mariachi_full`

**Already in pipeline.** No changes needed. See Rate_Card_Trio_Ensemble.md.

**Note:** Has separate out-of-county rates (not just a travel modifier — different base rates with 3-hour minimum). Out-of-county rates are NOT in the pipeline rate table — manual handling required.

---

## Format: `mariachi_4piece`

**Already in pipeline.** No changes needed. See Rate_Card_Trio_Ensemble.md.

---

## Format: `flamenco_trio` (hybrid, default)

**Already in pipeline as `flamenco_trio`.** Maps to hybrid pricing (duo for dinner + dancer for featured portion). No changes needed.

---

## Format: `flamenco_trio_full`

**New.** Dancer for entire duration. Uses separate rate table from hybrid.

### B2C Rates (Anchor / Floor)

| Duration | T1 | T2P | T2D | T3P | T3D |
|---|---|---|---|---|---|
| 1 hr | 1200 | 1500 / 1400 | 1700 / 1500 | 1700 / 1575 | 1900 / 1750 |
| 2 hrs | 1200 | 1800 / 1600 | 2100 / 1900 | 2200 / 2000 | 2495 / 2200 |
| 3 hrs | 1200 | 2200 / 2000 | 2600 / 2300 | 2600 / 2400 | 3000 / 2700 |
| 3.5 hrs | 1200 | 2400 / 2200 | 2800 / 2500 | 2800 / 2600 | 3300 / 2900 |

---

## Implementation Notes

**Rate lookup flow:**
1. Classifier determines `formatType` from lead text (detection logic above)
2. Classifier determines `tier` (T1/T2/T3) and `leadSource` (P/D) — already built
3. Classifier determines `duration` — already built
4. Pipeline looks up rate: `rates[formatType][duration][tier+leadSource]`
5. Competition level determines anchor vs floor — already built

**What the pipeline already handles:** Solo guitar, duo, flamenco duo, flamenco trio (hybrid), mariachi 4-piece, mariachi full, bolero trio. Tier classification. Lead source detection. Competition calibration (anchor vs floor). Duration extraction.

**What was added:** 6 new format types (flamenco_trio_full + 5 sourced cultural). Detection logic to identify sourced formats from lead text. The `deliveryMode` field in the lead record.

**Edge cases to handle:**
- Mariachi full ensemble has separate out-of-county rates (not in pipeline — manual handling)
- Bolero trio supports 1.5-hour duration (only format that does)
- Flamenco trio hybrid has sub-configurations (dancer hours within total hours) — pipeline uses total duration, defaults to 1hr dancer
- Ambiguous "Latin band" or "ensemble" requests should default to `sourced_cultural_trio` and flag for review
- If lead says "flamenco trio," default to `flamenco_trio` (hybrid) unless they explicitly request dancer for full duration

---

*Implementation reference only. Source of truth for rates remains the rate card files. If rates change there, update this document and the pipeline lookup tables.*
