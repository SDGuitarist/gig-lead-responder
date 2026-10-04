import { test } from "node:test";
import assert from "node:assert/strict";
import { postCheckDrafts } from "./pipeline/post-check.js";

// Sweep of Codex finding 3 (matching post-check rules): ranges without a second
// "$" passed the post-check. Hours after a price must not count as a range.
const ranged = (text: string) => postCheckDrafts(text, "ok").violations.includes(
  "price_range_in_full: draft uses a price range instead of a single confident number");

test("post-check catches every price range form", () => {
  for (const t of ["around $550-595 for two hours", "$550 to 595", "$550–$595", "$1,100 - $1,300", "$550 to $595"]) {
    assert.ok(ranged(t), t);
  }
});

test("post-check catches every price range form: control, single prices and hours pass", () => {
  for (const t of ["Spanish/Classical Guitar Duo — $995", "$1,100 — 2 hours of music", "$700 for 2-3 songs", "Latin Duo — 2.5 hours: $1,100"]) {
    assert.ok(!ranged(t), t);
  }
});
