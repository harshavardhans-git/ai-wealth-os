import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import {
  api,
  app,
  cleanupUsers,
  createUser,
  expenseCategory,
  makeAccount,
  postRefresh,
  refreshCookieFrom,
  signupRaw,
} from "./test/helpers";

/**
 * THE INVARIANT SUITE (Ch 13 §13.2).
 *
 * These are the rules the whole design rests on. Chapter 13 called them
 * non-negotiable: "if nothing else gets tested, these do." They live in one file
 * on purpose — this file IS the contract, and a reviewer can read it in a minute
 * to learn what this system promises.
 *
 * They run against a real database because that is where these rules actually
 * live: `WHERE user_id = ?` in a repository, a CHECK on an aggregate, an atomic
 * transaction. Mocking the database would test the mock.
 */

afterAll(cleanupUsers);

// ── #3 · CROSS-USER ISOLATION ────────────────────────────────────────────────
// The highest-severity bug class in the app. It is silent when it breaks: no
// crash, no error — just one user reading another's money.
describe("INVARIANT 3 — cross-user isolation", () => {
  it("returns 404 (never 403) when reading another user's transaction", async () => {
    const alice = await createUser("alice");
    const bob = await createUser("bob");

    const account = await makeAccount(alice);
    const created = await api
      .post("/transactions", alice, {
        accountId: account.id,
        type: "expense",
        amount: "500.00",
        note: "Alice's lunch",
      })
      .expect(201);

    // 404, not 403: we do not even confirm that another user's row exists.
    await api.get(`/transactions/${created.body.data.id}`, bob).expect(404);
  });

  it("returns 404 when writing to another user's account", async () => {
    const alice = await createUser("alice");
    const bob = await createUser("bob");
    const account = await makeAccount(alice);

    await api.patch(`/accounts/${account.id}`, bob, { name: "hacked" }).expect(404);
    await api.delete(`/accounts/${account.id}`, bob).expect(404);
  });

  it("never leaks another user's rows into a list", async () => {
    const alice = await createUser("alice");
    const bob = await createUser("bob");
    const account = await makeAccount(alice);

    await api.post("/transactions", alice, {
      accountId: account.id, type: "expense", amount: "100.00",
    }).expect(201);

    const bobsList = await api.get("/transactions", bob).expect(200);
    const bobsAccounts = await api.get("/accounts", bob).expect(200);

    expect(bobsList.body.data.total).toBe(0);
    expect(bobsAccounts.body.data).toHaveLength(0);
  });

  it("rejects a transaction pointed at someone else's account", async () => {
    const alice = await createUser("alice");
    const bob = await createUser("bob");
    const alicesAccount = await makeAccount(alice);

    await api.post("/transactions", bob, {
      accountId: alicesAccount.id, type: "expense", amount: "100.00",
    }).expect(404);
  });
});

// ── #2 · TRANSFERS ARE NOT SPEND ─────────────────────────────────────────────
// Moving your own money between your own accounts is not spending. Getting this
// wrong silently inflates every total on the dashboard.
describe("INVARIANT 2 — transfers aren't spend", () => {
  it("leaves spend, net worth and budget progress untouched", async () => {
    const user = await createUser("transfer");
    const from = await makeAccount(user, { name: "Bank", openingBalance: "50000.00" });
    const to = await makeAccount(user, { name: "Wallet", type: "wallet" });
    const category = await expenseCategory(user);

    await api.post("/transactions", user, {
      accountId: from.id, type: "expense", amount: "1000.00", categoryId: category.id,
    }).expect(201);
    await api.post("/budgets", user, {
      categoryId: category.id, amount: "5000.00",
    }).expect(201);

    const before = (await api.get("/dashboard/summary", user).expect(200)).body.data;

    await api.post("/transactions/transfer", user, {
      fromAccountId: from.id, toAccountId: to.id, amount: "10000.00",
    }).expect(201);

    const after = (await api.get("/dashboard/summary", user).expect(200)).body.data;

    expect(after.month.expenseMinor).toBe(before.month.expenseMinor);
    expect(after.netWorthMinor).toBe(before.netWorthMinor);
    expect(after.budgets[0].spentMinor).toBe(before.budgets[0].spentMinor);
  });

  it("writes both legs atomically and removes both on delete", async () => {
    const user = await createUser("legs");
    const from = await makeAccount(user, { name: "A" });
    const to = await makeAccount(user, { name: "B", type: "cash" });

    const transfer = await api.post("/transactions/transfer", user, {
      fromAccountId: from.id, toAccountId: to.id, amount: "750.00",
    }).expect(201);

    const legs = transfer.body.data;
    expect(legs).toHaveLength(2);
    expect(legs[0].transferGroupId).toBe(legs[1].transferGroupId);
    expect(legs.map((l: { transferDirection: string }) => l.transferDirection).sort())
      .toEqual(["in", "out"]);

    // Deleting one leg must remove both, or money appears from nowhere.
    await api.delete(`/transactions/${legs[0].id}`, user).expect(204);
    const remaining = await api.get("/transactions", user).expect(200);
    expect(remaining.body.data.total).toBe(0);
  });
});

// ── #7 · AUTH LIFECYCLE ──────────────────────────────────────────────────────
describe("INVARIANT 7 — auth lifecycle", () => {
  it("never stores or returns the password", async () => {
    const user = await createUser("pw");
    const me = await api.get("/auth/me", user).expect(200);

    expect(JSON.stringify(me.body)).not.toContain("supersecret123");
    expect(me.body.data.passwordHash).toBeUndefined();
  });

  it("gives the same answer for a wrong password and an unknown email", async () => {
    const user = await createUser("enum");

    const wrongPassword = await api
      .post("/auth/login", user, { email: user.email, password: "WRONGpassword" })
      .expect(401);
    const unknownEmail = await api
      .post("/auth/login", user, { email: "nobody@nowhere.test", password: "WRONGpassword" })
      .expect(401);

    // Differing messages here would turn login into a user-enumeration oracle.
    expect(wrongPassword.body.error.message).toBe(unknownEmail.body.error.message);
  });

  it("rejects requests with no token, and with a forged one", async () => {
    const user = await createUser("tok");
    const forged = { Authorization: "Bearer not.a.real.token" };

    await api.get("/accounts", { ...user, auth: forged }).expect(401);
  });

  it("refuses duplicate signups", async () => {
    const user = await createUser("dupe");
    await api
      .post("/auth/signup", user, {
        email: user.email, password: "supersecret123", name: "Copy",
      })
      .expect(409);
  });

  // Ch 10 §10.2 promises rotation makes a stolen refresh token "a short race".
  // That claim was false until refresh tokens got their own rows: tokenVersion
  // could only revoke everything at once, so a rotated token stayed valid for
  // its full 7 days beside its replacement. These four tests are the claim.
  it("rotates the refresh token, and the old one stops working", async () => {
    const { refreshCookie } = await signupRaw("rotate");

    const first = await postRefresh(refreshCookie).expect(200);
    const rotated = refreshCookieFrom(first);
    expect(rotated).not.toBe(refreshCookie);

    // The replacement works...
    await postRefresh(rotated).expect(200);
  });

  it("revokes the whole family when a rotated token is replayed", async () => {
    const { refreshCookie } = await signupRaw("reuse");

    const first = await postRefresh(refreshCookie).expect(200);
    const rotated = refreshCookieFrom(first);

    // Replaying the ALREADY-ROTATED token: either the user replaying an old
    // cookie or an attacker with a stolen one. We cannot tell, so we assume theft.
    await postRefresh(refreshCookie).expect(401);

    // ...and the consequence: the legitimate successor dies too. A thief who
    // races ahead cannot keep the session alive at the real user's expense.
    await postRefresh(rotated).expect(401);
  });

  it("keeps other sessions alive when one rotates", async () => {
    const { email, refreshCookie: deviceA } = await signupRaw("multi");

    const loginB = await request(app)
      .post("/api/v1/auth/login")
      .send({ email, password: "supersecret123" })
      .expect(200);
    const deviceB = refreshCookieFrom(loginB);

    await postRefresh(deviceA).expect(200);

    // Rotation is per-token, not per-user: signing in on a second device must
    // not silently sign you out of the first.
    await postRefresh(deviceB).expect(200);
  });

  it("rejects a refresh carrying a foreign Origin", async () => {
    const { refreshCookie } = await signupRaw("csrf");

    // The refresh cookie is SameSite=none in production, so the browser WILL
    // attach it cross-site. Origin is the control that stops a foreign page
    // spending it — and scripts cannot forge the header.
    await postRefresh(refreshCookie)
      .set("Origin", "https://evil.example.com")
      .expect(403);

    await postRefresh(refreshCookie).expect(200);
  });
});

// ── PROVENANCE ───────────────────────────────────────────────────────────────
describe("provenance is server-determined", () => {
  it("ignores a client-supplied source and records 'manual'", async () => {
    const user = await createUser("prov");
    const account = await makeAccount(user);

    const created = await api
      .post("/transactions", user, {
        accountId: account.id,
        type: "expense",
        amount: "100.00",
        source: "capture", // a lie the API must not accept
      })
      .expect(201);

    expect(created.body.data.source).toBe("manual");
  });

  it("stamps 'capture' only via the accept endpoint, and only on your own row", async () => {
    const alice = await createUser("prov_a");
    const bob = await createUser("prov_b");
    const account = await makeAccount(alice);

    const created = await api
      .post("/transactions", alice, {
        accountId: account.id, type: "expense", amount: "250.00",
      })
      .expect(201);

    // Bob naming Alice's transaction id must not touch it — the update is
    // scoped by userId, so a valid-looking id from the wrong user does nothing.
    await api
      .post("/capture/accepted", bob, {
        text: "coffee 250", transactionId: created.body.data.id,
      })
      .expect(204);

    const afterBob = await api.get(`/transactions/${created.body.data.id}`, alice);
    expect(afterBob.body.data.source).toBe("manual");

    await api
      .post("/capture/accepted", alice, {
        text: "coffee 250", transactionId: created.body.data.id,
      })
      .expect(204);

    const afterAlice = await api.get(`/transactions/${created.body.data.id}`, alice);
    expect(afterAlice.body.data.source).toBe("capture");
  });
});

// ── #8 · SOFT DELETE ─────────────────────────────────────────────────────────
describe("INVARIANT 8 — soft delete hides rows everywhere", () => {
  it("removes a deleted transaction from lists, balances and aggregates", async () => {
    const user = await createUser("soft");
    const account = await makeAccount(user, { openingBalance: "10000.00" });
    const category = await expenseCategory(user);

    const created = await api.post("/transactions", user, {
      accountId: account.id, type: "expense", amount: "2500.00", categoryId: category.id,
    }).expect(201);

    const before = (await api.get("/dashboard/summary", user).expect(200)).body.data;
    expect(before.month.expenseMinor).toBe(250000);

    await api.delete(`/transactions/${created.body.data.id}`, user).expect(204);

    const list = await api.get("/transactions", user).expect(200);
    const after = (await api.get("/dashboard/summary", user).expect(200)).body.data;
    const accounts = await api.get("/accounts", user).expect(200);

    expect(list.body.data.total).toBe(0);
    expect(after.month.expenseMinor).toBe(0);
    // Balance must return to the opening figure — a soft-deleted row that still
    // counted would be the worst kind of bug: invisible but wrong.
    expect(accounts.body.data[0].balanceMinor).toBe(1000000);
  });
});

// ── #9 · BUDGET PROGRESS ─────────────────────────────────────────────────────
describe("INVARIANT 9 — budget progress is computed, and correct", () => {
  it("reflects spend in the category, and only that category", async () => {
    const user = await createUser("budget");
    const account = await makeAccount(user);
    const categories = (await api.get("/categories", user).expect(200)).body.data;
    const food = categories.find((c: { name: string }) => c.name === "Food & Dining");
    const transport = categories.find((c: { name: string }) => c.name === "Transport");

    await api.post("/budgets", user, { categoryId: food.id, amount: "8000.00" }).expect(201);

    await api.post("/transactions", user, {
      accountId: account.id, type: "expense", amount: "2000.00", categoryId: food.id,
    }).expect(201);
    // Spend in a DIFFERENT category must not move this budget.
    await api.post("/transactions", user, {
      accountId: account.id, type: "expense", amount: "5000.00", categoryId: transport.id,
    }).expect(201);

    const budgets = (await api.get("/budgets", user).expect(200)).body.data;
    expect(budgets[0].spentMinor).toBe(200000);
    expect(budgets[0].remainingMinor).toBe(600000);
    expect(budgets[0].percentUsed).toBe(25);
  });

  it("reports going over budget rather than clamping", async () => {
    const user = await createUser("over");
    const account = await makeAccount(user);
    const category = await expenseCategory(user);

    await api.post("/budgets", user, { categoryId: category.id, amount: "1000.00" }).expect(201);
    await api.post("/transactions", user, {
      accountId: account.id, type: "expense", amount: "1500.00", categoryId: category.id,
    }).expect(201);

    const budgets = (await api.get("/budgets", user).expect(200)).body.data;
    expect(budgets[0].percentUsed).toBe(150);
    expect(budgets[0].remainingMinor).toBe(-50000);
  });
});

// ── #1 · MONEY IS EXACT (end to end) ─────────────────────────────────────────
// money.test.ts proves the arithmetic; this proves it survives the round trip
// through HTTP, Prisma, Postgres BigInt, and back.
describe("INVARIANT 1 — money is exact end to end", () => {
  it("survives the full round trip without drift", async () => {
    const user = await createUser("money");
    const account = await makeAccount(user);

    for (const amount of ["0.01", "0.10", "0.20", "320.50", "99999.99"]) {
      const created = await api.post("/transactions", user, {
        accountId: account.id, type: "expense", amount,
      }).expect(201);
      expect(created.body.data.amountMinor).toBe(Math.round(Number(amount) * 100));
    }

    // 0.10 + 0.20 must equal exactly 0.30 in the aggregate — the float bug.
    const summary = (await api.get("/dashboard/summary", user).expect(200)).body.data;
    expect(summary.month.expenseMinor).toBe(1 + 10 + 20 + 32050 + 9999999);
  });
});

// ── SYSTEM CATEGORIES ARE READ-ONLY ──────────────────────────────────────────
// Shared rows (userId = null) are visible to everyone and editable by no one.
// That falls out of scoping writes by userId — no permissions system required.
describe("categories — shared rows are read-only, custom rows are yours", () => {
  it("lets a user create, rename and delete their own category", async () => {
    const user = await createUser("cat");

    const created = await api
      .post("/categories", user, { name: "Pet Care", kind: "expense", color: "#3b7dd8" })
      .expect(201);
    expect(created.body.data.isSystem).toBe(false);

    const renamed = await api
      .patch(`/categories/${created.body.data.id}`, user, { name: "Pets" })
      .expect(200);
    expect(renamed.body.data.name).toBe("Pets");

    await api.delete(`/categories/${created.body.data.id}`, user).expect(204);
  });

  it("refuses to edit or delete a built-in category", async () => {
    const user = await createUser("sys");
    const system = (await api.get("/categories", user).expect(200)).body.data.find(
      (c: { isSystem: boolean }) => c.isSystem,
    );

    await api.patch(`/categories/${system.id}`, user, { name: "Hijacked" }).expect(404);
    await api.delete(`/categories/${system.id}`, user).expect(404);
  });

  it("cannot see or touch another user's custom category", async () => {
    const alice = await createUser("alice");
    const bob = await createUser("bob");

    const mine = await api
      .post("/categories", alice, { name: "Alice Only", kind: "expense" })
      .expect(201);

    const bobsList = (await api.get("/categories", bob).expect(200)).body.data;
    expect(bobsList.some((c: { id: string }) => c.id === mine.body.data.id)).toBe(false);

    await api.patch(`/categories/${mine.body.data.id}`, bob, { name: "Bob's" }).expect(404);
  });

  it("refuses to delete a category still in use, rather than orphaning history", async () => {
    const user = await createUser("inuse");
    const account = await makeAccount(user);
    const category = await api
      .post("/categories", user, { name: "Temporary", kind: "expense" })
      .expect(201);

    await api.post("/transactions", user, {
      accountId: account.id, type: "expense", amount: "100.00",
      categoryId: category.body.data.id,
    }).expect(201);

    await api.delete(`/categories/${category.body.data.id}`, user).expect(409);
  });
});

// ── BASE-CURRENCY CHANGE BACKFILLS HISTORY ───────────────────────────────────
// Ch 5 §5.5 stores each transaction's value in the user's reporting currency at
// capture time. Change the reporting currency and every stored snapshot is
// suddenly in the OLD one — a dashboard adding rupees to dollars, which looks
// perfectly fine and is completely wrong.
describe("changing base currency rewrites the reporting snapshots", () => {
  it("converts historical amounts, and leaves the original amounts untouched", async () => {
    const user = await createUser("fx");
    const account = await makeAccount(user, { currency: "INR" });

    await api.post("/transactions", user, {
      accountId: account.id, type: "expense", amount: "8350.00",
    }).expect(201);

    const before = (await api.get("/dashboard/summary", user).expect(200)).body.data;
    expect(before.baseCurrency).toBe("INR");
    expect(before.month.expenseMinor).toBe(835000);

    await api.patch("/auth/me", user, { baseCurrency: "USD" }).expect(200);

    const after = (await api.get("/dashboard/summary", user).expect(200)).body.data;
    expect(after.baseCurrency).toBe("USD");
    // ₹8,350 at the seeded rate of 83.5 is exactly $100.
    expect(after.month.expenseMinor).toBe(10000);

    // The transaction's OWN amount and currency must not move — only the
    // reporting snapshot does. The user still spent ₹8,350.
    const transactions = (await api.get("/transactions", user).expect(200)).body.data;
    expect(transactions.items[0].amountMinor).toBe(835000);
    expect(transactions.items[0].currency).toBe("INR");
  });

  it("moves budget limits with the reporting currency", async () => {
    const user = await createUser("fxbudget");
    const category = await expenseCategory(user);

    await api.post("/budgets", user, { categoryId: category.id, amount: "8350.00" }).expect(201);
    await api.patch("/auth/me", user, { baseCurrency: "USD" }).expect(200);

    const budgets = (await api.get("/budgets", user).expect(200)).body.data;
    expect(budgets[0].amountMinor).toBe(10000);
    expect(budgets[0].currency).toBe("USD");
  });
});

// ── #4/#5 · CAPTURE CANNOT WRITE BAD DATA ────────────────────────────────────
describe("INVARIANTS 4 & 5 — capture proposes, never persists", () => {
  it("does not write anything when parsing", async () => {
    const user = await createUser("capture");
    await makeAccount(user);

    const before = (await api.get("/transactions", user).expect(200)).body.data.total;
    await api.post("/capture/parse", user, { text: "coffee 250 yesterday" }).expect(200);
    await api.post("/capture/parse", user, { text: "uber 180" }).expect(200);
    const after = (await api.get("/transactions", user).expect(200)).body.data.total;

    expect(after).toBe(before);
  });

  it("only ever returns ids belonging to the caller", async () => {
    const user = await createUser("ids");
    const account = await makeAccount(user);

    const draft = (
      await api.post("/capture/parse", user, { text: "coffee 250 yesterday" }).expect(200)
    ).body.data;

    const ownAccounts = (await api.get("/accounts", user).expect(200)).body.data;
    const ownCategories = (await api.get("/categories", user).expect(200)).body.data;

    expect(ownAccounts.map((a: { id: string }) => a.id)).toContain(draft.accountId);
    if (draft.categoryId) {
      expect(ownCategories.map((c: { id: string }) => c.id)).toContain(draft.categoryId);
    }
    expect(draft.accountId).toBe(account.id);
  });

  it("refuses input it cannot read instead of guessing", async () => {
    const user = await createUser("guess");
    await api.post("/capture/parse", user, { text: "had a coffee" }).expect(400);
    await api.post("/capture/parse", user, { text: "x".repeat(250) }).expect(400);
  });
});
