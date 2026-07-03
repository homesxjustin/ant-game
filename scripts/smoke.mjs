// Headless smoke test for the shipped (3D) edition: serve the production
// build, boot the game in Chromium with software WebGL, let it simulate a few
// seconds, and assert it initialised the 3D pipeline and ran the simulation
// without errors. Exits non-zero on any failure so CI can gate.
import { chromium } from "playwright-core";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname } from "node:path";

const DIST = new URL("../dist/", import.meta.url).pathname;
const CHROME = process.env.SMOKE_CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".map": "application/json",
  ".json": "application/json",
};

async function serve() {
  const server = createServer(async (req, res) => {
    try {
      let p = decodeURIComponent((req.url || "/").split("?")[0]);
      if (p === "/") p = "/index.html";
      const file = join(DIST, p);
      await stat(file);
      res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" });
      res.end(await readFile(file));
    } catch {
      res.writeHead(404);
      res.end("not found");
    }
  });
  await new Promise((r) => server.listen(0, r));
  return server;
}

async function main() {
  const server = await serve();
  const port = server.address().port;

  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ["--no-sandbox", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"],
  });
  const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });

  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("favicon")) errors.push(m.text());
  });

  await page.goto(`http://localhost:${port}/`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => !!window.__game, { timeout: 8000 });

  const bootHidden = await page.evaluate(() =>
    document.getElementById("boot")?.classList.contains("hidden"),
  );

  // 3D pipeline check: the canvas must be backed by a live WebGL context.
  const glOk = await page.evaluate(() => {
    const c = document.getElementById("game-canvas");
    const gl = c.getContext("webgl2") || c.getContext("webgl");
    return !!gl && c.width > 0 && c.height > 0;
  });

  // Let it simulate ~3 seconds.
  await page.waitForTimeout(3000);
  const stats = await page.evaluate(() => window.__game.debugStats());

  await browser.close();
  server.close();

  const problems = [];
  if (errors.length) problems.push(`console/page errors: ${JSON.stringify(errors.slice(0, 5))}`);
  if (!bootHidden) problems.push("boot splash was not dismissed");
  if (!glOk) problems.push("WebGL context / canvas not initialised");
  if (!stats || stats.simTime <= 0) problems.push("simulation did not advance");
  if (stats && stats.playerPop === 0) problems.push("player colony has no population");

  if (problems.length) {
    console.error("SMOKE FAILED:\n - " + problems.join("\n - "));
    process.exit(1);
  }
  console.log("SMOKE PASSED", { bootHidden, glOk, stats });
}

main().catch((e) => {
  console.error("SMOKE CRASHED", e);
  process.exit(1);
});
