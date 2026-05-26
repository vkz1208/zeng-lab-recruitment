const { validateContentData } = require("../../content-schema");
const { readTenantContentData, writeTenantContentData } = require("../../content-store");
const { errorStatus, methodNotAllowed, readJson, sendJson } = require("../../api-utils");
const { publicTenantForVisitor, requireTenantAdmin, resolveTenantByHost } = require("../../tenant-auth");

module.exports = async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) return methodNotAllowed(res, "GET, POST");
  try {
    let tenant = await resolveTenantByHost(req.headers.host || "");
    const publicHostTenant = Boolean(tenant);
    if (!tenant) {
      const context = await requireTenantAdmin(req);
      tenant = context.tenant;
    }
    if (!tenant) throw new Error("tenant_not_found");

    if (req.method === "GET") {
      const { data, source } = await readTenantContentData(tenant.id);
      sendJson(res, 200, { ok: true, source, tenant: publicHostTenant ? publicTenantForVisitor(tenant) : tenant, data });
      return;
    }

    const context = await requireTenantAdmin(req);
    if (context.user.role !== "super_admin" && context.user.tenantId !== tenant.id) throw new Error("unauthorized");
    const data = await readJson(req);
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("invalid_content");
    const validation = validateContentData(data);
    if (!validation.valid) {
      sendJson(res, 400, { ok: false, error: "invalid_schema", details: validation.errors });
      return;
    }
    const result = await writeTenantContentData(tenant.id, data);
    sendJson(res, 200, { ok: true, source: result.source, tenant });
  } catch (error) {
    sendJson(res, errorStatus(error), { ok: false, error: error.message || "bad_request" });
  }
};
