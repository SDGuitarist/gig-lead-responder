import "dotenv/config";
import express from "express";
import helmet from "helmet";
import { join } from "node:path";
import { initDb } from "./leads.js";
import webhookRouter from "./webhook.js";
import twilioWebhookRouter from "./twilio-webhook.js";
import apiRouter from "./api.js";

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("Error: ANTHROPIC_API_KEY not set in .env file");
  process.exit(1);
}

// Initialize SQLite (creates tables if needed)
initDb();

const app = express();
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: false }));
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        scriptSrc: ["'self'", "'unsafe-inline'"],
      },
    },
  })
);
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
app.listen(PORT, () => {
  console.log(`Gig Lead Responder running at http://localhost:${PORT}`);
});
