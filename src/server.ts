import "dotenv/config";
import express from "express";
import { join } from "node:path";
import { initDb } from "./leads.js";
import webhookRouter from "./webhook.js";
import twilioWebhookRouter from "./twilio-webhook.js";
import apiRouter from "./api.js";
import { startFollowUpScheduler, stopFollowUpScheduler } from "./follow-up-scheduler.js";

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("Error: ANTHROPIC_API_KEY not set in .env file");
  process.exit(1);
}

if (process.env.NODE_ENV === "production") {
  if (process.env.DISABLE_TWILIO_VALIDATION || process.env.DISABLE_MAILGUN_VALIDATION) {
    console.error("FATAL: webhook validation bypass enabled in production");
    process.exit(1);
  }
}

// Initialize SQLite (creates tables if needed)
initDb();

const app = express();

// Railway runs behind a reverse proxy. Trust one hop so req.ip
// reflects the real client IP, not the proxy IP.
app.set("trust proxy", 1);

app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(join(import.meta.dirname, "..", "public")));

// Mailgun inbound webhook
app.use(webhookRouter);

// Twilio inbound SMS webhook
app.use(twilioWebhookRouter);

// JSON API for new dashboard (includes /api/analyze)
app.use(apiRouter);

// Redirect root to new dashboard
app.get("/", (_req, res) => {
  res.redirect("/dashboard.html");
});

// Healthcheck for Railway
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

const PORT = parseInt(process.env.PORT || "3000", 10);
const server = app.listen(PORT, () => {
  console.log(`Gig Lead Responder running at http://localhost:${PORT}`);
  startFollowUpScheduler();
});

process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down...");
  stopFollowUpScheduler();
  server.close(() => {
    console.log("HTTP server closed");
  });
});
