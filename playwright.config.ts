import { defineConfig, devices } from "@playwright/test";
import path from "path";

/**
 * Next.js + Playwright — 공식:
 * https://nextjs.org/docs/app/guides/testing/playwright
 * 예제: https://github.com/vercel/next.js/tree/canary/examples/with-playwright
 */
const PORT = process.env.PORT || 3000;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  timeout: 30 * 1000,
  testDir: path.join(__dirname, "e2e"),
  retries: process.env.CI ? 2 : 0,
  outputDir: "test-results/",
  webServer: {
    command: "npm run dev",
    url: baseURL,
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "Desktop Chrome",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
