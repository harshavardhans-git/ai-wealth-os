"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AccountWithBalance,
  Category,
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
  transactions: (filters?: Record<string, unknown>) =>
    ["transactions", filters ?? {}] as const,
};

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts });
    },
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
    onSuccess: () => {
      // A new transaction changes both the ledger AND every account balance.
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts });
    },
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
