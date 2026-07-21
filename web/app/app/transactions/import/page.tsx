"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/field";
import { MoneyText } from "@/components/patterns/money-text";
import { apiFetch } from "@/lib/api-client";
import { parseAmount, parseCsv, parseFlexibleDate } from "@/lib/csv";
import { useAccounts } from "@/hooks/use-finance";
import { useQueryClient } from "@tanstack/react-query";

interface ImportResult {
  batchId: string;
  imported: number;
  skipped: number;
}

const PREVIEW_ROWS = 5;

export default function ImportPage() {
  const accounts = useAccounts();
  const queryClient = useQueryClient();

  const [filename, setFilename] = useState("");
  const [rows, setRows] = useState<string[][]>([]);
  const [hasHeader, setHasHeader] = useState(true);
  const [dateCol, setDateCol] = useState(0);
  const [descCol, setDescCol] = useState(1);
  const [amountCol, setAmountCol] = useState(2);
  const [allExpenses, setAllExpenses] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const header = hasHeader ? rows[0] : undefined;
  const bodyRows = useMemo(
    () => (hasHeader ? rows.slice(1) : rows),
    [rows, hasHeader],
  );

  const effectiveAccountId = accountId || accounts.data?.[0]?.id || "";

  /** Rows that survive parsing, plus a count of the ones that didn't. */
  const parsed = useMemo(() => {
    const good: Array<{
      occurredAt: string;
      note: string;
      amount: string;
      type: "income" | "expense";
    }> = [];
    let bad = 0;

    for (const cells of bodyRows) {
      const date = parseFlexibleDate(cells[dateCol] ?? "");
      const amount = parseAmount(cells[amountCol] ?? "");

      if (!date || amount === null || amount === 0) {
        bad += 1;
        continue;
      }

      good.push({
        occurredAt: date.toISOString(),
        note: (cells[descCol] ?? "").trim().slice(0, 280),
        amount: Math.abs(amount).toFixed(2),
        type: allExpenses || amount < 0 ? "expense" : "income",
      });
    }

    return { good, bad };
  }, [bodyRows, dateCol, descCol, amountCol, allExpenses]);

  function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setResult(null);
    setFilename(file.name);

    file.text().then((text) => {
      const cells = parseCsv(text);
      setRows(cells);

      // Guess the columns from the header row — the user can correct any of them.
      const head = cells[0]?.map((c) => c.toLowerCase()) ?? [];
      const findCol = (...needles: string[]) =>
        head.findIndex((cell) => needles.some((n) => cell.includes(n)));

      const d = findCol("date");
      const desc = findCol("description", "narration", "particulars", "details", "note");
      const amt = findCol("amount", "debit", "withdrawal", "value");

      if (d >= 0) setDateCol(d);
      if (desc >= 0) setDescCol(desc);
      if (amt >= 0) setAmountCol(amt);
    });
  }

  async function handleImport() {
    setError(null);
    setIsSubmitting(true);

    try {
      const data = await apiFetch<ImportResult>("/transactions/import", {
        method: "POST",
        body: JSON.stringify({
          filename: filename || "import.csv",
          accountId: effectiveAccountId,
          rows: parsed.good,
        }),
      });
      setResult(data);
      queryClient.invalidateQueries();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Import failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUndo() {
    if (!result) return;
    try {
      await apiFetch<{ reverted: number }>(
        `/transactions/import/${result.batchId}/revert`,
        { method: "POST" },
      );
      setResult(null);
      setRows([]);
      setFilename("");
      queryClient.invalidateQueries();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not undo");
    }
  }

  const columnOptions = (header ?? rows[0] ?? []).map((label, index) => (
    <option key={index} value={index}>
      {header ? label || `Column ${index + 1}` : `Column ${index + 1}`}
    </option>
  ));

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <Link
          href="/app/transactions"
          className="text-xs text-[var(--primary)] hover:underline"
        >
          ← Transactions
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Import CSV</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Upload a bank statement. Nothing is saved until you confirm, and every
          import can be undone in one click.
        </p>
      </header>

      {result ? (
        <Card className="p-5">
          <h2 className="text-sm font-medium">Import complete</h2>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            <strong className="text-[var(--text)]">{result.imported}</strong>{" "}
            transactions imported
            {result.skipped > 0 && (
              <>
                {" · "}
                <strong className="text-[var(--text)]">{result.skipped}</strong>{" "}
                skipped as duplicates
              </>
            )}
          </p>
          <div className="mt-4 flex gap-3">
            <Link
              href="/app/transactions"
              className="rounded-[var(--radius)] bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-contrast)]"
            >
              View transactions
            </Link>
            <Button variant="secondary" onClick={handleUndo}>
              Undo this import
            </Button>
          </div>
        </Card>
      ) : (
        <>
          <Card className="p-5">
            <Field label="CSV file" htmlFor="csv-file">
              <input
                id="csv-file"
                type="file"
                accept=".csv,text/csv"
                onChange={handleFile}
                className="block w-full text-sm text-[var(--text-muted)] file:mr-3 file:rounded-[var(--radius)] file:border-0 file:bg-[var(--primary)] file:px-3 file:py-1.5 file:text-sm file:text-[var(--primary-contrast)]"
              />
            </Field>
          </Card>

          {rows.length > 0 && (
            <>
              <Card className="p-5">
                <h2 className="mb-4 text-sm font-medium">Map the columns</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Account" htmlFor="imp-account">
                    <Select
                      id="imp-account"
                      value={effectiveAccountId}
                      onChange={(e) => setAccountId(e.target.value)}
                    >
                      {(accounts.data ?? []).map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label="Date column" htmlFor="imp-date">
                    <Select
                      id="imp-date"
                      value={dateCol}
                      onChange={(e) => setDateCol(Number(e.target.value))}
                    >
                      {columnOptions}
                    </Select>
                  </Field>

                  <Field label="Description column" htmlFor="imp-desc">
                    <Select
                      id="imp-desc"
                      value={descCol}
                      onChange={(e) => setDescCol(Number(e.target.value))}
                    >
                      {columnOptions}
                    </Select>
                  </Field>

                  <Field
                    label="Amount column"
                    htmlFor="imp-amount"
                    hint="Negative values are treated as expenses."
                  >
                    <Select
                      id="imp-amount"
                      value={amountCol}
                      onChange={(e) => setAmountCol(Number(e.target.value))}
                    >
                      {columnOptions}
                    </Select>
                  </Field>

                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={hasHeader}
                      onChange={(e) => setHasHeader(e.target.checked)}
                    />
                    First row is a header
                  </label>

                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={allExpenses}
                      onChange={(e) => setAllExpenses(e.target.checked)}
                    />
                    Treat every row as an expense
                  </label>
                </div>
              </Card>

              <Card>
                <CardHeader
                  title={`Preview · ${parsed.good.length} ready${
                    parsed.bad > 0 ? `, ${parsed.bad} unreadable` : ""
                  }`}
                />
                {parsed.good.length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-[var(--text-muted)]">
                    No readable rows — check the column mapping above.
                  </p>
                ) : (
                  <ul className="divide-y divide-[var(--border)]">
                    {parsed.good.slice(0, PREVIEW_ROWS).map((row, index) => (
                      <li
                        key={index}
                        className="flex items-center justify-between px-5 py-3 text-sm"
                      >
                        <span className="min-w-0">
                          <span className="truncate">{row.note || "—"}</span>
                          <span className="ml-2 text-xs text-[var(--text-muted)]">
                            {new Date(row.occurredAt).toLocaleDateString()}
                          </span>
                        </span>
                        <MoneyText
                          amountMinor={Math.round(Number(row.amount) * 100)}
                          type={row.type}
                        />
                      </li>
                    ))}
                  </ul>
                )}
                {parsed.good.length > PREVIEW_ROWS && (
                  <p className="px-5 py-3 text-xs text-[var(--text-muted)]">
                    …and {parsed.good.length - PREVIEW_ROWS} more
                  </p>
                )}
              </Card>

              {error && (
                <p role="alert" className="text-sm text-[var(--negative)]">
                  {error}
                </p>
              )}

              <Button
                onClick={handleImport}
                disabled={isSubmitting || parsed.good.length === 0}
              >
                {isSubmitting
                  ? "Importing…"
                  : `Import ${parsed.good.length} transactions`}
              </Button>
            </>
          )}
        </>
      )}
    </div>
  );
}
