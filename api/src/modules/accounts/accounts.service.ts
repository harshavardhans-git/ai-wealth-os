import type { Account as AccountRow } from "@prisma/client";
import type { Account, AccountWithBalance, AccountType } from "@wealth-os/types";
import { AppError } from "../../lib/app-error";
import { bigIntToNumber, toMinor } from "../../lib/money";
import { accountsRepository } from "./accounts.repository";
import type { CreateAccountInput, UpdateAccountInput } from "./accounts.schema";

/** Prisma row → wire DTO. BigInt becomes number here, at the boundary (Ch 5). */
function toDto(row: AccountRow): Account {
  return {
    id: row.id,
    name: row.name,
    type: row.type as AccountType,
    currency: row.currency,
    openingBalanceMinor: bigIntToNumber(row.openingBalanceMinor),
    isArchived: row.isArchived,
  };
}

export const accountsService = {
  async list(userId: string): Promise<AccountWithBalance[]> {
    const [accounts, balances] = await Promise.all([
      accountsRepository.listForUser(userId),
      accountsRepository.balancesForUser(userId),
    ]);

    const balanceById = new Map(
      balances.map((row) => [row.id, bigIntToNumber(row.balance_minor)]),
    );

    return accounts.map((account) => ({
      ...toDto(account),
      balanceMinor:
        balanceById.get(account.id) ?? bigIntToNumber(account.openingBalanceMinor),
    }));
  },

  async create(userId: string, input: CreateAccountInput): Promise<Account> {
    const openingBalanceMinor = BigInt(
      input.openingBalance === undefined ? 0 : toMinor(input.openingBalance),
    );

    const account = await accountsRepository.create(userId, {
      name: input.name,
      type: input.type,
      currency: input.currency,
      openingBalanceMinor,
    });

    return toDto(account);
  },

  async update(
    id: string,
    userId: string,
    input: UpdateAccountInput,
  ): Promise<Account> {
    const { count } = await accountsRepository.updateForUser(id, userId, input);

    // count === 0 means the row doesn't exist OR belongs to someone else.
    // We return 404 either way — never confirm another user's row exists (Ch 10 §10.5).
    if (count === 0) throw AppError.notFound("Account not found");

    const updated = await accountsRepository.findByIdForUser(id, userId);
    if (!updated) throw AppError.notFound("Account not found");

    return toDto(updated);
  },

  async remove(id: string, userId: string): Promise<void> {
    const { count } = await accountsRepository.softDeleteForUser(id, userId);
    if (count === 0) throw AppError.notFound("Account not found");
  },
};
