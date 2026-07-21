import type { NextConfig } from "next";

/**
 * Security headers for the HTML origin (Ch 12 §12.2).
 *
 * `helmet()` on the API only protects a JSON endpoint — nothing it sets reaches
 * the document that actually renders a user's finances. These headers belong
 * here, on the origin a browser treats as the app.
 *
 * The API base URL is inlined at build time so the CSP can name exactly one
 * backend as a permitted connect target.
 */
const API_ORIGIN = (() => {
  const raw = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  try {
    return new URL(raw).origin;
  } catch {
    return "http://localhost:4000";
  }
})();

const csp = [
  "default-src 'self'",
  // 'unsafe-inline' is required by the pre-paint theme script and Next's
  // hydration bootstrap. Removing it means adopting nonces — worth doing, but a
  // deliberate change rather than a silent one.
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  `connect-src 'self' ${API_ORIGIN}`,
  "frame-ancestors 'none'", // clickjacking: no one may frame this app
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Belt-and-braces for browsers that predate frame-ancestors.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
