import type { Format } from "../types.js";

export interface RateEntry {
  anchor: number;
  floor: number;
}

export interface TierRates {
  T1?: RateEntry;
  T2P: RateEntry;
  T2D: RateEntry;
  T3P: RateEntry;
  T3D: RateEntry;
}

export interface FormatRates {
  [durationKey: string]: TierRates;
}

// --- Solo (Spanish Guitar / Latin) ---
// Source: Rate_Card_Solo_Duo.md — April 2026 ($500 floor enforced)
export const SOLO_RATES: FormatRates = {
  "1": {
    T1: { anchor: 500, floor: 500 },
    T2P: { anchor: 550, floor: 500 },
    T2D: { anchor: 595, floor: 550 },
    T3P: { anchor: 600, floor: 550 },
    T3D: { anchor: 650, floor: 595 },
  },
  "2": {
    T1: { anchor: 500, floor: 500 },
    T2P: { anchor: 595, floor: 550 },
    T2D: { anchor: 700, floor: 650 },
    T3P: { anchor: 795, floor: 750 },
    T3D: { anchor: 895, floor: 795 },
  },
  "3": {
    T1: { anchor: 500, floor: 500 },
    T2P: { anchor: 750, floor: 700 },
    T2D: { anchor: 895, floor: 795 },
    T3P: { anchor: 895, floor: 895 },
    T3D: { anchor: 1200, floor: 1000 },
  },
  "4": {
    T1: { anchor: 500, floor: 500 },
    T2P: { anchor: 950, floor: 900 },
    T2D: { anchor: 1100, floor: 1000 },
    T3P: { anchor: 1250, floor: 1100 },
    T3D: { anchor: 1500, floor: 1400 },
  },
};

// --- Duo (Guitar + Second Musician) ---
// Source: Rate_Card_Solo_Duo.md
export const DUO_RATES: FormatRates = {
  "1": {
    T1: { anchor: 700, floor: 700 },
    T2P: { anchor: 950, floor: 850 },
    T2D: { anchor: 1100, floor: 1000 },
    T3P: { anchor: 1050, floor: 950 },
    T3D: { anchor: 1200, floor: 1100 },
  },
  "2": {
    T1: { anchor: 700, floor: 700 },
    T2P: { anchor: 1100, floor: 1000 },
    T2D: { anchor: 1300, floor: 1200 },
    T3P: { anchor: 1495, floor: 1325 },
    T3D: { anchor: 1700, floor: 1500 },
  },
  "3": {
    T1: { anchor: 700, floor: 700 },
    T2P: { anchor: 1400, floor: 1275 },
    T2D: { anchor: 1700, floor: 1500 },
    T3P: { anchor: 1700, floor: 1575 },
    T3D: { anchor: 2200, floor: 1900 },
  },
  "4": {
    T1: { anchor: 700, floor: 700 },
    T2P: { anchor: 1750, floor: 1575 },
    T2D: { anchor: 2100, floor: 1900 },
    T3P: { anchor: 2200, floor: 1925 },
    T3D: { anchor: 2800, floor: 2450 },
  },
};

// --- Flamenco Duo (Guitar + Cajón) ---
// Source: Rate_Card_Solo_Duo.md — specialty cultural premium
export const FLAMENCO_DUO_RATES: FormatRates = {
  "1": {
    T1: { anchor: 750, floor: 750 },
    T2P: { anchor: 950, floor: 850 },
    T2D: { anchor: 1100, floor: 1000 },
    T3P: { anchor: 1200, floor: 1100 },
    T3D: { anchor: 1400, floor: 1250 },
  },
  "2": {
    T1: { anchor: 750, floor: 750 },
    T2P: { anchor: 1100, floor: 1000 },
    T2D: { anchor: 1350, floor: 1200 },
    T3P: { anchor: 1595, floor: 1400 },
    T3D: { anchor: 1895, floor: 1700 },
  },
  "3": {
    T1: { anchor: 750, floor: 750 },
    T2P: { anchor: 1400, floor: 1275 },
    T2D: { anchor: 1700, floor: 1500 },
    T3P: { anchor: 1895, floor: 1750 },
    T3D: { anchor: 2400, floor: 2100 },
  },
  "4": {
    T1: { anchor: 750, floor: 750 },
    T2P: { anchor: 1750, floor: 1575 },
    T2D: { anchor: 2100, floor: 1900 },
    T3P: { anchor: 2350, floor: 2100 },
    T3D: { anchor: 2995, floor: 2650 },
  },
};

// --- Flamenco Trio (Guitar + Cajón + Dancer) — Hybrid model ---
// Source: Rate_Card_Trio_Ensemble.md — B2C Hybrid pricing
export const FLAMENCO_TRIO_RATES: FormatRates = {
  "1": {
    T1: { anchor: 1200, floor: 1200 },
    T2P: { anchor: 1500, floor: 1400 },
    T2D: { anchor: 1700, floor: 1500 },
    T3P: { anchor: 1700, floor: 1575 },
    T3D: { anchor: 1900, floor: 1750 },
  },
  "2": {
    T1: { anchor: 1200, floor: 1200 },
    T2P: { anchor: 1500, floor: 1400 },
    T2D: { anchor: 1700, floor: 1500 },
    T3P: { anchor: 1800, floor: 1650 },
    T3D: { anchor: 2000, floor: 1850 },
  },
  "3": {
    T1: { anchor: 1200, floor: 1200 },
    T2P: { anchor: 1800, floor: 1650 },
    T2D: { anchor: 2100, floor: 1900 },
    T3P: { anchor: 2200, floor: 2000 },
    T3D: { anchor: 2500, floor: 2300 },
  },
  "3.5": {
    T1: { anchor: 1200, floor: 1200 },
    T2P: { anchor: 2400, floor: 2200 },
    T2D: { anchor: 2800, floor: 2500 },
    T3P: { anchor: 2800, floor: 2600 },
    T3D: { anchor: 3300, floor: 2900 },
  },
};

// --- Mariachi 4-Piece (Weekday) ---
// Source: Rate_Card_Trio_Ensemble.md — B2C pricing
export const MARIACHI_4PIECE_RATES: FormatRates = {
  "1": {
    T2P: { anchor: 650, floor: 600 },
    T2D: { anchor: 750, floor: 700 },
    T3P: { anchor: 800, floor: 750 },
    T3D: { anchor: 900, floor: 850 },
  },
  "2": {
    T2P: { anchor: 1200, floor: 1100 },
    T2D: { anchor: 1350, floor: 1250 },
    T3P: { anchor: 1450, floor: 1350 },
    T3D: { anchor: 1650, floor: 1500 },
  },
  "3": {
    T2P: { anchor: 1750, floor: 1600 },
    T2D: { anchor: 1950, floor: 1800 },
    T3P: { anchor: 2050, floor: 1900 },
    T3D: { anchor: 2350, floor: 2150 },
  },
};

// --- Mariachi Full Ensemble (Weekend, 8-10 Players) ---
// Source: Rate_Card_Trio_Ensemble.md — B2C San Diego County
export const MARIACHI_FULL_RATES: FormatRates = {
  "2": {
    T2P: { anchor: 1800, floor: 1650 },
    T2D: { anchor: 1900, floor: 1750 },
    T3P: { anchor: 1950, floor: 1850 },
    T3D: { anchor: 2100, floor: 2000 },
  },
  "3": {
    T2P: { anchor: 2700, floor: 2500 },
    T2D: { anchor: 2850, floor: 2650 },
    T3P: { anchor: 2925, floor: 2800 },
    T3D: { anchor: 3150, floor: 2950 },
  },
  "4": {
    T2P: { anchor: 3600, floor: 3300 },
    T2D: { anchor: 3800, floor: 3500 },
    T3P: { anchor: 3900, floor: 3700 },
    T3D: { anchor: 4200, floor: 3900 },
  },
};

// --- Bolero Trio ---
// Source: Rate_Card_Bolero_Trio.md — B2C pricing
export const BOLERO_TRIO_RATES: FormatRates = {
  "1": {
    T2P: { anchor: 917, floor: 850 },
    T2D: { anchor: 1007, floor: 925 },
    T3P: { anchor: 1100, floor: 1000 },
    T3D: { anchor: 1200, floor: 1100 },
  },
  "1.5": {
    T2P: { anchor: 1376, floor: 1275 },
    T2D: { anchor: 1520, floor: 1400 },
    T3P: { anchor: 1650, floor: 1500 },
    T3D: { anchor: 1800, floor: 1650 },
  },
  "2": {
    T2P: { anchor: 1834, floor: 1700 },
    T2D: { anchor: 2013, floor: 1850 },
    T3P: { anchor: 2200, floor: 2000 },
    T3D: { anchor: 2400, floor: 2200 },
  },
  "3": {
    T2P: { anchor: 2645, floor: 2450 },
    T2D: { anchor: 2875, floor: 2700 },
    T3P: { anchor: 3185, floor: 2900 },
    T3D: { anchor: 3450, floor: 3150 },
  },
};

// --- Flamenco Trio Full (Guitar + Cajón + Dancer entire duration) ---
// Source: Rate_Card_Trio_Ensemble.md — B2C Full pricing
export const FLAMENCO_TRIO_FULL_RATES: FormatRates = {
  "1": {
    T1: { anchor: 1200, floor: 1200 },
    T2P: { anchor: 1500, floor: 1400 },
    T2D: { anchor: 1700, floor: 1500 },
    T3P: { anchor: 1700, floor: 1575 },
    T3D: { anchor: 1900, floor: 1750 },
  },
  "2": {
    T1: { anchor: 1200, floor: 1200 },
    T2P: { anchor: 1800, floor: 1600 },
    T2D: { anchor: 2100, floor: 1900 },
    T3P: { anchor: 2200, floor: 2000 },
    T3D: { anchor: 2495, floor: 2200 },
  },
  "3": {
    T1: { anchor: 1200, floor: 1200 },
    T2P: { anchor: 2200, floor: 2000 },
    T2D: { anchor: 2600, floor: 2300 },
    T3P: { anchor: 2600, floor: 2400 },
    T3D: { anchor: 3000, floor: 2700 },
  },
  "3.5": {
    T1: { anchor: 1200, floor: 1200 },
    T2P: { anchor: 2400, floor: 2200 },
    T2D: { anchor: 2800, floor: 2500 },
    T3P: { anchor: 2800, floor: 2600 },
    T3D: { anchor: 3300, floor: 2900 },
  },
};

// --- Sourced Cultural Solo (any tradition, $200/hr musician cost) ---
// Source: Rate_Card_Solo_Duo.md — Sourced Cultural Music section
export const SOURCED_CULTURAL_SOLO_RATES: FormatRates = {
  "1": {
    T2P: { anchor: 550, floor: 500 },
    T2D: { anchor: 600, floor: 550 },
    T3P: { anchor: 650, floor: 575 },
    T3D: { anchor: 700, floor: 625 },
  },
  "2": {
    T2P: { anchor: 595, floor: 550 },
    T2D: { anchor: 700, floor: 650 },
    T3P: { anchor: 750, floor: 695 },
    T3D: { anchor: 895, floor: 795 },
  },
  "3": {
    T2P: { anchor: 850, floor: 775 },
    T2D: { anchor: 950, floor: 875 },
    T3P: { anchor: 1050, floor: 950 },
    T3D: { anchor: 1200, floor: 1100 },
  },
};

// --- Sourced Cultural Duo (any tradition, $400/hr musician cost) ---
// Source: Rate_Card_Solo_Duo.md — Sourced Cultural Music section
export const SOURCED_CULTURAL_DUO_RATES: FormatRates = {
  "1": {
    T2P: { anchor: 600, floor: 550 },
    T2D: { anchor: 700, floor: 650 },
    T3P: { anchor: 750, floor: 700 },
    T3D: { anchor: 895, floor: 800 },
  },
  "2": {
    T2P: { anchor: 1150, floor: 1050 },
    T2D: { anchor: 1300, floor: 1200 },
    T3P: { anchor: 1400, floor: 1275 },
    T3D: { anchor: 1600, floor: 1450 },
  },
  "3": {
    T2P: { anchor: 1650, floor: 1500 },
    T2D: { anchor: 1850, floor: 1700 },
    T3P: { anchor: 1995, floor: 1825 },
    T3D: { anchor: 2295, floor: 2100 },
  },
};

// --- Sourced Cultural Trio (any tradition, $600/hr musician cost) ---
// Source: Rate_Card_Trio_Ensemble.md — Sourced Cultural Music section
export const SOURCED_CULTURAL_TRIO_RATES: FormatRates = {
  "1": {
    T2P: { anchor: 850, floor: 775 },
    T2D: { anchor: 950, floor: 875 },
    T3P: { anchor: 1000, floor: 900 },
    T3D: { anchor: 1100, floor: 1000 },
  },
  "2": {
    T2P: { anchor: 1595, floor: 1450 },
    T2D: { anchor: 1750, floor: 1600 },
    T3P: { anchor: 1800, floor: 1650 },
    T3D: { anchor: 2000, floor: 1850 },
  },
  "3": {
    T2P: { anchor: 2300, floor: 2100 },
    T2D: { anchor: 2500, floor: 2300 },
    T3P: { anchor: 2600, floor: 2400 },
    T3D: { anchor: 2895, floor: 2650 },
  },
};

// --- Sourced Cultural Quartet (any tradition, $800/hr musician cost) ---
// Source: Rate_Card_Trio_Ensemble.md — Sourced Cultural Music section
export const SOURCED_CULTURAL_QUARTET_RATES: FormatRates = {
  "1": {
    T2P: { anchor: 1100, floor: 1000 },
    T2D: { anchor: 1250, floor: 1150 },
    T3P: { anchor: 1350, floor: 1250 },
    T3D: { anchor: 1500, floor: 1375 },
  },
  "2": {
    T2P: { anchor: 2100, floor: 1925 },
    T2D: { anchor: 2400, floor: 2200 },
    T3P: { anchor: 2500, floor: 2300 },
    T3D: { anchor: 2895, floor: 2650 },
  },
  "3": {
    T2P: { anchor: 3100, floor: 2825 },
    T2D: { anchor: 3400, floor: 3100 },
    T3P: { anchor: 3600, floor: 3300 },
    T3D: { anchor: 4100, floor: 3750 },
  },
};

// --- Sourced Cultural 5-Piece (any tradition, $1000/hr musician cost) ---
// Source: Rate_Card_Trio_Ensemble.md — Sourced Cultural Music section
export const SOURCED_CULTURAL_5PIECE_RATES: FormatRates = {
  "1": {
    T2P: { anchor: 1395, floor: 1275 },
    T2D: { anchor: 1500, floor: 1375 },
    T3P: { anchor: 1600, floor: 1475 },
    T3D: { anchor: 1800, floor: 1650 },
  },
  "2": {
    T2P: { anchor: 2695, floor: 2450 },
    T2D: { anchor: 2895, floor: 2650 },
    T3P: { anchor: 3100, floor: 2850 },
    T3D: { anchor: 3495, floor: 3200 },
  },
  "3": {
    T2P: { anchor: 3895, floor: 3550 },
    T2D: { anchor: 4200, floor: 3850 },
    T3P: { anchor: 4500, floor: 4100 },
    T3D: { anchor: 4995, floor: 4550 },
  },
};

// --- Master lookup: format string → rate table ---
export const RATE_TABLES: Record<Format, FormatRates> = {
  solo: SOLO_RATES,
  duo: DUO_RATES,
  flamenco_duo: FLAMENCO_DUO_RATES,
  flamenco_trio: FLAMENCO_TRIO_RATES,
  flamenco_trio_full: FLAMENCO_TRIO_FULL_RATES,
  mariachi_4piece: MARIACHI_4PIECE_RATES,
  mariachi_full: MARIACHI_FULL_RATES,
  bolero_trio: BOLERO_TRIO_RATES,
  sourced_cultural_solo: SOURCED_CULTURAL_SOLO_RATES,
  sourced_cultural_duo: SOURCED_CULTURAL_DUO_RATES,
  sourced_cultural_trio: SOURCED_CULTURAL_TRIO_RATES,
  sourced_cultural_quartet: SOURCED_CULTURAL_QUARTET_RATES,
  sourced_cultural_5piece: SOURCED_CULTURAL_5PIECE_RATES,
};
