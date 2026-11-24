// Usage: node evidence.mjs <baseUrl> <outDir> <persona: coach|athlete|public> <widths csv> <route=>dataSelector> [...]
// Each route waits for, and asserts, a selector that only exists once real data has rendered.
// Writes <outDir>/<slug>@<w>.png per route and width, and <outDir>/axe.json with the full axe violations.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
const require = createRequire("C:/nvm4w/nodejs/node_modules/@playwright/cli/node_modules/");
const { chromium } = require("playwright-core");

const [BASE, OUT, persona, widthsCsv, ...specs] = process.argv.slice(2);
const DATA = Object.fromEntries(specs.map((s) => { const i = s.indexOf("=>"); return i < 0 ? [s, null] : [s.slice(0, i), s.slice(i + 2)]; }));
const routes = Object.keys(DATA);
if (routes.some((r) => !DATA[r])) throw new Error("every route needs =>dataSelector");
const WIDTHS = widthsCsv.split(",").map(Number);
const AXE = readFileSync("C:/Users/arynb/Documents/Projects/breathband-console/node_modules/axe-core/axe.min.js", "utf8");
const NAMES = { coach: "Lena Vos", athlete: "Alex Morgan" };
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.PW_EXE ?? "C:/Users/arynb/AppData/Local/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-win64/chrome-headless-shell.exe",
});
console.log(`browser ${browser.version()}`);
const ctx = await browser.newContext();
const page = await ctx.newPage();
if (persona !== "public") {
  await page.goto(BASE + "/cloud/login/", { waitUntil: "networkidle", timeout: 180000 });
  const deadline = Date.now() + 90000;
  for (;;) {
    await page.getByRole("button", { name: new RegExp("Sign in as " + NAMES[persona]) }).click();
    try { await page.waitForURL((u) => !u.pathname.startsWith("/cloud/login"), { timeout: 4000 }); break; }
    catch { if (Date.now() > deadline) throw new Error("sign-in failed for " + persona); }
  }
}

const results = [];
for (const r of routes) {
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.goto(BASE + r, { waitUntil: "networkidle", timeout: 180000 });
    await page.locator(DATA[r]).first().waitFor({ state: "attached", timeout: 20000 });
    await page.waitForTimeout(500);
    const slug = r.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "root";
    const shot = `${OUT}/${slug}@${w}.png`;
    await page.screenshot({ path: shot, fullPage: true });
    const bytes = readFileSync(shot).length;
    const scroll = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      overflowingScrollers: [...document.querySelectorAll("body *")]
        .filter((el) => { const s = getComputedStyle(el); return /(auto|scroll)/.test(s.overflowX) && el.scrollWidth > el.clientWidth + 1; })
        .map((el) => `${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).join(".") : ""} ${el.scrollWidth}/${el.clientWidth}`),
    }));
    await page.addScriptTag({ content: AXE });
    const violations = await page.evaluate(async () => (await axe.run(document, { resultTypes: ["violations"] })).violations.map((v) => ({
      id: v.id, impact: v.impact, help: v.help,
      nodes: v.nodes.map((n) => ({ target: n.target.join(" "), html: n.html.slice(0, 200), summary: n.failureSummary })),
    })));
    const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    results.push({ route: r, width: w, shot, bytes, dataSelector: DATA[r], ...scroll, horizontalScroll: scroll.scrollWidth > scroll.clientWidth, seriousOrCritical: serious.length, violations });
    console.log(`${r} @${w}: data ✓ ${DATA[r]}, ${bytes} B, page scrollWidth ${scroll.scrollWidth}/${scroll.clientWidth}, overflowing scrollers [${scroll.overflowingScrollers.join("; ")}], axe serious+critical ${serious.length}, all ${violations.length}${violations.length ? " [" + violations.map((v) => v.id + ":" + v.impact).join(", ") + "]" : ""}`);
  }
}
await browser.close();
writeFileSync(`${OUT}/axe.json`, JSON.stringify(results, null, 1));
