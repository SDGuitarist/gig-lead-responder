import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { parseCliArgs } from "./cli-args.js";

// Payment terms plan P14: --platform for hand-run leads, validated before the API-key check.
test("P14: parseCliArgs accepts every platform and the existing flags", () => {
  for (const p of ["gigsalad", "thebash", "direct", "yelp", "squarespace"]) {
    assert.deepEqual(parseCliArgs(["--json", "--platform", p]), { ok: true, json: true, verbose: false, platform: p });
  }
  assert.deepEqual(parseCliArgs([]), { ok: true, json: false, verbose: false, platform: undefined });
});

test("P14: an unknown or missing platform value, or an unknown argument, is an error", () => {
  for (const argv of [["--platform", "thumbtack"], ["--platform"], ["--plattform", "gigsalad"]]) {
    assert.equal(parseCliArgs(argv).ok, false, argv.join(" "));
  }
});

test("P14: the CLI rejects --platform thumbtack with usage and exit 2 even with no API key (never calls the model)", () => {
  const r = spawnSync("npx", ["tsx", "src/index.ts", "--platform", "thumbtack"], {
    input: "", encoding: "utf-8", env: { ...process.env, ANTHROPIC_API_KEY: "", DATABASE_PATH: "/dev/null/never.db" },
  });
  assert.equal(r.status, 2, r.stderr);
  assert.match(r.stderr, /usage:/);
});
