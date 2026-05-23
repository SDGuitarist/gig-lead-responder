import "dotenv/config";

export interface AutomationConfig {
  readonly dryRun: boolean;
  /**
   * When true, the orchestrator sends replies automatically via the platform.
   * When false (default), leads that would auto-send are held for review.
   *
   * Env: AUTO_SEND_ENABLED=true
   * Phase 1: always false (review-only mode)
   * Phase 2: flip to true after monitoring review-only leads
   *
   * dryRun x autoSendEnabled interaction:
   *   dryRun=true,  autoSendEnabled=true  → Dry-run: log send result, no actual dispatch
   *   dryRun=true,  autoSendEnabled=false → Dry-run: log review-only, no SMS
   *   dryRun=false, autoSendEnabled=true  → Real auto-send
   *   dryRun=false, autoSendEnabled=false → Review-only: SMS fires, lead stored as "sent"
   */
  readonly autoSendEnabled: boolean;
  readonly gmail: {
    readonly credentialsPath: string;
    readonly tokenPath: string;
  };
  readonly twilio: {
    readonly accountSid: string;
    readonly authToken: string;
    readonly fromNumber: string;
    readonly toNumber: string;
  };
  readonly portalCredentials: {
    readonly gigsalad: { readonly email: string; readonly password: string };
    readonly yelp: { readonly email: string; readonly password: string };
  };
  readonly edgeCaseBudgetThreshold: number;
  readonly logPath: string;
  readonly pollIntervalMs: number;
}

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
}

function optional(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

export function loadConfig(): AutomationConfig {
  return {
    dryRun: process.env.DRY_RUN !== "false", // default true — safe
    autoSendEnabled: process.env.AUTO_SEND_ENABLED === "true", // default false — review-only
    gmail: {
      credentialsPath: optional("GMAIL_CREDENTIALS_PATH", "credentials.json"),
      tokenPath: optional("GMAIL_TOKEN_PATH", "data/gmail-token.json"),
    },
    twilio: {
      accountSid: optional("TWILIO_ACCOUNT_SID", ""),
      authToken: optional("TWILIO_AUTH_TOKEN", ""),
      fromNumber: optional("TWILIO_FROM_NUMBER", ""),
      toNumber: optional("TWILIO_TO_NUMBER", ""),
    },
    portalCredentials: {
      gigsalad: {
        email: optional("GIGSALAD_EMAIL", ""),
        password: optional("GIGSALAD_PASSWORD", ""),
      },
      yelp: {
        email: optional("YELP_EMAIL", ""),
        password: optional("YELP_PASSWORD", ""),
      },
    },
    edgeCaseBudgetThreshold: Number(optional("EDGE_CASE_BUDGET_THRESHOLD", "3000")),
    logPath: optional("LOG_PATH", "logs/leads.jsonl"),
    pollIntervalMs: Number(optional("POLL_INTERVAL_MS", "60000")),
  };
}
