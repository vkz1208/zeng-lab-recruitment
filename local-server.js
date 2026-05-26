const http = require("http");
const fs = require("fs");
const path = require("path");
const { pageDirs: pageDirList, publicRootFiles: publicRootFileList } = require("./static-manifest");
const { validateContentData } = require("./content-schema");
const { readContentData, writeContentData } = require("./content-store");
const authRegister = require("./api/auth/register");
const authVerifyEmail = require("./api/auth/verify-email");
const authLogin = require("./api/auth/login");
const authLogout = require("./api/auth/logout");
const authMe = require("./api/auth/me");
const authChangePassword = require("./api/auth/change-password");
const tenantContent = require("./api/tenant/content");
const tenantOnboarding = require("./api/tenant/onboarding");
const tenantOnboardingTask = require("./api/tenant/onboarding-task");
const tenantSettings = require("./api/tenant/settings");
const tenantAnalytics = require("./api/tenant/analytics");
const tenantReviewQueue = require("./api/tenant/review-queue");
const platformConfig = require("./api/platform/config");
const superTenants = require("./api/super/tenants");

const root = __dirname;
const port = process.env.PORT || 3000;
const adminToken = process.env.ADMIN_TOKEN || "";
const maxBodyBytes = 2 * 1024 * 1024;
const pageDirs = new Set(pageDirList);
const publicRootFiles = new Set(publicRootFileList);

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".gif": "image/gif",
  ".ico": "image/x-icon"
};

function send(res, status, body, type = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": type,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin"
  });
  res.end(body);
}

function hasFileExtension(pathname) {
  return Boolean(path.extname(pathname));
}

function isPublicPath(relative) {
  const normalized = relative.replaceAll("\\", "/");
  const parts = normalized.split("/").filter(Boolean);
  if (!parts.length || parts.some((part) => part.startsWith("."))) return false;
  if (parts.length === 1) return publicRootFiles.has(parts[0]);
  if (parts[0] === "assets") return parts.length > 1;
  if (parts[0] === "data") return parts.length === 2 && path.extname(parts[1]) === ".json";
  if (pageDirs.has(parts[0])) return parts.length === 2 && parts[1] === "index.html";
  return false;
}

function shouldFallbackToAppShell(pathname) {
  if (hasFileExtension(pathname)) return false;
  if (pathname.startsWith("/api/")) return false;
  const parts = pathname.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
  if (parts.some((part) => part.startsWith(".") || part === "..")) return false;
  return true;
}

const apiRoutes = new Map([
  ["/api/auth/register", authRegister],
  ["/api/auth/verify-email", authVerifyEmail],
  ["/api/auth/login", authLogin],
  ["/api/auth/logout", authLogout],
  ["/api/auth/me", authMe],
  ["/api/auth/change-password", authChangePassword],
  ["/api/tenant/content", tenantContent],
  ["/api/tenant/onboarding", tenantOnboarding],
  ["/api/tenant/onboarding-task", tenantOnboardingTask],
  ["/api/tenant/settings", tenantSettings],
  ["/api/tenant/analytics", tenantAnalytics],
  ["/api/tenant/review-queue", tenantReviewQueue],
  ["/api/wechat/review-items", tenantReviewQueue],
  ["/api/platform/config", platformConfig],
  ["/api/super/tenants", superTenants]
]);

const server = http.createServer((req, res) => {
  let url;
  try {
    url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  } catch {
    send(res, 400, "Bad request");
    return;
  }

  if (apiRoutes.has(url.pathname)) {
    apiRoutes.get(url.pathname)(req, res);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/content") {
    readContentData()
      .then(({ data, source }) => {
        send(res, 200, JSON.stringify({ ok: true, source, data }), "application/json; charset=utf-8");
      })
      .catch(() => {
        send(res, 500, JSON.stringify({ ok: false, error: "read_failed" }), "application/json; charset=utf-8");
      });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/content") {
    if (!adminToken || req.headers["x-admin-token"] !== adminToken) {
      send(res, 401, JSON.stringify({ ok: false, error: "unauthorized" }), "application/json; charset=utf-8");
      return;
    }

    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > maxBodyBytes) {
        send(res, 413, JSON.stringify({ ok: false, error: "payload_too_large" }), "application/json; charset=utf-8");
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        const data = JSON.parse(body || "{}");
        if (!data || typeof data !== "object" || Array.isArray(data)) {
          send(res, 400, JSON.stringify({ ok: false, error: "invalid_content" }), "application/json; charset=utf-8");
          return;
        }
        const validation = validateContentData(data);
        if (!validation.valid) {
          send(res, 400, JSON.stringify({ ok: false, error: "invalid_schema", details: validation.errors }), "application/json; charset=utf-8");
          return;
        }
        writeContentData(data)
          .then(({ source }) => {
            send(res, 200, JSON.stringify({ ok: true, source }), "application/json; charset=utf-8");
          })
          .catch(() => {
            send(res, 500, JSON.stringify({ ok: false, error: "write_failed" }), "application/json; charset=utf-8");
          });
      } catch {
        send(res, 400, JSON.stringify({ ok: false }), "application/json; charset=utf-8");
      }
    });
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    send(res, 400, "Bad request");
    return;
  }
  const direct = pathname === "/" ? "/index.html" : pathname;
  let file = path.resolve(root, `.${direct}`);
  const relative = path.relative(root, file);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    send(res, 403, "Forbidden");
    return;
  }

  try {
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
      file = path.join(file, "index.html");
    }
  } catch {
    // Fall through to normal 404 handling.
  }

  const finalRelative = path.relative(root, file);
  if (finalRelative.startsWith("..") || path.isAbsolute(finalRelative)) {
    send(res, 404, "Not found");
    return;
  }
  if (!isPublicPath(finalRelative)) {
    if (!shouldFallbackToAppShell(pathname)) {
      send(res, 404, "Not found");
      return;
    }
    file = path.join(root, "index.html");
  }

  fs.readFile(file, (error, data) => {
    if (!error) {
      res.writeHead(200, {
        "Content-Type": types[path.extname(file)] || "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Cache-Control": path.extname(file) === ".html" ? "no-cache" : "public, max-age=3600"
      });
      res.end(data);
      return;
    }

    if (!shouldFallbackToAppShell(pathname)) {
      send(res, 404, "Not found");
      return;
    }

    fs.readFile(path.join(root, "index.html"), (fallbackError, fallbackData) => {
      if (fallbackError) {
        send(res, 404, "Not found");
        return;
      }
      res.writeHead(200, {
        "Content-Type": types[".html"],
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Cache-Control": "no-cache"
      });
      res.end(fallbackData);
    });
  });
});

server.listen(port, () => {
  console.log(`Lab site running at http://localhost:${port}`);
});
