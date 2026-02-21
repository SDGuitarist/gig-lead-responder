import { createHmac, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { parseEmail } from "./email-parser.js";
import { insertLead, isEmailProcessed, markEmailProcessed } from "./leads.js";
import { runPipeline } from "./run-pipeline.js";
import { postPipeline, postPipelineError } from "./post-pipeline.js";

const router = Router();

// Mailgun sends form-encoded POST bodies
router.use("/webhook/mailgun", (req, _res, next) => {
  // express.urlencoded() for this route only
  if (!req.is("application/x-www-form-urlencoded")) {
    next();
    return;
  }
  next();
});

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

router.post("/webhook/mailgun", (req, res) => {
  const body = req.body;

  // --- HMAC validation ---
  const timestamp = body.timestamp as string | undefined;
  const token = body.token as string | undefined;
  const signature = body.signature as string | undefined;

  if (!timestamp || !token || !signature) {
    console.warn("Webhook missing signature fields");
    res.status(401).json({ error: "Missing signature fields" });
    return;
  }

  if (process.env.DISABLE_MAILGUN_VALIDATION === "true") {
    console.warn("⚠ Mailgun signature validation disabled via DISABLE_MAILGUN_VALIDATION");
  } else if (!verifyMailgunSignature(timestamp, token, signature)) {
    console.warn("Webhook HMAC validation failed");
    res.status(401).json({ error: "Invalid signature" });
    return;
  }

  // --- Parse email ---
  const fields = {
    from: (body.from as string) || "",
    subject: (body.subject as string) || "",
    "body-plain": (body["body-plain"] as string) || "",
    "body-html": (body["body-html"] as string) || "",
    "Message-Id": (body["Message-Id"] as string) || (body["message-id"] as string) || undefined,
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

  // --- Idempotency check ---
  if (isEmailProcessed(lead.external_id)) {
    console.log(`Webhook dedup: ${lead.platform} ${lead.external_id} already processed`);
    res.status(200).json({ status: "duplicate" });
    return;
  }

  // --- Insert into processed_emails + create LeadRecord ---
  markEmailProcessed(lead.external_id, lead.platform);

  const leadRecord = insertLead({
    raw_email: lead.raw_text,
    source_platform: lead.platform,
    mailgun_message_id: lead.external_id,
    event_date: lead.event_date,
    event_type: lead.event_type,
    venue: lead.location ?? null,
  });

  console.log(`Webhook received: ${lead.platform} lead #${leadRecord.id} (${lead.event_type})`);

  // --- Fire-and-forget pipeline with post-processing ---
  runPipeline(lead.raw_text)
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
