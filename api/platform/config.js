const { sendJson } = require("../../api-utils");
const { publicPlatformConfig } = require("../../platform-config");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    sendJson(res, 405, { ok: false, error: "method_not_allowed" });
    return;
  }
  sendJson(res, 200, { ok: true, ...publicPlatformConfig() });
};
