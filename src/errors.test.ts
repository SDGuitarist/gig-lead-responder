import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  LeadResponderError,
  PipelineStageError,
  ClassificationError,
  PricingError,
  ContextError,
  GenerationError,
  VerificationError,
  ClaudeApiError,
  EmailParseError,
  WebhookValidationError,
} from "./errors.js";

describe("Exception hierarchy", () => {
  it("all errors inherit from LeadResponderError", () => {
    const errors = [
      new PipelineStageError("test", "classify"),
      new ClassificationError("test"),
      new PricingError("test"),
      new ContextError("test"),
      new GenerationError("test"),
      new VerificationError("test"),
      new ClaudeApiError("test"),
      new EmailParseError("test"),
      new WebhookValidationError("test"),
    ];
    for (const err of errors) {
      assert.ok(err instanceof LeadResponderError, `${err.name} should inherit from LeadResponderError`);
      assert.ok(err instanceof Error, `${err.name} should inherit from Error`);
    }
  });

  it("pipeline errors inherit from PipelineStageError", () => {
    assert.ok(new ClassificationError("t") instanceof PipelineStageError);
    assert.ok(new PricingError("t") instanceof PipelineStageError);
    assert.ok(new ContextError("t") instanceof PipelineStageError);
    assert.ok(new GenerationError("t") instanceof PipelineStageError);
    assert.ok(new VerificationError("t") instanceof PipelineStageError);
  });

  it("PipelineStageError carries stage name", () => {
    assert.equal(new ClassificationError("t").stage, "classify");
    assert.equal(new PricingError("t").stage, "price");
    assert.equal(new ContextError("t").stage, "context");
    assert.equal(new GenerationError("t").stage, "generate");
    assert.equal(new VerificationError("t").stage, "verify");
  });

  it("catch LeadResponderError catches all app errors", () => {
    try {
      throw new PricingError("test");
    } catch (e) {
      assert.ok(e instanceof LeadResponderError);
    }
  });

  it("catch PipelineStageError does not catch ClaudeApiError", () => {
    let caught = false;
    try {
      throw new ClaudeApiError("test");
    } catch (e) {
      if (e instanceof PipelineStageError) {
        caught = true;
      }
    }
    assert.equal(caught, false, "PipelineStageError should not catch ClaudeApiError");
  });

  it("all errors preserve message", () => {
    const msg = "specific error message";
    assert.equal(new ClassificationError(msg).message, msg);
    assert.equal(new PricingError(msg).message, msg);
    assert.equal(new ClaudeApiError(msg).message, msg);
  });

  it("all errors have correct name property", () => {
    assert.equal(new LeadResponderError("t").name, "LeadResponderError");
    assert.equal(new ClassificationError("t").name, "ClassificationError");
    assert.equal(new PricingError("t").name, "PricingError");
    assert.equal(new ContextError("t").name, "ContextError");
    assert.equal(new GenerationError("t").name, "GenerationError");
    assert.equal(new VerificationError("t").name, "VerificationError");
    assert.equal(new ClaudeApiError("t").name, "ClaudeApiError");
    assert.equal(new EmailParseError("t").name, "EmailParseError");
    assert.equal(new WebhookValidationError("t").name, "WebhookValidationError");
  });
});
