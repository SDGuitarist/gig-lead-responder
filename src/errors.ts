/**
 * Custom exception hierarchy for gig-lead-responder.
 *
 * All application-specific errors inherit from LeadResponderError.
 * This lets callers catch broad (LeadResponderError) or narrow
 * (e.g., ClassificationError) as needed.
 *
 * Modeled on pf-intel's PFIntelError hierarchy.
 */

/** Base error for all gig-lead-responder errors. */
export class LeadResponderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LeadResponderError";
  }
}

// --- Pipeline errors ---

/** Error during a pipeline stage. */
export class PipelineStageError extends LeadResponderError {
  constructor(
    message: string,
    public readonly stage: string,
  ) {
    super(message);
    this.name = "PipelineStageError";
  }
}

/** Stage 1: Claude classification failed or returned invalid shape. */
export class ClassificationError extends PipelineStageError {
  constructor(message: string) {
    super(message, "classify");
    this.name = "ClassificationError";
  }
}

/** Stage 2: Rate card lookup or budget gap detection failed. */
export class PricingError extends PipelineStageError {
  constructor(message: string) {
    super(message, "price");
    this.name = "PricingError";
  }
}

/** Stage 3: Context file loading or assembly failed. */
export class ContextError extends PipelineStageError {
  constructor(message: string) {
    super(message, "context");
    this.name = "ContextError";
  }
}

/** Stage 4: Response draft generation failed. */
export class GenerationError extends PipelineStageError {
  constructor(message: string) {
    super(message, "generate");
    this.name = "GenerationError";
  }
}

/** Stage 5: Verification gate validation failed. */
export class VerificationError extends PipelineStageError {
  constructor(message: string) {
    super(message, "verify");
    this.name = "VerificationError";
  }
}

// --- External service errors ---

/** Claude API call failed (network, rate limit, etc.). */
export class ClaudeApiError extends LeadResponderError {
  constructor(message: string) {
    super(message);
    this.name = "ClaudeApiError";
  }
}

/** Email parsing failed (Mailgun payload, GigSalad format, etc.). */
export class EmailParseError extends LeadResponderError {
  constructor(message: string) {
    super(message);
    this.name = "EmailParseError";
  }
}

// --- Validation errors ---

/** Webhook payload failed validation. */
export class WebhookValidationError extends LeadResponderError {
  constructor(message: string) {
    super(message);
    this.name = "WebhookValidationError";
  }
}
