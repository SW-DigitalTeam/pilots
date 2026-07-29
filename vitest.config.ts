import { defineConfig } from "vitest/config";

// One root config; each package's tests live under its own src/**/__tests__.
// jsdom is only needed for the React binding tests; the engine tests run in node.
export default defineConfig({
  test: {
    include: ["packages/**/src/**/*.{test,spec}.ts", "packages/**/src/**/*.{test,spec}.tsx"],
    environmentMatchGlobs: [
      ["packages/react/**", "jsdom"],
    ],
    passWithNoTests: false,
  },
});
