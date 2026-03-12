import type { Request, Response, NextFunction } from "express";
import { timingSafeEqual, createHmac, randomBytes } from "node:crypto";

// --- Cookie config ---

const COOKIE_NAME = "session";
const COOKIE_MAX_AGE_S = 14 * 24 * 60 * 60; // 14 days
const COOKIE_MAX_AGE_MS = COOKIE_MAX_AGE_S * 1000;

/** Get or generate COOKIE_SECRET. Falls back to random bytes in dev. */
function getCookieSecret(): string {
  if (process.env.COOKIE_SECRET) return process.env.COOKIE_SECRET;
  if (process.env.NODE_ENV === "production" || process.env.RAILWAY_ENVIRONMENT) {
    console.error("FATAL: COOKIE_SECRET must be set in production");
    process.exit(1);
  }
  console.warn("WARNING: Using random COOKIE_SECRET — sessions won't survive restarts");
  return randomBytes(32).toString("hex");
}

let cookieSecret: string | null = null;
function getSecret(): string {
  if (!cookieSecret) cookieSecret = getCookieSecret();
  return cookieSecret;
}

// --- Cookie signing (HMAC-SHA256) ---

interface CookiePayload {
  user: string;
  iat: number; // issued-at (epoch ms)
}

function signCookie(payload: CookiePayload): string {
  const data = JSON.stringify(payload);
  const encoded = Buffer.from(data).toString("base64url");
  const sig = createHmac("sha256", getSecret()).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

function verifyCookie(raw: string): CookiePayload | null {
  const dotIndex = raw.indexOf(".");
  if (dotIndex === -1) return null;

  const encoded = raw.slice(0, dotIndex);
  const sig = raw.slice(dotIndex + 1);

  const expected = createHmac("sha256", getSecret()).update(encoded).digest("base64url");
  if (!safeCompare(sig, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString()) as CookiePayload;

    // Check server-side expiry
    if (Date.now() - payload.iat > COOKIE_MAX_AGE_MS) return null;

    return payload;
  } catch {
    return null;
  }
}

// --- Helpers ---

/** Constant-time string comparison (safe for different-length strings). */
function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA); // keep constant time
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

function checkBasicAuth(req: Request): string | null {
  const user = process.env.DASHBOARD_USER;
  const pass = process.env.DASHBOARD_PASS;
  if (!user || !pass) return null;

  const header = req.headers.authorization;
  if (!header || !header.startsWith("Basic ")) return null;

  const decoded = Buffer.from(header.slice(6), "base64").toString();
  const colonIndex = decoded.indexOf(":");
  if (colonIndex === -1) return null;

  const u = decoded.slice(0, colonIndex);
  const p = decoded.slice(colonIndex + 1);

  if (safeCompare(u, user) && safeCompare(p, pass)) return u;
  return null;
}

function setSessionCookie(res: Response, username: string): void {
  const value = signCookie({ user: username, iat: Date.now() });
  const isProd = process.env.NODE_ENV === "production" || !!process.env.RAILWAY_ENVIRONMENT;
  res.cookie(COOKIE_NAME, value, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE_MS,
    path: "/",
  });
}

// --- Middleware ---

/**
 * Session auth middleware: cookie-first, Basic Auth fallback.
 * On successful Basic Auth, sets a long-lived signed cookie so subsequent
 * requests (phone bookmark, SMS deep links) don't need re-auth.
 */
export function sessionAuth(req: Request, res: Response, next: NextFunction): void {
  const user = process.env.DASHBOARD_USER;
  const pass = process.env.DASHBOARD_PASS;

  // Dev bypass when creds aren't set
  if (!user || !pass) {
    if (process.env.NODE_ENV === "production" || process.env.RAILWAY_ENVIRONMENT) {
      res.status(500).json({ error: "Server misconfigured — auth credentials missing" });
      return;
    }
    console.warn("WARNING: Auth disabled — DASHBOARD_USER/DASHBOARD_PASS not set");
    next();
    return;
  }

  // 1. Check cookie first
  const cookieRaw = req.cookies?.[COOKIE_NAME];
  if (cookieRaw) {
    const payload = verifyCookie(cookieRaw);
    if (payload) {
      next();
      return;
    }
  }

  // 2. Fallback to Basic Auth
  const authedUser = checkBasicAuth(req);
  if (authedUser) {
    // Set cookie so future requests skip Basic Auth prompt
    setSessionCookie(res, authedUser);
    next();
    return;
  }

  // 3. Not authenticated
  res.setHeader("WWW-Authenticate", 'Basic realm="Gig Lead Dashboard"');
  res.status(401).send("Authentication required");
}

/**
 * CSRF guard for state-changing dashboard requests.
 * Requires X-Requested-With: dashboard header on POSTs.
 */
export function csrfGuard(req: Request, res: Response, next: NextFunction): void {
  // Only check POST/PUT/DELETE (state-changing methods)
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    next();
    return;
  }

  if (req.headers["x-requested-with"] === "dashboard") {
    next();
    return;
  }

  res.status(403).json({ error: "CSRF check failed — missing X-Requested-With header" });
}

/** Clear session cookie and return JSON (agent-friendly). */
export function logout(_req: Request, res: Response): void {
  res.clearCookie(COOKIE_NAME, { path: "/" });
  res.json({ success: true });
}
