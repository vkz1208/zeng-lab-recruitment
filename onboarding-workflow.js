const path = require("path");
const zlib = require("zlib");
const { readJsonStore, writeJsonStore } = require("./content-store");

const storeBlobPath = process.env.ONBOARDING_BLOB_PATH || "tenant-onboarding.json";
const storeFile = path.join(__dirname, ".data", "tenant-onboarding.json");

const blockMap = {
  "home.hero": { label: "Homepage hero", paths: ["zh.home", "en.home"] },
  "home.highlights": { label: "Homepage highlights", paths: ["zh.home.highlights", "en.home.highlights"] },
  "team.pi": { label: "PI profile", paths: ["zh.team.pi", "en.team.pi"] },
  "team.members": { label: "Team members", paths: ["zh.team.sections", "en.team.sections"] },
  "papers.items": { label: "Publications", paths: ["zh.papers.items", "en.papers.items"] },
  "research.directions": { label: "Research directions", paths: ["zh.research.directions", "en.research.directions"] },
  "resources.items": { label: "Projects and resources", paths: ["zh.resources.items", "en.resources.items"] },
  "news.items": { label: "News", paths: ["zh.news.items", "en.news.items"] }
};

function nowIso() {
  return new Date().toISOString();
}

function taskId() {
  return `task_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function decodeXmlEntities(value = "") {
  return String(value)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));
}

function parseZipEntries(buffer) {
  const entries = new Map();
  let offset = 0;
  while (offset + 30 < buffer.length) {
    const signature = buffer.readUInt32LE(offset);
    if (signature !== 0x04034b50) {
      offset += 1;
      continue;
    }
    const method = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const uncompressedSize = buffer.readUInt32LE(offset + 22);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > buffer.length || !compressedSize || !uncompressedSize) break;
    const name = buffer.slice(nameStart, nameStart + nameLength).toString("utf8");
    const compressed = buffer.slice(dataStart, dataEnd);
    let data = Buffer.alloc(0);
    if (method === 0) data = compressed;
    if (method === 8) data = zlib.inflateRawSync(compressed);
    entries.set(name, data);
    offset = dataEnd;
  }
  return entries;
}

function extractDocxTextFromBase64(base64 = "") {
  if (!base64) return "";
  try {
    const entries = parseZipEntries(Buffer.from(base64, "base64"));
    const xmlParts = [
      "word/document.xml",
      "word/footnotes.xml",
      "word/endnotes.xml",
      "word/header1.xml",
      "word/footer1.xml"
    ];
    return xmlParts
      .map((name) => entries.get(name)?.toString("utf8") || "")
      .filter(Boolean)
      .map((xml) => decodeXmlEntities(xml
        .replace(/<\/w:p>/g, "\n")
        .replace(/<\/w:tr>/g, "\n")
        .replace(/<w:tab\/>/g, "\t")
        .replace(/<[^>]+>/g, "")))
      .join("\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  } catch {
    return "";
  }
}

function textLooksBinary(value = "") {
  const text = String(value || "");
  if (!text) return false;
  return /docProps\/|word\/document\.xml|PK\u0003\u0004|�{3,}/.test(text) || (text.match(/\uFFFD/g) || []).length > 8;
}

function extractUploadedText(file = {}) {
  const name = String(file.name || "");
  const rawText = String(file.text || "");
  if (/\.docx$/i.test(name)) {
    const docxText = extractDocxTextFromBase64(file.dataBase64);
    if (docxText) return docxText;
  }
  if (textLooksBinary(rawText)) return "";
  return rawText;
}

function sanitizeFiles(files = []) {
  return files.slice(0, 20).map((file) => ({
    name: String(file.name || "").slice(0, 160),
    type: String(file.type || "").slice(0, 100),
    size: Number(file.size || 0),
    text: extractUploadedText(file).slice(0, 120000)
  }));
}

function summarizeFiles(files = []) {
  return sanitizeFiles(files).map((file) => ({
    name: file.name,
    type: file.type,
    size: file.size,
    text: file.text.replace(/\s+/g, " ").trim().slice(0, 1200)
  }));
}

function extractUrls(files = []) {
  const found = [];
  files.forEach((file) => {
    const text = `${file.name || ""}\n${file.text || ""}`;
    const matches = text.match(/https?:\/\/[^\s<>"')]+/gi) || [];
    matches.forEach((url) => {
      const clean = url.replace(/[.,;]+$/, "");
      if (!found.includes(clean)) found.push(clean);
    });
  });
  return found.slice(0, 6);
}

function htmlToReadableText(html = "") {
  const raw = String(html || "");
  const cleanHtml = raw
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  const title = (cleanHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").trim();
  const description = (
    cleanHtml.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i)?.[1]
    || cleanHtml.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["'][^>]*>/i)?.[1]
    || cleanHtml.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["'][^>]*>/i)?.[1]
    || ""
  ).trim();
  const headingMatches = [...cleanHtml.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)]
    .map((match) => match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 16);
  const blockMatches = [...cleanHtml.matchAll(/<(p|li|td)[^>]*>([\s\S]*?)<\/\1>/gi)]
    .map((match) => match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 25 && line.length < 800 && !/outdated browser|javascript|cookies|copyright/i.test(line))
    .slice(0, 120);
  return [
    title ? `WEBPAGE TITLE: ${title}` : "",
    description ? `WEBPAGE DESCRIPTION: ${description}` : "",
    headingMatches.length ? `WEBPAGE HEADINGS:\n${headingMatches.join("\n")}` : "",
    blockMatches.length ? `WEBPAGE CONTENT:\n${blockMatches.join("\n")}` : ""
  ].filter(Boolean).join("\n\n")
    .replace(/<\/(p|div|section|article|h1|h2|h3|li|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function fetchUrlText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 AcademicSiteOnboardingBot/1.0",
        "Accept": "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.2"
      },
      redirect: "follow",
      signal: controller.signal
    });
    if (!res.ok) return "";
    const contentType = res.headers.get("content-type") || "";
    const text = await res.text();
    const readable = /html/i.test(contentType) ? htmlToReadableText(text) : text;
    return readable.replace(/\s+/g, " ").trim().slice(0, 16000);
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

async function enrichFilesWithWebPages(files = []) {
  const sanitized = sanitizeFiles(files);
  const urls = extractUrls(sanitized);
  if (!urls.length) return sanitized;
  const fetched = await Promise.all(urls.map(async (url) => ({
    name: `webpage-${url.replace(/^https?:\/\//, "").slice(0, 90)}.txt`,
    type: "text/html",
    size: 0,
    text: await fetchUrlText(url),
    sourceUrl: url
  })));
  return [
    ...sanitized,
    ...fetched.filter((file) => file.text && file.text.length > 80)
  ].slice(0, 26);
}

async function readOnboardingStore() {
  const { data } = await readJsonStore(storeBlobPath, storeFile, { sessions: {} });
  return {
    sessions: data && typeof data.sessions === "object" && !Array.isArray(data.sessions) ? data.sessions : {}
  };
}

async function writeOnboardingStore(data) {
  return writeJsonStore(storeBlobPath, storeFile, data);
}

function emptySession(tenantId) {
  return {
    tenantId,
    currentDraft: null,
    pipeline: null,
    versions: [],
    files: [],
    comments: [],
    tasks: [],
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
}

async function getOnboardingSession(tenantId) {
  const store = await readOnboardingStore();
  return store.sessions[tenantId] || emptySession(tenantId);
}

async function updateOnboardingSession(tenantId, updater) {
  const store = await readOnboardingStore();
  const session = store.sessions[tenantId] || emptySession(tenantId);
  const next = await updater(clone(session));
  next.updatedAt = nowIso();
  store.sessions[tenantId] = next;
  await writeOnboardingStore(store);
  return next;
}

function saveDraftVersion(session, draft, reason = "draft", pipeline = null) {
  const version = {
    id: `version_${Date.now()}_${session.versions.length + 1}`,
    reason,
    draft: clone(draft),
    pipeline: clone(pipeline || session.pipeline || null),
    createdAt: nowIso()
  };
  session.currentDraft = clone(draft);
  if (pipeline) session.pipeline = clone(pipeline);
  session.versions = [...(session.versions || []), version].slice(-12);
  return version;
}

function estimateSeconds({ comment = "", files = [] } = {}) {
  const commentCost = Math.min(60, Math.ceil(String(comment).length / 18));
  const fileCost = Math.min(90, (files || []).length * 8);
  return Math.max(18, Math.min(180, 24 + commentCost + fileCost));
}

function makeSteps(status = "queued", message = "") {
  const base = [
    { key: "queued", label: "Queued request", status: "complete" },
    { key: "analyzing", label: "Analyzing your comment and target section", status: "pending" },
    { key: "editing", label: "Updating the preview draft", status: "pending" },
    { key: "validating", label: "Checking website content structure", status: "pending" },
    { key: "complete", label: "Ready for review", status: "pending" }
  ];
  const order = base.map((step) => step.key);
  const index = order.indexOf(status);
  return base.map((step, stepIndex) => ({
    ...step,
    status: stepIndex < index || status === "complete" ? "complete" : step.key === status ? "active" : "pending",
    detail: step.key === status && message ? message : ""
  }));
}

function progressForStatus(status) {
  return {
    queued: 5,
    analyzing: 25,
    editing: 62,
    validating: 84,
    complete: 100,
    failed: 100
  }[status] || 0;
}

function createTask({ type, blockId, comment, estimatedSeconds: seconds }) {
  const status = "queued";
  return {
    id: taskId(),
    type,
    blockId,
    blockLabel: blockMap[blockId]?.label || blockId || "Full website",
    comment: String(comment || "").trim(),
    status,
    estimatedSeconds: seconds,
    progressPercent: progressForStatus(status),
    steps: makeSteps(status),
    resultDraft: null,
    error: "",
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
}

function updateTask(task, status, detail = "") {
  task.status = status;
  task.progressPercent = progressForStatus(status);
  task.steps = makeSteps(status, detail);
  task.updatedAt = nowIso();
  return task;
}

function getBlockPath(blockId) {
  return blockMap[blockId]?.paths || [];
}

function pathGet(obj, dotted) {
  return dotted.split(".").reduce((cursor, key) => cursor?.[key], obj);
}

function appendNoteToString(value, note) {
  const cleanNote = String(note || "").trim();
  if (!cleanNote) return value;
  const current = String(value || "").trim();
  if (current.includes(cleanNote)) return current;
  return current ? `${current}\n\nRevision note: ${cleanNote}` : `Revision note: ${cleanNote}`;
}

function applyLocalCommentToDraft(draft, { blockId, comment }) {
  const next = clone(draft || {});
  const paths = getBlockPath(blockId);
  paths.forEach((pathName) => {
    const target = pathGet(next, pathName);
    if (Array.isArray(target)) {
      if (target[0] && typeof target[0] === "object") {
        target[0].copy = appendNoteToString(target[0].copy || target[0].title, comment);
      }
      return;
    }
    if (target && typeof target === "object") {
      if ("copy" in target || /home$/.test(pathName)) target.copy = appendNoteToString(target.copy, comment);
      else if ("details" in target && Array.isArray(target.details)) target.details = [...target.details, `Revision note: ${comment}`];
      else target.note = appendNoteToString(target.note, comment);
    }
  });
  const historyItem = {
    date: new Date().toISOString().slice(0, 10),
    title: "Preview revised from comment",
    copy: `${blockMap[blockId]?.label || blockId}: ${String(comment || "").slice(0, 180)}`,
    image: "",
    link: "/news"
  };
  ["zh", "en"].forEach((locale) => {
    next[locale] = next[locale] || {};
    next[locale].news = next[locale].news || {};
    next[locale].news.items = Array.isArray(next[locale].news.items) ? next[locale].news.items : [];
    next[locale].news.items = [historyItem, ...next[locale].news.items].slice(0, 12);
  });
  return next;
}

module.exports = {
  applyLocalCommentToDraft,
  blockMap,
  createTask,
  estimateSeconds,
  getBlockPath,
  getOnboardingSession,
  progressForStatus,
  enrichFilesWithWebPages,
  sanitizeFiles,
  saveDraftVersion,
  summarizeFiles,
  updateOnboardingSession,
  updateTask
};
