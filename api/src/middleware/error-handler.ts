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
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
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

  console.error("Unhandled error:", err);

  res.status(500).json({
    error: { code: "INTERNAL", message: "Something went wrong" },
  });
};
