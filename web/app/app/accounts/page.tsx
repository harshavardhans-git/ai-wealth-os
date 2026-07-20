"use client";

import { useState } from "react";
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
import { useAccounts, useCreateAccount } from "@/hooks/use-finance";

const ACCOUNT_TYPES = ["bank", "cash", "card", "wallet"] as const;

export default function AccountsPage() {
  const accounts = useAccounts();
  const createAccount = useCreateAccount();

  const [name, setName] = useState("");
  const [type, setType] = useState<(typeof ACCOUNT_TYPES)[number]>("bank");
  const [currency, setCurrency] = useState("INR");
  const [openingBalance, setOpeningBalance] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    try {
      await createAccount.mutateAsync({
        name,
        type,
        currency,
        ...(openingBalance ? { openingBalance } : {}),
      });
      setName("");
      setOpeningBalance("");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not create account",
      );
    }
  }

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Accounts</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Balances are calculated from your transactions, never stored.
        </p>
      </header>

      <Card className="p-5">
        <h2 className="mb-4 text-sm font-medium">Add an account</h2>
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="account-name">
            <Input
              id="account-name"
              required
              placeholder="HDFC Bank"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>

          <Field label="Type" htmlFor="account-type">
            <Select
              id="account-type"
              value={type}
              onChange={(event) =>
                setType(event.target.value as (typeof ACCOUNT_TYPES)[number])
              }
            >
              {ACCOUNT_TYPES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Currency" htmlFor="account-currency">
            <Input
              id="account-currency"
              required
              maxLength={3}
              value={currency}
              onChange={(event) =>
                setCurrency(event.target.value.toUpperCase())
              }
            />
          </Field>

          <Field
            label="Opening balance"
            htmlFor="account-opening"
            hint="Optional. e.g. 10000.00"
          >
            <Input
              id="account-opening"
              inputMode="decimal"
              placeholder="0.00"
              value={openingBalance}
              onChange={(event) => setOpeningBalance(event.target.value)}
            />
          </Field>

          {error && (
            <p role="alert" className="text-sm text-[var(--negative)] sm:col-span-2">
              {error}
            </p>
          )}

          <div className="sm:col-span-2">
            <Button type="submit" disabled={createAccount.isPending}>
              {createAccount.isPending ? "Adding…" : "Add account"}
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader title="Your accounts" />
        {accounts.isLoading && <LoadingState />}
        {accounts.isError && <ErrorState message="Could not load accounts." />}
        {accounts.data?.length === 0 && (
          <EmptyState message="No accounts yet — add your first one above." />
        )}
        {accounts.data && accounts.data.length > 0 && (
          <ul className="divide-y divide-[var(--border)]">
            {accounts.data.map((account) => (
              <li
                key={account.id}
                className="flex items-center justify-between px-5 py-3.5 text-sm"
              >
                <div>
                  <p className="font-medium">{account.name}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {account.type} · {account.currency}
                  </p>
                </div>
                <MoneyText
                  amountMinor={account.balanceMinor}
                  currency={account.currency}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
