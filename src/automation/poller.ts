/**
 * Gmail Poller — startable/stoppable module for embedding in the server process.
 *
 * Non-fatal: if Gmail credentials aren't configured, logs a warning and returns.
 * The server keeps running for dashboard/webhooks regardless.
 */
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { loadConfig } from "./config.js";
import { setLogPath } from "./logger.js";
import { loadAuthClient, pollForNewMessages } from "./gmail-watcher.js";
import { processLead } from "./orchestrator.js";
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
  if (!existsSync(tokenPath) && process.env.GMAIL_TOKEN_JSON) {
    mkdirSync(dirname(tokenPath), { recursive: true });
    writeFileSync(tokenPath, process.env.GMAIL_TOKEN_JSON, { mode: 0o600 });
    console.log(`[gmail-poller] Wrote ${tokenPath} from GMAIL_TOKEN_JSON env var`);
  }
}

let interval: ReturnType<typeof setInterval> | null = null;
let yelpClient: YelpPortalClient | null = null;
let authFailed = false;

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

  // Live mode credential checks
  if (!config.dryRun) {
    if (!config.twilio.accountSid || !config.twilio.authToken || !config.twilio.toNumber) {
      console.warn("[gmail-poller] LIVE MODE requires Twilio credentials — falling back to DRY RUN");
      config = { ...config, dryRun: true };
    }
  }

  // Initialize portal clients
  yelpClient = new YelpPortalClient({
    email: config.portalCredentials.yelp.email,
    password: config.portalCredentials.yelp.password,
  });

  const gigsaladClient = new GigSaladPortalClient({
    email: config.portalCredentials.gigsalad.email,
    password: config.portalCredentials.gigsalad.password,
  });

  let lastPollTimestamp = Math.floor(Date.now() / 1000) - 300;
  let processing = false;

  async function poll(): Promise<void> {
    if (processing || authFailed) return;
    processing = true;

    try {
      const messages = await pollForNewMessages(auth!, lastPollTimestamp);

      if (messages.length > 0) {
        console.log(`[gmail-poller] Found ${messages.length} new message(s)`);
      }

      for (const msg of messages) {
        try {
          await processLead(msg, config, auth!, yelpClient!, gigsaladClient);
        } catch (err) {
          console.error(`[gmail-poller] Error processing ${msg.id}:`, err instanceof Error ? err.message : err);
        }
      }

      if (messages.length > 0) {
        const newestDate = Math.max(
          ...messages.map((m) => Math.floor(new Date(m.date).getTime() / 1000))
        );
        lastPollTimestamp = newestDate - 300;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("invalid_grant") || msg.includes("401")) {
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

  // Run immediately, then on interval
  await poll();
  interval = setInterval(poll, config.pollIntervalMs);

  const mode = config.dryRun ? "DRY RUN" : "LIVE";
  console.log(`[gmail-poller] Started (${mode}, every ${config.pollIntervalMs / 1000}s)`);
}

export async function stopGmailPoller(): Promise<void> {
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
