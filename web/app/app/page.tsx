"use client";

import Link from "next/link";
import { MoneyText } from "@/components/patterns/money-text";
import {
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/ui/card";
import { useAccounts, useTransactions } from "@/hooks/use-finance";
import { useAuth } from "@/providers/auth-provider";

export default function DashboardPage() {
  const { user } = useAuth();
  const accounts = useAccounts();
  const transactions = useTransactions({ limit: 5 });

  const netWorthMinor =
    accounts.data?.reduce((total, account) => total + account.balanceMinor, 0) ??
    0;

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Hello, {user?.name}
        </h1>
        <p className="text-sm text-[var(--text-muted)]">
          Here&rsquo;s where your money stands.
        </p>
      </header>

      <Card className="p-5">
        <p className="text-sm text-[var(--text-muted)]">Net position</p>
        <p className="mt-1 text-3xl font-semibold tracking-tight">
          {accounts.isLoading ? (
            <span className="text-[var(--text-muted)]">—</span>
          ) : (
            <MoneyText
              amountMinor={netWorthMinor}
              currency={user?.baseCurrency}
            />
          )}
        </p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Across {accounts.data?.length ?? 0} account
          {accounts.data?.length === 1 ? "" : "s"}
        </p>
      </Card>

      <Card>
        <CardHeader
          title="Accounts"
          action={
            <Link
              href="/app/accounts"
              className="text-xs text-[var(--primary)] hover:underline"
            >
              Manage
            </Link>
          }
        />
        {accounts.isLoading && <LoadingState />}
        {accounts.isError && <ErrorState message="Could not load accounts." />}
        {accounts.data?.length === 0 && (
          <EmptyState message="No accounts yet — add one to get started." />
        )}
        {accounts.data && accounts.data.length > 0 && (
          <ul className="divide-y divide-[var(--border)]">
            {accounts.data.map((account) => (
              <li
                key={account.id}
                className="flex items-center justify-between px-5 py-3 text-sm"
              >
                <span>
                  {account.name}
                  <span className="ml-2 text-xs text-[var(--text-muted)]">
                    {account.type}
                  </span>
                </span>
                <MoneyText
                  amountMinor={account.balanceMinor}
                  currency={account.currency}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Recent activity"
          action={
            <Link
              href="/app/transactions"
              className="text-xs text-[var(--primary)] hover:underline"
            >
              View all
            </Link>
          }
        />
        {transactions.isLoading && <LoadingState />}
        {transactions.isError && (
          <ErrorState message="Could not load transactions." />
        )}
        {transactions.data?.items.length === 0 && (
          <EmptyState message="Nothing recorded yet." />
        )}
        {transactions.data && transactions.data.items.length > 0 && (
          <ul className="divide-y divide-[var(--border)]">
            {transactions.data.items.map((transaction) => (
              <li
                key={transaction.id}
                className="flex items-center justify-between px-5 py-3 text-sm"
              >
                <span>
                  {transaction.note ?? "—"}
                  <span className="ml-2 text-xs text-[var(--text-muted)]">
                    {new Date(transaction.occurredAt).toLocaleDateString()}
                  </span>
                </span>
                <MoneyText
                  amountMinor={transaction.amountMinor}
                  currency={transaction.currency}
                  type={transaction.type}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
