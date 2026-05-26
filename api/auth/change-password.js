const { errorStatus, methodNotAllowed, readJson, sendJson } = require("../../api-utils");
const { changePassword, getRequestSession } = require("../../tenant-auth");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, "POST");
  try {
    const result = await changePassword(getRequestSession(req), await readJson(req));
    sendJson(res, 200, { ok: true, ...result });
  } catch (error) {
    sendJson(res, errorStatus(error), { ok: false, error: error.message || "bad_request" });
  }
};
