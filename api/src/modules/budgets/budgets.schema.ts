import { z } from "zod";

const MoneyInput = z.union([z.string(), z.number()]);

export const CreateBudgetSchema = z.object({
  categoryId: z.string().uuid(),
  amount: MoneyInput,
  currency: z.string().length(3).optional(), // defaults to the user's base currency
  startsOn: z.string().optional(), // defaults to the start of this month
});

export const UpdateBudgetSchema = z.object({
  amount: MoneyInput,
});

export const IdParamSchema = z.object({ id: z.string().uuid() });

export type CreateBudgetInput = z.infer<typeof CreateBudgetSchema>;
export type UpdateBudgetInput = z.infer<typeof UpdateBudgetSchema>;
