import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/__tests__/**", "src/index.ts", "src/types.ts"],
      thresholds: {
        statements: 85,
        branches: 80,
        functions: 80,
        lines: 85,
      },
    },
  },
});
