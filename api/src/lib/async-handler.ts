import type { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Express 4 does not catch errors thrown inside async handlers — an unhandled
 * rejection would hang the request. Wrapping a handler here forwards any rejection
 * to next(), so it reaches the central error handler (Ch 7 §7.5).
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
