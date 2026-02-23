import type { Request, Response, NextFunction } from "express";
import { timingSafeEqual } from "node:crypto";

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

/** Shared Basic Auth middleware. Exits in production if env vars are unset. */
export function basicAuth(req: Request, res: Response, next: NextFunction): void {
  const user = process.env.DASHBOARD_USER;
  const pass = process.env.DASHBOARD_PASS;

  if (!user || !pass) {
    if (process.env.NODE_ENV === "production" || process.env.RAILWAY_ENVIRONMENT) {
      console.error("FATAL: DASHBOARD_USER and DASHBOARD_PASS must be set in production");
      process.exit(1);
    }
    console.warn("WARNING: Auth disabled — DASHBOARD_USER/DASHBOARD_PASS not set");
    next();
    return;
  }

  const header = req.headers.authorization;
  if (!header || !header.startsWith("Basic ")) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Gig Lead Dashboard"');
    res.status(401).send("Authentication required");
    return;
  }

  const decoded = Buffer.from(header.slice(6), "base64").toString();
  const colonIndex = decoded.indexOf(":");
  if (colonIndex === -1) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Gig Lead Dashboard"');
    res.status(401).send("Invalid credentials");
    return;
  }
  const u = decoded.slice(0, colonIndex);
  const p = decoded.slice(colonIndex + 1);

  if (safeCompare(u, user) && safeCompare(p, pass)) {
    next();
  } else {
    res.setHeader("WWW-Authenticate", 'Basic realm="Gig Lead Dashboard"');
    res.status(401).send("Invalid credentials");
  }
}
