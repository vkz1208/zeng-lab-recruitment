const crypto = require("crypto");
const path = require("path");
const { readJsonStore, writeJsonStore } = require("./content-store");

const storeDir = path.join(__dirname, ".data");
const localFile = path.join(storeDir, "review-queue.json");
const blobPath = process.env.REVIEW_QUEUE_BLOB_PATH || "review-queue.json";

function nowIso() {
  return new Date().toISOString();
}

function randomId() {
  return `review_${crypto.randomBytes(10).toString("hex")}`;
}

function emptyQueue() {
  return { items: [] };
}

async function readQueue() {
  const { data, source } = await readJsonStore(blobPath, localFile, emptyQueue());
  return { data: data && Array.isArray(data.items) ? data : emptyQueue(), source };
}

async function listReviewItems(tenantId) {
  const { data, source } = await readQueue();
  return {
    source,
    items: data.items.filter((item) => item.tenantId === tenantId).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
  };
}

async function createReviewItem(tenantId, input = {}) {
  const { data } = await readQueue();
  const item = {
    id: randomId(),
    tenantId,
    source: String(input.source || "manual").slice(0, 120),
    sourceUrl: String(input.sourceUrl || "").slice(0, 500),
    title: String(input.title || "Untitled candidate").slice(0, 240),
    summary: String(input.summary || "").slice(0, 2000),
    aiSuggestion: String(input.aiSuggestion || "").slice(0, 4000),
    target: String(input.target || "news").slice(0, 80),
    status: "pending",
    reviewer: "",
    reviewerNote: "",
    publishedAt: null,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  data.items.push(item);
  await writeJsonStore(blobPath, localFile, data);
  return item;
}

async function updateReviewItem(tenantId, input = {}, reviewer = "") {
  const { data } = await readQueue();
  const item = data.items.find((candidate) => candidate.id === input.id && candidate.tenantId === tenantId);
  if (!item) throw new Error("not_found");
  const status = String(input.status || item.status);
  if (!["pending", "approved", "rejected", "needs_revision", "published"].includes(status)) throw new Error("invalid_status");
  item.status = status;
  item.reviewer = reviewer || item.reviewer;
  item.reviewerNote = String(input.reviewerNote || item.reviewerNote || "").slice(0, 2000);
  item.updatedAt = nowIso();
  if (status === "published") item.publishedAt = item.publishedAt || nowIso();
  await writeJsonStore(blobPath, localFile, data);
  return item;
}

module.exports = {
  createReviewItem,
  listReviewItems,
  updateReviewItem
};
