const fs = require("fs");
const path = require("path");

const root = __dirname;
const outDir = path.join(root, "dist");
const files = [
  "index.html",
  "styles.css",
  "script.js",
  "site-data.js",
  "papers-data.js",
  "content.json",
  "content-schema.js",
  "content-store.js",
  "package.json",
  "package-lock.json",
  "api/content.js",
  "admin/index.html",
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
copyDir("node_modules");

console.log(`Static Vercel output written to ${outDir}`);
