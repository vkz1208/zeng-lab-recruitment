const { errorStatus, methodNotAllowed, readJson, sendJson } = require("../../api-utils");
const { aiStatus, generateImage, generateText } = require("../../ai-provider");
const { requireTenantAdmin } = require("../../tenant-auth");

module.exports = async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) return methodNotAllowed(res, "GET, POST");
  try {
    await requireTenantAdmin(req);
    if (req.method === "GET") {
      sendJson(res, 200, { ok: true, ai: aiStatus() });
      return;
    }

    const input = await readJson(req);
    if (input.action === "image") {
      const image = await generateImage({
        prompt: input.prompt,
        size: input.size || "1024x1024",
        quality: input.quality || "medium"
      });
      sendJson(res, 200, { ok: true, image });
      return;
    }

    if (input.action === "text") {
      const text = await generateText({
        system: String(input.system || "You help academic labs write concise website copy."),
        prompt: String(input.prompt || ""),
        maxOutputTokens: Math.min(Number(input.maxOutputTokens || 3000), 12000)
      });
      sendJson(res, 200, { ok: true, text });
      return;
    }

    throw new Error("invalid_action");
  } catch (error) {
    sendJson(res, errorStatus(error), { ok: false, error: error.message || "bad_request" });
  }
};
