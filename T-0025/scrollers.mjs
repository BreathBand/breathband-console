// Usage: node scrollers.mjs <baseUrl> <outDir>
// T-0013 A2: at 375px, each table scroller takes Tab focus, shows a focus outline, is a named region,
// and scrolls with the arrow keys; axe reports no scrollable-region-focusable.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
const require = createRequire("C:/nvm4w/nodejs/node_modules/@playwright/cli/node_modules/");
const { chromium } = require("playwright-core");

const [BASE, OUT] = process.argv.slice(2);
const AXE = readFileSync("C:/Users/arynb/Documents/Projects/breathband-console/node_modules/axe-core/axe.min.js", "utf8");
const CASES = [
  { route: "/cloud/sessions/?athlete=demo-athlete&tab=plan", scroller: ".table-scroll", data: "text=Earlier" },
  { route: "/cloud/session/?athlete=demo-athlete&id=s001", scroller: ".bt-scroll", data: ".bt-scroll" },
];
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({
  executablePath: "C:/Users/arynb/AppData/Local/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-win64/chrome-headless-shell.exe",
});
const page = await (await browser.newContext({ viewport: { width: 375, height: 900 } })).newPage();
await page.goto(BASE + "/cloud/login/", { waitUntil: "networkidle", timeout: 180000 });
for (const deadline = Date.now() + 90000; ; ) {
  await page.getByRole("button", { name: /Sign in as Lena Vos/ }).click();
  try { await page.waitForURL((u) => !u.pathname.startsWith("/cloud/login"), { timeout: 4000 }); break; }
  catch { if (Date.now() > deadline) throw new Error("sign-in failed"); }
}
const out = [];
for (const c of CASES) {
  await page.goto(BASE + c.route, { waitUntil: "networkidle", timeout: 180000 });
  await page.locator(c.data).first().waitFor({ state: "attached", timeout: 20000 });
  await page.waitForTimeout(500);
  const info = await page.evaluate((sel) => [...document.querySelectorAll(sel)].map((el) => ({
    role: el.getAttribute("role"), name: el.getAttribute("aria-label") || (el.getAttribute("aria-labelledby") && document.getElementById(el.getAttribute("aria-labelledby"))?.textContent.trim()) || null,
    tabindex: el.getAttribute("tabindex"), overflows: el.scrollWidth > el.clientWidth + 1, scroll: `${el.scrollWidth}/${el.clientWidth}`,
  })), c.scroller);
  let tabs = 0, focused = null;
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  for (; tabs < 300; tabs++) {
    await page.keyboard.press("Tab");
    if (await page.evaluate((sel) => document.activeElement?.matches(sel), c.scroller)) {
      focused = await page.evaluate(() => {
        const el = document.activeElement, s = getComputedStyle(el);
        return { outlineStyle: s.outlineStyle, outlineWidth: s.outlineWidth, outlineColor: s.outlineColor, focusVisible: el.matches(":focus-visible"), scrollLeftBefore: el.scrollLeft };
      });
      break;
    }
  }
  let scrollLeftAfter = null;
  if (focused) {
    await page.screenshot({ path: `${OUT}/${c.scroller.slice(1)}-focused@375.png`, fullPage: false });
    for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(300);
    scrollLeftAfter = await page.evaluate(() => document.activeElement.scrollLeft);
  }
  await page.addScriptTag({ content: AXE });
  const axeRes = await page.evaluate(async () => (await axe.run(document, { resultTypes: ["violations"] })).violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.map((n) => n.target.join(" ")) })));
  const r = { ...c, scrollers: info, tabsToReach: focused ? tabs + 1 : null, focused, scrollLeftAfter, axe: axeRes };
  out.push(r);
  console.log(JSON.stringify(r));
}
await browser.close();
writeFileSync(`${OUT}/scrollers.json`, JSON.stringify(out, null, 1));
