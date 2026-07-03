"use strict";

const fs = require("fs");
const http = require("http");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 4173);

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".task", "application/octet-stream"],
  [".wasm", "application/wasm"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
]);

function resolveRequestPath(requestUrl) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(requestUrl, `http://${host}:${port}`).pathname);
  } catch {
    return null;
  }

  const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const fullPath = path.resolve(rootDir, relativePath);
  if (fullPath !== rootDir && !fullPath.startsWith(`${rootDir}${path.sep}`)) return null;
  return fullPath;
}

const server = http.createServer((request, response) => {
  const fullPath = resolveRequestPath(request.url || "/");
  if (!fullPath) {
    response.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
    response.end("Bad request");
    return;
  }

  fs.stat(fullPath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    const contentType = contentTypes.get(path.extname(fullPath).toLowerCase());
    response.writeHead(200, {
      "cache-control": "no-store",
      "content-type": contentType || "application/octet-stream",
    });
    fs.createReadStream(fullPath).pipe(response);
  });
});

server.listen(port, host, () => {
  console.log(`E2E server listening at http://${host}:${port}`);
});
