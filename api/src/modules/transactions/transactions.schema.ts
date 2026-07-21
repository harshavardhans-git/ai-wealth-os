import { z } from "zod";

const MoneyInput = z.union([z.string(), z.number()]); // major units, e.g. "320.50"

export const CreateTransactionSchema = z.object({
  accountId: z.string().uuid(),
  type: z.enum(["income", "expense"]), // transfers use the dedicated endpoint
  amount: MoneyInput,
  categoryId: z.string().uuid().nullable().optional(),
  occurredAt: z.string().optional(), // ISO date/datetime; defaults to now
  note: z.string().max(280).nullable().optional(),
  // No `source` field by design. Provenance is server-determined: this route
  // always writes "manual", /transactions/import writes "import", and
  // /capture/accepted stamps "capture". A client that could name its own source
  // could lie about how a row was created.
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

/**
 * CSV import (C7). The browser parses the file and maps columns, then posts
 * normalized rows — so the API never handles multipart uploads or stores files
 * (Ch 5: "MVP parses CSV without persisting files").
 */
export const ImportRowSchema = z.object({
  occurredAt: z.string(),
  amount: MoneyInput,
  type: z.enum(["income", "expense"]),
  note: z.string().max(280).nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
});

export const ImportTransactionsSchema = z.object({
  filename: z.string().min(1).max(200),
  accountId: z.string().uuid(),
  rows: z.array(ImportRowSchema).min(1).max(2000),
});

export const BatchIdParamSchema = z.object({ batchId: z.string().uuid() });

export type ImportTransactionsInput = z.infer<typeof ImportTransactionsSchema>;

export type CreateTransactionInput = z.infer<typeof CreateTransactionSchema>;
export type CreateTransferInput = z.infer<typeof CreateTransferSchema>;
export type UpdateTransactionInput = z.infer<typeof UpdateTransactionSchema>;
export type ListTransactionsQuery = z.infer<typeof ListTransactionsQuerySchema>;
