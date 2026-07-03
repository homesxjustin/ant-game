import { chromium } from "playwright-core";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname } from "node:path";
const DIST = new URL("../dist/", import.meta.url).pathname;
const CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const MIME = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css", ".map":"application/json" };
const server = createServer(async (req,res)=>{ try{ let p=decodeURIComponent((req.url||"/").split("?")[0]); if(p==="/")p="/index.html"; const f=join(DIST,p); await stat(f); res.writeHead(200,{"content-type":MIME[extname(f)]||"application/octet-stream"}); res.end(await readFile(f)); }catch{ res.writeHead(404); res.end(); } });
await new Promise(r=>server.listen(0,r));
const port=server.address().port;
const b=await chromium.launch({executablePath:CHROME,args:["--no-sandbox"]});
const pg=await b.newPage({viewport:{width:1280,height:800},deviceScaleFactor:2});
await pg.goto(`http://localhost:${port}/`,{waitUntil:"networkidle"});
await pg.waitForFunction(()=>!!window.__game);
await pg.waitForTimeout(12000); // let trails and colony develop
await pg.screenshot({path:"docs/screenshot.png"});
await b.close(); server.close();
console.log("shot saved");
