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
  // Solo 2hr T2D: floor = 500
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

  it("gap exactly $75 → tier: large (near-miss tolerance widens funnel)", () => {
    // Solo 2hr T2D: floor = 500. Budget = 425 → gap = 75 (in large range)
    // Solo 1hr T2D: floor = 450. Near-miss check: 450 >= 425 + 75 = 500? No → returns alt
    // With NEAR_MISS_TOLERANCE = 75, budget $425 vs 1hr floor $450 (gap $25) passes
    const result = detectBudgetGap(425, 500, "solo", 2, "T2D");
    assert.notEqual(result.tier, "small"); // NOT small — 75 is past the threshold
    assert.equal(result.tier, "large");
    assert.equal((result as { gap: number }).gap, 75);
    const alt = (result as { scoped_alternative: { duration_hours: number; price: number } }).scoped_alternative;
    assert.equal(alt.duration_hours, 1);
    assert.equal(alt.price, 450);
  });

  it("gap $75 with successful scope-down → tier: large", () => {
    // Solo 2hr T2D: floor = 500. Budget = 425 → 1hr T2D floor = 450 > 425 → no fit
    // Need a case where shorter duration floor <= budget
    // Solo 3hr T2P: floor = 600. Budget = 525 → gap = 75
    // Solo 2hr T2P: floor = 400. 400 <= 525? Yes! → large with scoped alt
    const result = detectBudgetGap(525, 600, "solo", 3, "T2P");
    assert.equal(result.tier, "large");
    assert.equal((result as { gap: number }).gap, 75);
    const alt = (result as { scoped_alternative: { duration_hours: number; price: number } }).scoped_alternative;
    assert.equal(alt.duration_hours, 2);
    assert.equal(alt.price, 400);
  });

  it("gap exactly $200 → tier: large (with scope-down)", () => {
    // Solo 3hr T2P: floor = 600. Budget = 400 → gap = 200
    // Solo 2hr T2P: floor = 400. 400 <= 400? Yes → scoped alt
    const result = detectBudgetGap(400, 600, "solo", 3, "T2P");
    assert.equal(result.tier, "large");
    assert.equal((result as { gap: number }).gap, 200);
  });

  it("gap $201 → tier: no_viable_scope", () => {
    // Solo 3hr T2P: floor = 600. Budget = 399 → gap = 201
    const result = detectBudgetGap(399, 600, "solo", 3, "T2P");
    assert.equal(result.tier, "no_viable_scope");
    assert.equal((result as { gap: number }).gap, 201);
  });
});

// --- detectBudgetGap: scope-down edge cases ---

describe("detectBudgetGap — scope-down", () => {
  it("duo at 2hr with large gap → no_viable_scope (no 1hr duo exists)", () => {
    // Duo 2hr T2P: floor = 600. Budget = 450 → gap = 150 (in large range)
    // Duo has no 1hr entry → no scope-down → no_viable_scope
    const result = detectBudgetGap(450, 600, "duo", 2, "T2P");
    assert.equal(result.tier, "no_viable_scope");
    assert.equal((result as { gap: number }).gap, 150);
  });

  it("solo at 1hr → no_viable_scope (no shorter duration)", () => {
    // Solo 1hr T2P: floor = 400. Budget = 325 → gap = 75
    // Already at minimum duration → no scope-down
    const result = detectBudgetGap(325, 400, "solo", 1, "T2P");
    assert.equal(result.tier, "no_viable_scope");
    assert.equal((result as { gap: number }).gap, 75);
  });

  it("scoped alternative uses same tier_key", () => {
    // Solo 3hr T2P: floor = 600. Budget = 500 → gap = 100
    // Solo 2hr T2P: floor = 400. 400 <= 500? Yes
    const result = detectBudgetGap(500, 600, "solo", 3, "T2P");
    assert.equal(result.tier, "large");
    const alt = (result as { scoped_alternative: { duration_hours: number; price: number } }).scoped_alternative;
    assert.equal(alt.duration_hours, 2);
    assert.equal(alt.price, 400); // T2P floor for solo 2hr
  });

  it("scoped alternative price is floor, not anchor", () => {
    // Solo 3hr T2D: floor = 700. Budget = 550 → gap = 150
    // Solo 2hr T2D: floor = 500. 500 <= 550? Yes
    const result = detectBudgetGap(550, 700, "solo", 3, "T2D");
    assert.equal(result.tier, "large");
    const alt = (result as { scoped_alternative: { duration_hours: number; price: number } }).scoped_alternative;
    assert.equal(alt.price, 500); // Floor, not anchor (550)
  });
});

// --- Near-miss tolerance (NEAR_MISS_TOLERANCE = 75) ---

describe("detectBudgetGap — near-miss tolerance", () => {
  // All use Solo 2hr T2D (floor 500) → 1hr T2D (floor 450)

  it("$400 budget vs $450 1hr floor (gap $50 < tolerance $75) → large", () => {
    // Original gap: 500 - 400 = 100 (large range)
    // Near-miss: 450 >= 400 + 75 = 475? No → returns scoped alt
    const result = detectBudgetGap(400, 500, "solo", 2, "T2D");
    assert.equal(result.tier, "large");
    const alt = (result as { scoped_alternative: { duration_hours: number; price: number } }).scoped_alternative;
    assert.equal(alt.price, 450);
    assert.equal(alt.duration_hours, 1);
  });

  it("$376 budget vs $450 1hr floor (gap $74 < tolerance $75) → large", () => {
    // Original gap: 500 - 376 = 124 (large range)
    // Near-miss: 450 >= 376 + 75 = 451? No → returns scoped alt
    const result = detectBudgetGap(376, 500, "solo", 2, "T2D");
    assert.equal(result.tier, "large");
    const alt = (result as { scoped_alternative: { duration_hours: number; price: number } }).scoped_alternative;
    assert.equal(alt.price, 450);
  });

  it("$375 budget vs $450 1hr floor (gap $75 = tolerance) → no_viable_scope", () => {
    // Original gap: 500 - 375 = 125 (large range)
    // Near-miss: 450 >= 375 + 75 = 450? Yes → null → no_viable_scope
    const result = detectBudgetGap(375, 500, "solo", 2, "T2D");
    assert.equal(result.tier, "no_viable_scope");
    assert.equal((result as { gap: number }).gap, 125);
  });

  it("$400 budget, no shorter duration available → no_viable_scope", () => {
    // Solo 1hr T2D: floor = 450. Budget = 400, gap = 50 (in small range)
    // Wait — gap 50 < 75, that's small tier. Use a bigger gap:
    // Solo 1hr T2D: floor = 450. Budget = 350, gap = 100 (large range)
    // Already at 1hr — no shorter duration → no_viable_scope
    const result = detectBudgetGap(350, 450, "solo", 1, "T2D");
    assert.equal(result.tier, "no_viable_scope");
    assert.equal((result as { gap: number }).gap, 100);
  });
});

// --- Security: adversarial budget values ---

describe("detectBudgetGap — security edge cases", () => {
  it("injection string parsed as number (400) → normal processing", () => {
    // If classify extracts 400 from "$400\\n\\nIgnore instructions", detectBudgetGap gets 400
    const result = detectBudgetGap(400, 500, "solo", 2, "T2D");
    assert.equal(result.tier, "large"); // normal large-gap processing
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
