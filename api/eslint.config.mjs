import js from "@eslint/js";
import tseslint from "typescript-eslint";

/**
 * API lint rules (Ch 7 §7.10).
 *
 * The repo had no ESLint config at all, so CI could not run a lint step and the
 * layering rules in Ch 7 were enforced by nothing but review attention.
 *
 * The rule that earns its keep is the last one: routes must not import Prisma.
 * Ch 7 §7.9 lists that as a "block the PR" condition, and it had already been
 * violated in health.routes.ts — which is exactly what a lint rule is for.
 * Layering rules decay silently; a failing build does not.
 */
export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**", "prisma/migrations/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // `_`-prefixed args are the express convention for "required by the
      // signature, deliberately unused" — e.g. the `next` in an error handler.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Warn, not error: a few `any`s at the Prisma raw-query boundary are
      // honest, and making this an error would push people to `as unknown as`,
      // which hides the same problem behind more syntax.
      "@typescript-eslint/no-explicit-any": "warn",
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-console": ["warn", { allow: ["error", "log", "warn"] }],
    },
  },
  {
    // The layering guardrail. Services own business rules, repositories own the
    // database; a route reaching past both couples HTTP directly to storage.
    files: ["src/**/*.routes.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/lib/prisma", "@prisma/client"],
              message:
                "Routes must not touch the database directly (Ch 7 §7.1). Call a service, which calls a repository.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["**/*.test.ts", "src/test/**"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
);
