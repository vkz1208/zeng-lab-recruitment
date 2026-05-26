const crypto = require("crypto");
const { enabledPlanIds, enabledStylePluginIds, planById } = require("./platform-config");
const {
  analyzeEmailDomain,
  defaultTenantFields,
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
} = require("./tenant-model");
const { loadTenantData, writeStore } = require("./tenant-store");

const SESSION_COOKIE = "zeng_session";
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;

function nowIso() {
  return new Date().toISOString();
}

function randomId(prefix) {
  return `${prefix}_${crypto.randomBytes(12).toString("hex")}`;
}

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function timingSafeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString("hex");
    crypto.scrypt(String(password), salt, 64, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(`scrypt:${salt}:${derivedKey.toString("hex")}`);
    });
  });
}

function verifyPassword(password, stored) {
  return new Promise((resolve) => {
    const [algorithm, salt, key] = String(stored || "").split(":");
    if (algorithm !== "scrypt" || !salt || !key) {
      resolve(false);
      return;
    }
    crypto.scrypt(String(password), salt, 64, (error, derivedKey) => {
      if (error) {
        resolve(false);
        return;
      }
      resolve(timingSafeEqual(derivedKey.toString("hex"), key));
    });
  });
}

function sessionSecret() {
  const secret = process.env.SESSION_SECRET || process.env.ADMIN_TOKEN || "";
  if (!secret && process.env.NODE_ENV === "production") throw new Error("missing_session_secret");
  return secret || "dev-session-secret-change-me";
}

function signSession(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", sessionSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function parseSessionToken(token) {
  const [body, sig] = String(token || "").split(".");
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", sessionSecret()).update(body).digest("base64url");
  if (!timingSafeEqual(sig, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function parseCookies(header = "") {
  return Object.fromEntries(String(header).split(";").map((part) => {
    const index = part.indexOf("=");
    if (index < 0) return ["", ""];
    return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
  }).filter(([key]) => key));
}

function getRequestSession(req) {
  return parseSessionToken(parseCookies(req.headers.cookie || "")[SESSION_COOKIE]);
}

function sessionCookie(payload) {
  const token = signSession({ ...payload, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS });
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${SESSION_TTL_SECONDS}; HttpOnly; SameSite=Lax${secure}`;
}

function clearSessionCookie() {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure}`;
}

async function registerTenant({ email, password, tenantName, slug, origin }) {
  const normalizedEmail = normalizeEmail(email);
  const cleanSlug = slugify(slug || tenantName);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizedEmail)) throw new Error("invalid_email");
  if (String(password || "").length < 8) throw new Error("weak_password");
  if (!tenantName || String(tenantName).trim().length < 2) throw new Error("invalid_tenant_name");
  if (!cleanSlug || cleanSlug.length < 3) throw new Error("invalid_slug");

  const { tenants, users, tokens } = await loadTenantData();
  if (users.some((user) => user.email === normalizedEmail)) throw new Error("email_taken");
  if (tenants.some((tenant) => tenant.slug === cleanSlug)) throw new Error("slug_taken");

  const domainInfo = analyzeEmailDomain(normalizedEmail);
  const tenant = {
    ...defaultTenantFields(cleanSlug),
    id: randomId("tenant"),
    name: String(tenantName).trim(),
    slug: cleanSlug,
    initializedAt: null,
    emailDomain: domainInfo.domain,
    domainFlags: domainInfo.flags,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  const user = {
    id: randomId("user"),
    tenantId: tenant.id,
    email: normalizedEmail,
    passwordHash: await hashPassword(password),
    role: "tenant_admin",
    emailVerified: false,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  const rawToken = crypto.randomBytes(24).toString("base64url");
  tokens.push({
    id: randomId("verify"),
    userId: user.id,
    tokenHash: hashToken(rawToken),
    expiresAt: new Date(Date.now() + VERIFY_TTL_MS).toISOString(),
    usedAt: null,
    createdAt: nowIso()
  });
  tenants.push(tenant);
  users.push(user);
  await writeStore("tenants", { tenants });
  await writeStore("users", { users });
  await writeStore("verifications", { tokens });
  const verifyUrl = `${origin || ""}/admin/?verify=${encodeURIComponent(rawToken)}&email=${encodeURIComponent(normalizedEmail)}`;
  await sendVerificationEmail(normalizedEmail, verifyUrl);
  return { tenant: publicTenant(tenant), user: publicUser(user), verifyUrl };
}

async function sendVerificationEmail(email, verifyUrl) {
  if (!process.env.EMAIL_PROVIDER) {
    console.log(`[email-verification] ${email}: ${verifyUrl}`);
    return { ok: true, provider: "console" };
  }
  console.log(`[email-verification:${process.env.EMAIL_PROVIDER}] ${email}: ${verifyUrl}`);
  return { ok: true, provider: process.env.EMAIL_PROVIDER };
}

async function verifyEmailToken({ email, token }) {
  const normalizedEmail = normalizeEmail(email);
  const { users, tokens } = await loadTenantData();
  const user = users.find((item) => item.email === normalizedEmail);
  if (!user) throw new Error("not_found");
  const record = tokens.find((item) => item.userId === user.id && !item.usedAt && item.tokenHash === hashToken(token));
  if (!record) throw new Error("invalid_token");
  if (new Date(record.expiresAt).getTime() < Date.now()) throw new Error("expired_token");
  record.usedAt = nowIso();
  user.emailVerified = true;
  user.updatedAt = nowIso();
  await writeStore("users", { users });
  await writeStore("verifications", { tokens });
  return { user: publicUser(user) };
}

async function login({ email, password }) {
  if (process.env.SUPER_ADMIN_EMAIL && process.env.SUPER_ADMIN_PASSWORD) {
    await createSuperAdmin(process.env.SUPER_ADMIN_EMAIL, process.env.SUPER_ADMIN_PASSWORD);
  }
  const { users, tenants } = await loadTenantData();
  const user = users.find((item) => item.email === normalizeEmail(email));
  if (!user || !(await verifyPassword(password, user.passwordHash))) throw new Error("invalid_credentials");
  if (!user.emailVerified) throw new Error("email_not_verified");
  const tenant = hydrateTenant(tenants.find((item) => item.id === user.tenantId));
  if (user.role !== "super_admin" && (!tenant || tenant.status !== "active")) throw new Error("tenant_inactive");
  return { user: publicUser(user), tenant: publicTenant(tenant) };
}

async function changePassword(session, { currentPassword, newPassword }) {
  if (!session?.userId) throw new Error("unauthorized");
  if (String(newPassword || "").length < 8) throw new Error("weak_password");
  const { users } = await loadTenantData();
  const user = users.find((item) => item.id === session.userId);
  if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) throw new Error("invalid_credentials");
  user.passwordHash = await hashPassword(newPassword);
  user.updatedAt = nowIso();
  await writeStore("users", { users });
  return { user: publicUser(user) };
}

async function getSessionContext(req) {
  const session = getRequestSession(req);
  if (!session?.userId) return null;
  const { users, tenants } = await loadTenantData();
  const user = users.find((item) => item.id === session.userId);
  if (!user) return null;
  const tenant = hydrateTenant(tenants.find((item) => item.id === user.tenantId));
  return { session, user, tenant };
}

async function resolveTenantByHost(host) {
  const normalized = normalizeHost(host);
  if (!normalized || ["localhost", "127.0.0.1"].includes(normalized)) return null;
  const { tenants } = await loadTenantData();
  const hydratedTenants = tenants.map(hydrateTenant);
  const custom = hydratedTenants.find((tenant) => tenant.domains.includes(normalized));
  if (custom) return custom.status === "active" ? custom : null;
  const baseDomain = normalizeHost(process.env.PLATFORM_BASE_DOMAIN || "");
  if (baseDomain && normalized.endsWith(`.${baseDomain}`)) {
    const subdomain = normalized.slice(0, -baseDomain.length - 1);
    const tenant = hydratedTenants.find((item) => item.subdomain === subdomain || item.slug === subdomain);
    return tenant?.status === "active" ? tenant : null;
  }
  return null;
}

async function requireTenantAdmin(req) {
  const context = await getSessionContext(req);
  if (!context?.user?.emailVerified) throw new Error("unauthorized");
  if (context.user.role === "super_admin") return context;
  if (!context.tenant || context.tenant.status !== "active") throw new Error("tenant_inactive");
  return context;
}

async function requireSuperAdmin(req) {
  const context = await getSessionContext(req);
  if (context?.user?.role === "super_admin") return context;
  if (process.env.SUPER_ADMIN_TOKEN && req.headers["x-super-admin-token"] === process.env.SUPER_ADMIN_TOKEN) {
    return { user: { role: "super_admin", email: "token-admin" }, tenant: null };
  }
  throw new Error("unauthorized");
}

async function listTenants(req) {
  await requireSuperAdmin(req);
  const { tenants, users } = await loadTenantData();
  return tenants.map((tenant) => ({
    ...publicTenant(hydrateTenant(tenant)),
    users: users.filter((user) => user.tenantId === tenant.id).map(publicUser)
  }));
}

function ensureUniqueTenantRouting(tenants, currentTenant) {
  const current = hydrateTenant(currentTenant);
  const currentDomains = new Set(current.domains);
  const currentSubdomain = current.subdomain;
  const conflict = tenants
    .filter((tenant) => tenant.id !== current.id)
    .map(hydrateTenant)
    .find((tenant) => {
      if (currentSubdomain && tenant.subdomain === currentSubdomain) return true;
      return tenant.domains.some((domain) => currentDomains.has(domain));
    });
  if (conflict) throw new Error("tenant_route_taken");
}

async function updateTenant(req, input) {
  await requireSuperAdmin(req);
  const { tenants } = await loadTenantData();
  const tenant = tenants.find((item) => item.id === input.id);
  if (!tenant) throw new Error("not_found");
  if (input.status) tenant.status = normalizeTenantStatus(input.status);
  if (Array.isArray(input.domains)) {
    tenant.domains = normalizeDomains(input.domains);
  }
  if (input.subdomain != null) {
    const subdomain = slugify(input.subdomain);
    if (!subdomain || subdomain.length < 3) throw new Error("invalid_subdomain");
    tenant.subdomain = subdomain;
  }
  if (input.planId != null) {
    if (!enabledPlanIds().has(input.planId)) throw new Error("invalid_plan");
    tenant.planId = input.planId;
    tenant.features = featuresForPlan(input.planId);
  }
  if (input.stylePluginId != null) {
    if (!enabledStylePluginIds().has(input.stylePluginId)) throw new Error("invalid_style_plugin");
    tenant.stylePluginId = input.stylePluginId;
  }
  if (input.aiProviderConfigRef != null) {
    tenant.aiProviderConfigRef = String(input.aiProviderConfigRef || "platform-default").trim().slice(0, 80) || "platform-default";
  }
  if (input.features && typeof input.features === "object" && !Array.isArray(input.features)) {
    tenant.features = normalizeFeatureSet(input.features);
  }
  ensureUniqueTenantRouting(tenants, tenant);
  tenant.updatedAt = nowIso();
  await writeStore("tenants", { tenants });
  return publicTenant(tenant);
}

async function updateTenantSettings(req, input) {
  const context = await requireTenantAdmin(req);
  const { tenants } = await loadTenantData();
  const tenant = tenants.find((item) => item.id === context.user.tenantId);
  if (!tenant) throw new Error("not_found");
  const hydrated = hydrateTenant(tenant);
  if (input.stylePluginId != null) {
    if (!hydrated.features.styleSwitching) throw new Error("feature_unavailable");
    if (!enabledStylePluginIds().has(input.stylePluginId)) throw new Error("invalid_style_plugin");
    tenant.stylePluginId = input.stylePluginId;
  }
  if (input.domains != null) {
    if (!hydrated.features.customDomain) throw new Error("feature_unavailable");
    const domains = normalizeDomains(input.domains);
    const limit = Number(planById(hydrated.planId)?.domainLimit || 0);
    if (limit >= 0 && domains.length > limit) throw new Error("domain_limit_exceeded");
    tenant.domains = domains;
  }
  if (input.subdomain != null) {
    const subdomain = slugify(input.subdomain);
    if (!subdomain || subdomain.length < 3) throw new Error("invalid_subdomain");
    tenant.subdomain = subdomain;
  }
  ensureUniqueTenantRouting(tenants, tenant);
  tenant.updatedAt = nowIso();
  await writeStore("tenants", { tenants });
  return publicTenant(tenant);
}

async function markTenantInitialized(req) {
  const context = await requireTenantAdmin(req);
  const { tenants } = await loadTenantData();
  const tenant = tenants.find((item) => item.id === context.user.tenantId);
  if (!tenant) throw new Error("not_found");
  tenant.initializedAt = tenant.initializedAt || nowIso();
  tenant.updatedAt = nowIso();
  await writeStore("tenants", { tenants });
  return publicTenant(tenant);
}

async function createSuperAdmin(email, password) {
  const { users } = await loadTenantData();
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !password) return null;
  const existing = users.find((user) => user.email === normalizedEmail);
  if (existing) return publicUser(existing);
  const user = {
    id: randomId("user"),
    tenantId: null,
    email: normalizedEmail,
    passwordHash: await hashPassword(password),
    role: "super_admin",
    emailVerified: true,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  users.push(user);
  await writeStore("users", { users });
  return publicUser(user);
}

module.exports = {
  SESSION_COOKIE,
  analyzeEmailDomain,
  changePassword,
  clearSessionCookie,
  createSuperAdmin,
  getRequestSession,
  getSessionContext,
  hashPassword,
  hashToken,
  listTenants,
  login,
  markTenantInitialized,
  publicTenant,
  publicTenantForVisitor,
  publicUser,
  registerTenant,
  requireSuperAdmin,
  requireTenantAdmin,
  resolveTenantByHost,
  sessionCookie,
  updateTenant,
  updateTenantSettings,
  verifyEmailToken,
  verifyPassword
};
