// Usage: node nodata-t0022.mjs <baseUrl> <outDir>
// Empties one athlete's sessions in the local adapter's stored db, then checks the trend charts
// show their empty state and render no "Show values as a table" toggle.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
const require = createRequire("C:/nvm4w/nodejs/node_modules/@playwright/cli/node_modules/");
const { chromium } = require("playwright-core");
const [BASE, OUT] = process.argv.slice(2);
const KEY = "breathband-console:local-db";
const ATHLETE = "demo-athlete-5";
const ROUTE = `/cloud/sessions/?athlete=${ATHLETE}&tab=trends`;
const EMPTY = "text=Nothing in this period.";
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: "C:/Users/arynb/AppData/Local/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-win64/chrome-headless-shell.exe" });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
await page.goto(BASE + "/cloud/login/", { waitUntil: "networkidle", timeout: 180000 });
for (const deadline = Date.now() + 90000; ; ) {
  await page.getByRole("button", { name: /Sign in as Lena Vos/ }).click();
  try { await page.waitForURL((u) => !u.pathname.startsWith("/cloud/login"), { timeout: 4000 }); break; }
  catch { if (Date.now() > deadline) throw new Error("sign-in failed"); }
}
const before = await page.evaluate(([k, a]) => {
  const db = JSON.parse(localStorage.getItem(k));
  const n = (db.sessions[a] || []).length;
  db.sessions[a] = [];
  localStorage.setItem(k, JSON.stringify(db));
  return { sessionsBefore: n, sessionsAfter: JSON.parse(localStorage.getItem(k)).sessions[a].length };
}, [KEY, ATHLETE]);
console.log("store:", JSON.stringify(before));
const results = [];
for (const period of ["", "&period=week", "&period=90d"]) {
  await page.goto(BASE + ROUTE + period, { waitUntil: "networkidle", timeout: 180000 });
  await page.locator(EMPTY).first().waitFor({ state: "visible", timeout: 20000 });
  await page.waitForTimeout(500);
  const r = await page.evaluate(() => ({
    emptyStates: [...document.querySelectorAll(".viz-empty")].map((e) => e.textContent.trim()),
    toggles: [...document.querySelectorAll("button")].filter((b) => /show values as a table/i.test(b.textContent || "")).length,
    chartsWithSummary: document.querySelectorAll('svg[role="img"][aria-describedby]').length,
    storedSessions: JSON.parse(localStorage.getItem("breathband-console:local-db")).sessions["demo-athlete-5"].length,
  }));
  const shot = `${OUT}/nodata${period.replace(/[^a-z0-9]/gi, "_")}@1280.png`;
  await page.screenshot({ path: shot, fullPage: true });
  results.push({ route: ROUTE + period, dataFreeSelector: EMPTY, ...r, shot });
  console.log(ROUTE + period, JSON.stringify(r));
}
await browser.close();
writeFileSync(`${OUT}/nodata.json`, JSON.stringify({ store: before, results }, null, 1));
