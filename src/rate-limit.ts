import rateLimit, { type Options } from "express-rate-limit";
import type { Request, Response, NextFunction } from "express";

// In-memory store resets on process restart (Railway deploys).
// Acceptable for single-user abuse protection — catches sustained
// runaway requests, not one-off spikes during deploys.
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

const handler = (
  req: Request,
  res: Response,
  _next: NextFunction,
  _options: Options,
) => {
  console.warn(`Rate limit hit: ${req.method} ${req.path} from ${req.ip}`);
  res.status(429).json({
    error: "Too many requests. Please wait before trying again.",
  });
};

export const analyzeLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: 5,
  handler,
  standardHeaders: true,
  legacyHeaders: false,
});

export const approveLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: 10,
  handler,
  standardHeaders: true,
  legacyHeaders: false,
});
