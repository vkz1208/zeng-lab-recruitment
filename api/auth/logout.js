const { methodNotAllowed, sendJson } = require("../../api-utils");
const { clearSessionCookie } = require("../../tenant-auth");

module.exports = async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) return methodNotAllowed(res, "GET, POST");
  sendJson(res, 200, { ok: true }, { "Set-Cookie": clearSessionCookie() });
};
