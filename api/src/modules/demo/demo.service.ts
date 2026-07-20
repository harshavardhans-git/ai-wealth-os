import type { Prisma } from "@prisma/client";
import { AppError } from "../../lib/app-error";
import { toMinor } from "../../lib/money";
import { prisma } from "../../lib/prisma";

/**
 * The demo dataset (Ch 11 §11.5) — treated as engineered product content, not a
 * dev convenience. It is the recruiter's first impression: the dashboard must
 * look full and believable within seconds of signing up (Ch 3 DoD item 2).
 *
 * Deterministic by design: a seeded PRNG means the same account always produces
 * the same data, so the demo is reproducible and screenshots stay stable.
 */

/** Small LCG — deterministic pseudo-randomness without a dependency. */
function makeRandom(seed: number): () => number {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

interface SpendPattern {
  category: string;
  merchants: string[];
  min: number;
  max: number;
  /** Roughly how many times per month this happens. */
  perMonth: number;
}

const SPEND_PATTERNS: SpendPattern[] = [
  {
    category: "Food & Dining",
    merchants: ["Swiggy", "Zomato", "Third Wave Coffee", "Rameshwaram Cafe", "Blue Tokai"],
    min: 150, max: 900, perMonth: 12,
  },
  {
    category: "Groceries",
    merchants: ["BigBasket", "Zepto", "More Supermarket", "Ratnadeep"],
    min: 800, max: 2800, perMonth: 5,
  },
  {
    category: "Transport",
    merchants: ["Uber", "Rapido", "Ola", "Metro recharge", "Indian Oil"],
    min: 80, max: 520, perMonth: 10,
  },
  {
    category: "Shopping",
    merchants: ["Amazon", "Myntra", "Decathlon", "Croma"],
    min: 600, max: 4500, perMonth: 3,
  },
  {
    category: "Entertainment",
    merchants: ["PVR Cinemas", "BookMyShow", "Steam"],
    min: 300, max: 1400, perMonth: 2,
  },
  {
    category: "Health",
    merchants: ["Apollo Pharmacy", "PharmEasy", "Practo consult"],
    min: 250, max: 1800, perMonth: 1,
  },
];

/** Same amount, same day, every month. */
const RECURRING = [
  { category: "Rent & Housing", merchant: "Rent — 2BHK", amount: 22000, day: 3 },
  { category: "Utilities", merchant: "TSSPDCL electricity", amount: 1840, day: 8 },
  { category: "Utilities", merchant: "ACT Fibernet", amount: 799, day: 8 },
  { category: "Subscriptions", merchant: "Netflix", amount: 649, day: 12 },
  { category: "Subscriptions", merchant: "Spotify", amount: 119, day: 12 },
  { category: "Subscriptions", merchant: "Cult.fit membership", amount: 1499, day: 15 },
];

const BUDGETS = [
  { category: "Food & Dining", amount: 9000 },
  { category: "Groceries", amount: 8000 },
  { category: "Transport", amount: 4000 },
  { category: "Shopping", amount: 6000 },
  { category: "Entertainment", amount: 2000 },
];

/** Pre-cached AI parses so the Sprint 4 capture demo is instant and free. */
const AI_SAMPLES = [
  { input: "coffee 250 yesterday", category: "Food & Dining", amount: 250 },
  { input: "uber to office 180", category: "Transport", amount: 180 },
  { input: "groceries 1450 at bigbasket", category: "Groceries", amount: 1450 },
  { input: "movie tickets 700 saturday", category: "Entertainment", amount: 700 },
  { input: "amazon order 2300", category: "Shopping", amount: 2300 },
];

const MONTHS_OF_HISTORY = 3;

export const demoService = {
  /**
   * Populates the CURRENT user's account with demo data. Refuses if they already
   * have accounts — this should feel like a one-time "show me what this looks
   * like", never something that silently duplicates their real data.
   */
  async seedForUser(userId: string): Promise<{
    accounts: number;
    transactions: number;
    budgets: number;
  }> {
    const existing = await prisma.account.count({
      where: { userId, deletedAt: null },
    });
    if (existing > 0) {
      throw AppError.conflict(
        "Demo data can only be loaded into an empty account",
      );
    }

    const categories = await prisma.category.findMany({
      where: { OR: [{ userId }, { userId: null }] },
    });
    const categoryByName = new Map(categories.map((c) => [c.name, c]));
    const categoryId = (name: string) => categoryByName.get(name)?.id ?? null;

    const [bank, card, cash, wallet] = await Promise.all([
      prisma.account.create({
        data: { userId, name: "HDFC Bank", type: "bank", currency: "INR",
          openingBalanceMinor: BigInt(toMinor("64000.00")) },
      }),
      prisma.account.create({
        data: { userId, name: "HDFC Credit Card", type: "card", currency: "INR",
          openingBalanceMinor: BigInt(0) },
      }),
      prisma.account.create({
        data: { userId, name: "Cash", type: "cash", currency: "INR",
          openingBalanceMinor: BigInt(toMinor("3500.00")) },
      }),
      prisma.account.create({
        data: { userId, name: "Paytm Wallet", type: "wallet", currency: "INR",
          openingBalanceMinor: BigInt(toMinor("1200.00")) },
      }),
    ]);

    const random = makeRandom(userId.charCodeAt(0) + userId.length * 7919);
    const rows: Prisma.TransactionCreateManyInput[] = [];

    const base = (
      occurredAt: Date,
      accountId: string,
      type: "income" | "expense",
      amount: number,
      note: string,
      category: string | null,
    ): Prisma.TransactionCreateManyInput => {
      const minor = BigInt(toMinor(amount.toFixed(2)));
      return {
        userId, accountId, type, amountMinor: minor, currency: "INR",
        amountBaseMinor: minor, occurredAt, note,
        categoryId: category ? categoryId(category) : null,
        source: "import",
      };
    };

    const now = new Date();
    const startMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (MONTHS_OF_HISTORY - 1), 1),
    );

    for (let m = 0; m < MONTHS_OF_HISTORY; m += 1) {
      const monthStart = new Date(
        Date.UTC(startMonth.getUTCFullYear(), startMonth.getUTCMonth() + m, 1),
      );
      const daysInMonth = new Date(
        Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0),
      ).getUTCDate();

      const dayOf = (day: number) =>
        new Date(
          Date.UTC(
            monthStart.getUTCFullYear(),
            monthStart.getUTCMonth(),
            Math.min(day, daysInMonth),
            10,
          ),
        );

      // Salary on the 1st — the anchor of a believable month.
      rows.push(base(dayOf(1), bank.id, "income", 85000, "Monthly salary", "Salary"));

      // An occasional freelance top-up so income isn't perfectly flat.
      if (random() > 0.55) {
        rows.push(
          base(dayOf(18 + Math.floor(random() * 6)), bank.id, "income",
            8000 + Math.floor(random() * 12000), "Freelance project", "Freelance"),
        );
      }

      for (const item of RECURRING) {
        rows.push(
          base(dayOf(item.day), bank.id, "expense", item.amount, item.merchant, item.category),
        );
      }

      for (const pattern of SPEND_PATTERNS) {
        const count = Math.max(1, Math.round(pattern.perMonth * (0.75 + random() * 0.5)));
        for (let i = 0; i < count; i += 1) {
          const day = 1 + Math.floor(random() * daysInMonth);
          const amount =
            pattern.min + Math.floor(random() * (pattern.max - pattern.min));
          const merchant =
            pattern.merchants[Math.floor(random() * pattern.merchants.length)]!;
          // Bigger buys land on the card, small everyday spend on bank/cash.
          const account =
            amount > 1500 ? card : random() > 0.75 ? cash : bank;
          rows.push(
            base(dayOf(day), account.id, "expense", amount, merchant, pattern.category),
          );
        }
      }

      // Card bill payment as a transfer pair — keeps balances honest without
      // counting as spend.
      const settle = new Date(
        Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), Math.min(25, daysInMonth), 10),
      );
      const groupId = crypto.randomUUID();
      const settleAmount = BigInt(toMinor("6000.00"));
      rows.push(
        { userId, accountId: bank.id, type: "transfer", amountMinor: settleAmount,
          currency: "INR", amountBaseMinor: settleAmount, occurredAt: settle,
          note: "Credit card payment", categoryId: null, source: "manual",
          transferGroupId: groupId, transferDirection: "out" },
        { userId, accountId: card.id, type: "transfer", amountMinor: settleAmount,
          currency: "INR", amountBaseMinor: settleAmount, occurredAt: settle,
          note: "Credit card payment", categoryId: null, source: "manual",
          transferGroupId: groupId, transferDirection: "in" },
      );
    }

    // A little wallet activity so all four accounts show life.
    rows.push(
      base(new Date(Date.now() - 4 * 86_400_000), wallet.id, "expense", 240, "Metro recharge", "Transport"),
      base(new Date(Date.now() - 9 * 86_400_000), wallet.id, "expense", 180, "Chai & snacks", "Food & Dining"),
    );

    await prisma.transaction.createMany({ data: rows });

    const monthStartNow = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const budgetRows = BUDGETS.map((budget) => ({
      userId,
      categoryId: categoryId(budget.category)!,
      period: "monthly",
      amountMinor: BigInt(toMinor(budget.amount.toFixed(2))),
      currency: "INR",
      startsOn: monthStartNow,
    })).filter((budget) => budget.categoryId);

    await prisma.budget.createMany({ data: budgetRows });

    // Warm the AI cache so Sprint 4's capture demo is instant and costs nothing.
    await prisma.aiParseLog.createMany({
      data: AI_SAMPLES.map((sample) => ({
        userId,
        inputText: sample.input,
        parsedJson: {
          type: "expense",
          amountMinor: toMinor(sample.amount.toFixed(2)),
          currency: "INR",
          categoryId: categoryId(sample.category),
          accountId: bank.id,
          occurredAt: new Date().toISOString(),
          note: sample.input,
          confidence: 0.95,
        },
        model: "seeded-demo",
        confidence: 0.95,
        accepted: true,
      })),
    });

    return { accounts: 4, transactions: rows.length, budgets: budgetRows.length };
  },
};
