/**
 * Automation Entry Point
 *
 * Starts the Gmail poller and processes leads through the full pipeline.
 * Run with: npx tsx src/automation/main.ts
 * Or via pm2: pm2 start ecosystem.config.cjs
 *
 * Requires:
 *   - ANTHROPIC_API_KEY in .env
 *   - Gmail credentials (run scripts/gmail-auth.ts first)
 *   - DRY_RUN=true (default) for testing, "false" for live sends
 */
import "dotenv/config";
import { loadConfig } from "./config.js";
import { setLogPath } from "./logger.js";
import { loadAuthClient, pollForNewMessages } from "./gmail-watcher.js";
import { processLead } from "./orchestrator.js";
import { YelpPortalClient } from "./portals/yelp-client.js";
import { GigSaladPortalClient } from "./portals/gigsalad-client.js";

async function main() {
  // Validate API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Error: ANTHROPIC_API_KEY not set in .env file");
    process.exit(1);
  }

  // Load config
  const config = loadConfig();
  setLogPath(config.logPath);

  console.log("=== Gig Lead Responder — Automation ===");
  console.log(`Mode: ${config.dryRun ? "DRY RUN (no real sends)" : "LIVE"}`);
  console.log(`Poll interval: ${config.pollIntervalMs / 1000}s`);
  console.log(`Budget threshold: $${config.edgeCaseBudgetThreshold}`);
  console.log("");

  // Initialize Gmail auth
  let auth;
  try {
    auth = loadAuthClient(config);
    console.log("Gmail API authenticated");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Gmail auth failed: ${msg}`);
    console.error("Run: npx tsx scripts/gmail-auth.ts");
    process.exit(1);
  }

  // Initialize portal clients
  const yelpClient = new YelpPortalClient({
    email: config.portalCredentials.yelp.email,
    password: config.portalCredentials.yelp.password,
  });

  const gigsaladClient = new GigSaladPortalClient({
    email: config.portalCredentials.gigsalad.email,
    password: config.portalCredentials.gigsalad.password,
  });

  // Polling state
  let lastPollTimestamp = Math.floor(Date.now() / 1000);
  let processing = false;

  console.log(`Starting poll loop...\n`);

  async function poll(): Promise<void> {
    if (processing) {
      console.log("Previous poll still processing — skipping");
      return;
    }
    processing = true;

    try {
      const messages = await pollForNewMessages(auth!, lastPollTimestamp);

      if (messages.length > 0) {
        console.log(`Found ${messages.length} new message(s)`);
      }

      for (const msg of messages) {
        try {
          await processLead(msg, config, auth!, yelpClient, gigsaladClient);
        } catch (err) {
          // Per-lead error isolation — one bad lead shouldn't kill the loop
          console.error(`Error processing message ${msg.id}:`, err instanceof Error ? err.message : err);
        }
      }

      lastPollTimestamp = Math.floor(Date.now() / 1000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);

      // Handle auth failures
      if (msg.includes("invalid_grant") || msg.includes("401")) {
        console.error("\nGmail auth token expired or revoked.");
        console.error("Run: npx tsx scripts/gmail-auth.ts");
        console.error("Then restart the automation.\n");
        // Don't exit — keep trying in case it's transient
      } else {
        console.error(`Poll error: ${msg}`);
      }
    } finally {
      processing = false;
    }
  }

  // Run immediately, then on interval
  await poll();
  const interval = setInterval(poll, config.pollIntervalMs);

  // Graceful shutdown
  process.on("SIGTERM", async () => {
    console.log("\nShutting down gracefully...");
    clearInterval(interval);
    await yelpClient.close();
    console.log("Goodbye.");
    process.exit(0);
  });

  process.on("SIGINT", async () => {
    console.log("\nInterrupted — shutting down...");
    clearInterval(interval);
    await yelpClient.close();
    process.exit(0);
  });

  console.log(`Polling every ${config.pollIntervalMs / 1000}s. Press Ctrl+C to stop.\n`);
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
