const fs = require("fs");
const path = require("path");

const root = __dirname;
const outDir = path.join(root, "dist");
const files = [
  "index.html",
  "styles.css",
  "admin.css",
  "api-client.js",
  "admin-ui.js",
  "script.js",
  "site-data.js",
  "papers-data.js",
  "content.json",
  "api-utils.js",
  "content-schema.js",
  "content-store.js",
  "analytics-store.js",
  "review-store.js",
  "academic-site-generator.js",
  "ai-provider.js",
  "platform-config.js",
  "tenant-auth.js",
  "tenant-model.js",
  "tenant-store.js",
  "admin/index.html",
  "super-admin/index.html",
  "contact/index.html",
  "join/index.html",
  "news/index.html",
  "papers/index.html",
  "research/index.html",
  "resources/index.html",
  "team/index.html"
];

function copyFile(relativePath) {
  const from = path.join(root, relativePath);
  const to = path.join(outDir, relativePath);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

function copyDir(relativePath) {
  const fromDir = path.join(root, relativePath);
  const toDir = path.join(outDir, relativePath);
  fs.cpSync(fromDir, toDir, { recursive: true });
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
files.forEach(copyFile);
copyDir("assets");
copyDir("data");

console.log(`Static Vercel output written to ${outDir}`);
