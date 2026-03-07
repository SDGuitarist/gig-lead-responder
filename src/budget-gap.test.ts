import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { detectBudgetGap } from "./pipeline/price.js";

// --- detectBudgetGap: input validation ---

describe("detectBudgetGap — input validation", () => {
  it("null budget → tier: none", () => {
    const result = detectBudgetGap(null, 550, "solo", 2, "T2D");
    assert.equal(result.tier, "none");
  });

  it("negative budget → tier: none", () => {
    const result = detectBudgetGap(-500, 550, "solo", 2, "T2D");
    assert.equal(result.tier, "none");
  });

  it("zero budget → tier: none", () => {
    const result = detectBudgetGap(0, 550, "solo", 2, "T2D");
    assert.equal(result.tier, "none");
  });

  it("NaN budget → tier: none", () => {
    const result = detectBudgetGap(NaN, 550, "solo", 2, "T2D");
    assert.equal(result.tier, "none");
  });

  it("budget >= 100000 → tier: none", () => {
    const result = detectBudgetGap(100_000, 550, "solo", 2, "T2D");
    assert.equal(result.tier, "none");
  });
});

// --- detectBudgetGap: gap tiers ---

describe("detectBudgetGap — gap tiers", () => {
  // These tests use synthetic floor values to exercise gap thresholds only.
  it("budget at floor → tier: none (gap = 0)", () => {
    const result = detectBudgetGap(500, 500, "solo", 2, "T2D");
    assert.equal(result.tier, "none");
  });

  it("budget above floor → tier: none", () => {
    const result = detectBudgetGap(600, 500, "solo", 2, "T2D");
    assert.equal(result.tier, "none");
  });

  it("gap $50 → tier: small", () => {
    const result = detectBudgetGap(500, 550, "solo", 2, "T2D");
    assert.equal(result.tier, "small");
    assert.equal((result as { gap: number }).gap, 50);
  });

  it("gap exactly $74 → tier: small (boundary)", () => {
    const result = detectBudgetGap(476, 550, "solo", 2, "T2D");
    assert.equal(result.tier, "small");
    assert.equal((result as { gap: number }).gap, 74);
  });

  it("gap $75, scope-down floor too high → no_viable_scope", () => {
    // Synthetic floor 500 creates gap = 75 (in large range)
    // Scope-down: Solo 1hr T2D floor = 550 (rates.ts). 550 >= 425 + 75 = 500? Yes → null
    const result = detectBudgetGap(425, 500, "solo", 2, "T2D");
    assert.notEqual(result.tier, "small"); // NOT small — 75 is past the threshold
    assert.equal(result.tier, "no_viable_scope");
    assert.equal((result as { gap: number }).gap, 75);
  });

  it("gap $75 with successful scope-down → tier: large", () => {
    // Synthetic floor 600 creates gap = 75
    // Scope-down: Solo 2hr T2P floor = 550 (rates.ts). 550 >= 525 + 75 = 600? No → alt returned
    const result = detectBudgetGap(525, 600, "solo", 3, "T2P");
    assert.equal(result.tier, "large");
    assert.equal((result as { gap: number }).gap, 75);
    const alt = (result as { scoped_alternative: { duration_hours: number; price: number } }).scoped_alternative;
    assert.equal(alt.duration_hours, 2);
    assert.equal(alt.price, 550);
  });

  it("gap $200, scope-down floor too high → no_viable_scope", () => {
    // Synthetic floor 600 creates gap = 200
    // Scope-down: Solo 2hr T2P floor = 550 (rates.ts). 550 >= 400 + 75 = 475? Yes → null
    const result = detectBudgetGap(400, 600, "solo", 3, "T2P");
    assert.equal(result.tier, "no_viable_scope");
    assert.equal((result as { gap: number }).gap, 200);
  });

  it("gap $201 → tier: no_viable_scope", () => {
    // Synthetic floor 600 creates gap = 201 (above max large threshold)
    const result = detectBudgetGap(399, 600, "solo", 3, "T2P");
    assert.equal(result.tier, "no_viable_scope");
    assert.equal((result as { gap: number }).gap, 201);
  });
});

// --- detectBudgetGap: scope-down edge cases ---

describe("detectBudgetGap — scope-down", () => {
  it("duo at 2hr with large gap → no_viable_scope (scope-down 1hr floor $850 too high for $450 budget)", () => {
    // Synthetic floor 600. Budget = 450 → gap = 150 (large range)
    // Scope-down: Duo 1hr T2P floor = 850 (rates.ts). 850 >= 450 + 75 = 525? Yes → null
    const result = detectBudgetGap(450, 600, "duo", 2, "T2P");
    assert.equal(result.tier, "no_viable_scope");
    assert.equal((result as { gap: number }).gap, 150);
  });

  it("solo at 1hr → no_viable_scope (no shorter duration)", () => {
    // Synthetic floor 400. Budget = 325 → gap = 75 (large range)
    // Already at minimum duration → no scope-down available
    const result = detectBudgetGap(325, 400, "solo", 1, "T2P");
    assert.equal(result.tier, "no_viable_scope");
    assert.equal((result as { gap: number }).gap, 75);
  });

  it("scoped alternative uses same tier_key", () => {
    // Synthetic floor 600 creates gap = 100
    // Scope-down: Solo 2hr T2P floor = 550 (rates.ts). 550 >= 500 + 75 = 575? No → alt returned
    const result = detectBudgetGap(500, 600, "solo", 3, "T2P");
    assert.equal(result.tier, "large");
    const alt = (result as { scoped_alternative: { duration_hours: number; price: number } }).scoped_alternative;
    assert.equal(alt.duration_hours, 2);
    assert.equal(alt.price, 550); // Solo 2hr T2P: floor = 550 (rates.ts)
  });

  it("scoped alternative price is floor, not anchor", () => {
    // Synthetic floor 700 creates gap = 100
    // Scope-down: Solo 2hr T2D anchor = 700, floor = 650 (rates.ts). 650 >= 600 + 75 = 675? No → alt returned
    const result = detectBudgetGap(600, 700, "solo", 3, "T2D");
    assert.equal(result.tier, "large");
    const alt = (result as { scoped_alternative: { duration_hours: number; price: number } }).scoped_alternative;
    assert.equal(alt.price, 650); // Floor (rates.ts), not anchor
  });
});

// --- Near-miss tolerance (NEAR_MISS_TOLERANCE = 75) ---

describe("detectBudgetGap — near-miss tolerance", () => {
  // All use Solo 2hr T2D → scope-down to 1hr T2D floor = 550 (rates.ts)

  it("$500 budget vs $550 1hr floor (gap $50 < tolerance $75) → large", () => {
    // Budget $500 vs 1hr T2D floor $550 — gap $50 is within tolerance $75,
    // so scope-down succeeds. (rates.ts: solo 1hr T2D floor = 550)
    const result = detectBudgetGap(500, 650, "solo", 2, "T2D");
    assert.equal(result.tier, "large");
    const alt = (result as { scoped_alternative: { duration_hours: number; price: number } }).scoped_alternative;
    assert.equal(alt.price, 550);
    assert.equal(alt.duration_hours, 1);
  });

  it("$476 budget vs $550 1hr floor (gap $74 < tolerance $75) → large", () => {
    // Budget $476 + tolerance $75 = $551 > floor $550 — just barely
    // passes the near-miss check. (rates.ts: solo 1hr T2D floor = 550)
    const result = detectBudgetGap(476, 650, "solo", 2, "T2D");
    assert.equal(result.tier, "large");
    const alt = (result as { scoped_alternative: { duration_hours: number; price: number } }).scoped_alternative;
    assert.equal(alt.price, 550);
  });

  it("$475 budget vs $550 1hr floor (gap $75 = tolerance) → no_viable_scope", () => {
    // Budget $475 + tolerance $75 = $550 = floor $550 — exact tolerance,
    // scope-down fails. (rates.ts: solo 1hr T2D floor = 550)
    const result = detectBudgetGap(475, 650, "solo", 2, "T2D");
    assert.equal(result.tier, "no_viable_scope");
    assert.equal((result as { gap: number }).gap, 175);
  });

  it("$350 budget at 1hr, no shorter duration available → no_viable_scope", () => {
    // Synthetic floor 450. Budget = 350 → gap = 100 (large range)
    // Already at 1hr — no shorter duration available for scope-down
    const result = detectBudgetGap(350, 450, "solo", 1, "T2D");
    assert.equal(result.tier, "no_viable_scope");
    assert.equal((result as { gap: number }).gap, 100);
  });
});

// --- Security: adversarial budget values ---

describe("detectBudgetGap — security edge cases", () => {
  it("injection string parsed as number (400) → normal processing", () => {
    // Security property: sanitized injection value enters normal processing.
    // Scope-down: Solo 1hr T2D floor = 550 (rates.ts). 550 >= 400 + 75 = 475? Yes → no_viable_scope
    const result = detectBudgetGap(400, 500, "solo", 2, "T2D");
    assert.equal(result.tier, "no_viable_scope"); // normal processing (tier depends on current rates)
  });

  it("-500 → tier: none", () => {
    const result = detectBudgetGap(-500, 500, "solo", 2, "T2D");
    assert.equal(result.tier, "none");
  });

  it("$0 → tier: none", () => {
    const result = detectBudgetGap(0, 500, "solo", 2, "T2D");
    assert.equal(result.tier, "none");
  });

  it("$999999999 → tier: none", () => {
    const result = detectBudgetGap(999_999_999, 500, "solo", 2, "T2D");
    assert.equal(result.tier, "none");
  });
});
