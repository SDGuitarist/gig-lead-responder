import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "./automation/config.js";

describe("loadConfig — autoSendEnabled", () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    savedEnv.AUTO_SEND_ENABLED = process.env.AUTO_SEND_ENABLED;
    savedEnv.DRY_RUN = process.env.DRY_RUN;
  });

  afterEach(() => {
    if (savedEnv.AUTO_SEND_ENABLED === undefined) {
      delete process.env.AUTO_SEND_ENABLED;
    } else {
      process.env.AUTO_SEND_ENABLED = savedEnv.AUTO_SEND_ENABLED;
    }
    if (savedEnv.DRY_RUN === undefined) {
      delete process.env.DRY_RUN;
    } else {
      process.env.DRY_RUN = savedEnv.DRY_RUN;
    }
  });

  it("defaults autoSendEnabled to false when env var is unset", () => {
    delete process.env.AUTO_SEND_ENABLED;
    const config = loadConfig();
    assert.equal(config.autoSendEnabled, false);
  });

  it('autoSendEnabled is false when env var is "false"', () => {
    process.env.AUTO_SEND_ENABLED = "false";
    const config = loadConfig();
    assert.equal(config.autoSendEnabled, false);
  });

  it('autoSendEnabled is true when env var is "true"', () => {
    process.env.AUTO_SEND_ENABLED = "true";
    const config = loadConfig();
    assert.equal(config.autoSendEnabled, true);
  });

  it("dryRun defaults to true (safe default)", () => {
    delete process.env.DRY_RUN;
    const config = loadConfig();
    assert.equal(config.dryRun, true);
  });
});
