import { z } from "zod";

export const CreateCategorySchema = z.object({
  name: z.string().min(1).max(60).trim(),
  kind: z.enum(["income", "expense"]),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  icon: z.string().max(40).nullable().optional(),
});

export const UpdateCategorySchema = z.object({
  name: z.string().min(1).max(60).trim().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  icon: z.string().max(40).nullable().optional(),
});

export const IdParamSchema = z.object({ id: z.string().uuid() });

export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof UpdateCategorySchema>;
