/**
 * Adds `req.userId` to Express's Request type. Set ONLY by the requireAuth
 * middleware from a verified access token — identity never comes from the body
 * or query string (Ch 10 §10.4).
 */
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export {};
