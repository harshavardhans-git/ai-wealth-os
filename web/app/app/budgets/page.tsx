"use client";

import { useMemo, useState } from "react";
import { BudgetMeter } from "@/components/charts/budget-meter";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import {
  useBudgets,
  useCategories,
  useCreateBudget,
  useDeleteBudget,
} from "@/hooks/use-finance";
import { useAuth } from "@/providers/auth-provider";

export default function BudgetsPage() {
  const { user } = useAuth();
  const budgets = useBudgets();
  const categories = useCategories();
  const createBudget = useCreateBudget();
  const deleteBudget = useDeleteBudget();

  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  const currency = user?.baseCurrency ?? "INR";

  // Budgets only make sense on expense categories, and only one per category.
  const available = useMemo(() => {
    const taken = new Set((budgets.data ?? []).map((b) => b.categoryId));
    return (categories.data ?? []).filter(
      (category) => category.kind === "expense" && !taken.has(category.id),
    );
  }, [categories.data, budgets.data]);

  const effectiveCategoryId = categoryId || available[0]?.id || "";

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!effectiveCategoryId) {
      setError("Every expense category already has a budget.");
      return;
    }

    try {
      await createBudget.mutateAsync({
        categoryId: effectiveCategoryId,
        amount,
      });
      setAmount("");
      setCategoryId("");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not create budget",
      );
    }
  }

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Budgets</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Monthly limits per category. Progress is calculated live from your
          transactions — transfers between your own accounts never count as spend.
        </p>
      </header>

      <Card className="p-5">
        <h2 className="mb-4 text-sm font-medium">Set a budget</h2>
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <Field label="Category" htmlFor="budget-category">
            <Select
              id="budget-category"
              value={effectiveCategoryId}
              onChange={(event) => setCategoryId(event.target.value)}
            >
              {available.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Monthly limit"
            htmlFor="budget-amount"
            hint={`In ${currency}`}
          >
            <Input
              id="budget-amount"
              required
              inputMode="decimal"
              placeholder="8000.00"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </Field>

          {error && (
            <p role="alert" className="text-sm text-[var(--negative)] sm:col-span-2">
              {error}
            </p>
          )}

          <div className="sm:col-span-2">
            <Button type="submit" disabled={createBudget.isPending}>
              {createBudget.isPending ? "Saving…" : "Set budget"}
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader title="Your budgets" />
        {budgets.isLoading && <LoadingState />}
        {budgets.isError && <ErrorState message="Could not load budgets." />}
        {budgets.data?.length === 0 && (
          <EmptyState message="No budgets yet — set your first one above." />
        )}
        {budgets.data && budgets.data.length > 0 && (
          <ul className="divide-y divide-[var(--border)]">
            {budgets.data.map((budget) => (
              <li key={budget.id} className="flex items-start gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <BudgetMeter budget={budget} currency={currency} />
                </div>
                <Button
                  variant="danger"
                  className="shrink-0 px-0 text-xs"
                  onClick={() => deleteBudget.mutate(budget.id)}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
