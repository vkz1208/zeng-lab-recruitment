const { methodNotAllowed, sendJson } = require("../../api-utils");
const { getSessionContext, publicTenant, publicUser } = require("../../tenant-auth");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, "GET");
  const context = await getSessionContext(req);
  sendJson(res, 200, {
    ok: true,
    authenticated: Boolean(context),
    user: publicUser(context?.user),
    tenant: publicTenant(context?.tenant)
  });
};
