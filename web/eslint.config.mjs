import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    /**
     * Components must not call `fetch` directly (Ch 8 §8.4, §8.8).
     *
     * apiFetch is where the auth header, the response-envelope unwrapping and
     * the typed ApiError live. Ch 8 §8.8 lists bypassing it as a "block the PR"
     * condition — and the landing page had already grown a raw fetch, which is
     * precisely the decay this rule exists to stop.
     */
    files: ["app/**/*.tsx", "components/**/*.tsx", "hooks/**/*.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        {
          name: "fetch",
          message:
            "Use apiFetch from @/lib/api-client — it attaches auth, unwraps the envelope and throws typed errors (Ch 8 §8.4).",
        },
      ],
    },
  },
]);

export default eslintConfig;
