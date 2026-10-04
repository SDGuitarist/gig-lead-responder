import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildVerifyPrompt } from "./prompts/verify.js";
import type { Classification } from "./types.js";

// Port manifest R256/R258: verify grades components present vs excellent,
// using the Component Quality Standards table from docs/VERIFICATION.md verbatim.
const c = { action: "quote", format_requested: "guitarist", format_recommended: "solo", delivery_mode: "alex_performs",
  flagged_concerns: [], cultural_context_active: false, timeline_band: "comfortable", vagueness: "clear", platform: "yelp",
  venue_name: null, client_first_name: null, stealth_premium_signals: [], context_modifiers: [] } as unknown as Classification;

test("verify grades present vs excellent with the VERIFICATION.md table", () => {
  const p = buildVerifyPrompt(c, { budget: { tier: "none" } });
  assert.ok(p.includes("Is this the best version, or just a version?"));
  const doc = readFileSync("docs/VERIFICATION.md", "utf-8").split("\n");
  const rows = doc.slice(doc.findIndex((l) => l.startsWith("### Component Quality Standards"))).filter((l) => l.startsWith("| **")).slice(0, 7);
  assert.equal(rows.length, 7, "control: found the 7 component rows");
  for (const r of rows) assert.ok(p.includes(r), r.slice(0, 40));
});
