import { test } from "node:test";

// Fixtures for the test instrument's own controls (scripts/run-tests.test.ts).
// This file sits one folder deeper than src/*.test.ts on purpose: the old glob
// could not reach it.

test("nested fixture reachable", () => {});

test(
  "selftest deliberate failure",
  { skip: process.env.TEST_MATCH_SELFTEST !== "1" && "runs only under TEST_MATCH_SELFTEST=1" },
  () => {
    throw new Error("deliberate failure for the test:match exit-1 control");
  },
);

// Planted todo for the todo-counting control. Defined only under TEST_MATCH_SELFTEST=1, so the
// normal suite reports 0 todos and a real known gap is never hidden behind this one.
if (process.env.TEST_MATCH_SELFTEST === "1") {
  test("selftest planted todo", { todo: "control for the todo counter" }, () => {
    throw new Error("planted known gap");
  });
}
