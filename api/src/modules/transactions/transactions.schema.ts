import { z } from "zod";

const MoneyInput = z.union([z.string(), z.number()]); // major units, e.g. "320.50"

export const CreateTransactionSchema = z.object({
  accountId: z.string().uuid(),
  type: z.enum(["income", "expense"]), // transfers use the dedicated endpoint
  amount: MoneyInput,
  categoryId: z.string().uuid().nullable().optional(),
  occurredAt: z.string().optional(), // ISO date/datetime; defaults to now
  note: z.string().max(280).nullable().optional(),
  source: z.enum(["manual", "ai", "import"]).optional(),
});

export const CreateTransferSchema = z
  .object({
    fromAccountId: z.string().uuid(),
    toAccountId: z.string().uuid(),
    amount: MoneyInput,
    occurredAt: z.string().optional(),
    note: z.string().max(280).nullable().optional(),
  })
  .refine((data) => data.fromAccountId !== data.toAccountId, {
    message: "Cannot transfer to the same account",
    path: ["toAccountId"],
  });

export const UpdateTransactionSchema = z.object({
  amount: MoneyInput.optional(),
  categoryId: z.string().uuid().nullable().optional(),
  occurredAt: z.string().optional(),
  note: z.string().max(280).nullable().optional(),
});

export const ListTransactionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  accountId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  type: z.enum(["income", "expense", "transfer"]).optional(),
  from: z.string().optional(), // ISO date — inclusive lower bound
  to: z.string().optional(), // ISO date — inclusive upper bound
});

export const IdParamSchema = z.object({ id: z.string().uuid() });

export type CreateTransactionInput = z.infer<typeof CreateTransactionSchema>;
export type CreateTransferInput = z.infer<typeof CreateTransferSchema>;
export type UpdateTransactionInput = z.infer<typeof UpdateTransactionSchema>;
export type ListTransactionsQuery = z.infer<typeof ListTransactionsQuerySchema>;
