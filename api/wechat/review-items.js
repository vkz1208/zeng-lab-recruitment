const { errorStatus, methodNotAllowed, readJson, sendJson } = require("../../api-utils");
const { createReviewItem, listReviewItems, updateReviewItem } = require("../../review-store");
const { getSessionContext } = require("../../tenant-auth");

// V1 compatibility: the mini-program endpoint reuses the tenant session cookie.
// A real WeChat openid/session binding layer should sit here before production mini-program rollout.
module.exports = async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) return methodNotAllowed(res, "GET, POST");
  try {
    const context = await getSessionContext(req);
    if (!context?.user?.emailVerified || !context.tenant) throw new Error("unauthorized");
    if (req.method === "GET") {
      sendJson(res, 200, { ok: true, ...(await listReviewItems(context.tenant.id)) });
      return;
    }
    const input = await readJson(req);
    const item = input.action === "create"
      ? await createReviewItem(context.tenant.id, input)
      : await updateReviewItem(context.tenant.id, input, context.user.email);
    sendJson(res, 200, { ok: true, item });
  } catch (error) {
    sendJson(res, errorStatus(error), { ok: false, error: error.message || "bad_request" });
  }
};
