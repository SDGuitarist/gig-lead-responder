import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { logCliPipelineError } from "./utils/cli-error.js";

describe("logCliPipelineError", () => {
  it("keeps default CLI errors generic when verbose mode is off", () => {
    const lines: string[] = [];

    logCliPipelineError(new Error("secret details"), false, (...args: unknown[]) => {
      lines.push(args.map(String).join(" "));
    });

    assert.deepEqual(lines, ["Pipeline error"]);
  });

  it("restores message and stack output when verbose mode is on", () => {
    const lines: string[] = [];
    const err = new Error("boom");
    err.stack = "Error: boom\n    at test";

    logCliPipelineError(err, true, (...args: unknown[]) => {
      lines.push(args.map(String).join(" "));
    });

    assert.equal(lines[0], "Pipeline error: boom");
    assert.equal(lines[1], "Error: boom\n    at test");
  });

  it("stringifies non-Error values in verbose mode", () => {
    const lines: string[] = [];

    logCliPipelineError("plain failure", true, (...args: unknown[]) => {
      lines.push(args.map(String).join(" "));
    });

    assert.deepEqual(lines, ["Pipeline error: plain failure"]);
  });
});
