const { errorStatus, methodNotAllowed, readJson, sendJson } = require("../../api-utils");
const { getSessionContext, publicTenant, updateTenantSettings } = require("../../tenant-auth");

module.exports = async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) return methodNotAllowed(res, "GET, POST");
  try {
    if (req.method === "GET") {
      const context = await getSessionContext(req);
      if (!context?.user?.emailVerified) throw new Error("unauthorized");
      sendJson(res, 200, { ok: true, tenant: publicTenant(context.tenant) });
      return;
    }
    const tenant = await updateTenantSettings(req, await readJson(req));
    sendJson(res, 200, { ok: true, tenant });
  } catch (error) {
    sendJson(res, errorStatus(error), { ok: false, error: error.message || "bad_request" });
  }
};
