/**
 * Gmail Poller — startable/stoppable module for embedding in the server process.
 *
 * Non-fatal: if Gmail credentials aren't configured, logs a warning and returns.
 * The server keeps running for dashboard/webhooks regardless.
 */
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { loadConfig, type AutomationConfig } from "./config.js";
import { setLogPath } from "./logger.js";
import { loadAuthClient, pollForNewMessages } from "./gmail-watcher.js";
import { processLead } from "./orchestrator.js";
import type { GmailMessage } from "./gmail-watcher.js";
import { getPollerState, savePollAuthFailed, savePollSuccess } from "../db/poller-state.js";
import { YelpPortalClient } from "./portals/yelp-client.js";
import { GigSaladPortalClient } from "./portals/gigsalad-client.js";

/**
 * Write Gmail credential files from env vars if the files don't already exist.
 * This lets Railway store secrets as env vars while the Gmail client reads files.
 */
function bootstrapCredentialFiles(credPath: string, tokenPath: string): void {
  if (!existsSync(credPath) && process.env.GMAIL_CREDENTIALS_JSON) {
    mkdirSync(dirname(credPath), { recursive: true });
    writeFileSync(credPath, process.env.GMAIL_CREDENTIALS_JSON, { mode: 0o600 });
    console.log(`[gmail-poller] Wrote ${credPath} from GMAIL_CREDENTIALS_JSON env var`);
  }
  if (process.env.GMAIL_TOKEN_JSON) {
    mkdirSync(dirname(tokenPath), { recursive: true });
    writeFileSync(tokenPath, process.env.GMAIL_TOKEN_JSON, { mode: 0o600 });
    console.log(`[gmail-poller] Wrote ${tokenPath} from GMAIL_TOKEN_JSON env var`);
  }
}

let interval: ReturnType<typeof setInterval> | null = null;
let yelpClient: YelpPortalClient | null = null;
let authFailed = false;
let activePoll: (() => Promise<void>) | null = null;

/** Polls right away (used on wake). Returns false if the poller isn't running. */
export async function pollNow(): Promise<boolean> {
  if (!activePoll) return false;
  await activePoll();
  return true;
}

/**
 * The poller never sends for real until Module 1 ships an alert channel to
 * Alex (plan 0.3). This used to be decided by "are Twilio creds present";
 * Twilio is gone, so it is now an explicit rule.
 */
export function resolvePollerDryRun(_config: AutomationConfig): boolean {
  return true;
}

/** Seconds of overlap kept behind the cursor; the dedup table drops repeats. */
const CURSOR_OVERLAP_S = 300;
const MAX_ATTEMPTS = 3;
/** Gmail id -> failed attempts so far; in memory, so a restart allows 3 more. */
const failedAttempts = new Map<string, number>();

export interface PollDeps {
  fetchSince: (afterTs: number) => Promise<GmailMessage[]>;
  handle: (msg: GmailMessage) => Promise<void>;
  now: () => number;
}

/**
 * One poll: fetch from the stored cursor, handle each message, then move the
 * cursor. A fetch error leaves the cursor alone; invalid_grant also records
 * auth as failed. Errors are rethrown for the caller.
 */
export async function pollOnce(deps: PollDeps): Promise<void> {
  const startedMs = deps.now();
  const startedS = Math.floor(startedMs / 1000);
  const cursor = getPollerState().cursorTs ?? startedS - CURSOR_OVERLAP_S;

  let messages: GmailMessage[];
  try {
    messages = await deps.fetchSince(cursor);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (isAuthError(msg)) savePollAuthFailed();
    throw err;
  }

  if (messages.length > 0) {
    console.log(`[gmail-poller] Found ${messages.length} new message(s)`);
  }
  // A failed lead holds the cursor so the next poll retries it; finished ones
  // are skipped by the done-list. After MAX_ATTEMPTS we give up on it.
  let hold = false;
  for (const m of messages) {
    try {
      await deps.handle(m);
      failedAttempts.delete(m.id);
    } catch (err) {
      const attempts = (failedAttempts.get(m.id) ?? 0) + 1;
      const reason = err instanceof Error ? err.message : String(err);
      if (attempts >= MAX_ATTEMPTS) {
        failedAttempts.delete(m.id);
        console.error(`[gmail-poller] GAVE UP on ${m.id} after ${attempts} attempts: ${reason}`);
      } else {
        failedAttempts.set(m.id, attempts);
        hold = true;
        console.error(`[gmail-poller] Error processing ${m.id} (attempt ${attempts}, will retry): ${reason}`);
      }
    }
  }

  savePollSuccess(hold ? cursor : startedS - CURSOR_OVERLAP_S, new Date(startedMs).toISOString());
}

function isAuthError(msg: string): boolean {
  return msg.includes("invalid_grant") || msg.includes("401");
}

export async function startGmailPoller(): Promise<void> {
  authFailed = false;
  let config = loadConfig();
  setLogPath(config.logPath);

  // Bootstrap credential files from env vars (Railway support)
  bootstrapCredentialFiles(config.gmail.credentialsPath, config.gmail.tokenPath);

  // Try to load Gmail auth — if it fails, warn and skip (non-fatal)
  let auth;
  try {
    auth = loadAuthClient(config);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[gmail-poller] Gmail auth not configured — polling disabled (${msg})`);
    console.warn("[gmail-poller] Run: npx tsx scripts/gmail-auth.ts to enable");
    return;
  }

  // Phase 0: always dry-run (see resolvePollerDryRun)
  if (!config.dryRun) {
    console.warn("[gmail-poller] DRY_RUN=false ignored — the poller stays DRY RUN until an alert channel exists");
  }
  config = { ...config, dryRun: resolvePollerDryRun(config) };

  // Initialize portal clients
  yelpClient = new YelpPortalClient({
    email: config.portalCredentials.yelp.email,
    password: config.portalCredentials.yelp.password,
  });

  const gigsaladClient = new GigSaladPortalClient({
    email: config.portalCredentials.gigsalad.email,
    password: config.portalCredentials.gigsalad.password,
  });

  let processing = false;

  async function poll(): Promise<void> {
    if (processing || authFailed) return;
    processing = true;

    try {
      await pollOnce({
        fetchSince: (after) => pollForNewMessages(auth!, after),
        handle: (msg) => processLead(msg, config, auth!, yelpClient!, gigsaladClient),
        now: () => Date.now(),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (isAuthError(msg)) {
        console.error("[gmail-poller] Gmail auth token expired — stopping poller. Run: npx tsx scripts/gmail-auth.ts");
        authFailed = true;
        if (interval) {
          clearInterval(interval);
          interval = null;
        }
      } else {
        console.error(`[gmail-poller] Poll error: ${msg}`);
      }
    } finally {
      processing = false;
    }
  }

  activePoll = poll;
  // Run immediately, then on interval
  await poll();
  interval = setInterval(poll, config.pollIntervalMs);

  const mode = config.dryRun ? "DRY RUN" : "LIVE";
  const sendMode = config.autoSendEnabled ? "auto-send ENABLED" : "review-only";
  console.log(`[gmail-poller] Started (${mode}, ${sendMode}, every ${config.pollIntervalMs / 1000}s)`);
}

export async function stopGmailPoller(): Promise<void> {
  activePoll = null;
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
  if (yelpClient) {
    await yelpClient.close();
    yelpClient = null;
  }
  console.log("[gmail-poller] Stopped");
}
