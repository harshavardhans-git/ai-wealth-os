import { randomUUID } from "node:crypto";
import type { Transaction as TransactionRow } from "@prisma/client";
import type {
  Paginated,
  Transaction,
  TransactionSource,
  TransactionType,
  TransferDirection,
} from "@ai-wealth-os/types";
import { AppError } from "../../lib/app-error";
import { bigIntToNumber, toMinor } from "../../lib/money";
import { convertMinor } from "../../lib/fx";
import { prisma } from "../../lib/prisma";
import { accountsRepository } from "../accounts/accounts.repository";
import { transactionsRepository } from "./transactions.repository";
import type {
  CreateTransactionInput,
  CreateTransferInput,
  ListTransactionsQuery,
  UpdateTransactionInput,
} from "./transactions.schema";

function toDto(row: TransactionRow): Transaction {
  return {
    id: row.id,
    accountId: row.accountId,
    categoryId: row.categoryId,
    type: row.type as TransactionType,
    amountMinor: bigIntToNumber(row.amountMinor),
    currency: row.currency,
    amountBaseMinor: bigIntToNumber(row.amountBaseMinor),
    occurredAt: row.occurredAt.toISOString(),
    note: row.note,
    source: row.source as TransactionSource,
    transferGroupId: row.transferGroupId,
    transferDirection: row.transferDirection as TransferDirection | null,
  };
}

function parseDate(value: string | undefined): Date {
  if (!value) return new Date();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw AppError.validation(`Invalid date: ${value}`);
  }
  return date;
}

/** The account must exist AND belong to this user — otherwise 404, never 403. */
async function requireOwnedAccount(accountId: string, userId: string) {
  const account = await accountsRepository.findByIdForUser(accountId, userId);
  if (!account) throw AppError.notFound("Account not found");
  return account;
}

/**
 * A category is usable if it is a shared system category (userId null) or the
 * user's own. This is the same re-authorization the AI path performs (Ch 9 §9.2).
 */
async function assertUsableCategory(
  categoryId: string | null | undefined,
  userId: string,
): Promise<void> {
  if (!categoryId) return;

  const category = await prisma.category.findFirst({
    where: { id: categoryId, OR: [{ userId }, { userId: null }] },
  });

  if (!category) throw AppError.notFound("Category not found");
}

async function getBaseCurrency(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { baseCurrency: true },
  });
  if (!user) throw AppError.unauthorized();
  return user.baseCurrency;
}

export const transactionsService = {
  async list(
    userId: string,
    filters: ListTransactionsQuery,
  ): Promise<Paginated<Transaction>> {
    const [rows, total] = await Promise.all([
      transactionsRepository.listForUser(userId, filters),
      transactionsRepository.countForUser(userId, filters),
    ]);

    return {
      items: rows.map(toDto),
      total,
      limit: filters.limit,
      offset: filters.offset,
    };
  },

  async getById(id: string, userId: string): Promise<Transaction> {
    const row = await transactionsRepository.findByIdForUser(id, userId);
    if (!row) throw AppError.notFound("Transaction not found");
    return toDto(row);
  },

  async create(
    userId: string,
    input: CreateTransactionInput,
  ): Promise<Transaction> {
    const account = await requireOwnedAccount(input.accountId, userId);
    await assertUsableCategory(input.categoryId, userId);

    const baseCurrency = await getBaseCurrency(userId);
    const amountMinor = toMinor(input.amount);

    if (amountMinor <= 0) {
      throw AppError.validation("Amount must be greater than zero");
    }

    const row = await transactionsRepository.create({
      userId,
      accountId: account.id,
      categoryId: input.categoryId ?? null,
      type: input.type,
      amountMinor: BigInt(amountMinor),
      currency: account.currency,
      // Snapshot in the user's reporting currency at capture time (Ch 5 §5.5).
      amountBaseMinor: BigInt(
        convertMinor(amountMinor, account.currency, baseCurrency),
      ),
      occurredAt: parseDate(input.occurredAt),
      note: input.note ?? null,
      source: input.source ?? "manual",
    });

    return toDto(row);
  },

  /**
   * A transfer is TWO linked rows sharing a transferGroupId (Ch 5 §5.4):
   * an 'out' leg on the source account and an 'in' leg on the destination.
   * Amounts stay positive; `transferDirection` carries the sign.
   */
  async createTransfer(
    userId: string,
    input: CreateTransferInput,
  ): Promise<Transaction[]> {
    const [from, to] = await Promise.all([
      requireOwnedAccount(input.fromAccountId, userId),
      requireOwnedAccount(input.toAccountId, userId),
    ]);

    // v1 limitation, deliberately explicit: cross-currency transfers would need a
    // per-leg rate and reconciliation. Rejecting is better than silently guessing.
    if (from.currency !== to.currency) {
      throw AppError.validation(
        "Transfers between accounts of different currencies are not supported yet",
      );
    }

    const amountMinor = toMinor(input.amount);
    if (amountMinor <= 0) {
      throw AppError.validation("Amount must be greater than zero");
    }

    const baseCurrency = await getBaseCurrency(userId);
    const amountBaseMinor = BigInt(
      convertMinor(amountMinor, from.currency, baseCurrency),
    );
    const transferGroupId = randomUUID();
    const occurredAt = parseDate(input.occurredAt);

    const shared = {
      userId,
      type: "transfer" as const,
      amountMinor: BigInt(amountMinor),
      currency: from.currency,
      amountBaseMinor,
      occurredAt,
      note: input.note ?? null,
      source: "manual",
      transferGroupId,
      categoryId: null,
    };

    const rows = await transactionsRepository.createTransferPair(
      { ...shared, accountId: from.id, transferDirection: "out" },
      { ...shared, accountId: to.id, transferDirection: "in" },
    );

    return rows.map(toDto);
  },

  async update(
    id: string,
    userId: string,
    input: UpdateTransactionInput,
  ): Promise<Transaction> {
    const existing = await transactionsRepository.findByIdForUser(id, userId);
    if (!existing) throw AppError.notFound("Transaction not found");

    if (existing.type === "transfer") {
      throw AppError.validation(
        "Transfers cannot be edited — delete and recreate instead",
      );
    }

    await assertUsableCategory(input.categoryId, userId);

    const data: Record<string, unknown> = {};

    if (input.amount !== undefined) {
      const amountMinor = toMinor(input.amount);
      if (amountMinor <= 0) {
        throw AppError.validation("Amount must be greater than zero");
      }
      const baseCurrency = await getBaseCurrency(userId);
      data.amountMinor = BigInt(amountMinor);
      data.amountBaseMinor = BigInt(
        convertMinor(amountMinor, existing.currency, baseCurrency),
      );
    }

    if (input.categoryId !== undefined) data.categoryId = input.categoryId;
    if (input.note !== undefined) data.note = input.note;
    if (input.occurredAt !== undefined) data.occurredAt = parseDate(input.occurredAt);

    await transactionsRepository.updateForUser(id, userId, data);

    return this.getById(id, userId);
  },

  async remove(id: string, userId: string): Promise<void> {
    const existing = await transactionsRepository.findByIdForUser(id, userId);
    if (!existing) throw AppError.notFound("Transaction not found");

    // Removing one leg of a transfer must remove both, or money appears/vanishes.
    if (existing.transferGroupId) {
      await transactionsRepository.softDeleteGroupForUser(
        existing.transferGroupId,
        userId,
      );
      return;
    }

    await transactionsRepository.softDeleteForUser(id, userId);
  },
};
