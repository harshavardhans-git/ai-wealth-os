import type { ErrorRequestHandler, RequestHandler } from "express";
import { AppError } from "../lib/app-error";

/** Any route that matched nothing. */
export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({
    error: { code: "NOT_FOUND", message: "Route not found" },
  });
};

/**
 * The LAST middleware. Every thrown error funnels here and becomes one consistent
 * envelope (Ch 7 §7.5). Internal details are logged server-side but never returned —
 * leaking a stack trace or SQL is an information-disclosure bug (Ch 12).
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
    return;
  }

  // Tagged with the request id so this trace can be tied to the access-log line
  // for the same request — a stack with no way to place it is half a clue.
  console.error(
    JSON.stringify({
      level: "error",
      time: new Date().toISOString(),
      requestId: req.requestId ?? null,
      path: req.path,
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    }),
  );

  res.status(500).json({
    error: {
      code: "INTERNAL",
      message: "Something went wrong",
      // The only internal detail we DO return: it carries no information about
      // the failure, but it lets a user point us straight at the log line.
      ...(req.requestId ? { requestId: req.requestId } : {}),
    },
  });
};
