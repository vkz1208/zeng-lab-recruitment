const { errorStatus, methodNotAllowed, sendJson } = require("../../api-utils");
const { getOnboardingSession } = require("../../onboarding-workflow");
const { requireTenantAdmin } = require("../../tenant-auth");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, "GET");
  try {
    const context = await requireTenantAdmin(req);
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const id = url.searchParams.get("id") || "";
    if (!id) throw new Error("missing_task_id");
    const session = await getOnboardingSession(context.tenant.id);
    const task = (session.tasks || []).find((item) => item.id === id);
    if (!task) throw new Error("not_found");
    sendJson(res, 200, { ok: true, task, session });
  } catch (error) {
    sendJson(res, errorStatus(error), { ok: false, error: error.message || "bad_request" });
  }
};
