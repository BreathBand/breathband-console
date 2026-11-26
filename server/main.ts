// Runs the API on Node.
//
//   npm run api:dev      tsx watch, NODE_ENV=development (server/development.env)
//   npm run api:start    production: serves out/ too (run `npm run build` first)
//
// Neither loads .env.local. Pass the environment in, e.g.
//   TURSO_DATABASE_URL=file:./data/other.db API_PORT=8790 npm run api:start

import { existsSync } from "node:fs";
import { serve } from "@hono/node-server";
import { authBaseUrl, authSecret, createAuth } from "./auth";
import { createDb } from "./db/client";
import { readEnv } from "./env";
import { createApp } from "./index";
import { createMailer } from "./mailer";

const STATIC_DIR = "out";
const SHUTDOWN_TIMEOUT_MS = 10_000;

const env = readEnv();
const { client, db } = createDb(env.databaseUrl, env.databaseAuthToken);

const production = env.mode === "production";
if (production && !existsSync(STATIC_DIR)) {
  console.warn(`${STATIC_DIR}/ is missing: run \`npm run build\` to serve the web app from the API.`);
}

const auth = createAuth({
  db,
  mode: env.mode,
  secret: authSecret(env.mode, env.authSecret),
  baseUrl: authBaseUrl(env),
  appUrl: env.appUrl,
  mailer: createMailer(env.mode, env.smtp),
});

const app = createApp({
  db,
  mode: env.mode,
  appUrl: env.appUrl,
  staticDir: production ? STATIC_DIR : undefined,
  log: env.mode !== "test",
  auth,
});

const server = serve({ fetch: app.fetch, port: env.port }, (info) => {
  console.log(`API (${env.mode}) listening on http://localhost:${info.port}`);
});

let stopping = false;

function shutdown(signal: NodeJS.Signals): void {
  if (stopping) return;
  stopping = true;
  console.log(`${signal}: closing the server`);
  const force = setTimeout(() => {
    console.error("Open connections did not close in time; exiting.");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  force.unref();
  server.close((error) => {
    client.close();
    if (error) {
      console.error(error);
      process.exitCode = 1;
    }
  });
  if ("closeIdleConnections" in server) server.closeIdleConnections();
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
