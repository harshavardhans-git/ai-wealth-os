"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { QuickCapture } from "@/components/features/quick-capture";
import { useAuth } from "@/providers/auth-provider";

const NAV = [
  { href: "/app", label: "Dashboard" },
  { href: "/app/transactions", label: "Transactions" },
  { href: "/app/accounts", label: "Accounts" },
  { href: "/app/budgets", label: "Budgets" },
];

/**
 * The authenticated app shell (Ch 4 §4.3): sidebar navigation chosen so later
 * phases (Goals, Reports, Documents) have room to grow.
 *
 * This is a client-side guard for UX only — the real enforcement is server-side,
 * where every endpoint requires a verified token and scopes by user_id (Ch 10).
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
  }, [isLoading, user, router]);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-[var(--text-muted)]">
        Loading…
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex min-h-full flex-1">
      <aside className="hidden w-56 shrink-0 border-r border-[var(--border)] bg-[var(--surface)] p-4 sm:flex sm:flex-col">
        <Link
          href="/app"
          className="mb-6 block px-2 text-sm font-semibold tracking-tight"
        >
          <span className="text-[var(--primary)]">◆</span> AI Wealth OS
        </Link>

        <nav className="flex flex-col gap-1">
          {NAV.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`rounded-[var(--radius-sm)] px-2 py-1.5 text-sm transition-colors ${
                  isActive
                    ? "bg-[var(--surface-raised)] font-medium text-[var(--text)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-2 px-2 pt-6">
          <p className="truncate text-xs text-[var(--text-muted)]">{user.email}</p>
          <Button
            variant="ghost"
            className="px-0 text-xs"
            onClick={async () => {
              await logout();
              router.replace("/login");
            }}
          >
            Sign out
          </Button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-8">
          {children}
        </main>
      </div>

      {/* Global, not per-page: the flagship is one keystroke from anywhere. */}
      <QuickCapture />
    </div>
  );
}
