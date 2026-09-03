import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Unit tests only, and node-environment only.
 *
 * What is worth testing here is the logic that decides prices, order, and
 * validity — pure functions with no database and no DOM. Anything that needs a
 * real Supabase project or a browser belongs in an end-to-end suite, which is
 * a separate job with its own credentials.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
