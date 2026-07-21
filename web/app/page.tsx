import Link from "next/link";

/**
 * The public landing page (Ch 4 §4.2, Ch 11 §11.1).
 *
 * A Server Component, as Ch 8 §8.1 specifies for the public zone: it has no
 * state, no data hooks and no interactivity, so shipping React runtime for it
 * would buy nothing. It previously carried the walking-skeleton's health-check
 * widget and a MoneyText demo — useful while proving the stack was wired,
 * indefensible on the page a first-time visitor lands on.
 */

const PILLARS = [
  {
    title: "Type it, don't fill it",
    body: "“coffee 250 yesterday” becomes a categorized, dated, budget-aware transaction. You confirm before anything is saved — the parser proposes, it never writes.",
  },
  {
    title: "Money that stays exact",
    body: "Every amount is stored as an integer in minor units and converted once, at the edge. No floating-point drift, no cent that quietly goes missing.",
  },
  {
    title: "Answers, not spreadsheets",
    body: "Net position, six months of cash flow, spend by category and live budget progress — all computed on read, so they can never disagree with your ledger.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-12 px-6 py-20">
      <header className="space-y-4">
        <p className="text-sm font-medium uppercase tracking-wide text-[var(--primary)]">
          Wealth OS
        </p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Your money, understood.
        </h1>
        <p className="max-w-prose text-lg text-[var(--text-muted)]">
          A personal financial operating system. Type one sentence —{" "}
          <em>&ldquo;coffee 250 yesterday&rdquo;</em> — and get a categorized,
          budget-aware transaction.
        </p>

        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            href="/signup"
            className="rounded-[var(--radius)] bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-contrast)] hover:opacity-90"
          >
            Get started
          </Link>
          <Link
            href="/login"
            className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium hover:bg-[var(--surface-raised)]"
          >
            Sign in
          </Link>
        </div>

        <p className="pt-1 text-sm text-[var(--text-muted)]">
          New accounts can load a full demo dataset in one click — three months of
          realistic history, so there is something to look at immediately.
        </p>
      </header>

      <section className="grid gap-6 sm:grid-cols-3">
        {PILLARS.map((pillar) => (
          <div key={pillar.title} className="space-y-2">
            <h2 className="text-sm font-medium">{pillar.title}</h2>
            <p className="text-sm leading-relaxed text-[var(--text-muted)]">
              {pillar.body}
            </p>
          </div>
        ))}
      </section>
    </main>
  );
}
