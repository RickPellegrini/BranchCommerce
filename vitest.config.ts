import path from "path"

import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname) },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: [
            "lib/**/*.test.ts",
            "features/**/*.test.ts",
          ],
        },
      },
      {
        extends: true,
        test: {
          name: "convex",
          environment: "edge-runtime",
          include: ["convex/**/*.test.ts"],
        },
      },
    ],
  },
})
