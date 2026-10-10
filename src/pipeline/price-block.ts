import { clientTotal, inKindSentence } from "./price.js";
import type { Classification, PricingResult } from "../types.js";

// Plan 2026-10-09 (app-inserted price block). Codex round 3 (NP2) graded the prose price-line detector the wrong
// shape: no detector can tell "I can make $695 work for 2 hours" from Alex's price line. So on a one-price NP2
// draft the model writes ONE marker line, [[PRICE: <format in plain words>]], and the app replaces it with the
// price line and Alex's in-kind sentence (Alex: NP2 only; the model names the format; every number is the app's).

// The included clause is true only for formats Alex performs (port manifest R301).
const ALEX_PERFORMS: ReadonlySet<string> = new Set(["solo", "duo", "flamenco_duo", "flamenco_trio", "flamenco_trio_full"]);

export interface PriceBlock { tail: string; inKind: string }

// Everything after the format name on a price line: "$695, 2 hours | Professional sound, ...". The ONE builder:
// the generate prompt's PRICE LINE section and the inserted block both use it.
export function priceLineTail(pricing: Pick<PricingResult, "travel" | "format">, price: number, hours: number): string {
  const included = ALEX_PERFORMS.has(pricing.format) ? " | Professional sound, setup and breakdown, repertoire shaped to their event" : "";
  return `$${clientTotal(pricing, price)}, ${hours} hour${hours === 1 ? "" : "s"}${included}`;
}

// A block exactly when the draft carries the in-kind line (inKindSentence: one-price NP2 only).
export function priceBlockFor(classification: Pick<Classification, "venue_name" | "organization_name">,
  pricing: PricingResult): PriceBlock | null {
  const inKind = inKindSentence(classification, pricing);
  return inKind ? { tail: priceLineTail(pricing, pricing.quote_price, pricing.duration_hours), inKind } : null;
}

// A marker counts only as a WHOLE line; inside a sentence it is left in place and the post-check holds the draft.
const MARKER_LINE = /^\s*\[\[PRICE:([^\]\n]*)\]\]\s*$/;
// Any letter (Codex plan round 1: "Guitarra española"), no digits, $, | or brackets: no number reaches the price
// line through the name.
export const FORMAT_NAME = /^\p{L}[\p{L} '&-]{0,39}$/u;

// Replace exactly one valid marker line with "<name>, <tail>" + the in-kind line. Anything else (no marker, two,
// a bad name) leaves the draft unchanged, so the post-check holds it for Alex: never a guessed price line.
export function insertPriceBlock(draft: string, block: PriceBlock | null): string {
  if (!block) return draft;
  const lines = draft.split("\n");
  const at = lines.flatMap((l, i) => (MARKER_LINE.test(l) ? [i] : []));
  if (at.length !== 1) return draft;
  const name = (MARKER_LINE.exec(lines[at[0]])?.[1] ?? "").trim();
  if (!FORMAT_NAME.test(name)) return draft;
  lines.splice(at[0], 1, `${name}, ${block.tail}`, block.inKind);
  return lines.join("\n");
}
