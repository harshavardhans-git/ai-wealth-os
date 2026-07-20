/**
 * @ai-wealth-os/types — the shared contract imported by BOTH the Express API and the
 * Next.js client (Ch 6 §6.4, Ch 8 §8.4). A change here fails compilation on whichever
 * side falls out of sync — a free, compile-time integration test across the service
 * boundary. This is the single source of truth for the shapes that cross the wire.
 */

// ── Primitive aliases (documentation, not new runtime types) ──────────────────
export type UUID = string;
export type ISODateString = string; // e.g. "2026-07-20T00:00:00.000Z"
export type CurrencyCode = string; // ISO 4217, e.g. "INR", "USD"

/**
 * Money is ALWAYS integer minor units (paise/cents), never a float (Ch 5 D1).
 * A separate `MoneyMinor` alias makes the intent unmissable at every call site.
 */
export type MoneyMinor = number;

// ── Domain enums — kept in lockstep with the DB CHECK constraints (Ch 5 §5.4) ──
export type AccountType = "cash" | "bank" | "card" | "wallet";
export type CategoryKind = "income" | "expense";
export type TransactionType = "income" | "expense" | "transfer";
export type TransactionSource = "manual" | "ai" | "import";
export type TransferDirection = "in" | "out";
export type BudgetPeriod = "monthly";

// ── Entity DTOs (camelCase API shape; mirror the Ch 5 tables) ─────────────────
export interface Account {
  id: UUID;
  name: string;
  type: AccountType;
  currency: CurrencyCode;
  openingBalanceMinor: MoneyMinor;
  isArchived: boolean;
}

/** Balances are DERIVED, never stored (Ch 5 §5.4). */
export interface AccountWithBalance extends Account {
  balanceMinor: MoneyMinor;
}

export interface Category {
  id: UUID;
  name: string;
  kind: CategoryKind;
  icon: string | null;
  color: string | null;
  isSystem: boolean;
}

export interface Transaction {
  id: UUID;
  accountId: UUID;
  categoryId: UUID | null;
  type: TransactionType;
  amountMinor: MoneyMinor; // always positive; direction comes from `type`
  currency: CurrencyCode;
  amountBaseMinor: MoneyMinor; // value in the user's base currency (Ch 5 §5.5)
  occurredAt: ISODateString;
  note: string | null;
  source: TransactionSource;
  transferGroupId: UUID | null;
  transferDirection: TransferDirection | null;
}

export interface Budget {
  id: UUID;
  categoryId: UUID;
  period: BudgetPeriod;
  amountMinor: MoneyMinor;
  currency: CurrencyCode;
  startsOn: ISODateString;
}

// ── The AI natural-language capture draft (A1) ─────────────────────────────────
// The model only ever PROPOSES this; it is never persisted without confirm +
// server-side re-authorization of categoryId/accountId (Ch 9 §9.2, §9.4).
export interface ParsedTransactionDraft {
  type: Exclude<TransactionType, "transfer">;
  amountMinor: MoneyMinor;
  currency: CurrencyCode;
  categoryId: UUID | null;
  accountId: UUID | null;
  occurredAt: ISODateString;
  note: string | null;
  confidence: number; // 0–1; drives the draft-vs-manual-form choice (Ch 9)
}

/** Budget progress is COMPUTED on read, never stored (Ch 5 §5.4). */
export interface BudgetWithProgress extends Budget {
  categoryName: string;
  categoryColor: string | null;
  spentMinor: MoneyMinor;
  remainingMinor: MoneyMinor;
  /** 0–100+, clamped at neither end: >100 means over budget. */
  percentUsed: number;
}

// ── Dashboard read-model (Ch 6/7: aggregates, not raw rows) ───────────────────
export interface CategorySpend {
  categoryId: UUID | null;
  name: string;
  color: string | null;
  amountMinor: MoneyMinor;
}

export interface CashFlowPoint {
  month: string; // "2026-07"
  incomeMinor: MoneyMinor;
  expenseMinor: MoneyMinor;
}

export interface DashboardSummary {
  baseCurrency: CurrencyCode;
  netWorthMinor: MoneyMinor;
  month: {
    label: string; // "July 2026"
    incomeMinor: MoneyMinor;
    expenseMinor: MoneyMinor;
    netMinor: MoneyMinor;
  };
  spendByCategory: CategorySpend[];
  cashFlow: CashFlowPoint[];
  budgets: BudgetWithProgress[];
}

// ── List responses ────────────────────────────────────────────────────────────
export interface Paginated<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

// ── API envelope — every response is exactly one of these (Ch 7 §7.5) ─────────
export type ApiErrorCode =
  | "VALIDATION"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL";

export interface ApiSuccess<T> {
  data: T;
}

export interface ApiError {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
