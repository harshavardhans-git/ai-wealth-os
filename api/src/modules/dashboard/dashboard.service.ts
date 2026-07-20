import type { DashboardSummary } from "@ai-wealth-os/types";
import { AppError } from "../../lib/app-error";
import { convertMinor } from "../../lib/fx";
import { bigIntToNumber } from "../../lib/money";
import {
  currentMonth,
  monthKey,
  monthLabel,
  monthsAgo,
} from "../../lib/period";
import { prisma } from "../../lib/prisma";
import { accountsService } from "../accounts/accounts.service";
import { budgetsService } from "../budgets/budgets.service";
import { dashboardRepository } from "./dashboard.repository";

const CASH_FLOW_MONTHS = 6;

export const dashboardService = {
  /**
   * The read-model behind "how am I doing?" (Ch 4 §4.2, DoD item 5).
   * One endpoint, several aggregates — so the dashboard is a single round trip
   * rather than the client stitching six calls together.
   */
  async getSummary(userId: string): Promise<DashboardSummary> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { baseCurrency: true },
    });
    if (!user) throw AppError.unauthorized();

    const base = user.baseCurrency;
    const { start, end } = currentMonth();
    const cashFlowSince = monthsAgo(CASH_FLOW_MONTHS);

    const [accounts, totals, categorySpend, cashFlowRows, budgets] =
      await Promise.all([
        accountsService.list(userId),
        dashboardRepository.monthTotals(userId, start, end),
        dashboardRepository.spendByCategory(userId, start, end),
        dashboardRepository.cashFlowByMonth(userId, cashFlowSince),
        budgetsService.list(userId),
      ]);

    // Account balances are in each account's own currency; convert before summing
    // so a multi-currency user still gets one meaningful net figure (Ch 5 §5.5).
    const netWorthMinor = accounts.reduce(
      (total, account) =>
        total + convertMinor(account.balanceMinor, account.currency, base),
      0,
    );

    const findTotal = (type: string) =>
      bigIntToNumber(totals.find((row) => row.type === type)?.total ?? 0n);

    const incomeMinor = findTotal("income");
    const expenseMinor = findTotal("expense");

    // Fill gaps so the chart shows a continuous 6-month axis even in months with
    // no activity — a chart that silently skips months misleads the reader.
    const byMonth = new Map(
      cashFlowRows.map((row) => [
        monthKey(row.month),
        {
          incomeMinor: bigIntToNumber(row.income),
          expenseMinor: bigIntToNumber(row.expense),
        },
      ]),
    );

    const cashFlow = Array.from({ length: CASH_FLOW_MONTHS }, (_, index) => {
      const date = new Date(
        Date.UTC(
          cashFlowSince.getUTCFullYear(),
          cashFlowSince.getUTCMonth() + index,
          1,
        ),
      );
      const key = monthKey(date);
      return {
        month: key,
        incomeMinor: byMonth.get(key)?.incomeMinor ?? 0,
        expenseMinor: byMonth.get(key)?.expenseMinor ?? 0,
      };
    });

    return {
      baseCurrency: base,
      netWorthMinor,
      month: {
        label: monthLabel(start),
        incomeMinor,
        expenseMinor,
        netMinor: incomeMinor - expenseMinor,
      },
      spendByCategory: categorySpend.map((row) => ({
        categoryId: row.category_id,
        name: row.name ?? "Uncategorized",
        color: row.color,
        amountMinor: bigIntToNumber(row.total),
      })),
      cashFlow,
      budgets,
    };
  },
};
