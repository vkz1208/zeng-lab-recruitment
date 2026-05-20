const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = process.env.PORT || 3000;
const contentFile = path.join(root, "content.json");

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml"
};

function send(res, status, body, type = "text/plain; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "POST" && url.pathname === "/api/content") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 18 * 1024 * 1024) req.destroy();
    });
    req.on("end", () => {
      try {
        const data = JSON.parse(body || "{}");
        fs.writeFileSync(contentFile, JSON.stringify(data, null, 2), "utf8");
        send(res, 200, JSON.stringify({ ok: true }), "application/json; charset=utf-8");
      } catch {
        send(res, 400, JSON.stringify({ ok: false }), "application/json; charset=utf-8");
      }
    });
    return;
  }

  const pathname = decodeURIComponent(url.pathname);
  const direct = pathname === "/" ? "/index.html" : pathname;
  let file = path.join(root, direct);
  try {
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
      file = path.join(file, "index.html");
    }
  } catch {
    // Fall through to normal 404 handling.
  }

  if (!file.startsWith(root)) {
    send(res, 403, "Forbidden");
    return;
  }

  fs.readFile(file, (error, data) => {
    if (!error) {
      res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
      res.end(data);
      return;
    }

    fs.readFile(path.join(root, "index.html"), (fallbackError, fallbackData) => {
      if (fallbackError) {
        send(res, 404, "Not found");
        return;
      }
      res.writeHead(200, { "Content-Type": types[".html"] });
      res.end(fallbackData);
    });
  });
});

server.listen(port, () => {
  console.log(`Lab site running at http://localhost:${port}`);
});
