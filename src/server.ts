import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { initDb } from "./leads.js";
import webhookRouter from "./webhook.js";
import twilioWebhookRouter from "./twilio-webhook.js";
import apiRouter from "./api.js";
import followUpApiRouter from "./follow-up-api.js";
import { startFollowUpScheduler, stopFollowUpScheduler } from "./follow-up-scheduler.js";

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
}

// Initialize SQLite (creates tables if needed)
initDb();

const app = express();

// Railway runs behind a reverse proxy. Trust one hop so req.ip
// reflects the real client IP, not the proxy IP.
// If adding Cloudflare, change to 2. If exposed directly (no proxy), set to false.
app.set("trust proxy", 1);

app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Security headers — nonce generated per request for CSP script-src
app.use((_req, res, next) => {
  const nonce = randomBytes(16).toString("base64");
  res.locals.cspNonce = nonce;
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Security-Policy",
    `default-src 'self'; script-src 'self' 'nonce-${nonce}'; ` +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "img-src 'self' data:; connect-src 'self'");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (process.env.NODE_ENV === "production" || process.env.RAILWAY_ENVIRONMENT) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});

// Healthcheck for Railway (before any auth middleware)
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Serve dashboard.html with per-request CSP nonce injected into <script> tags
const dashboardHtml = readFileSync(join(import.meta.dirname, "..", "public", "dashboard.html"), "utf-8");
app.get("/dashboard.html", (_req, res) => {
  const nonce = res.locals.cspNonce as string;
  const html = dashboardHtml.replace(/<script>/g, `<script nonce="${nonce}">`);
  res.type("html").send(html);
});

app.use(express.static(join(import.meta.dirname, "..", "public")));

// Mailgun inbound webhook
app.use(webhookRouter);

// Twilio inbound SMS webhook
app.use(twilioWebhookRouter);

// JSON API for new dashboard (includes /api/analyze)
app.use(apiRouter);

// Follow-up action endpoints (approve, skip, snooze, replied)
app.use(followUpApiRouter);

// Redirect root to new dashboard
app.get("/", (_req, res) => {
  res.redirect("/dashboard.html");
});

const PORT = parseInt(process.env.PORT || "3000", 10);
const server = app.listen(PORT, "::", () => {
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
