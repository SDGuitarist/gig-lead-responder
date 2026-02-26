import rateLimit from "express-rate-limit";
import type { Request, Response } from "express";

// In-memory store resets on process restart (Railway deploys).
// Acceptable for single-user abuse protection — catches sustained
// runaway requests, not one-off spikes during deploys.
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function createLimitHandler(msg: string) {
  return (req: Request, res: Response) => {
    console.warn(`Rate limit hit: ${req.method} ${req.path} from ${req.ip}`);
    res.status(429).json({ error: msg });
  };
}

export const analyzeLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: 5,
  handler: createLimitHandler("Too many requests. Please wait before trying again."),
  standardHeaders: true,
  legacyHeaders: false,
});

export const approveLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: 10,
  handler: createLimitHandler("Too many requests. Please wait before trying again."),
  standardHeaders: true,
  legacyHeaders: false,
});
