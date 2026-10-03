import "dotenv/config";
import { initDb } from "./db/index.js";
import { createApp } from "./app.js";
import { startFollowUpScheduler, stopFollowUpScheduler } from "./follow-up-scheduler.js";
import { startGmailPoller, stopGmailPoller } from "./automation/poller.js";
import { recoverStuckLeads } from "./post-pipeline.js";

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("Error: ANTHROPIC_API_KEY not set in .env file");
  process.exit(1);
}

// The dashboard can approve sends, so it never runs without a login, in any
// NODE_ENV (plan 0.3). It also listens on loopback only.
for (const name of ["DASHBOARD_USER", "DASHBOARD_PASS", "COOKIE_SECRET"]) {
  if (!process.env[name]) {
    console.error(`FATAL: ${name} must be set`);
    process.exit(1);
  }
}
const MIN_SECRET_LEN = 16;
if (process.env.COOKIE_SECRET!.length < MIN_SECRET_LEN) {
  console.error(`FATAL: COOKIE_SECRET must be at least ${MIN_SECRET_LEN} characters`);
  process.exit(1);
}
if (process.env.DASHBOARD_PASS!.length < 8) {
  console.error("FATAL: DASHBOARD_PASS must be at least 8 characters");
  process.exit(1);
}
if (process.env.NODE_ENV === "production" || process.env.RAILWAY_ENVIRONMENT) {
  if (process.env.DISABLE_TWILIO_VALIDATION === "true" || process.env.DISABLE_MAILGUN_VALIDATION === "true") {
    console.error("FATAL: webhook validation bypass enabled in production");
    process.exit(1);
  }
}

// Initialize SQLite (creates tables if needed)
initDb();

const app = createApp();

const PORT = parseInt(process.env.PORT || "3000", 10);
const HOST = "127.0.0.1";
const server = app.listen(PORT, HOST, () => {
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : PORT;
  console.log(`LISTENING ${HOST}:${port}`);
  console.log(`Gig Lead Responder running at http://localhost:${port}`);
  startFollowUpScheduler();
  startGmailPoller().catch(err => {
    console.error("[startup] Gmail poller failed (non-fatal):", err instanceof Error ? err.message : err);
  });
  recoverStuckLeads().catch(err => {
    console.error("[startup] Stuck lead recovery failed (non-fatal):", err instanceof Error ? err.message : err);
  });
});

process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down...");
  stopFollowUpScheduler();
  stopGmailPoller();
  server.close(() => {
    console.log("HTTP server closed");
  });
});
