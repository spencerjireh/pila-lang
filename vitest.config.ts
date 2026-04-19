import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./apps/web"),
    },
  },
  test: {
    environment: "node",
    include: [
      "apps/web/**/*.test.ts",
      "packages/**/src/**/*.test.ts",
      "scripts/**/*.test.ts",
    ],
    globals: false,
    setupFiles: ["./vitest.setup.ts"],
  },
});
