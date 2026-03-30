import "dotenv/config";
import express from "express";
import { join } from "node:path";
import { runPipeline } from "./pipeline/run.js";
import type { PipelineOutput } from "./types.js";

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
  if (text.length > 10_000) {
    res.status(400).json({ error: "Text exceeds maximum length of 10,000 characters" });
    return;
  }

  // JSON mode: return single JSON response instead of SSE stream
  const wantsJSON =
    req.headers.accept === "application/json" || req.query.format === "json";

  if (wantsJSON) {
    try {
      const output = await runPipeline(text.trim());
      res.json(output);
    } catch (err: unknown) {
      console.error("Pipeline error:", err);
      res.status(500).json({ error: "Analysis failed. Please try again." });
    }
    return;
  }

  // SSE mode: stream stage progress
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  try {
    const output = await runPipeline(text.trim(), {
      onStageStart(stage, name) {
        sendSSE(res, "stage", { stage, name, status: "running" });
      },
      onStageComplete(stage, name, ms, result) {
        sendSSE(res, "stage", { stage, name, status: "done", ms, result });
      },
    });
    sendSSE(res, "complete", output);
  } catch (err: unknown) {
    console.error("Pipeline error:", err);
    sendSSE(res, "error", { error: "Analysis failed. Please try again." });
  } finally {
    res.end();
  }
});

const PORT = parseInt(process.env.PORT || "3000", 10);
app.listen(PORT, "127.0.0.1", () => {
  console.log(`Gig Lead Responder running at http://127.0.0.1:${PORT}`);
});
