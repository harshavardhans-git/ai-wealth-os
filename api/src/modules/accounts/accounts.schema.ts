import { z } from "zod";

const MoneyInput = z.union([z.string(), z.number()]); // major units, e.g. "1500.50"

export const CreateAccountSchema = z.object({
  name: z.string().min(1).max(80),
  type: z.enum(["cash", "bank", "card", "wallet"]),
  currency: z
    .string()
    .length(3)
    .transform((value) => value.toUpperCase()),
  openingBalance: MoneyInput.optional(),
});

export const UpdateAccountSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  isArchived: z.boolean().optional(),
});

export const IdParamSchema = z.object({ id: z.string().uuid() });

export type CreateAccountInput = z.infer<typeof CreateAccountSchema>;
export type UpdateAccountInput = z.infer<typeof UpdateAccountSchema>;
