const path = require("path");
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

function sanitizeFiles(files = []) {
  return files.slice(0, 20).map((file) => ({
    name: String(file.name || "").slice(0, 160),
    type: String(file.type || "").slice(0, 100),
    size: Number(file.size || 0),
    text: String(file.text || "").slice(0, 120000)
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

function saveDraftVersion(session, draft, reason = "draft") {
  const version = {
    id: `version_${Date.now()}_${session.versions.length + 1}`,
    reason,
    draft: clone(draft),
    createdAt: nowIso()
  };
  session.currentDraft = clone(draft);
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
  sanitizeFiles,
  saveDraftVersion,
  summarizeFiles,
  updateOnboardingSession,
  updateTask
};
