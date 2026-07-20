import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Integration tests hit a real database over the network, so the 5s default
    // is too tight. Unit tests are unaffected — they finish in milliseconds.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // One database, shared state: run test FILES sequentially so two suites
    // never race on the same rows.
    fileParallelism: false,
    env: { NODE_ENV: "test" },
  },
});
