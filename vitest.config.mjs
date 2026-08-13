import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    pool: "threads",
    fileParallelism: false,
    maxWorkers: 1,
    minWorkers: 1,
  },
});
