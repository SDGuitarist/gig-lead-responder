import { test } from "node:test";
import assert from "node:assert/strict";
import Anthropic from "@anthropic-ai/sdk";

// Second layer of the no-billing guard: src/claude.ts itself must refuse the
// real API inside any node:test process, even when a file is run directly
// with `node --test` and the runner's dead key/base URL were never set.
test("app claude client cannot reach the real API under node:test, even run directly", async () => {
  assert.ok(process.env.NODE_TEST_CONTEXT, "node sets NODE_TEST_CONTEXT in test processes");
  // Simulate a direct run: no runner guard, a key present.
  delete process.env.ANTHROPIC_BASE_URL;
  process.env.ANTHROPIC_API_KEY = "sk-ant-not-a-real-key";
  const { callClaudeText } = await import("./claude.js");
  await assert.rejects(callClaudeText("s", "x", "claude-haiku-4-5", 1), (err: unknown) => {
    // A 401 would mean the request reached api.anthropic.com.
    assert.ok(err instanceof Anthropic.APIConnectionError, `expected a connection error, got ${err}`);
    return true;
  });
});
