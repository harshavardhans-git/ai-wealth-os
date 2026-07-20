import type { ApiResponse } from "@wealth-os/types";

/**
 * The typed API client (Ch 8 §8.4).
 * Every network call goes through here so that auth headers, the response envelope,
 * and error shaping are handled in exactly one place. Return types come from
 * @wealth-os/types, so a backend contract change breaks the build here.
 */
const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

/**
 * Access token lives in MEMORY only — never localStorage, which XSS can read
 * (Ch 10 §10.1). It disappears on refresh and is re-obtained via the httpOnly
 * refresh cookie.
 */
let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    credentials: "include", // send the httpOnly refresh cookie where relevant
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init.headers,
    },
  });

  const body = (await response.json().catch(() => null)) as ApiResponse<T> | null;

  if (!response.ok || !body || "error" in body) {
    const failure =
      body && "error" in body
        ? body.error
        : { code: "INTERNAL", message: response.statusText };
    throw new ApiError(failure.code, failure.message, response.status);
  }

  return body.data;
}
