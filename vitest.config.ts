import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@schema": fileURLToPath(new URL("./db/schema.ts", import.meta.url)),
      "@app": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["src/test/**/*.test.ts", "socket-server/src/test/**/*.test.ts"],
    environment: "node",
    testTimeout: 2000,
    hookTimeout: 2000,
  },
});
