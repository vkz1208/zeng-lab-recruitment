const fs = require("fs");
const path = require("path");

const contentBlobPath = process.env.CONTENT_BLOB_PATH || "content/content.json";
const localContentFile = path.join(__dirname, "content.json");
const maxBackups = 5;

function hasBlobToken() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
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

async function readBlobContent() {
  if (!hasBlobToken()) return null;
  const { get } = require("@vercel/blob");
  const result = await get(contentBlobPath, { access: "private", useCache: false });
  if (!result?.stream) return {};
  const text = await streamToString(result.stream);
  return text ? JSON.parse(text) : {};
}

async function writeBlobContent(data) {
  if (!hasBlobToken()) return false;
  const { put } = require("@vercel/blob");
  await put(contentBlobPath, JSON.stringify(data, null, 2), {
    access: "private",
    allowOverwrite: true,
    contentType: "application/json; charset=utf-8",
    cacheControlMaxAge: 60
  });
  return true;
}

async function readContentData() {
  try {
    const blobData = await readBlobContent();
    if (blobData != null) return { data: blobData, source: "blob" };
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.warn("Blob read failed:", error.message);
  }

  try {
    if (!fs.existsSync(localContentFile)) return { data: {}, source: "file" };
    const text = fs.readFileSync(localContentFile, "utf8");
    return { data: text ? JSON.parse(text) : {}, source: "file" };
  } catch {
    return { data: {}, source: "file" };
  }
}

async function writeContentData(data) {
  if (await writeBlobContent(data)) return { source: "blob" };
  rotateBackups();
  atomicWriteJson(localContentFile, data);
  return { source: "file" };
}

module.exports = {
  readContentData,
  writeContentData
};
