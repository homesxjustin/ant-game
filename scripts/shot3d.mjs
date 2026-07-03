// Capture 3D screenshots at each perspective preset. Serves the production
// build and drives the game in headless Chromium (software WebGL).
import { chromium } from "playwright-core";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname } from "node:path";

const DIST = new URL("../dist/", import.meta.url).pathname;
const CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".map": "application/json" };

const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent((req.url || "/").split("?")[0]);
    if (p === "/") p = "/index.html";
    const f = join(DIST, p);
    await stat(f);
    res.writeHead(200, { "content-type": MIME[extname(f)] || "application/octet-stream" });
    res.end(await readFile(f));
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch({
  executablePath: CHROME,
  args: ["--no-sandbox", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("favicon")) errors.push(m.text()); });

await page.goto(`http://localhost:${port}/`, { waitUntil: "networkidle" });
await page.waitForFunction(() => !!window.__game, { timeout: 8000 });

// Let the colony develop trails.
await page.waitForTimeout(9000);

const shots = [
  { key: "Digit2", name: "colony", label: "Colony view" },
  { key: "Digit1", name: "ground", label: "Ground view" },
  { key: "Digit3", name: "ecosystem", label: "Ecosystem view" },
];
for (const s of shots) {
  await page.evaluate((code) => {
    window.dispatchEvent(new KeyboardEvent("keydown", { code }));
    setTimeout(() => window.dispatchEvent(new KeyboardEvent("keyup", { code })), 30);
  }, s.key);
  await page.waitForTimeout(2500); // let the camera glide to the preset
  await page.screenshot({ path: `docs/shot-3d-${s.name}.png` });
  console.log("shot", s.name);
}

const stats = await page.evaluate(() => window.__game.debugStats());
await browser.close();
server.close();
console.log("errors:", errors.slice(0, 5));
console.log("stats:", JSON.stringify(stats));
