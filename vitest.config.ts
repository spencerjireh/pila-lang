import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    include: [
      "lib/**/*.test.ts",
      "packages/**/src/**/*.test.ts",
      "scripts/**/*.test.ts",
    ],
    globals: false,
    setupFiles: ["./vitest.setup.ts"],
  },
});
