// Test runner behind `npm test` and `npm run test:match -- "<name>"` (plan §0.1).
//
// `npm test -- --test-name-pattern=X` runs every test and exits 0 even when X
// matches nothing, so it is refused here. test:match exit codes:
//   0  one or more leaf tests matched, none failed
//   1  a matched test failed (or node itself failed)
//   2  usage error, or the LEAF_MATCH sentinel is missing (reporter didn't run)
//   3  zero leaf tests matched and ran (skipped tests don't count)
import { spawn } from "node:child_process";
import { TEST_FILES } from "./test-files.mjs";

const args = process.argv.slice(2);
let pattern = null;
if (args[0] === "--match") {
  if (args.length !== 2 || !args[1]) {
    console.error('usage: npm run test:match -- "<test name>"');
    process.exit(2);
  }
  pattern = args[1];
} else if (args.length > 0) {
  console.error(`run-tests: unknown arguments ${JSON.stringify(args)}.`);
  console.error('To run tests by name use: npm run test:match -- "<test name>"');
  process.exit(2);
}

const nodeArgs = [
  "--import", "tsx", "--test",
  "--test-reporter=spec", "--test-reporter-destination=stdout",
  "--test-reporter=./scripts/leaf-reporter.mjs", "--test-reporter-destination=stdout",
];
if (pattern !== null) nodeArgs.push("--test-name-pattern", pattern);
nodeArgs.push(...TEST_FILES);

// A runner started from inside a test inherits NODE_TEST_CONTEXT and would
// report to its parent instead of to us.
const env = { ...process.env };
delete env.NODE_TEST_CONTEXT;

// No test may bill. The shell and .env both hold ANTHROPIC_API_KEY, and dotenv
// never overwrites a variable that is already set, so set both to dead values
// here. Any real call fails with a connection error before leaving the Mac.
env.ANTHROPIC_API_KEY = "test-runner-no-key";
env.ANTHROPIC_BASE_URL = "http://127.0.0.1:9";
delete env.ANTHROPIC_AUTH_TOKEN;
delete env.CLAUDE_CODE_OAUTH_TOKEN;

const child = spawn(process.execPath, nodeArgs, { env, stdio: ["ignore", "pipe", "inherit"] });
let out = "";
child.stdout.on("data", (chunk) => {
  out += chunk;
  process.stdout.write(chunk);
});
child.on("close", (code) => {
  const m = [...out.matchAll(/^LEAF_MATCH (\{.*\})$/gm)].pop();
  if (!m) {
    console.error("run-tests: LEAF_MATCH sentinel missing; the leaf reporter did not run.");
    process.exit(2);
  }
  const { pass, fail } = JSON.parse(m[1]);
  if (pattern === null) process.exit(code ?? 1);
  if (fail > 0 || code !== 0) process.exit(1);
  if (pass === 0) {
    console.error(`test:match: zero tests matched ${JSON.stringify(pattern)}.`);
    process.exit(3);
  }
  process.exit(0);
});
