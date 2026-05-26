const { errorStatus, methodNotAllowed, readJson, requestOrigin, sendJson } = require("../../api-utils");
const { registerTenant } = require("../../tenant-auth");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, "POST");
  try {
    const input = await readJson(req);
    const result = await registerTenant({ ...input, origin: requestOrigin(req) });
    sendJson(res, 200, { ok: true, ...result });
  } catch (error) {
    sendJson(res, errorStatus(error), { ok: false, error: error.message || "bad_request" });
  }
};
