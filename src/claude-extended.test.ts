import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { callClaude, callClaudeText, setClaudeRequesterForTests } from "./claude.js";

afterEach(() => {
  setClaudeRequesterForTests();
});

function mockResponse(text: string) {
  setClaudeRequesterForTests(async () => ({
    id: "msg-test",
    type: "message" as const,
    role: "assistant" as const,
    content: [{ type: "text" as const, text }],
    model: "claude-sonnet-4-6",
    stop_reason: "end_turn" as const,
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 10 },
  }));
}

describe("callClaude JSON parsing", () => {
  it("parses raw JSON response", async () => {
    mockResponse('{"key": "value"}');
    const result = await callClaude("sys", "user");
    assert.deepEqual(result, { key: "value" });
  });

  it("strips markdown code fences", async () => {
    mockResponse('```json\n{"key": "value"}\n```');
    const result = await callClaude("sys", "user");
    assert.deepEqual(result, { key: "value" });
  });

  it("strips code fences without language tag", async () => {
    mockResponse('```\n{"key": "value"}\n```');
    const result = await callClaude("sys", "user");
    assert.deepEqual(result, { key: "value" });
  });

  it("applies validate function when provided", async () => {
    mockResponse('{"name": "Alex"}');
    const validate = (raw: unknown) => {
      const obj = raw as { name: string };
      if (!obj.name) throw new Error("missing name");
      return obj;
    };
    const result = await callClaude("sys", "user", undefined, validate);
    assert.equal(result.name, "Alex");
  });

  it("retries on validation failure", async () => {
    let calls = 0;
    setClaudeRequesterForTests(async () => {
      calls++;
      const text = calls === 1
        ? '{"bad": true}'
        : '{"name": "Alex"}';
      return {
        content: [{ type: "text" as const, text }],
      } as any;
    });

    const validate = (raw: unknown) => {
      const obj = raw as { name?: string };
      if (!obj.name) throw new Error("missing name");
      return obj;
    };
    const result = await callClaude("sys", "user", undefined, validate);
    assert.equal(result.name, "Alex");
    assert.equal(calls, 2);
  });

  it("throws after both attempts fail", async () => {
    mockResponse("not json at all");
    await assert.rejects(
      () => callClaude("sys", "user"),
      { message: "Failed to parse Claude JSON response after retry." },
    );
  });
});

describe("callClaudeText", () => {
  it("returns raw text without JSON parsing", async () => {
    mockResponse("Hello, I am Claude");
    const result = await callClaudeText("sys", "user");
    assert.equal(result, "Hello, I am Claude");
  });

  it("throws on non-text response block", async () => {
    setClaudeRequesterForTests(async () => ({
      content: [{ type: "tool_use" as any, id: "t1", name: "test", input: {} }],
    } as any));
    await assert.rejects(
      () => callClaudeText("sys", "user"),
      { message: "Unexpected response type: tool_use" },
    );
  });
});
