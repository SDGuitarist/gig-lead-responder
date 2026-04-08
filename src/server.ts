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

if (process.env.NODE_ENV === "production" || process.env.RAILWAY_ENVIRONMENT) {
  if (process.env.DISABLE_TWILIO_VALIDATION || process.env.DISABLE_MAILGUN_VALIDATION) {
    console.error("FATAL: webhook validation bypass enabled in production");
    process.exit(1);
  }
  if (!process.env.DASHBOARD_USER || !process.env.DASHBOARD_PASS) {
    console.error("FATAL: DASHBOARD_USER and DASHBOARD_PASS must be set in production");
    process.exit(1);
  }
  if (!process.env.COOKIE_SECRET) {
    console.error("FATAL: COOKIE_SECRET must be set in production");
    process.exit(1);
  }
  const MIN_SECRET_LEN = 16;
  if (process.env.COOKIE_SECRET.length < MIN_SECRET_LEN) {
    console.error(`FATAL: COOKIE_SECRET must be at least ${MIN_SECRET_LEN} characters`);
    process.exit(1);
  }
  if (process.env.DASHBOARD_PASS!.length < 8) {
    console.error("FATAL: DASHBOARD_PASS must be at least 8 characters");
    process.exit(1);
  }
}

// Initialize SQLite (creates tables if needed)
initDb();

const app = createApp();

const PORT = parseInt(process.env.PORT || "3000", 10);
const server = app.listen(PORT, "::", () => {
  console.log(`Gig Lead Responder running at http://localhost:${PORT}`);
  startFollowUpScheduler();
  startGmailPoller();
  recoverStuckLeads().catch(err => console.error("Stuck lead recovery failed:", err));
});

process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down...");
  stopFollowUpScheduler();
  stopGmailPoller();
  server.close(() => {
    console.log("HTTP server closed");
  });
});
