const path = require("path");
const { readJsonStore, writeJsonStore } = require("./content-store");

const storeDir = path.join(__dirname, ".data");
const localFile = path.join(storeDir, "analytics.json");
const blobPath = process.env.ANALYTICS_BLOB_PATH || "analytics.json";
const maxDailyVisitorKeys = 5000;

function today() {
  return new Date().toISOString().slice(0, 10);
}

function emptyAnalytics() {
  return { tenants: {} };
}

function clientIp(req) {
  return String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "")
    .split(",")[0]
    .trim();
}

function coarseRegion(ip = "") {
  if (!ip) return "unknown";
  if (ip === "::1" || ip.startsWith("127.") || ip.startsWith("10.") || ip.startsWith("192.168.")) return "local/private";
  return "unresolved";
}

function cleanVisitorKey(value = "") {
  return String(value || "")
    .replace(/[^a-zA-Z0-9._:-]/g, "")
    .slice(0, 96);
}

async function readAnalytics() {
  const { data, source } = await readJsonStore(blobPath, localFile, emptyAnalytics());
  return { data: data && typeof data === "object" ? data : emptyAnalytics(), source };
}

async function recordVisit(tenantId, req, input = {}) {
  if (!tenantId) throw new Error("tenant_not_found");
  // This JSON store is a v1 aggregate. High-concurrency production analytics should move to
  // append-only events or a database-backed counter to avoid overwrite races.
  const { data } = await readAnalytics();
  const day = today();
  const tenant = data.tenants[tenantId] || { days: {}, totals: { pv: 0, uv: 0 } };
  const dayStats = tenant.days[day] || { pv: 0, uv: 0, paths: {}, regions: {}, referrers: {}, visitors: [] };
  const ip = clientIp(req);
  const visitorKey = cleanVisitorKey(input.visitorId) || cleanVisitorKey(ip) || "unknown";
  const visitors = Array.isArray(dayStats.visitors) ? dayStats.visitors : [];
  const firstSeen = !visitors.includes(visitorKey);
  dayStats.pv += 1;
  tenant.totals.pv += 1;
  if (firstSeen && visitors.length < maxDailyVisitorKeys) {
    visitors.push(visitorKey);
    dayStats.uv += 1;
    tenant.totals.uv += 1;
  }
  dayStats.visitors = visitors;
  const pagePath = String(input.path || "/").slice(0, 160);
  const region = coarseRegion(ip);
  const referrer = String(input.referrer || "direct").slice(0, 160) || "direct";
  dayStats.paths[pagePath] = (dayStats.paths[pagePath] || 0) + 1;
  dayStats.regions[region] = (dayStats.regions[region] || 0) + 1;
  dayStats.referrers[referrer] = (dayStats.referrers[referrer] || 0) + 1;
  tenant.days[day] = dayStats;
  data.tenants[tenantId] = tenant;
  await writeJsonStore(blobPath, localFile, data);
  return { ok: true };
}

async function analyticsSummary(tenantId) {
  const { data, source } = await readAnalytics();
  const tenant = data.tenants[tenantId] || { days: {}, totals: { pv: 0, uv: 0 }, visitors: {} };
  const days = Object.entries(tenant.days || {})
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 30)
    .map(([date, stats]) => {
      const { visitors, ...publicStats } = stats;
      return { date, ...publicStats };
    });
  return {
    source,
    totals: tenant.totals || { pv: 0, uv: 0 },
    days
  };
}

module.exports = {
  analyticsSummary,
  recordVisit
};
