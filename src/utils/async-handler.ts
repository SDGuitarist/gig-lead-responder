import type { Request, Response, NextFunction } from "express";

/**
 * Wraps an async Express route handler so rejected promises
 * are forwarded to Express error middleware (required for Express v4).
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}
