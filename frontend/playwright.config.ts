import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for ClauseWise accessibility tests.
 *
 * Runs against the Vite dev server (npm run dev).
 * Tests live in frontend/tests/ and use @axe-core/playwright.
 */
export default defineConfig({
  testDir: "./tests",
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source */
  forbidOnly: !!process.env["CI"],
  /* Retries on CI only */
  retries: process.env["CI"] ? 1 : 0,
  /* Opt out of parallel tests on CI */
  workers: process.env["CI"] ? 1 : undefined,
  /* Reporter */
  reporter: [["list"], ["html", { open: "never" }]],
  /* Shared settings */
  use: {
    baseURL: "http://localhost:5173",
    /* Collect trace when retrying a failed test */
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  /* Start the Vite dev server before tests */
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env["CI"],
    timeout: 120_000,
  },
});
