"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Transaction } from "@wealth-os/types";
import { MoneyText } from "@/components/patterns/money-text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { Table, Td, Th } from "@/components/ui/table";
import {
  useAccounts,
  useCategories,
  useCreateTransaction,
  useCreateTransfer,
  useDeleteTransaction,
  useTransactions,
  useUpdateTransaction,
  type TransactionFilters,
} from "@/hooks/use-finance";

const PAGE_SIZE = 25;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** ISO datetime → the `yyyy-mm-dd` an `<input type="date">` expects. */
function toDateInput(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

export default function TransactionsPage() {
  const accounts = useAccounts();
  const categories = useCategories();

  const [filters, setFilters] = useState<TransactionFilters>({});
  const [offset, setOffset] = useState(0);

  const transactions = useTransactions({ ...filters, limit: PAGE_SIZE, offset });
  const createTransaction = useCreateTransaction();
  const updateTransaction = useUpdateTransaction();
  const deleteTransaction = useDeleteTransaction();
  const createTransfer = useCreateTransfer();

  const [type, setType] = useState<"expense" | "income">("expense");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [occurredAt, setOccurredAt] = useState(today());
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<Transaction | null>(null);
  const [isTransferOpen, setIsTransferOpen] = useState(false);

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
  const total = transactions.data?.total ?? 0;
  const hasFilters = Object.values(filters).some(Boolean);

  /** Any filter change resets to page 1 — otherwise you land on an empty page. */
  function setFilter(patch: Partial<TransactionFilters>) {
    setFilters((current) => ({ ...current, ...patch }));
    setOffset(0);
  }

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
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>
          <p className="text-sm text-[var(--text-muted)]">
            Add one below, move money between accounts, or press ⌘K to type it in
            plain language.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="secondary" onClick={() => setIsTransferOpen(true)}>
            Transfer
          </Button>
          <Link
            href="/app/transactions/import"
            className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium hover:bg-[var(--surface-raised)]"
          >
            Import CSV
          </Link>
        </div>
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
        <CardHeader title={`All transactions${total ? ` (${total})` : ""}`} />

        {/* The API has supported these filters since Sprint 1; nothing exposed
            them, so the list was permanently "everything, newest 50". */}
        <div className="grid gap-3 border-b border-[var(--border)] p-5 sm:grid-cols-4">
          <Field label="Account" htmlFor="f-account">
            <Select
              id="f-account"
              value={filters.accountId ?? ""}
              onChange={(e) => setFilter({ accountId: e.target.value })}
            >
              <option value="">All accounts</option>
              {(accounts.data ?? []).map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Category" htmlFor="f-category">
            <Select
              id="f-category"
              value={filters.categoryId ?? ""}
              onChange={(e) => setFilter({ categoryId: e.target.value })}
            >
              <option value="">All categories</option>
              {(categories.data ?? []).map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="From" htmlFor="f-from">
            <Input
              id="f-from"
              type="date"
              value={filters.from ?? ""}
              onChange={(e) => setFilter({ from: e.target.value })}
            />
          </Field>

          <Field label="To" htmlFor="f-to">
            <Input
              id="f-to"
              type="date"
              value={filters.to ?? ""}
              onChange={(e) => setFilter({ to: e.target.value })}
            />
          </Field>

          {hasFilters && (
            <div className="sm:col-span-4">
              <Button
                variant="ghost"
                className="px-0 text-xs"
                onClick={() => {
                  setFilters({});
                  setOffset(0);
                }}
              >
                Clear filters
              </Button>
            </div>
          )}
        </div>

        {transactions.isLoading && <LoadingState />}
        {transactions.isError && (
          <ErrorState message="Could not load transactions." />
        )}
        {transactions.data?.items.length === 0 && (
          <EmptyState
            message={
              hasFilters
                ? "No transactions match these filters."
                : "Nothing recorded yet — add your first transaction above."
            }
          />
        )}

        {transactions.data && transactions.data.items.length > 0 && (
          <>
            <Table caption="Your transactions, newest first">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <Th>Date</Th>
                  <Th>Description</Th>
                  <Th>Category</Th>
                  <Th>Account</Th>
                  <Th align="right">Amount</Th>
                  <Th align="right">Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {transactions.data.items.map((transaction) => {
                  const account = accountById.get(transaction.accountId);
                  const category = transaction.categoryId
                    ? categoryById.get(transaction.categoryId)
                    : null;
                  const isTransfer = transaction.type === "transfer";

                  return (
                    <tr key={transaction.id}>
                      <Td className="whitespace-nowrap text-[var(--text-muted)]">
                        {new Date(transaction.occurredAt).toLocaleDateString()}
                      </Td>
                      <Td className="max-w-[16rem] truncate font-medium">
                        {transaction.note ?? category?.name ?? "—"}
                        {transaction.source === "capture" && (
                          <Badge title="Added with quick capture">⌘K</Badge>
                        )}
                        {transaction.source === "import" && (
                          <Badge title="Added from a CSV import">CSV</Badge>
                        )}
                        {isTransfer && (
                          <Badge tone="accent">
                            {transaction.transferDirection === "in"
                              ? "Transfer in"
                              : "Transfer out"}
                          </Badge>
                        )}
                      </Td>
                      <Td className="text-[var(--text-muted)]">
                        {category?.name ?? "—"}
                      </Td>
                      <Td className="text-[var(--text-muted)]">
                        {account?.name ?? "—"}
                      </Td>
                      <Td align="right">
                        <MoneyText
                          amountMinor={transaction.amountMinor}
                          currency={transaction.currency}
                          type={transaction.type}
                        />
                      </Td>
                      <Td align="right" className="whitespace-nowrap">
                        {/* Transfers are edited as a pair or not at all —
                            changing one leg would unbalance the other. */}
                        {!isTransfer && (
                          <Button
                            variant="ghost"
                            className="px-0 text-xs"
                            onClick={() => setEditing(transaction)}
                          >
                            Edit
                          </Button>
                        )}
                        <Button
                          variant="danger"
                          className="ml-3 px-0 text-xs"
                          onClick={() => deleteTransaction.mutate(transaction.id)}
                        >
                          Delete
                        </Button>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>

            <Pagination
              offset={offset}
              pageSize={PAGE_SIZE}
              total={total}
              onChange={setOffset}
            />
          </>
        )}
      </Card>

      {editing && (
        <EditDialog
          transaction={editing}
          categories={categories.data ?? []}
          onClose={() => setEditing(null)}
          onSave={async (patch) => {
            await updateTransaction.mutateAsync({ id: editing.id, ...patch });
            setEditing(null);
          }}
          isSaving={updateTransaction.isPending}
        />
      )}

      <TransferDialog
        isOpen={isTransferOpen}
        accounts={accounts.data ?? []}
        onClose={() => setIsTransferOpen(false)}
        onSave={async (body) => {
          await createTransfer.mutateAsync(body);
          setIsTransferOpen(false);
        }}
        isSaving={createTransfer.isPending}
      />
    </div>
  );
}

/** Offset pagination, matching the API's contract (Ch 7 §7.10). */
function Pagination({
  offset,
  pageSize,
  total,
  onChange,
}: {
  offset: number;
  pageSize: number;
  total: number;
  onChange: (next: number) => void;
}) {
  if (total <= pageSize) return null;

  const page = Math.floor(offset / pageSize) + 1;
  const pages = Math.ceil(total / pageSize);
  const first = offset + 1;
  const last = Math.min(offset + pageSize, total);

  return (
    <nav
      aria-label="Transaction pages"
      className="flex items-center justify-between gap-4 border-t border-[var(--border)] px-5 py-3 text-sm"
    >
      {/* Stating the range, not just the page number: "26–50 of 312" tells you
          where you are in the ledger; "page 2" does not. */}
      <p className="text-[var(--text-muted)]">
        {first}–{last} of {total}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          disabled={page === 1}
          onClick={() => onChange(Math.max(0, offset - pageSize))}
        >
          Previous
        </Button>
        <span className="text-xs text-[var(--text-muted)]">
          {page} / {pages}
        </span>
        <Button
          variant="secondary"
          disabled={page >= pages}
          onClick={() => onChange(offset + pageSize)}
        >
          Next
        </Button>
      </div>
    </nav>
  );
}

function EditDialog({
  transaction,
  categories,
  onClose,
  onSave,
  isSaving,
}: {
  transaction: Transaction;
  categories: { id: string; name: string; kind: string }[];
  onClose: () => void;
  onSave: (patch: {
    amount: string;
    categoryId: string | null;
    occurredAt: string;
    note: string | null;
  }) => Promise<void>;
  isSaving: boolean;
}) {
  const [amount, setAmount] = useState(
    (transaction.amountMinor / 100).toFixed(2),
  );
  const [categoryId, setCategoryId] = useState(transaction.categoryId ?? "");
  const [occurredAt, setOccurredAt] = useState(
    toDateInput(transaction.occurredAt),
  );
  const [note, setNote] = useState(transaction.note ?? "");
  const [error, setError] = useState<string | null>(null);

  const visible = categories.filter((c) => c.kind === transaction.type);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await onSave({
        amount,
        categoryId: categoryId || null,
        occurredAt: new Date(occurredAt).toISOString(),
        note: note || null,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save");
    }
  }

  return (
    <Dialog isOpen onClose={onClose} label="Edit transaction">
      <h2 className="mb-4 text-sm font-medium">Edit transaction</h2>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Amount" htmlFor="e-amount">
          <Input
            id="e-amount"
            required
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
        <Field label="Date" htmlFor="e-date">
          <Input
            id="e-date"
            type="date"
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
          />
        </Field>
        <Field label="Category" htmlFor="e-category">
          <Select
            id="e-category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">Uncategorized</option>
            {visible.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Note" htmlFor="e-note">
          <Input
            id="e-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>

        {error && (
          <p role="alert" className="text-sm text-[var(--negative)] sm:col-span-2">
            {error}
          </p>
        )}

        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" disabled={isSaving}>
            {isSaving ? "Saving…" : "Save changes"}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/**
 * Moving money between your own accounts (Ch 5 §5.8).
 *
 * Deliberately separate from "add a transaction": a transfer is not income or
 * expense — your net worth does not change — so mixing it into the same form
 * would invite people to record it as spending and double-count their outgoings.
 */
function TransferDialog({
  isOpen,
  accounts,
  onClose,
  onSave,
  isSaving,
}: {
  isOpen: boolean;
  accounts: { id: string; name: string; currency: string }[];
  onClose: () => void;
  onSave: (body: {
    fromAccountId: string;
    toAccountId: string;
    amount: string;
    occurredAt: string;
    note: string | null;
  }) => Promise<void>;
  isSaving: boolean;
}) {
  const [fromAccountId, setFrom] = useState("");
  const [toAccountId, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [occurredAt, setOccurredAt] = useState(today());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const from = fromAccountId || accounts[0]?.id || "";
  const to = toAccountId || accounts[1]?.id || "";
  const sameAccount = from !== "" && from === to;
  const fromCurrency = accounts.find((a) => a.id === from)?.currency;
  const toCurrency = accounts.find((a) => a.id === to)?.currency;
  const crossCurrency =
    Boolean(fromCurrency && toCurrency) && fromCurrency !== toCurrency;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await onSave({
        fromAccountId: from,
        toAccountId: to,
        amount,
        occurredAt: new Date(occurredAt).toISOString(),
        note: note || null,
      });
      setAmount("");
      setNote("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not transfer");
    }
  }

  return (
    <Dialog isOpen={isOpen} onClose={onClose} label="Transfer between accounts">
      <h2 className="text-sm font-medium">Transfer between accounts</h2>
      <p className="mb-4 mt-1 text-xs text-[var(--text-muted)]">
        Written as two linked legs in one atomic write, and excluded from income,
        spending and budgets — moving your own money is not earning or spending it.
      </p>

      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="From" htmlFor="t-from">
          <Select id="t-from" value={from} onChange={(e) => setFrom(e.target.value)}>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} ({account.currency})
              </option>
            ))}
          </Select>
        </Field>

        <Field label="To" htmlFor="t-to">
          <Select id="t-to" value={to} onChange={(e) => setTo(e.target.value)}>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} ({account.currency})
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Amount" htmlFor="t-amount">
          <Input
            id="t-amount"
            required
            inputMode="decimal"
            placeholder="5000.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>

        <Field label="Date" htmlFor="t-date">
          <Input
            id="t-date"
            type="date"
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
          />
        </Field>

        <Field label="Note" htmlFor="t-note">
          <Input
            id="t-note"
            placeholder="Move to savings"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>

        {/* Told before submitting, not after a 400 — the server rejects both of
            these, but a form that lets you fill it in and then fails is worse. */}
        {sameAccount && (
          <p className="text-xs text-[var(--warning)] sm:col-span-2">
            Pick two different accounts.
          </p>
        )}
        {crossCurrency && (
          <p className="text-xs text-[var(--warning)] sm:col-span-2">
            Both accounts must use the same currency — a cross-currency transfer
            needs an exchange rate, which v1 does not record per transfer.
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-[var(--negative)] sm:col-span-2">
            {error}
          </p>
        )}

        <div className="flex gap-2 sm:col-span-2">
          <Button
            type="submit"
            disabled={isSaving || sameAccount || crossCurrency || accounts.length < 2}
          >
            {isSaving ? "Transferring…" : "Transfer"}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>

        {accounts.length < 2 && (
          <p className="text-xs text-[var(--text-muted)] sm:col-span-2">
            You need at least two accounts to move money between them.
          </p>
        )}
      </form>
    </Dialog>
  );
}
