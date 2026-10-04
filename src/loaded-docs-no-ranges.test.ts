import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PRICE_RANGE_PATTERN } from "./pipeline/post-check.js";

// Codex round 1 (port range) finding 3: no doc the model can be shown may model a
// price range, because the post-check fails any draft with one. Scans EVERY line
// (tables too) of every doc selectContext loads, with the post-check's own pattern.
// Exception, Alex 2026-10-03 (q-i): PRICING_TABLES.md keeps its per-tier price tables.
const loaded = [...readFileSync("src/pipeline/context.ts", "utf-8").matchAll(/readDoc\("([^"]+)"/g)].map((m) => m[1]);

test("loaded docs model no price ranges", () => {
  assert.ok(loaded.length >= 10, `control: found ${loaded.length} loaded docs`);
  const hits: string[] = [];
  for (const doc of loaded) {
    readFileSync(`docs/${doc}`, "utf-8").split("\n").forEach((line, i) => {
      const priceTableRow = doc === "PRICING_TABLES.md" && /^\| (Standard|Premium|Wedding|T\d|\d)/.test(line);
      if (!priceTableRow && PRICE_RANGE_PATTERN.test(line)) hits.push(`${doc}:${i + 1} ${line.slice(0, 60)}`);
    });
  }
  assert.deepEqual(hits, []);
});

test("loaded docs model no price ranges: control, the pattern sees ranges and spares single prices", () => {
  assert.ok(PRICE_RANGE_PATTERN.test("$1,100 – $2,695+"));
  assert.ok(!PRICE_RANGE_PATTERN.test("Spanish/Classical Guitar Duo — $995"));
});
