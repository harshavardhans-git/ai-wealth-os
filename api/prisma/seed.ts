import "dotenv/config";
import { PrismaClient } from "@prisma/client";

/**
 * Seed script (Ch 11 §11.5).
 * Currently seeds the shared SYSTEM categories that every user sees. The richer
 * demo dataset (accounts, ~3 months of transactions, budgets, cached AI parses)
 * lands in Sprint 3, where it is treated as engineered product content.
 *
 * Idempotent: safe to run repeatedly.
 */
const prisma = new PrismaClient();

const SYSTEM_CATEGORIES: Array<{
  name: string;
  kind: "income" | "expense";
  color: string;
}> = [
  // Expense
  { name: "Food & Dining", kind: "expense", color: "#e2703a" },
  { name: "Groceries", kind: "expense", color: "#3f9d5a" },
  { name: "Transport", kind: "expense", color: "#3b7dd8" },
  { name: "Rent & Housing", kind: "expense", color: "#8a5cd6" },
  { name: "Utilities", kind: "expense", color: "#4aa3a3" },
  { name: "Shopping", kind: "expense", color: "#d1477a" },
  { name: "Entertainment", kind: "expense", color: "#9a58c4" },
  { name: "Health", kind: "expense", color: "#d94f4f" },
  { name: "Education", kind: "expense", color: "#2f8fbf" },
  { name: "Subscriptions", kind: "expense", color: "#7b6cf6" },
  { name: "Travel", kind: "expense", color: "#c98b1e" },
  { name: "Miscellaneous", kind: "expense", color: "#7a8290" },
  // Income
  { name: "Salary", kind: "income", color: "#0d7a53" },
  { name: "Freelance", kind: "income", color: "#12967e" },
  { name: "Interest", kind: "income", color: "#4a8f2f" },
  { name: "Refunds", kind: "income", color: "#5f9ea0" },
  { name: "Gifts", kind: "income", color: "#b56db0" },
  { name: "Other", kind: "income", color: "#7a8290" },
];

async function seedSystemCategories(): Promise<void> {
  let created = 0;

  for (const category of SYSTEM_CATEGORIES) {
    // NOTE: we check-then-create rather than upsert. Postgres treats NULLs as
    // distinct in UNIQUE constraints, so @@unique([userId, name, kind]) does NOT
    // block duplicate system rows (where userId IS NULL). A partial unique index
    // is the proper long-term fix; this keeps the seed idempotent meanwhile.
    const existing = await prisma.category.findFirst({
      where: { userId: null, name: category.name, kind: category.kind },
    });

    if (!existing) {
      await prisma.category.create({
        data: { ...category, isSystem: true },
      });
      created += 1;
    }
  }

  console.log(
    `✅ system categories: ${created} created, ${SYSTEM_CATEGORIES.length - created} already present`,
  );
}

async function main(): Promise<void> {
  await seedSystemCategories();
}

main()
  .catch((error) => {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
