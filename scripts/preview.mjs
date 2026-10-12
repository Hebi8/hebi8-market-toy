// Local preview: serves the package under a sub-path, the way Toy does.
//
//   npm run dev            # public/ with app.js bundled fresh on every load
//   npm run dev -- --dist  # exactly what `npm run build` put into dist/toy/
//
// The Toy SDK is not imitated: account, cloud save and leaderboard only exist
// inside Bilibili, and the game falls back to localStorage here.
import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { bundle } from "./bundle.mjs";

const built = process.argv.includes("--dist");
const root = fileURLToPath(new URL(built ? "../dist/toy/" : "../public/", import.meta.url));
const host = process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.PORT ?? 8818);
const mount = "/toy/hebi8-fx-preview/";
const mime = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".svg": "image/svg+xml", ".txt": "text/plain",
};

const server = http.createServer(async (request, response) => {
  response.setHeader("cache-control", "no-store");
  response.setHeader("x-content-type-options", "nosniff");
  try {
    if (!["GET", "HEAD"].includes(request.method)) {
      response.writeHead(405, { allow: "GET, HEAD" }).end();
      return;
    }
    const url = new URL(request.url, "http://preview.local");
    if (url.pathname === "/") {
      response.writeHead(302, { location: "/preview.html" }).end();
      return;
    }
    if (url.pathname === "/preview.html") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(await readFile(new URL("preview.html", import.meta.url)));
      return;
    }
    if (!url.pathname.startsWith(mount)) {
      response.writeHead(404).end();
      return;
    }
    const relative = decodeURIComponent(url.pathname.slice(mount.length)) || "index.html";
    const target = path.resolve(root, relative);
    if (!target.startsWith(root) || !mime[path.extname(target)]) {
      response.writeHead(404).end();
      return;
    }
    const data = !built && relative === "app.js" ? await bundle({ minify: false }) : await readFile(target);
    response.writeHead(200, { "content-type": `${mime[path.extname(target)]}; charset=utf-8` });
    response.end(request.method === "HEAD" ? undefined : data);
  } catch (error) {
    if (response.headersSent) {
      response.destroy();
      return;
    }
    const missing = error.code === "ENOENT";
    response.writeHead(missing ? 404 : 500, { "content-type": "text/plain; charset=utf-8" });
    response.end(missing ? "not found" : String(error.message));
  }
});

server.listen(port, host, () => {
  console.log(`Three sizes side by side: http://${host}:${port}/preview.html`);
  console.log(`The page alone:           http://${host}:${port}${mount}index.html`);
  console.log(built ? "Serving dist/toy/ as built." : "Serving public/ with a fresh bundle on every load.");
});
