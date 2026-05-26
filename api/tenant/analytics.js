const { analyticsSummary, recordVisit } = require("../../analytics-store");
const { errorStatus, methodNotAllowed, readJson, sendJson } = require("../../api-utils");
const { getSessionContext, resolveTenantByHost } = require("../../tenant-auth");

module.exports = async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) return methodNotAllowed(res, "GET, POST");
  try {
    if (req.method === "POST") {
      const tenant = await resolveTenantByHost(req.headers.host || "");
      if (!tenant) {
        sendJson(res, 202, { ok: true, skipped: "tenant_not_resolved" });
        return;
      }
      await recordVisit(tenant.id, req, await readJson(req));
      sendJson(res, 200, { ok: true });
      return;
    }
    const context = await getSessionContext(req);
    if (!context?.user?.emailVerified || !context.tenant) throw new Error("unauthorized");
    const summary = await analyticsSummary(context.tenant.id);
    sendJson(res, 200, { ok: true, ...summary });
  } catch (error) {
    sendJson(res, errorStatus(error), { ok: false, error: error.message || "bad_request" });
  }
};
