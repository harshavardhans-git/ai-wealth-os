/**
 * Typed application errors (Ch 7 §7.5).
 * Services THROW these; the central error handler translates them into the single
 * response envelope. Controllers never try/catch — they let errors bubble.
 */
export type AppErrorCode =
  | "VALIDATION"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL";

export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }

  static validation(message = "Invalid request", details?: unknown) {
    return new AppError("VALIDATION", message, 400, details);
  }

  static unauthorized(message = "Unauthorized") {
    return new AppError("UNAUTHORIZED", message, 401);
  }

  /**
   * For requests that are rejected on their SHAPE, not on what they own — a
   * cross-origin call, say. Ownership failures deliberately do NOT use this:
   * they return 404, so an attacker cannot tell "exists but yours" from
   * "does not exist" (Ch 10 §10.5).
   */
  static forbidden(message = "Forbidden") {
    return new AppError("FORBIDDEN", message, 403);
  }

  /** Used for cross-user access too — we return 404, never 403 (Ch 10 §10.5). */
  static notFound(message = "Not found") {
    return new AppError("NOT_FOUND", message, 404);
  }

  static conflict(message = "Already exists") {
    return new AppError("CONFLICT", message, 409);
  }

  static internal(message = "Something went wrong") {
    return new AppError("INTERNAL", message, 500);
  }
}
