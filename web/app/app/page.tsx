"use client";

import Link from "next/link";
import { MoneyText } from "@/components/patterns/money-text";
import { StatTile } from "@/components/patterns/stat-tile";
import { CashFlowChart } from "@/components/charts/cash-flow-chart";
import { CategoryBars } from "@/components/charts/category-bars";
import { BudgetMeter } from "@/components/charts/budget-meter";
import {
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/ui/card";
import { useDashboard } from "@/hooks/use-finance";
import { useAuth } from "@/providers/auth-provider";

/**
 * The "how am I doing?" screen (Ch 3 DoD item 5).
 * One request to /dashboard/summary — the server does the aggregation, so the
 * client isn't stitching six calls together.
 */
export default function DashboardPage() {
  const { user } = useAuth();
  const { data, isLoading, isError } = useDashboard();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <Card>
          <LoadingState />
        </Card>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <Card>
          <ErrorState message="Could not load your dashboard." />
        </Card>
      </div>
    );
  }

  const currency = data.baseCurrency;
  const hasActivity =
    data.month.incomeMinor > 0 ||
    data.month.expenseMinor > 0 ||
    data.netWorthMinor !== 0;

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Hello, {user?.name}
        </h1>
        <p className="text-sm text-[var(--text-muted)]">
          {data.month.label} · here&rsquo;s where your money stands.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          label="Net position"
          value={<MoneyText amountMinor={data.netWorthMinor} currency={currency} />}
          caption="Across all accounts"
        />
        <StatTile
          label="In this month"
          value={
            <MoneyText
              amountMinor={data.month.incomeMinor}
              currency={currency}
              type="income"
            />
          }
        />
        <StatTile
          label="Out this month"
          value={
            <MoneyText
              amountMinor={data.month.expenseMinor}
              currency={currency}
              type="expense"
            />
          }
          caption={`Net ${data.month.netMinor >= 0 ? "+" : ""}${(data.month.netMinor / 100).toFixed(2)}`}
        />
      </div>

      {!hasActivity && (
        <Card>
          <EmptyState message="No activity yet — add an account and a transaction to see your dashboard come alive." />
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-medium">Cash flow · last 6 months</h2>
          <CashFlowChart data={data.cashFlow} currency={currency} />
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 text-sm font-medium">
            Spend by category · {data.month.label}
          </h2>
          {data.spendByCategory.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--text-muted)]">
              No spending recorded this month.
            </p>
          ) : (
            <CategoryBars data={data.spendByCategory} currency={currency} />
          )}
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Budgets"
          action={
            <Link
              href="/app/budgets"
              className="text-xs text-[var(--primary)] hover:underline"
            >
              Manage
            </Link>
          }
        />
        {data.budgets.length === 0 ? (
          <EmptyState message="No budgets yet — set one to track your spending against a limit." />
        ) : (
          <div className="space-y-5 px-5 py-4">
            {data.budgets.map((budget) => (
              <BudgetMeter
                key={budget.id}
                budget={budget}
                currency={currency}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
