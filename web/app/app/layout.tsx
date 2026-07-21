"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { QuickCapture } from "@/components/features/quick-capture";
import { useAuth } from "@/providers/auth-provider";

const NAV = [
  { href: "/app", label: "Dashboard" },
  { href: "/app/transactions", label: "Transactions" },
  { href: "/app/accounts", label: "Accounts" },
  { href: "/app/budgets", label: "Budgets" },
  { href: "/app/settings", label: "Settings" },
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
  const [isNavOpen, setIsNavOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
  }, [isLoading, user, router]);

  // Navigating closes the drawer. Without this, tapping a link on a phone
  // leaves the menu covering the page you just asked for.
  useEffect(() => setIsNavOpen(false), [pathname]);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-[var(--text-muted)]">
        Loading…
      </div>
    );
  }

  if (!user) return null;

  const navLinks = (
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
  );

  const accountFooter = (
    <div className="space-y-2 px-2 pt-6">
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
  );

  return (
    <div className="flex min-h-full flex-1">
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      <aside className="hidden w-56 shrink-0 border-r border-[var(--border)] bg-[var(--surface)] p-4 sm:flex sm:flex-col">
        <Link
          href="/app"
          className="mb-6 block px-2 text-sm font-semibold tracking-tight"
        >
          <span className="text-[var(--primary)]">◆</span> Wealth OS
        </Link>
        {navLinks}
        <div className="mt-auto">{accountFooter}</div>
      </aside>

      {/* Below `sm` the sidebar is hidden — previously with nothing in its
          place, so a phone had no navigation at all beyond the browser's back
          button. This drawer is that missing half of the responsive rule. */}
      {isNavOpen && (
        <div
          className="fixed inset-0 z-50 bg-[var(--scrim)] sm:hidden"
          onClick={(event) =>
            event.target === event.currentTarget && setIsNavOpen(false)
          }
        >
          <div className="flex h-full w-64 flex-col border-r border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="mb-6 flex items-center justify-between px-2">
              <span className="text-sm font-semibold tracking-tight">
                <span className="text-[var(--primary)]">◆</span> Wealth OS
              </span>
              <button
                aria-label="Close navigation"
                onClick={() => setIsNavOpen(false)}
                className="text-[var(--text-muted)]"
              >
                ✕
              </button>
            </div>
            {navLinks}
            <div className="mt-auto">{accountFooter}</div>
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col">
        {/* The top bar Ch 4 §4.3 specified. The reporting-currency indicator
            matters more than it looks: every figure below it is converted into
            that currency, and without it a user reading a dashboard has no way
            to know which currency they are reading. */}
        <header className="flex items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3 sm:px-6">
          <button
            aria-label="Open navigation"
            aria-expanded={isNavOpen}
            onClick={() => setIsNavOpen(true)}
            className="text-lg leading-none text-[var(--text-muted)] sm:hidden"
          >
            ☰
          </button>

          <p className="text-sm font-medium">
            {NAV.find((item) => item.href === pathname)?.label ?? "Wealth OS"}
          </p>

          <span className="ml-auto text-xs text-[var(--text-muted)]">
            Reporting in{" "}
            <span className="font-medium text-[var(--text)]">
              {user.baseCurrency}
            </span>
          </span>
        </header>

        <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-6 py-8">
          {children}
        </main>
      </div>

      {/* Global, not per-page: the flagship is one keystroke from anywhere. */}
      <QuickCapture />
    </div>
  );
}
