"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { MoneyText } from "@/components/patterns/money-text";
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
  useAccounts,
  useCategories,
  useCreateTransaction,
  useDeleteTransaction,
  useTransactions,
} from "@/hooks/use-finance";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function TransactionsPage() {
  const accounts = useAccounts();
  const categories = useCategories();
  const transactions = useTransactions({ limit: 50 });
  const createTransaction = useCreateTransaction();
  const deleteTransaction = useDeleteTransaction();

  const [type, setType] = useState<"expense" | "income">("expense");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [occurredAt, setOccurredAt] = useState(today());
  const [error, setError] = useState<string | null>(null);

  // Only show categories matching the selected direction (Ch 5: `kind`).
  const visibleCategories = useMemo(
    () => categories.data?.filter((category) => category.kind === type) ?? [],
    [categories.data, type],
  );

  const accountById = useMemo(
    () => new Map((accounts.data ?? []).map((a) => [a.id, a])),
    [accounts.data],
  );
  const categoryById = useMemo(
    () => new Map((categories.data ?? []).map((c) => [c.id, c])),
    [categories.data],
  );

  const effectiveAccountId = accountId || accounts.data?.[0]?.id || "";

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!effectiveAccountId) {
      setError("Add an account first.");
      return;
    }

    try {
      await createTransaction.mutateAsync({
        accountId: effectiveAccountId,
        type,
        amount,
        categoryId: categoryId || null,
        occurredAt: new Date(occurredAt).toISOString(),
        note: note || null,
      });
      setAmount("");
      setNote("");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not save transaction",
      );
    }
  }

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>
          <p className="text-sm text-[var(--text-muted)]">
            Natural-language capture arrives in the next sprint — for now, the form.
          </p>
        </div>
        <Link
          href="/app/transactions/import"
          className="shrink-0 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium hover:bg-[var(--surface-raised)]"
        >
          Import CSV
        </Link>
      </header>

      <Card className="p-5">
        <h2 className="mb-4 text-sm font-medium">Add a transaction</h2>
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <Field label="Type" htmlFor="tx-type">
            <Select
              id="tx-type"
              value={type}
              onChange={(event) => {
                setType(event.target.value as "expense" | "income");
                setCategoryId("");
              }}
            >
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </Select>
          </Field>

          <Field label="Amount" htmlFor="tx-amount">
            <Input
              id="tx-amount"
              required
              inputMode="decimal"
              placeholder="320.50"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </Field>

          <Field label="Account" htmlFor="tx-account">
            <Select
              id="tx-account"
              value={effectiveAccountId}
              onChange={(event) => setAccountId(event.target.value)}
            >
              {(accounts.data ?? []).map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Category" htmlFor="tx-category">
            <Select
              id="tx-category"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
            >
              <option value="">Uncategorized</option>
              {visibleCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Date" htmlFor="tx-date">
            <Input
              id="tx-date"
              type="date"
              value={occurredAt}
              onChange={(event) => setOccurredAt(event.target.value)}
            />
          </Field>

          <Field label="Note" htmlFor="tx-note">
            <Input
              id="tx-note"
              placeholder="Lunch with team"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </Field>

          {error && (
            <p role="alert" className="text-sm text-[var(--negative)] sm:col-span-2">
              {error}
            </p>
          )}

          <div className="sm:col-span-2">
            <Button type="submit" disabled={createTransaction.isPending}>
              {createTransaction.isPending ? "Saving…" : "Add transaction"}
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader
          title={`All transactions${
            transactions.data ? ` (${transactions.data.total})` : ""
          }`}
        />
        {transactions.isLoading && <LoadingState />}
        {transactions.isError && (
          <ErrorState message="Could not load transactions." />
        )}
        {transactions.data?.items.length === 0 && (
          <EmptyState message="Nothing recorded yet — add your first transaction above." />
        )}
        {transactions.data && transactions.data.items.length > 0 && (
          <ul className="divide-y divide-[var(--border)]">
            {transactions.data.items.map((transaction) => {
              const account = accountById.get(transaction.accountId);
              const category = transaction.categoryId
                ? categoryById.get(transaction.categoryId)
                : null;

              return (
                <li
                  key={transaction.id}
                  className="flex items-center justify-between gap-4 px-5 py-3.5 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {transaction.note ?? category?.name ?? "—"}
                      {transaction.source === "ai" && (
                        <span className="ml-2 rounded-[var(--radius-sm)] border border-[var(--border)] px-1.5 py-0.5 text-[10px] uppercase text-[var(--text-muted)]">
                          AI
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-[var(--text-muted)]">
                      {new Date(transaction.occurredAt).toLocaleDateString()}
                      {category ? ` · ${category.name}` : ""}
                      {account ? ` · ${account.name}` : ""}
                      {transaction.transferDirection
                        ? ` · transfer ${transaction.transferDirection}`
                        : ""}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-4">
                    <MoneyText
                      amountMinor={transaction.amountMinor}
                      currency={transaction.currency}
                      type={transaction.type}
                    />
                    <Button
                      variant="danger"
                      className="px-0 text-xs"
                      onClick={() => deleteTransaction.mutate(transaction.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
