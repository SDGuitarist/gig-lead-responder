import "dotenv/config";
import express from "express";
import { join } from "node:path";
import { runPipeline } from "./run-pipeline.js";
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
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(join(import.meta.dirname, "..", "public")));

// Mailgun inbound webhook
app.use(webhookRouter);

// Twilio inbound SMS webhook
app.use(twilioWebhookRouter);

// JSON API for new dashboard
app.use(apiRouter);

// Redirect root to new dashboard
app.get("/", (_req, res) => {
  res.redirect("/dashboard.html");
});

// Healthcheck for Railway
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// SSE helper — sends a named event to the client
function sendSSE(res: express.Response, event: string, data: unknown) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

app.post("/api/analyze", async (req, res) => {
  const { text } = req.body;
  if (!text || typeof text !== "string" || !text.trim()) {
    res.status(400).json({ error: "Missing 'text' field in request body" });
    return;
  }

  // Set up SSE stream
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  try {
    const output = await runPipeline(text.trim(), (event) => {
      sendSSE(res, "stage", event);
    });
    sendSSE(res, "complete", output);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    sendSSE(res, "error", { error: message });
  } finally {
    res.end();
  }
});

const PORT = parseInt(process.env.PORT || "3000", 10);
app.listen(PORT, () => {
  console.log(`Gig Lead Responder running at http://localhost:${PORT}`);
});
