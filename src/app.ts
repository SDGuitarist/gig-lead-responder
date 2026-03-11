import express from "express";
import type { Request, Response } from "express";
import cookieParser from "cookie-parser";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import webhookRouter from "./webhook.js";
import twilioWebhookRouter from "./twilio-webhook.js";
import apiRouter from "./api.js";
import followUpApiRouter from "./follow-up-api.js";
import { sessionAuth, csrfGuard, logout } from "./auth.js";
import { errorHandler } from "./utils/error-handler.js";

/**
 * Build the Express app with all middleware and routes.
 * Separated from server.ts so tests can instantiate the real
 * middleware stack without env guards, DB init, or app.listen().
 */
export function createApp() {
  const app = express();

  // Railway runs behind a reverse proxy. Trust one hop so req.ip
  // reflects the real client IP, not the proxy IP.
  app.set("trust proxy", 1);

  app.use(express.json({ limit: "100kb" }));
  app.use(express.urlencoded({ extended: false, limit: "100kb" }));
  app.use(cookieParser());

  // Security headers — nonce generated per request for CSP script-src
  app.use((_req, res, next) => {
    const nonce = randomBytes(16).toString("base64");
    res.locals.cspNonce = nonce;
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy",
      `default-src 'self'; script-src 'self' 'nonce-${nonce}'; ` +
      "style-src 'self' https://fonts.googleapis.com; " +
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
    const html = dashboardHtml.replace(/<script(?=[\s>])/gi, `<script nonce="${nonce}"`);
    res.type("html").send(html);
  });

  app.use(express.static(join(import.meta.dirname, "..", "public"), { maxAge: "1h" }));

  // Mailgun inbound webhook
  app.use(webhookRouter);

  // Twilio inbound SMS webhook
  app.use(twilioWebhookRouter);

  // JSON API for new dashboard (includes /api/analyze)
  app.use(apiRouter);

  // Follow-up action endpoints (approve, skip, snooze, replied)
  app.use(followUpApiRouter);

  // Logout — POST-only, requires auth + CSRF guard
  app.post("/logout", sessionAuth, csrfGuard, logout);

  // Redirect root to new dashboard
  app.get("/", (_req, res) => {
    res.redirect("/dashboard.html");
  });

  // 404 catch-all — after all routes, before error handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "Not found" });
  });

  // Global error handler — must be registered last, must have 4 parameters
  app.use(errorHandler);

  return app;
}
