"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AccountWithBalance,
  BudgetWithProgress,
  Category,
  DashboardSummary,
  Paginated,
  Transaction,
} from "@ai-wealth-os/types";
import { apiFetch } from "@/lib/api-client";

/**
 * Server-state hooks (Ch 8 §8.2). Every mutation declares what it invalidates —
 * that is what keeps the UI from going stale after a write, and it's the single
 * most common bug in a Query codebase when forgotten.
 */

export const queryKeys = {
  accounts: ["accounts"] as const,
  categories: ["categories"] as const,
  budgets: ["budgets"] as const,
  dashboard: ["dashboard"] as const,
  transactions: (filters?: Record<string, unknown>) =>
    ["transactions", filters ?? {}] as const,
};

/**
 * Anything that changes money changes the dashboard too. Collecting the
 * invalidations here keeps every mutation honest — a stale dashboard after a
 * write is the most common bug in a Query codebase (Ch 8 R1).
 */
function invalidateMoney(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["transactions"] });
  queryClient.invalidateQueries({ queryKey: queryKeys.accounts });
  queryClient.invalidateQueries({ queryKey: queryKeys.budgets });
  queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
}

/**
 * Loads the engineered demo dataset into the signed-in account (Ch 11 §11.5).
 * Invalidates everything, because it creates accounts, transactions, and budgets
 * all at once.
 */
export function useSeedDemo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiFetch<{ accounts: number; transactions: number; budgets: number }>(
        "/demo/seed",
        { method: "POST" },
      ),
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

export function useDashboard(enabled = true) {
  return useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: () => apiFetch<DashboardSummary>("/dashboard/summary"),
    enabled,
  });
}

export function useBudgets(enabled = true) {
  return useQuery({
    queryKey: queryKeys.budgets,
    queryFn: () => apiFetch<BudgetWithProgress[]>("/budgets"),
    enabled,
  });
}

export function useCreateBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: { categoryId: string; amount: string }) =>
      apiFetch<BudgetWithProgress>("/budgets", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidateMoney(queryClient),
  });
}

export function useDeleteBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/budgets/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidateMoney(queryClient),
  });
}

export function useAccounts(enabled = true) {
  return useQuery({
    queryKey: queryKeys.accounts,
    queryFn: () => apiFetch<AccountWithBalance[]>("/accounts"),
    enabled,
  });
}

export function useCategories(enabled = true) {
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: () => apiFetch<Category[]>("/categories"),
    enabled,
  });
}

export function useTransactions(
  filters: { limit?: number; offset?: number } = {},
  enabled = true,
) {
  const params = new URLSearchParams();
  if (filters.limit) params.set("limit", String(filters.limit));
  if (filters.offset) params.set("offset", String(filters.offset));
  const query = params.toString();

  return useQuery({
    queryKey: queryKeys.transactions(filters),
    queryFn: () =>
      apiFetch<Paginated<Transaction>>(
        `/transactions${query ? `?${query}` : ""}`,
      ),
    enabled,
  });
}

interface CreateAccountBody {
  name: string;
  type: "cash" | "bank" | "card" | "wallet";
  currency: string;
  openingBalance?: string;
}

export function useCreateAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateAccountBody) =>
      apiFetch<AccountWithBalance>("/accounts", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidateMoney(queryClient),
  });
}

interface CreateTransactionBody {
  accountId: string;
  type: "income" | "expense";
  amount: string;
  categoryId?: string | null;
  occurredAt?: string;
  note?: string | null;
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateTransactionBody) =>
      apiFetch<Transaction>("/transactions", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidateMoney(queryClient),
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/transactions/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts });
    },
  });
}
