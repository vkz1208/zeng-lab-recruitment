const { errorStatus, methodNotAllowed, readJson, sendJson } = require("../../api-utils");
const { login, sessionCookie } = require("../../tenant-auth");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, "POST");
  try {
    const result = await login(await readJson(req));
    sendJson(res, 200, { ok: true, ...result }, { "Set-Cookie": sessionCookie({ userId: result.user.id, tenantId: result.user.tenantId, role: result.user.role }) });
  } catch (error) {
    sendJson(res, errorStatus(error), { ok: false, error: error.message || "bad_request" });
  }
};
