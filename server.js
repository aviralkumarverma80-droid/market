"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const HOST = "127.0.0.1";
const PORT = Number(process.env.PORT) || 8000;
const ROOT = __dirname;
const CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8"
};

const server = http.createServer((request, response) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, `http://${HOST}`).pathname);
  } catch {
    response.writeHead(400).end("Bad request");
    return;
  }

  if (pathname === "/auth-config") {
    if (request.method !== "GET") {
      response.writeHead(405, { Allow: "GET" }).end("Method not allowed");
      return;
    }

    const url = (process.env.SUPABASE_URL || "").trim();
    const publishableKey = (
      process.env.SUPABASE_PUBLISHABLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      ""
    ).trim();
    const configured = Boolean(url && publishableKey);

    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff"
    });
    response.end(JSON.stringify({
      configured,
      url: configured ? url : null,
      publishableKey: configured ? publishableKey : null
    }));
    return;
  }

  const file = path.resolve(ROOT, `.${pathname === "/" ? "/index.html" : pathname}`);
  const relativePath = path.relative(ROOT, file);
  if (relativePath.startsWith(`..${path.sep}`) || relativePath === ".." || path.isAbsolute(relativePath)) {
    response.writeHead(403).end("Forbidden");
    return;
  }

  fs.readFile(file, (error, contents) => {
    if (error) {
      if (error.code === "ENOENT" || error.code === "EISDIR") {
        response.writeHead(404).end("Not found");
        return;
      }
      response.writeHead(500).end("Could not read the requested file");
      return;
    }

    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": CONTENT_TYPES[path.extname(file)] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff"
    });
    response.end(contents);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Marketfield running at http://${HOST}:${PORT}`);
});
