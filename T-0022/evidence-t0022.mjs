// Usage: node evidence-t0022.mjs <baseUrl> <outDir>
// Chart text alternatives (T-0022): screenshots + axe at 375/768/1280 on three pages, a keyboard walk
// through the first toggle, svg ARIA wiring, and print-media checks on the report page.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
const require = createRequire("C:/nvm4w/nodejs/node_modules/@playwright/cli/node_modules/");
const { chromium } = require("playwright-core");

const [BASE, OUT] = process.argv.slice(2);
const PAGES = ["/cloud/sessions/?athlete=demo-athlete&tab=trends", "/cloud/trends/", "/cloud/report/?athlete=demo-athlete"];
const WIDTHS = [375, 768, 1280];
const AXE = readFileSync("C:/Users/arynb/Documents/Projects/breathband-console/node_modules/axe-core/axe.min.js", "utf8");
const TOGGLE = /show values as a table/i;
mkdirSync(OUT, { recursive: true });
const slug = (r) => r.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "");

const browser = await chromium.launch({
  executablePath: "C:/Users/arynb/AppData/Local/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-win64/chrome-headless-shell.exe",
});
const page = await (await browser.newContext()).newPage();
await page.goto(BASE + "/cloud/login/", { waitUntil: "networkidle", timeout: 180000 });
for (const deadline = Date.now() + 90000; ; ) {
  await page.getByRole("button", { name: /Sign in as Lena Vos/ }).click();
  try { await page.waitForURL((u) => !u.pathname.startsWith("/cloud/login"), { timeout: 4000 }); break; }
  catch { if (Date.now() > deadline) throw new Error("sign-in failed"); }
}
const DATA = {
  "/cloud/sessions/?athlete=demo-athlete&tab=trends": 'svg[role="img"][aria-label^="Total Breath Score for"]',
  "/cloud/trends/": 'svg[role="img"][aria-label^="Total Breath Score per week"]',
  "/cloud/report/?athlete=demo-athlete": 'svg[role="img"][aria-label^="Total Breath Score for"]',
};
const settle = async (r) => {
  await page.goto(BASE + r, { waitUntil: "networkidle", timeout: 180000 });
  await page.locator(DATA[r]).first().waitFor({ state: "visible", timeout: 20000 });
  await page.waitForTimeout(500);
};
const result = { shots: [], keyboard: null, svg: [], print: null };

for (const r of PAGES) for (const w of WIDTHS) {
  await page.setViewportSize({ width: w, height: 900 });
  await settle(r);
  const shot = `${OUT}/${slug(r)}@${w}.png`;
  await page.screenshot({ path: shot, fullPage: true });
  const m = await page.evaluate((src) => {
    const re = new RegExp(src, "i");
    return {
      scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth,
      charts: document.querySelectorAll('svg[role="img"]').length,
      toggles: [...document.querySelectorAll("button")].filter((b) => re.test(b.textContent || "")).length,
    };
  }, TOGGLE.source);
  await page.addScriptTag({ content: AXE });
  const violations = await page.evaluate(async () => (await axe.run(document, { resultTypes: ["violations"] })).violations.map((v) => ({
    id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.map((n) => ({ target: n.target.join(" "), html: n.html.slice(0, 200) })),
  })));
  const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical").length;
  const bytes = readFileSync(shot).length;
  result.shots.push({ route: r, width: w, shot, bytes, dataSelector: DATA[r], ...m, seriousOrCritical: serious, violations });
  console.log(`${r} @${w}: data ✓ ${DATA[r]}, ${bytes} B, scroll ${m.scrollWidth}/${m.clientWidth}, svg[role=img] ${m.charts}, toggles ${m.toggles}, axe serious+critical ${serious}, all ${violations.length}${violations.length ? " [" + violations.map((v) => v.id + ":" + v.impact).join(", ") + "]" : ""}`);
}

await page.setViewportSize({ width: 375, height: 900 });
await settle("/cloud/sessions/?athlete=demo-athlete&tab=trends");
const toggleCount = await page.getByRole("button", { name: TOGGLE }).count();
if (toggleCount) {
  let tabs = 0, reached = false;
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  for (; tabs < 250; tabs++) {
    await page.keyboard.press("Tab");
    reached = await page.evaluate((src) => new RegExp(src, "i").test(document.activeElement?.textContent || ""), TOGGLE.source);
    if (reached) break;
  }
  const before = await page.evaluate(() => document.activeElement.getAttribute("aria-expanded"));
  await page.keyboard.press("Enter");
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => {
    const b = document.activeElement;
    const id = b.getAttribute("aria-controls");
    const panel = id && document.getElementById(id);
    const table = panel && (panel.matches("table") ? panel : panel.querySelector("table"));
    return {
      ariaExpanded: b.getAttribute("aria-expanded"), ariaControls: id, panelVisible: !!panel && panel.offsetParent !== null,
      caption: table?.querySelector("caption")?.textContent?.trim() ?? null,
      th: table ? table.querySelectorAll("th").length : 0, rows: table ? table.querySelectorAll("tbody tr").length : 0,
      firstRow: table ? [...(table.querySelector("tbody tr")?.children ?? [])].map((c) => c.textContent.trim()) : [],
      pageScroll: `${document.documentElement.scrollWidth}/${document.documentElement.clientWidth}`,
    };
  });
  await page.keyboard.press("Space");
  await page.waitForTimeout(300);
  const afterSpace = await page.evaluate(() => document.activeElement.getAttribute("aria-expanded"));
  await page.keyboard.press("Space");
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/keyboard-open@375.png`, fullPage: true });
  result.keyboard = { tabsToReach: tabs + 1, reached, ariaExpandedBefore: before, enter: after, spaceTogglesTo: afterSpace };
  console.log("keyboard:", JSON.stringify(result.keyboard));
} else {
  console.log("keyboard: no toggle found");
}

for (const r of PAGES) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await settle(r);
  const s = await page.evaluate(() => [...document.querySelectorAll('svg[role="img"]')].map((svg) => {
    const d = svg.getAttribute("aria-describedby");
    const el = d && document.getElementById(d);
    return { ariaLabel: svg.getAttribute("aria-label"), describedby: d, describedText: el ? el.textContent.trim().slice(0, 160) : null };
  }));
  result.svg.push({ route: r, svgs: s });
  console.log(`svg ${r}: ${s.length} charts; with aria-label ${s.filter((x) => x.ariaLabel).length}; describedby resolves ${s.filter((x) => x.describedText).length}`);
}

await page.setViewportSize({ width: 1280, height: 900 });
await settle("/cloud/report/?athlete=demo-athlete");
await page.emulateMedia({ media: "print" });
await page.waitForTimeout(400);
result.print = await page.evaluate((src) => {
  const re = new RegExp(src, "i");
  const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.display !== "none" && s.visibility !== "hidden"; };
  return {
    visibleToggles: [...document.querySelectorAll("button")].filter((b) => re.test(b.textContent || "") && vis(b)).length,
    visibleChartTables: [...document.querySelectorAll(".viz-data, .viz-data table")].filter(vis).length,
    visibleCharts: [...document.querySelectorAll('svg[role="img"]')].filter(vis).length,
  };
}, TOGGLE.source);
await page.screenshot({ path: `${OUT}/report-print@1280.png`, fullPage: true });
await page.pdf({ path: `${OUT}/report-print.pdf`, printBackground: true }).catch(() => {});
console.log("print:", JSON.stringify(result.print));

await browser.close();
writeFileSync(`${OUT}/result.json`, JSON.stringify(result, null, 1));
