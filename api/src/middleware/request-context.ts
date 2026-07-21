import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";

/**
 * Request id + structured request log (Ch 6 §6.10, Ch 7 §7.3, Ch 14 §14.5).
 *
 * Both chapters specified this and neither was implemented, so the only
 * observability in production was `console.error` in the error handler — a stack
 * trace with nothing to tie it to the request that caused it.
 *
 * The id is echoed in the `x-request-id` response header, so a user reporting
 * "it failed at 3pm" can hand over one string that finds the exact log line.
 * An inbound id is honoured when present, which is what makes the id survive
 * across services if this ever stops being a single API.
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

/** Fields that must never reach a log line, at any nesting depth. */
const REDACTED = new Set([
  "password",
  "passwordhash",
  "token",
  "accesstoken",
  "refreshtoken",
  "authorization",
  "cookie",
]);

/**
 * Logs as JSON because a log line is parsed by machines far more often than it
 * is read by people — and in development as text, because there it is only ever
 * read by a person.
 */
function emit(level: "info" | "warn" | "error", fields: Record<string, unknown>) {
  if (env.NODE_ENV === "test") return; // a test run should not narrate itself

  if (env.isProduction) {
    console.log(JSON.stringify({ level, time: new Date().toISOString(), ...fields }));
    return;
  }

  const { method, path, status, ms } = fields as Record<string, string>;
  console.log(`${method} ${path} ${status} ${ms}ms`);
}

export function requestContext(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const inbound = req.get("x-request-id");
  const requestId = inbound && inbound.length <= 100 ? inbound : randomUUID();

  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);

  const startedAt = process.hrtime.bigint();

  // 'finish' rather than wrapping res.send: it fires once, after the response is
  // actually written, so the status and duration are the real ones.
  res.on("finish", () => {
    const ms = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const level =
      res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";

    emit(level, {
      requestId,
      method: req.method,
      // req.path, never req.originalUrl: the query string carries filter values
      // — account ids, date ranges — and those are user data, not diagnostics.
      path: req.path,
      status: res.statusCode,
      ms: Math.round(ms * 10) / 10,
      userId: req.userId ?? null,
    });
  });

  next();
}

/** Strips sensitive keys before an object is logged. Exported for the error handler. */
export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, val]) =>
        REDACTED.has(key.toLowerCase()) ? [key, "[redacted]"] : [key, redact(val)],
      ),
    );
  }
  return value;
}
