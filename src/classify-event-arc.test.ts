import { test } from "node:test";
import assert from "node:assert/strict";
import { buildClassifyPrompt } from "./prompts/classify.js";
import { normalizeEventArc } from "./pipeline/classify.js";

// Port manifest F7: classify names the event's arc so selectContext can load
// EVENT_STRUCTURE_THEORY.md. The model's value is parsed once at the boundary:
// anything outside the four arcs becomes null.
test("classify event arc: prompt asks for it", () => {
  const p = buildClassifyPrompt("2026-10-03");
  assert.ok(p.includes('"event_arc": "wedding" | "corporate" | "private_celebration" | "memorial" | null'));
});

test("classify event arc: values outside the four arcs become null", () => {
  for (const ok of ["wedding", "corporate", "private_celebration", "memorial"]) assert.equal(normalizeEventArc(ok), ok);
  for (const bad of [undefined, null, "", "Wedding", "birthday", 3]) assert.equal(normalizeEventArc(bad), null);
});
