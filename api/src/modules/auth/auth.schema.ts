import { z } from "zod";

/**
 * Input contracts for the auth endpoints (Ch 7 §7.4).
 * Email is lowercased here so it is stored and looked up consistently — this is our
 * application-level substitute for a case-insensitive DB column (Ch 5).
 */
export const SignupSchema = z.object({
  email: z
    .string()
    .email()
    .transform((value) => value.trim().toLowerCase()),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
  name: z.string().min(1).max(120),
  baseCurrency: z.string().length(3).optional(),
});

export const LoginSchema = z.object({
  email: z
    .string()
    .email()
    .transform((value) => value.trim().toLowerCase()),
  password: z.string().min(1),
});

export type SignupInput = z.infer<typeof SignupSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
