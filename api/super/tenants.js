const { errorStatus, methodNotAllowed, readJson, sendJson } = require("../../api-utils");
const { listTenants, updateTenant } = require("../../tenant-auth");

module.exports = async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) return methodNotAllowed(res, "GET, POST");
  try {
    if (req.method === "GET") {
      sendJson(res, 200, { ok: true, tenants: await listTenants(req) });
      return;
    }
    sendJson(res, 200, { ok: true, tenant: await updateTenant(req, await readJson(req)) });
  } catch (error) {
    sendJson(res, errorStatus(error), { ok: false, error: error.message || "bad_request" });
  }
};
