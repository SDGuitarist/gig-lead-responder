import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { postCheckDrafts } from "./pipeline/post-check.js";

// Every example line ("> ...") in a doc the model can be shown must itself pass
// the post-check that drafts face; otherwise the docs teach the model to fail.
// Found 2026-10-03: the ported Bolero playbook said "investment" 5 times.
const LOADED_DOCS = ["RESPONSE_CRAFT.md", "PRICING_TABLES.md", "PRINCIPLES.md", "LEAD_RESPONSE_VOICE.md",
  "CULTURAL_SPANISH_LATIN.md", "CULTURAL_CORE.md", "EVENT_STRUCTURE_THEORY.md", "Bolero_Trio_Negotiation_Playbook.md", "QUICK_REFERENCE.md"];

test("example lines in loaded docs pass the post-check", () => {
  const context = readFileSync("src/pipeline/context.ts", "utf-8");
  const loaded = [...context.matchAll(/readDoc\("([^"]+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(loaded, [...LOADED_DOCS].sort(), "control: this list must match what selectContext loads");
  let scanned = 0;
  const failing: string[] = [];
  for (const doc of LOADED_DOCS) {
    readFileSync(`docs/${doc}`, "utf-8").split("\n").forEach((line, i) => {
      if (!line.startsWith(">")) return;
      scanned++;
      const v = postCheckDrafts(line.replace(/^>\s?/, ""), "ok").violations.filter((x) => x.includes("full"));
      if (v.length) failing.push(`${doc}:${i + 1} ${v.join("; ")}`);
    });
  }
  assert.ok(scanned > 50, `control: scanned ${scanned} example lines`);
  assert.deepEqual(failing, []);
});
