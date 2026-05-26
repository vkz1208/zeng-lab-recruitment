const { validateContentData } = require("../../content-schema");
const { writeTenantContentData } = require("../../content-store");
const { errorStatus, methodNotAllowed, readJson, sendJson } = require("../../api-utils");
const { generateAcademicSiteDraft } = require("../../academic-site-generator");
const { generateAcademicSiteDraftWithAi } = require("../../ai-provider");
const { markTenantInitialized, requireTenantAdmin } = require("../../tenant-auth");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, "POST");
  try {
    const input = await readJson(req);
    const context = await requireTenantAdmin(req);
    if (input.action === "draft") {
      const files = Array.isArray(input.files) ? input.files.slice(0, 20) : [];
      const fallbackDraft = generateAcademicSiteDraft({ tenant: context.tenant, files });
      const result = await generateAcademicSiteDraftWithAi({ tenant: context.tenant, files, fallbackDraft });
      sendJson(res, 200, { ok: true, draft: result.draft, mode: result.mode, warning: result.warning, tenant: context.tenant });
      return;
    }
    if (input.action === "confirm") {
      const data = input.data;
      if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("invalid_content");
      const validation = validateContentData(data);
      if (!validation.valid) {
        sendJson(res, 400, { ok: false, error: "invalid_schema", details: validation.errors });
        return;
      }
      const saved = await writeTenantContentData(context.tenant.id, data);
      const tenant = await markTenantInitialized(req);
      sendJson(res, 200, { ok: true, source: saved.source, tenant });
      return;
    }
    throw new Error("invalid_action");
  } catch (error) {
    sendJson(res, errorStatus(error), { ok: false, error: error.message || "bad_request" });
  }
};
