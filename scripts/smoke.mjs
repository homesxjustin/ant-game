// Headless smoke test: serve the production build, boot the game in Chromium,
// let it simulate for a few seconds, and assert it ran without errors and the
// colony actually did something. Exits non-zero on any failure so CI can gate.
import { chromium } from "playwright-core";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname } from "node:path";

const DIST = new URL("../dist/", import.meta.url).pathname;
const CHROME =
  process.env.SMOKE_CHROME ||
  "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

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
      const body = await readFile(file);
      res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" });
      res.end(body);
    } catch {
      console.log("[server] 404", req.url);
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
  const url = `http://localhost:${port}/`;

  const browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });

  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("favicon")) errors.push(m.text());
  });

  await page.goto(url, { waitUntil: "networkidle" });

  // Wait for the game object to be exposed.
  await page.waitForFunction(() => !!window.__game, { timeout: 5000 });

  // Boot splash should be dismissed.
  const bootHidden = await page.evaluate(() =>
    document.getElementById("boot")?.classList.contains("hidden"),
  );

  // Let it simulate ~3 seconds of real time.
  await page.waitForTimeout(3000);

  // Pull a stats snapshot out of the running simulation via the debug handle.
  const stats = await page.evaluate(() => {
    const g = window.__game;
    // Game holds a private sim; reach in through a known accessor path.
    const sim = g.sim ?? g._sim ?? null;
    // Fall back: expose via the game's objectives/stats if available.
    return g.debugStats ? g.debugStats() : sim ? sim.stats() : null;
  });

  // Verify the canvas actually painted (non-blank).
  const painted = await page.evaluate(() => {
    const c = document.getElementById("game-canvas");
    const ctx = c.getContext("2d");
    const { data } = ctx.getImageData(0, 0, c.width, c.height);
    let nonBg = 0;
    for (let i = 0; i < data.length; i += 4000) {
      if (data[i] > 40 || data[i + 1] > 50 || data[i + 2] > 40) nonBg++;
    }
    return nonBg;
  });

  await browser.close();
  server.close();

  const problems = [];
  if (errors.length) problems.push(`console/page errors: ${JSON.stringify(errors.slice(0, 5))}`);
  if (!bootHidden) problems.push("boot splash was not dismissed");
  if (!painted) problems.push("canvas appears blank (nothing rendered)");
  if (stats && stats.playerGathered === 0 && stats.playerPop === 0)
    problems.push("simulation produced no activity");

  if (problems.length) {
    console.error("SMOKE FAILED:\n - " + problems.join("\n - "));
    process.exit(1);
  }

  console.log("SMOKE PASSED", { bootHidden, paintedSamples: painted, stats });
}

main().catch((e) => {
  console.error("SMOKE CRASHED", e);
  process.exit(1);
});
