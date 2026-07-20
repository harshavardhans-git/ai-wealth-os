"use client";

import { useQuery } from "@tanstack/react-query";
import { MoneyText } from "@/components/patterns/money-text";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
const HEALTH_URL = `${API_BASE.replace(/\/api\/v1\/?$/, "")}/health`;

interface Health {
  status: string;
  database: string;
  uptime: number;
}

/**
 * The walking skeleton's proof (Ch 15 §15.1): the browser calls the Express API,
 * which queries Postgres — and the result renders here. Every layer is wired.
 */
export default function Home() {
  const { data, isLoading, isError, error } = useQuery<Health>({
    queryKey: ["health"],
    queryFn: async () => {
      const response = await fetch(HEALTH_URL);
      if (!response.ok) throw new Error(`API responded ${response.status}`);
      const body = await response.json();
      return body.data as Health;
    },
  });

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-8 px-6 py-16">
      <header className="space-y-3">
        <p className="text-sm font-medium uppercase tracking-wide text-[var(--primary)]">
          AI Wealth OS
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">
          Your money, understood.
        </h1>
        <p className="text-[var(--text-muted)]">
          Type one sentence — <em>&ldquo;coffee 250 yesterday&rdquo;</em> — and get a
          categorized, budget-aware transaction.
        </p>
      </header>

      <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="text-sm font-medium text-[var(--text-muted)]">
          System status
        </h2>
        <div className="mt-3">
          {isLoading && (
            <p className="animate-pulse text-[var(--text-muted)]">
              Checking API…
            </p>
          )}
          {isError && (
            <p className="text-[var(--negative)]">
              API unreachable — is the server running on port 4000?{" "}
              <span className="text-[var(--text-muted)]">
                ({(error as Error).message})
              </span>
            </p>
          )}
          {data && (
            <dl className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <dt className="text-[var(--text-muted)]">API</dt>
                <dd className="mt-1 font-medium text-[var(--positive)]">
                  {data.status}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--text-muted)]">Database</dt>
                <dd className="mt-1 font-medium text-[var(--positive)]">
                  {data.database}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--text-muted)]">Uptime</dt>
                <dd className="mt-1 font-medium">{data.uptime}s</dd>
              </div>
            </dl>
          )}
        </div>
      </section>

      <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="text-sm font-medium text-[var(--text-muted)]">
          Money rendering
        </h2>
        <ul className="mt-3 space-y-2 text-sm">
          <li className="flex justify-between">
            <span>Salary</span>
            <MoneyText amountMinor={5_200_000} type="income" />
          </li>
          <li className="flex justify-between">
            <span>Coffee</span>
            <MoneyText amountMinor={25_000} type="expense" />
          </li>
          <li className="flex justify-between">
            <span>Transfer to savings</span>
            <MoneyText amountMinor={1_000_000} type="transfer" />
          </li>
        </ul>
        <p className="mt-4 text-xs text-[var(--text-muted)]">
          Stored as integer minor units; the sign is always rendered, so meaning
          never depends on colour alone.
        </p>
      </section>
    </main>
  );
}
