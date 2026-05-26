const fs = require("fs");
const path = require("path");
const { copyDirs, vercelFiles } = require("./static-manifest");

const root = __dirname;
const outDir = path.join(root, "dist");
const files = vercelFiles();

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
copyDirs.forEach(copyDir);

console.log(`Static Vercel output written to ${outDir}`);
