import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

// Controls for the test instrument itself (plan §0.1). Each one spawns the
// runner the way a human would, so they test the real command, not a copy.
// None of these test names may contain a pattern they spawn, or a child run
// would recurse into its parent.

function runMatch(pattern: string, extraEnv: Record<string, string> = {}) {
  const env: NodeJS.ProcessEnv = { ...process.env, ...extraEnv };
  delete env.NODE_TEST_CONTEXT;
  const r = spawnSync(process.execPath, ["scripts/run-tests.mjs", "--match", pattern], {
    encoding: "utf-8",
    env,
  });
  const sentinel = [...r.stdout.matchAll(/^LEAF_MATCH (\{.*\})$/gm)].pop();
  const counts = sentinel ? JSON.parse(sentinel[1]) : null;
  return { code: r.status, counts, out: r.stdout + r.stderr };
}

test("instrument: a real test name exits 0 with pass >= 1", () => {
  const r = runMatch("allows Basic Auth POSTs");
  assert.equal(r.code, 0, r.out);
  assert.ok(r.counts && r.counts.pass >= 1, r.out);
});

test("instrument: a name no test has exits 3", () => {
  const r = runMatch("zz-no-such-test");
  assert.equal(r.code, 3, r.out);
  assert.deepEqual(r.counts, { pass: 0, fail: 0, skip: 0 });
});

test("instrument: a name matching only a skipped test exits 3", () => {
  // node:test reports a skipped test as a pass event; it must not count.
  const r = runMatch("selftest deliberate failure");
  assert.equal(r.code, 3, r.out);
  assert.deepEqual(r.counts, { pass: 0, fail: 0, skip: 1 });
});

// A todo is a KNOWN failing check, not a skip: counting it as "skip" made a known gap
// read as harmless (Alex, 2026-10-04). It still proves nothing, so exit 3.
test("instrument: a todo test is counted as todo, not skip", () => {
  const r = runMatch("selftest planted todo", { TEST_MATCH_SELFTEST: "1" });
  assert.equal(r.code, 3, r.out);
  assert.deepEqual(r.counts, { pass: 0, fail: 0, skip: 0, todo: 1 });
});

test("instrument: a failing matched test exits 1, not 3", () => {
  const r = runMatch("selftest deliberate failure", { TEST_MATCH_SELFTEST: "1" });
  assert.equal(r.code, 1, r.out);
  assert.equal(r.counts?.fail, 1, r.out);
});

test("instrument: a test in a nested folder is reachable", () => {
  const r = runMatch("nested fixture reachable");
  assert.equal(r.code, 0, r.out);
  assert.equal(r.counts?.pass, 1, r.out);
});

test("instrument: the old --test-name-pattern form is refused", () => {
  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const r = spawnSync(process.execPath, ["scripts/run-tests.mjs", "--test-name-pattern=x"], {
    encoding: "utf-8",
    env,
  });
  assert.equal(r.status, 2, r.stdout + r.stderr);
});
