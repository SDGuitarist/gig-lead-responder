import type { Request, Response, NextFunction } from "express";

/** Shared Basic Auth middleware. Skips auth if env vars are unset (local dev). */
export function basicAuth(req: Request, res: Response, next: NextFunction): void {
  const user = process.env.DASHBOARD_USER;
  const pass = process.env.DASHBOARD_PASS;

  if (!user || !pass) {
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
  const [u, p] = decoded.split(":");

  if (u === user && p === pass) {
    next();
  } else {
    res.setHeader("WWW-Authenticate", 'Basic realm="Gig Lead Dashboard"');
    res.status(401).send("Invalid credentials");
  }
}
