import { defineConfig, devices } from "@playwright/test";

// The demo e2e on the http backend (I-14, T-0136): `npm run e2e:http`.
// Starts the API on a fresh file database seeded with the demo people
// (db:reset + db:seed, never a libsql:// URL), and the web app built for http
// against it. playwright.config.ts stays the local-backend run.
//
//   PORT=3201 npm run e2e:http                       web on 3201 (default 3001)
//   E2E_API_PORT=8798 PORT=3201 npm run e2e:http     API on 8798 (default 8797)

const port = process.env.PORT ?? "3001";
const apiPort = process.env.E2E_API_PORT ?? "8797";
const baseURL = `http://localhost:${port}`;
const apiURL = `http://localhost:${apiPort}`;

// Under data/ (gitignored), apart from the dev database. Wiped before every run.
const DB_FILE = "data/e2e-http.db";
const BLOB_DIR = "data/e2e-http-blobs";

const freshData = `node -e "const fs=require('node:fs');fs.rmSync('${BLOB_DIR}',{recursive:true,force:true});fs.mkdirSync('data',{recursive:true})"`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: ["demo-path.spec.ts", "demo-people.spec.ts", "signup-consents.spec.ts", "smoke.spec.ts"],
  // The demo buttons are the local backend's; on http the login page has the form only.
  grepInvert: /offers a demo button/,
  outputDir: "test-results/http",
  timeout: 240_000,
  retries: 0,
  // One worker: the API allows 5 sign-ins a minute per client, shared by every test.
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? "list" : [["list"], ["html", { open: "never", outputFolder: "playwright-report/http" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  // e2e/auth.ts reads metadata.backend: on http it signs in through the form, not the demo buttons (T-0139).
  projects: [{ name: "chromium-http", metadata: { backend: "http" }, use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: `${freshData} && npm run db:reset && npm run db:seed && npm run api:start`,
      url: `${apiURL}/api/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        // development: the API allows the web app's origin with cookies (CORS) and prints emails.
        NODE_ENV: "development",
        TURSO_DATABASE_URL: `file:./${DB_FILE}`,
        TURSO_AUTH_TOKEN: "",
        STORAGE_DIR: `./${BLOB_DIR}`,
        API_PORT: apiPort,
        APP_URL: baseURL,
        API_URL: apiURL,
        SMTP_HOST: "",
      },
    },
    {
      command: `npm run dev -- --port ${port}`,
      url: baseURL,
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        NEXT_PUBLIC_BACKEND: "http",
        NEXT_PUBLIC_API_BASE_URL: apiURL,
      },
    },
  ],
});
