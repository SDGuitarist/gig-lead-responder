import { test } from "node:test";
import assert from "node:assert/strict";
import { selectContext } from "./pipeline/context.js";
import { VOICE_REFERENCES } from "./data/voice-references.js";
import type { Classification } from "./types.js";

// Alex 2026-10-03 (Project memory quote-setup-rules): never mention
// battery-powered sound in any quote; it is an unannounced backup. Nothing the
// model is shown may suggest it: loaded docs (every branch) and voice references.
const lead = (format: string, cultural: boolean) =>
  ({ format_recommended: format, cultural_context_active: cultural, cultural_tradition: cultural ? "spanish_latin" : null }) as unknown as Classification;

test("battery never shown to the model: loaded docs on every branch", async () => {
  const withArc = { ...lead("solo", false), event_arc: "wedding" } as Classification;
  for (const c of [lead("solo", false), lead("solo", true), lead("bolero_trio", true), withArc]) {
    const ctx = await selectContext(c);
    assert.ok(ctx.length > 1000, "control: context loaded");
    assert.doesNotMatch(ctx, /batter/i);
  }
});

test("battery never shown to the model: voice references", () => {
  assert.ok(VOICE_REFERENCES.length > 0, "control: references loaded");
  for (const r of VOICE_REFERENCES) assert.doesNotMatch(r.text, /batter/i, r.name);
});
