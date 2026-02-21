import "dotenv/config";
import express from "express";
import { join } from "node:path";
import { runPipeline } from "./run-pipeline.js";

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("Error: ANTHROPIC_API_KEY not set in .env file");
  process.exit(1);
}

const app = express();
app.use(express.json());
app.use(express.static(join(import.meta.dirname, "..", "public")));

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
