// One price detector for model text that must never carry a price: the strategic
// reserve and follow-up drafts (Codex reserve/auth round 2). Errs toward "price":
// a false hit only drops an insight or rejects a follow-up draft, never sends one.

const UNIT_AFTER = String.raw`(?:guests?|people|persons?|attendees|kids|adults|minutes?|mins?|hours?|hrs?|years?|yrs?|songs?|sets?|miles?|pm|am|p\.m\.|a\.m\.|%|th|st|nd|rd)`;

const PRICE_PATTERNS: RegExp[] = [
  // A currency symbol next to a number: $900, €900, 900€, £ 700.
  /[$€£¥]\s?\d|\d[\d,.]*\s?[€£¥]/,
  // A currency code or word next to a number: USD 900, 900 dollars, 1500 pesos.
  /\b(?:USD|EUR|GBP|MXN)\s?\d|\d[\d,.]*\s*(?:USD|EUR|GBP|MXN|dollars?|bucks|pesos|euros?)\b/i,
  // Price-like phrasing: "for 900", "at 950", "a budget of 1200". Two or more digits, not a
  // time (4:30) and not followed by a unit (120 guests, 40th, 2 hours, 7pm).
  new RegExp(String.raw`\b(?:for|at|only|just|around|about|under|over|of|is|costs?|rate|price|quoted?|budget(?:ed)?)\s+(?:\d{1,3}(?:,\d{3})+|\d{2,})(?:\.\d+)?(?![\d:.,]*\d)(?!\s*${UNIT_AFTER}\b)(?!${UNIT_AFTER}\b)`, "i"),
  // A bare amount right after a budget word: "budgeted 1500".
  /\bbudget(?:ed)?\s+\d{3,}/i,
];

export function mentionsPrice(text: string): boolean {
  return PRICE_PATTERNS.some((p) => p.test(text));
}
