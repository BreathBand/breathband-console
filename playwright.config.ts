import { defineConfig, devices } from "@playwright/test";

const port = process.env.PORT ?? "3000";
const baseURL = process.env.BASE_URL ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  retries: 0,
  forbidOnly: !!process.env.CI,
  // The HTML report in CI too: the e2e job uploads it when a run fails.
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: `npm run dev -- --port ${port}`,
        url: baseURL,
        reuseExistingServer: true,
        timeout: 180_000,
        // The specs sign in through the local backend's demo buttons. Pinned so a
        // .env.local copied from .env.example (which says http) doesn't change it;
        // the http run is playwright.http.config.ts.
        env: { NEXT_PUBLIC_BACKEND: "local" },
      },
});
