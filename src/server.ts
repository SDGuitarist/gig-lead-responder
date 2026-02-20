import "dotenv/config";
import express from "express";
import { join } from "node:path";
import { classifyLead } from "./pipeline/classify.js";
import { lookupPrice } from "./pipeline/price.js";
import { selectContext } from "./pipeline/context.js";
import { runWithVerification } from "./pipeline/verify.js";
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

  // Set up SSE stream
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const timing: Record<string, number> = {};
  const totalStart = Date.now();

  try {
    // --- Stage 1: Classification ---
    sendSSE(res, "stage", { stage: 1, name: "classify", status: "running" });
    let start = Date.now();
    const classification = await classifyLead(text.trim());
    timing.classify = Date.now() - start;
    sendSSE(res, "stage", {
      stage: 1, name: "classify", status: "done",
      ms: timing.classify, result: classification,
    });

    // --- Stage 2: Pricing ---
    sendSSE(res, "stage", { stage: 2, name: "price", status: "running" });
    start = Date.now();
    const pricing = lookupPrice(classification);
    timing.price = Date.now() - start;
    sendSSE(res, "stage", {
      stage: 2, name: "price", status: "done",
      ms: timing.price, result: pricing,
    });

    // --- Stage 3: Context Assembly ---
    sendSSE(res, "stage", { stage: 3, name: "context", status: "running" });
    start = Date.now();
    const context = await selectContext(classification);
    timing.context = Date.now() - start;
    sendSSE(res, "stage", {
      stage: 3, name: "context", status: "done",
      ms: timing.context, result: { length: context.length },
    });

    // --- Stage 4: Generate ---
    sendSSE(res, "stage", { stage: 4, name: "generate", status: "running" });
    // --- Stage 5: Verify ---
    sendSSE(res, "stage", { stage: 5, name: "verify", status: "running" });
    start = Date.now();
    const { drafts, gate, verified } = await runWithVerification(
      classification, pricing, context
    );
    timing.generateAndVerify = Date.now() - start;
    sendSSE(res, "stage", {
      stage: 4, name: "generate", status: "done",
      ms: timing.generateAndVerify,
    });
    sendSSE(res, "stage", {
      stage: 5, name: "verify", status: "done",
      ms: timing.generateAndVerify,
    });

    timing.total = Date.now() - totalStart;

    const output: PipelineOutput = {
      classification, pricing, drafts, gate, verified, timing,
    };
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
