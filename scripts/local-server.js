// Run the page and the API together on this machine, without Vercel:
//   npm run local    then open http://localhost:3000
// Serves dist/ (build first) and routes /api/<name> to api/<name>.js with the small part of
// Vercel's req/res shape those handlers use (req.body, req.headers, res.status().json()).

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DIST = join(ROOT, "dist");
const PORT = Number(process.env.PORT) || 3000;
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml" };
const HANDLERS = new Set(["decide", "telegram", "engine-status"]);

function vercelRes(raw) {
  const res = {
    status(code) {
      raw.statusCode = code;
      return res;
    },
    json(payload) {
      raw.setHeader("Content-Type", "application/json");
      raw.end(JSON.stringify(payload));
      return res;
    },
  };
  return res;
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > 64_000) throw new Error("body too large");
    chunks.push(c);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

createServer(async (req, raw) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const api = url.pathname.match(/^\/api\/([a-z-]+)$/);
  try {
    if (api) {
      if (!HANDLERS.has(api[1])) {
        raw.statusCode = 404;
        raw.end("not found");
        return;
      }
      const { default: handler } = await import(`../api/${api[1]}.js`);
      req.body = await readBody(req);
      await handler(req, vercelRes(raw));
      return;
    }
    const path = normalize(url.pathname === "/" ? "/index.html" : url.pathname).replace(/^(\.\.[/\\])+/, "");
    const file = join(DIST, path);
    if (!file.startsWith(DIST)) {
      raw.statusCode = 403;
      raw.end("forbidden");
      return;
    }
    const data = await readFile(file).catch(() => readFile(join(DIST, "index.html")));
    raw.setHeader("Content-Type", TYPES[extname(file)] || "text/html");
    raw.end(data);
  } catch {
    raw.statusCode = 500;
    raw.end("server error");
  }
}).listen(PORT, () => console.log(`Stet running at http://localhost:${PORT}`));
