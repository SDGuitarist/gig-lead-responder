import { createHmac, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { parseEmail, type EmailFields } from "./email-parser.js";
import { insertLead, isEmailProcessed, markEmailProcessed, runTransaction } from "./db/index.js";
import { runPipeline } from "./run-pipeline.js";
import { postPipeline, postPipelineError } from "./post-pipeline.js";

const router = Router();

/**
 * Validate Mailgun V2 webhook signature.
 * Mailgun sends: timestamp, token, signature in the POST body.
 * Algorithm: HMAC-SHA256(timestamp + token) using MAILGUN_WEBHOOK_KEY.
 */
function verifyMailgunSignature(
  timestamp: string,
  token: string,
  signature: string,
): boolean {
  const key = process.env.MAILGUN_WEBHOOK_KEY;
  if (!key) {
    console.error("MAILGUN_WEBHOOK_KEY not set — cannot validate webhook");
    return false;
  }

  const computed = createHmac("sha256", key)
    .update(timestamp + token)
    .digest("hex");

  // Use timingSafeEqual to prevent timing attacks
  try {
    return timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
  } catch {
    // Lengths differ — signature is invalid
    return false;
  }
}

/** Max age for Mailgun webhook timestamps (5 minutes). Prevents replay attacks. */
const MAILGUN_TIMESTAMP_MAX_AGE_S = 5 * 60;

router.post("/webhook/mailgun", (req, res) => {
  const body = req.body;

  // --- HMAC validation ---
  const timestamp = body.timestamp as string | undefined;
  const token = body.token as string | undefined;
  const signature = body.signature as string | undefined;

  if (process.env.DISABLE_MAILGUN_VALIDATION === "true") {
    if (process.env.NODE_ENV === "production" || process.env.RAILWAY_ENVIRONMENT) {
      console.error("FATAL: DISABLE_MAILGUN_VALIDATION cannot be used in production");
      res.status(401).json({ error: "Validation bypass blocked in production" });
      return;
    }
    const devKey = process.env.DEV_WEBHOOK_KEY;
    if (!devKey || body.dev_key !== devKey) {
      res.status(401).json({ error: "Dev webhook key required when validation is disabled" });
      return;
    }
    console.warn("⚠ Mailgun signature validation disabled — dev key accepted");
  } else {
    if (!timestamp || !token || !signature) {
      console.warn("Webhook missing signature fields");
      res.status(401).json({ error: "Missing signature fields" });
      return;
    }

    // Replay protection: reject timestamps older than 5 minutes or >60s in the future (clock skew)
    const tsAge = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10);
    if (isNaN(tsAge) || tsAge < -60 || tsAge > MAILGUN_TIMESTAMP_MAX_AGE_S) {
      console.warn(`Webhook timestamp out of range: ${timestamp} (age: ${tsAge}s)`);
      res.status(401).json({ error: "Webhook timestamp expired" });
      return;
    }

    if (!verifyMailgunSignature(timestamp, token, signature)) {
      console.warn("Webhook HMAC validation failed");
      res.status(401).json({ error: "Invalid signature" });
      return;
    }
  }

  // --- Parse email ---
  const rawMessageId = body["Message-Id"] ?? body["message-id"];
  const fields: EmailFields = {
    from: String(body.from ?? ""),
    subject: String(body.subject ?? ""),
    "body-plain": String(body["body-plain"] ?? ""),
    "body-html": String(body["body-html"] ?? ""),
    "Message-Id": typeof rawMessageId === "string" && rawMessageId.length > 0
      ? rawMessageId
      : undefined,
  };

  const result = parseEmail(fields);

  if (!result.ok && result.reason === "skip") {
    console.log(`Webhook skip: ${result.detail}`);
    res.status(200).json({ status: "skipped", detail: result.detail });
    return;
  }

  if (!result.ok && result.reason === "parse_error") {
    console.error(`Webhook parse error: ${result.detail}`);
    res.status(200).json({ status: "parse_error", detail: result.detail });
    return;
  }

  if (!result.ok) {
    // Shouldn't reach here, but satisfies TypeScript narrowing
    res.status(200).json({ status: "unknown_error" });
    return;
  }

  const lead = result.lead;

  // --- Atomic dedup + insert (transaction prevents TOCTOU race) ---
  const leadRecord = runTransaction(() => {
    if (isEmailProcessed(lead.external_id)) return null;
    markEmailProcessed(lead.external_id, lead.platform);
    return insertLead({
      raw_email: lead.raw_text,
      source_platform: lead.platform,
      mailgun_message_id: lead.external_id,
      event_date: lead.event_date,
      event_type: lead.event_type,
      venue: lead.location ?? null,
    });
  });

  if (!leadRecord) {
    console.log(`Webhook dedup: ${lead.platform} ${lead.external_id} already processed`);
    res.status(200).json({ status: "duplicate" });
    return;
  }

  console.log(`Webhook received: ${lead.platform} lead #${leadRecord.id} (${lead.event_type})`);

  // --- Fire-and-forget pipeline with 2-minute timeout ---
  const PIPELINE_TIMEOUT_MS = 2 * 60 * 1000;

  Promise.race([
    runPipeline(lead.raw_text, undefined, lead.platform),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Pipeline timeout after 2 minutes")), PIPELINE_TIMEOUT_MS),
    ),
  ])
    .then((output) => postPipeline(leadRecord.id, output))
    .catch((err) =>
      postPipelineError(leadRecord.id, err).catch((innerErr) => {
        // Double fault: postPipelineError itself failed (Twilio down + DB write failed)
        // Last resort: log both errors. Nothing else we can do.
        console.error("postPipelineError failed:", innerErr);
        console.error("Original error:", err);
      }),
    );

  res.status(200).json({ status: "accepted", lead_id: leadRecord.id });
});

export default router;
