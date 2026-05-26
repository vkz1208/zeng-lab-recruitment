const fs = require("fs");
const path = require("path");

const contentBlobPath = process.env.CONTENT_BLOB_PATH || "content.json";
const localContentFile = path.join(__dirname, "content.json");
const localDataDir = path.join(__dirname, ".data");
const maxBackups = 5;

function hasBlobToken() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_OIDC_TOKEN);
}

function rotateBackups(file = localContentFile) {
  for (let index = maxBackups - 1; index >= 1; index -= 1) {
    const from = `${file}.bak.${index}`;
    const to = `${file}.bak.${index + 1}`;
    if (fs.existsSync(from)) fs.renameSync(from, to);
  }
  if (fs.existsSync(file)) fs.copyFileSync(file, `${file}.bak.1`);
}

function atomicWriteJson(file, data) {
  const tempFile = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tempFile, file);
}

async function streamToString(stream) {
  if (!stream) return "";
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

async function readBlobJson(blobPath) {
  if (!hasBlobToken()) return null;
  const { get } = require("@vercel/blob");
  const result = await get(blobPath, { access: "private", useCache: false });
  if (!result?.stream) return {};
  const text = await streamToString(result.stream);
  return text ? JSON.parse(text) : {};
}

async function writeBlobJson(blobPath, data) {
  if (!hasBlobToken()) return false;
  const { put } = require("@vercel/blob");
  await put(blobPath, JSON.stringify(data, null, 2), {
    access: "private",
    allowOverwrite: true,
    contentType: "application/json; charset=utf-8",
    cacheControlMaxAge: 60
  });
  return true;
}

async function readJsonStore(blobPath, localFile, fallback = {}) {
  try {
    const blobData = await readBlobJson(blobPath);
    if (blobData != null) return { data: blobData, source: "blob" };
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.warn(`Blob read failed for ${blobPath}:`, error.message);
  }

  try {
    if (!fs.existsSync(localFile)) return { data: fallback, source: "file" };
    const text = fs.readFileSync(localFile, "utf8");
    return { data: text ? JSON.parse(text) : fallback, source: "file" };
  } catch {
    return { data: fallback, source: "file" };
  }
}

async function writeJsonStore(blobPath, localFile, data) {
  if (await writeBlobJson(blobPath, data)) return { source: "blob" };
  fs.mkdirSync(path.dirname(localFile), { recursive: true });
  rotateBackups(localFile);
  atomicWriteJson(localFile, data);
  return { source: "file" };
}

async function readContentData() {
  return readJsonStore(contentBlobPath, localContentFile, {});
}

async function writeContentData(data) {
  return writeJsonStore(contentBlobPath, localContentFile, data);
}

function tenantContentBlobPath(tenantId) {
  return `tenant-content/${tenantId}.json`;
}

function tenantContentFile(tenantId) {
  return path.join(localDataDir, "tenant-content", `${tenantId}.json`);
}

async function readTenantContentData(tenantId) {
  return readJsonStore(tenantContentBlobPath(tenantId), tenantContentFile(tenantId), {});
}

async function writeTenantContentData(tenantId, data) {
  return writeJsonStore(tenantContentBlobPath(tenantId), tenantContentFile(tenantId), data);
}

module.exports = {
  readContentData,
  writeContentData,
  readJsonStore,
  writeJsonStore,
  readTenantContentData,
  writeTenantContentData
};
