import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["tests/archive/**", "node_modules/**", "dist/**"],
    globals: true
  }
});
