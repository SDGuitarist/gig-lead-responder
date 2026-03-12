import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { callClaude, setClaudeRequesterForTests } from "./claude.js";

afterEach(() => {
  setClaudeRequesterForTests();
});

describe("callClaude", () => {
  it("sanitizes parse failures after the retry path", async () => {
    let calls = 0;

    setClaudeRequesterForTests(async () => {
      calls += 1;
      return {
        content: [
          {
            type: "text",
            text: calls === 1
              ? "{ definitely not valid json }"
              : "SECRET_PROMPT_FRAGMENT should never leak",
          },
        ],
      } as any;
    });

    await assert.rejects(
      () => callClaude("system prompt", "user prompt"),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.equal(err.message, "Failed to parse Claude JSON response after retry.");
        assert.ok(!err.message.includes("SECRET_PROMPT_FRAGMENT"));
        return true;
      }
    );

    assert.equal(calls, 2);
  });
});
