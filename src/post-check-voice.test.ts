import { test } from "node:test";
import assert from "node:assert/strict";
import { postCheckDrafts } from "./pipeline/post-check.js";
import { VOICE_REFERENCES } from "./data/voice-references.js";

// Port manifest F2: the mechanical part of Alex's kill list is code. Words that
// appear in his own converted replies ("Just say the word", "perfect for that")
// are judgment calls for verify, not code bans.
const voice = (full: string, compressed = "Fine.") =>
  postCheckDrafts(full, compressed).violations.filter((v) => v.startsWith("voice_"));

test("voice kill list: banned words and phrases fail", () => {
  for (const bad of ["The guitar lands right as dinner starts.", "It's a seamless evening.", "Here's the thing about patios.",
    "Your special day deserves it.", "Don't miss out on this date.", "My artistry shows.", "A turnkey option.", "In a world where music matters."]) {
    assert.ok(voice(bad).length > 0, bad);
  }
});

test("voice kill list: more than one exclamation mark fails", () => {
  assert.deepEqual(voice("Great! See you there!"), ["voice_exclamations_full: 2"]);
  assert.deepEqual(voice("See you there!"), []);
});

test("voice kill list: control, Alex's own converted replies pass", () => {
  for (const r of VOICE_REFERENCES.filter((x) => x.active)) {
    assert.deepEqual(voice(r.text), [], r.name);
  }
  assert.deepEqual(voice("Just say the word and I'll hold it. Spanish guitar is perfect for that."), []);
});
