import { test } from "node:test";
import assert from "node:assert/strict";
import Anthropic from "@anthropic-ai/sdk";

// scripts/run-tests.mjs must make every Anthropic call in a test fail before it
// leaves the machine. On 2026-10-03 a test that missed its fake ran the real
// pipeline on the shell's ANTHROPIC_API_KEY and made billed calls.
test("test runs cannot reach the real Anthropic API", async () => {
  await import("./automation/config.js"); // loads .env via dotenv; must not undo the guard
  assert.equal(process.env.ANTHROPIC_BASE_URL, "http://127.0.0.1:9");
  assert.equal(process.env.ANTHROPIC_API_KEY, "test-runner-no-key");
  const client = new Anthropic({ maxRetries: 0 });
  await assert.rejects(
    client.messages.create({ model: "claude-haiku-4-5", max_tokens: 1, messages: [{ role: "user", content: "x" }] }),
    Anthropic.APIConnectionError,
  );
});
