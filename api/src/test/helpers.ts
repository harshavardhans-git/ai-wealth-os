import request from "supertest";
import type { Express } from "express";
import { createApp } from "../app";
import { prisma } from "../lib/prisma";

/**
 * Integration-test helpers.
 *
 * These drive the real Express app in-process via Supertest — no port, no HTTP
 * server — which is exactly why app.ts separates "build the app" from "listen"
 * (Ch 6, Ch 13 §13.1).
 *
 * Isolation strategy: every test run creates its own users with unique emails and
 * deletes everything it made afterwards. That makes the suite safe to run against
 * a shared database, while CI still points at a throwaway Postgres container.
 */

export const app: Express = createApp();

const createdUserIds: string[] = [];

export interface TestUser {
  id: string;
  email: string;
  token: string;
  auth: { Authorization: string };
}

let counter = 0;

/** Signs up a fresh user and returns a ready-to-use auth header. */
export async function createUser(label = "user"): Promise<TestUser> {
  counter += 1;
  const email = `test_${label}_${Date.now()}_${counter}@example.test`;

  const response = await request(app)
    .post("/api/v1/auth/signup")
    .send({ email, password: "supersecret123", name: `Test ${label}` })
    .expect(201);

  const { accessToken, user } = response.body.data;
  createdUserIds.push(user.id);

  return {
    id: user.id,
    email,
    token: accessToken,
    auth: { Authorization: `Bearer ${accessToken}` },
  };
}

/**
 * Removes every row these tests created. Order matters: our foreign keys have no
 * cascade, so children must go before parents — deliberately, since a cascade on
 * financial data is a footgun.
 */
export async function cleanupUsers(): Promise<void> {
  if (createdUserIds.length === 0) return;
  const where = { userId: { in: createdUserIds } };

  await prisma.refreshToken.deleteMany({ where });
  await prisma.captureLog.deleteMany({ where });
  await prisma.transaction.deleteMany({ where });
  await prisma.budget.deleteMany({ where });
  await prisma.importBatch.deleteMany({ where });
  await prisma.account.deleteMany({ where });
  await prisma.category.deleteMany({ where });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });

  createdUserIds.length = 0;
}

/**
 * Signs up a user and hands back the raw response, so tests can inspect the
 * `Set-Cookie` header that `createUser` discards. Needed to exercise refresh
 * rotation, which is entirely a cookie-level behaviour.
 */
export async function signupRaw(label = "raw") {
  counter += 1;
  const email = `test_${label}_${Date.now()}_${counter}@example.test`;

  const response = await request(app)
    .post("/api/v1/auth/signup")
    .send({ email, password: "supersecret123", name: `Test ${label}` })
    .expect(201);

  createdUserIds.push(response.body.data.user.id);
  return { email, response, refreshCookie: refreshCookieFrom(response) };
}

/** Pulls the refresh cookie out of a Set-Cookie header, ready to send back. */
export function refreshCookieFrom(response: request.Response): string {
  const header = response.headers["set-cookie"] as unknown as
    | string[]
    | undefined;
  const cookie = (header ?? []).find((c) => c.startsWith("refresh_token="));
  if (!cookie) throw new Error("No refresh_token cookie on response");
  return cookie.split(";")[0]!;
}

/** POSTs /auth/refresh with an explicit cookie — the rotation entry point. */
export function postRefresh(cookie: string) {
  return request(app).post("/api/v1/auth/refresh").set("Cookie", cookie);
}

/** Convenience wrappers so tests read as intent, not plumbing. */
export const api = {
  get: (path: string, user: TestUser) =>
    request(app).get(`/api/v1${path}`).set(user.auth),
  post: (path: string, user: TestUser, body?: unknown) =>
    request(app).post(`/api/v1${path}`).set(user.auth).send(body ?? {}),
  patch: (path: string, user: TestUser, body?: unknown) =>
    request(app).patch(`/api/v1${path}`).set(user.auth).send(body ?? {}),
  delete: (path: string, user: TestUser) =>
    request(app).delete(`/api/v1${path}`).set(user.auth),
};

export async function makeAccount(
  user: TestUser,
  overrides: Record<string, unknown> = {},
) {
  const response = await api
    .post("/accounts", user, {
      name: "Test Bank",
      type: "bank",
      currency: "INR",
      ...overrides,
    })
    .expect(201);
  return response.body.data;
}

export async function expenseCategory(user: TestUser) {
  const response = await api.get("/categories", user).expect(200);
  return response.body.data.find(
    (category: { kind: string }) => category.kind === "expense",
  );
}
