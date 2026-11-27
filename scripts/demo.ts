// The demo laptop's one command (U3): `npm run demo`.
//
// Builds the static export on the local backend (demo accounts, data in the
// browser, no API and no network) and serves out/ on http://localhost:3000/
// with the API's own static server, so the pages carry the same headers as
// production. Nothing is fetched: it runs offline once `npm ci` has.
//
//   npm run demo                  build, then serve
//   npm run demo -- --no-build    serve the last build (a rehearsal's)
//   PORT=3100 npm run demo        another port

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { SECURITY_HEADERS } from "../server/index";
import { serveExport } from "../server/static";

const OUT = "out";
const port = Number(process.env.PORT ?? 3000);

if (!process.argv.includes("--no-build")) {
  // The backend is named here: it wins over .env.local, which may say http.
  const build = spawnSync("npx", ["next", "build"], {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, NEXT_PUBLIC_BACKEND: "local" },
  });
  if (build.status !== 0) process.exit(build.status ?? 1);
}
if (!existsSync(`${OUT}/index.html`)) {
  console.error(`${OUT}/ has no build: run \`npm run demo\` without --no-build.`);
  process.exit(1);
}

const app = new Hono();
app.use(async (c, next) => {
  await next();
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) c.res.headers.set(name, value);
});
app.get("*", serveExport(OUT));

serve({ fetch: app.fetch, port }, () => {
  console.log(`\nDemo on the local backend: http://localhost:${port}/cloud/login/ (Try a demo account). Ctrl+C stops it.`);
});
