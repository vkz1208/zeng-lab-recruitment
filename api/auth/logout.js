const { methodNotAllowed, sendJson } = require("../../api-utils");
const { clearSessionCookie } = require("../../tenant-auth");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, "POST");
  sendJson(res, 200, { ok: true }, { "Set-Cookie": clearSessionCookie() });
};
