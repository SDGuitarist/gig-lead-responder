import type { Request, Response, NextFunction } from "express";

/**
 * Global Express error handler. Registered last in server.ts.
 * Must have 4 parameters for Express to recognize it as error middleware.
 */
export const errorHandler = (err: unknown, req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  console.error(`[ERROR] ${req.method} ${req.path}:`, message);
  if (stack) console.error(stack);

  if (res.headersSent) {
    res.end();
    return;
  }

  const status =
    typeof (err as any).status === "number" &&
    (err as any).status >= 400 &&
    (err as any).status < 600
      ? (err as any).status
      : 500;

  const clientMessage =
    status >= 400 && status < 500 && (err as any).expose === true && message
      ? message
      : "Internal server error";

  res.status(status).json({ error: clientMessage });
};
