"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AccountWithBalance,
  BudgetWithProgress,
  Category,
  DashboardSummary,
  Paginated,
  Transaction,
} from "@wealth-os/types";
import { apiFetch } from "@/lib/api-client";

/**
 * Server-state hooks (Ch 8 §8.2). Every mutation declares what it invalidates —
 * that is what keeps the UI from going stale after a write, and it's the single
 * most common bug in a Query codebase when forgotten.
 */

export interface TransactionFilters {
  limit?: number;
  offset?: number;
  accountId?: string;
  categoryId?: string;
  type?: "income" | "expense" | "transfer";
  from?: string;
  to?: string;
}

export const queryKeys = {
  accounts: ["accounts"] as const,
  categories: ["categories"] as const,
  budgets: ["budgets"] as const,
  dashboard: ["dashboard"] as const,
  transactions: (filters?: TransactionFilters) =>
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

interface ProfileUpdate {
  name?: string;
  baseCurrency?: string;
}

/**
 * Changing base currency rewrites every historical reporting snapshot on the
 * server, so this invalidates everything — the dashboard, budgets and balances
 * are all denominated differently afterwards.
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: ProfileUpdate) =>
      apiFetch<{ id: string; email: string; name: string; baseCurrency: string }>(
        "/auth/me",
        { method: "PATCH", body: JSON.stringify(body) },
      ),
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: {
      name: string;
      kind: "income" | "expense";
      color?: string | null;
    }) =>
      apiFetch<Category>("/categories", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories });
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/categories/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories });
    },
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

/**
 * The filters are part of the query key, so each distinct view is cached
 * separately and switching back to a previous filter is instant. Empty values
 * are dropped rather than sent blank — otherwise `?accountId=` would become a
 * different key from no filter at all, and cache the same result twice.
 */
export function useTransactions(filters: TransactionFilters = {}, enabled = true) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const query = params.toString();

  return useQuery({
    queryKey: queryKeys.transactions(filters),
    queryFn: () =>
      apiFetch<Paginated<Transaction>>(
        `/transactions${query ? `?${query}` : ""}`,
      ),
    enabled,
    // Keeps the previous page on screen while the next one loads, instead of
    // collapsing the table to a skeleton on every page change.
    placeholderData: (previous) => previous,
  });
}

interface UpdateTransactionBody {
  id: string;
  amount?: string;
  categoryId?: string | null;
  occurredAt?: string;
  note?: string | null;
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...body }: UpdateTransactionBody) =>
      apiFetch<Transaction>(`/transactions/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidateMoney(queryClient),
  });
}

interface CreateTransferBody {
  fromAccountId: string;
  toAccountId: string;
  amount: string;
  occurredAt?: string;
  note?: string | null;
}

/**
 * A transfer writes two linked legs atomically (Ch 5 §5.8), so it has its own
 * endpoint rather than being a `type` on the normal create.
 */
export function useCreateTransfer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateTransferBody) =>
      apiFetch<Transaction[]>("/transactions/transfer", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidateMoney(queryClient),
  });
}

export function useUpdateAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; name?: string }) =>
      apiFetch<AccountWithBalance>(`/accounts/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidateMoney(queryClient),
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/accounts/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidateMoney(queryClient),
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
    // Deleting money changes the dashboard and budget progress exactly as much
    // as creating it does. Listing only transactions+accounts here left budget
    // meters and net worth stale for a full staleTime window.
    onSuccess: () => invalidateMoney(queryClient),
  });
}
