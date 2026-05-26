const { defaultFeatureSet, planById } = require("./platform-config");

const freemailDomains = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "qq.com",
  "163.com", "126.com", "foxmail.com", "icloud.com", "yahoo.com", "proton.me", "protonmail.com"
]);

function normalizeEmail(email = "") {
  return String(email).trim().toLowerCase();
}

function emailDomain(email = "") {
  return normalizeEmail(email).split("@")[1] || "";
}

function slugify(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function normalizeHost(host = "") {
  return String(host).split(":")[0].trim().toLowerCase();
}

function normalizeDomains(domains = []) {
  return [...new Set((Array.isArray(domains) ? domains : [])
    .map(normalizeHost)
    .filter(Boolean))];
}

function normalizeTenantStatus(status = "active") {
  return ["active", "disabled", "frozen"].includes(status) ? status : "active";
}

function normalizeFeatureSet(features = {}) {
  return {
    ...defaultFeatureSet,
    ...(features && typeof features === "object" && !Array.isArray(features) ? features : {})
  };
}

function featuresForPlan(planId = "starter") {
  return normalizeFeatureSet(planById(planId)?.features || defaultFeatureSet);
}

function defaultTenantFields(slug = "") {
  return {
    status: "active",
    planId: "starter",
    features: featuresForPlan("starter"),
    domains: [],
    subdomain: slugify(slug),
    stylePluginId: "sustech-lab",
    aiProviderConfigRef: "platform-default"
  };
}

function hydrateTenant(tenant = {}) {
  if (!tenant) return null;
  const defaults = defaultTenantFields(tenant.slug || tenant.subdomain || "");
  return {
    ...tenant,
    status: normalizeTenantStatus(tenant.status || defaults.status),
    planId: tenant.planId || defaults.planId,
    features: normalizeFeatureSet(tenant.features),
    domains: normalizeDomains(tenant.domains),
    subdomain: slugify(tenant.subdomain || tenant.slug || defaults.subdomain),
    stylePluginId: tenant.stylePluginId || defaults.stylePluginId,
    aiProviderConfigRef: tenant.aiProviderConfigRef || defaults.aiProviderConfigRef
  };
}

function analyzeEmailDomain(email) {
  const domain = emailDomain(email);
  const parts = domain.split(".").filter(Boolean);
  const flags = [];
  if (!domain) flags.push("invalid");
  if (freemailDomains.has(domain)) flags.push("freemail");
  if (parts.some((part) => ["edu", "ac"].includes(part))) flags.push("academic");
  if (parts.includes("org")) flags.push("organization");
  if (!flags.length) flags.push("custom-domain");
  return { domain, flags };
}

function publicTenant(tenant) {
  if (!tenant) return null;
  const hydrated = hydrateTenant(tenant);
  return {
    id: hydrated.id,
    name: hydrated.name,
    slug: hydrated.slug,
    status: hydrated.status,
    planId: hydrated.planId,
    features: hydrated.features,
    domains: hydrated.domains,
    subdomain: hydrated.subdomain,
    stylePluginId: hydrated.stylePluginId,
    aiProviderConfigRef: hydrated.aiProviderConfigRef,
    initializedAt: hydrated.initializedAt || null,
    onboardingStatus: hydrated.initializedAt ? "complete" : "pending",
    createdAt: hydrated.createdAt,
    updatedAt: hydrated.updatedAt,
    emailDomain: hydrated.emailDomain,
    domainFlags: hydrated.domainFlags || []
  };
}

function publicTenantForVisitor(tenant) {
  if (!tenant) return null;
  const hydrated = hydrateTenant(tenant);
  return {
    id: hydrated.id,
    name: hydrated.name,
    slug: hydrated.slug,
    status: hydrated.status,
    domains: hydrated.domains,
    subdomain: hydrated.subdomain,
    initializedAt: hydrated.initializedAt || null,
    onboardingStatus: hydrated.initializedAt ? "complete" : "pending",
    createdAt: hydrated.createdAt
  };
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    tenantId: user.tenantId,
    emailVerified: Boolean(user.emailVerified)
  };
}

module.exports = {
  analyzeEmailDomain,
  defaultTenantFields,
  emailDomain,
  featuresForPlan,
  hydrateTenant,
  normalizeDomains,
  normalizeEmail,
  normalizeFeatureSet,
  normalizeHost,
  normalizeTenantStatus,
  publicTenant,
  publicTenantForVisitor,
  publicUser,
  slugify
};
