import type { BudgetWithProgress } from "@wealth-os/types";
import { AppError } from "../../lib/app-error";
import { bigIntToNumber, toMinor } from "../../lib/money";
import { currentMonth } from "../../lib/period";
import { prisma } from "../../lib/prisma";
import { dashboardRepository } from "../dashboard/dashboard.repository";
import { budgetsRepository } from "./budgets.repository";
import type { CreateBudgetInput, UpdateBudgetInput } from "./budgets.schema";

type BudgetRow = Awaited<
  ReturnType<typeof budgetsRepository.listForUser>
>[number];

/**
 * Attaches live progress to budgets. Progress is COMPUTED on read (Ch 5 §5.4) —
 * storing "spent so far" would drift the moment a transaction is added, edited,
 * or deleted.
 */
function withProgress(
  budget: BudgetRow,
  spentByCategory: Map<string, number>,
): BudgetWithProgress {
  const amountMinor = bigIntToNumber(budget.amountMinor);
  const spentMinor = spentByCategory.get(budget.categoryId) ?? 0;

  return {
    id: budget.id,
    categoryId: budget.categoryId,
    period: "monthly",
    amountMinor,
    currency: budget.currency,
    startsOn: budget.startsOn.toISOString(),
    categoryName: budget.category.name,
    categoryColor: budget.category.color,
    spentMinor,
    remainingMinor: amountMinor - spentMinor,
    percentUsed: amountMinor === 0 ? 0 : Math.round((spentMinor / amountMinor) * 100),
  };
}

async function assertExpenseCategory(
  categoryId: string,
  userId: string,
): Promise<void> {
  const category = await prisma.category.findFirst({
    where: { id: categoryId, OR: [{ userId }, { userId: null }] },
  });

  if (!category) throw AppError.notFound("Category not found");

  // Budgeting an income category is meaningless — reject rather than silently
  // create something that can never show progress.
  if (category.kind !== "expense") {
    throw AppError.validation("Budgets can only be set on expense categories");
  }
}

export const budgetsService = {
  async list(userId: string): Promise<BudgetWithProgress[]> {
    const { start, end } = currentMonth();

    const [budgets, spend] = await Promise.all([
      budgetsRepository.listForUser(userId),
      dashboardRepository.spendPerCategory(userId, start, end),
    ]);

    const spentByCategory = new Map(
      spend.map((row) => [row.category_id, bigIntToNumber(row.total)]),
    );

    return budgets.map((budget) => withProgress(budget, spentByCategory));
  },

  async create(
    userId: string,
    input: CreateBudgetInput,
  ): Promise<BudgetWithProgress> {
    await assertExpenseCategory(input.categoryId, userId);

    const amountMinor = toMinor(input.amount);
    if (amountMinor <= 0) {
      throw AppError.validation("Budget amount must be greater than zero");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { baseCurrency: true },
    });
    if (!user) throw AppError.unauthorized();

    const startsOn = input.startsOn
      ? new Date(input.startsOn)
      : currentMonth().start;

    const existing = await prisma.budget.findFirst({
      where: { userId, categoryId: input.categoryId, period: "monthly", startsOn },
    });
    if (existing) {
      throw AppError.conflict("A budget already exists for that category this period");
    }

    const budget = await budgetsRepository.create({
      userId,
      categoryId: input.categoryId,
      period: "monthly",
      amountMinor: BigInt(amountMinor),
      currency: input.currency ?? user.baseCurrency,
      startsOn,
    });

    const { start, end } = currentMonth();
    const spend = await dashboardRepository.spendPerCategory(userId, start, end);
    const spentByCategory = new Map(
      spend.map((row) => [row.category_id, bigIntToNumber(row.total)]),
    );

    return withProgress(budget, spentByCategory);
  },

  async update(
    id: string,
    userId: string,
    input: UpdateBudgetInput,
  ): Promise<BudgetWithProgress> {
    const amountMinor = toMinor(input.amount);
    if (amountMinor <= 0) {
      throw AppError.validation("Budget amount must be greater than zero");
    }

    const { count } = await budgetsRepository.updateForUser(id, userId, {
      amountMinor: BigInt(amountMinor),
    });
    if (count === 0) throw AppError.notFound("Budget not found");

    const budget = await budgetsRepository.findByIdForUser(id, userId);
    if (!budget) throw AppError.notFound("Budget not found");

    const { start, end } = currentMonth();
    const spend = await dashboardRepository.spendPerCategory(userId, start, end);

    return withProgress(
      budget,
      new Map(spend.map((row) => [row.category_id, bigIntToNumber(row.total)])),
    );
  },

  async remove(id: string, userId: string): Promise<void> {
    const { count } = await budgetsRepository.deleteForUser(id, userId);
    if (count === 0) throw AppError.notFound("Budget not found");
  },
};
