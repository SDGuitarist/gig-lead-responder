import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { lookupTravelFee } from "./travel-fee.js";

// The ZIP table used to live in the gitignored /data/ folder, so every
// deploy and fresh clone had no table and every travel lookup missed.
test("travel fee table is tracked in git and loads", () => {
  const tracked = execFileSync("git", ["ls-files", "src/data/zip_distances.json"], { encoding: "utf-8" }).trim();
  assert.equal(tracked, "src/data/zip_distances.json");
  const r = lookupTravelFee("85320");
  assert.equal(r.type, "hit");
});
