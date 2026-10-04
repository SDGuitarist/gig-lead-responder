import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PRICE_RANGE_PATTERN } from "./pipeline/post-check.js";

// Codex round 1 (port range) finding 3: no doc the model can be shown may model a
// price range, because the post-check fails any draft with one. Scans EVERY line
// (tables too) of every doc selectContext loads, with the post-check's own pattern.
const loaded = [...readFileSync("src/pipeline/context.ts", "utf-8").matchAll(/readDoc\("([^"]+)"/g)].map((m) => m[1]);

// Reviewed internal-reference lines (not draft wording). Each must still exist;
// any other range line fails until someone reviews it and adds it here.
const ALLOWED: Array<{ doc: string; text: string; why: string }> = [
  { doc: "Bolero_Trio_Negotiation_Playbook.md", text: '"We were hoping for closer to $1,200-1,400..."', why: "what a client says, not what Alex says" },
  { doc: "Bolero_Trio_Negotiation_Playbook.md", text: "or $1,650-1,750 when trio does flex", why: "internal floor note" },
  { doc: "Bolero_Trio_Negotiation_Playbook.md", text: "willing to quote $100-200 less for off-peak", why: "internal flexibility note" },
  { doc: "Bolero_Trio_Negotiation_Playbook.md", text: "commodity trio pricing ($1,200-1,400 range)", why: "competitor context" },
  { doc: "Bolero_Trio_Negotiation_Playbook.md", text: "book after supplier flex ($1,650-1,750 for 2hrs)", why: "internal funnel numbers" },
];

test("loaded docs model no price ranges", () => {
  assert.ok(loaded.length >= 10, `control: found ${loaded.length} loaded docs`);
  const hits: string[] = [];
  for (const doc of loaded) {
    readFileSync(`docs/${doc}`, "utf-8").split("\n").forEach((line, i) => {
      const allowed = ALLOWED.some((a) => a.doc === doc && line.includes(a.text));
      if (!allowed && PRICE_RANGE_PATTERN.test(line)) hits.push(`${doc}:${i + 1} ${line.slice(0, 60)}`);
    });
  }
  assert.deepEqual(hits, []);
});

test("loaded docs model no price ranges: every allowed line still exists", () => {
  for (const a of ALLOWED) assert.ok(readFileSync(`docs/${a.doc}`, "utf-8").includes(a.text), `${a.doc}: ${a.text}`);
});

test("loaded docs model no price ranges: control, the pattern sees ranges and spares single prices", () => {
  assert.ok(PRICE_RANGE_PATTERN.test("$1,100 – $2,695+"));
  assert.ok(!PRICE_RANGE_PATTERN.test("Spanish/Classical Guitar Duo — $995"));
});
