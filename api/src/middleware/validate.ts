import type { RequestHandler } from "express";
import { ZodError, type ZodTypeAny } from "zod";
import { AppError } from "../lib/app-error";

interface RequestSchemas {
  body?: ZodTypeAny;
  params?: ZodTypeAny;
  query?: ZodTypeAny;
}

/**
 * Validates request input at the boundary BEFORE it reaches business logic
 * (Ch 7 §7.4). This is both a correctness and a security control — never trust the
 * client, even your own.
 */
export const validate =
  (schemas: RequestSchemas): RequestHandler =>
  (req, _res, next) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.params) Object.assign(req.params, schemas.params.parse(req.params));
      if (schemas.query) Object.assign(req.query, schemas.query.parse(req.query));
      next();
    } catch (error) {
      const details =
        error instanceof ZodError ? error.flatten().fieldErrors : undefined;
      next(AppError.validation("Invalid request", details));
    }
  };
