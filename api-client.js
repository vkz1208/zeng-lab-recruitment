async function getServerData() {
  try {
    const res = await fetch("/api/tenant/content", { cache: "no-store" });
    if (res.ok) {
      const payload = await res.json();
      if (payload?.ok && payload.data && typeof payload.data === "object" && Object.keys(payload.data).length) return payload.data;
    }
  } catch {
    // Fall back to bundled/default content below.
  }
  try {
    const res = await fetch("/api/content", { cache: "no-store" });
    if (res.ok) {
      const payload = await res.json();
      if (payload?.ok && payload.data && typeof payload.data === "object") return payload.data;
    }
  } catch {
    // Fall back to bundled static data below.
  }
  try {
    const res = await fetch("content.json", { cache: "no-store" });
    if (!res.ok) return {};
    return await res.json();
  } catch {
    return {};
  }
}

async function loadPlatformConfig() {
  try {
    const payload = await apiJson("/api/platform/config", { method: "GET", headers: {} });
    platformConfig = {
      plans: Array.isArray(payload.plans) ? payload.plans : [],
      stylePlugins: Array.isArray(payload.stylePlugins) ? payload.stylePlugins : [],
      defaultFeatures: payload.defaultFeatures || {}
    };
  } catch {
    platformConfig = { plans: [], stylePlugins: [], defaultFeatures: {} };
  }
  onboardingStylePluginId = platformConfig.stylePlugins[0]?.id || onboardingStylePluginId;
  return platformConfig;
}

async function saveServerData(data) {
  if (legacyAdminMode) {
    const token = getLegacyAdminToken();
    if (!token) return { ok: false, mode: "legacy", error: "missing_admin_token" };
    const legacyResult = await postJsonWithDetails("/api/content", data, { "X-Admin-Token": token });
    if (legacyResult.ok) return { ...legacyResult, mode: "legacy" };
    if (legacyResult.status === 401) sessionStorage.removeItem("zeng-admin-token");
    return { ok: false, mode: "legacy", error: legacyResult.error || "request_failed", status: legacyResult.status };
  }

  const tenantResult = await postJsonWithDetails("/api/tenant/content", data);
  if (tenantResult.ok) return { ...tenantResult, mode: "tenant" };

  const token = getLegacyAdminToken();
  if (!token) {
    return { ok: false, mode: "legacy", error: tenantResult.error || "missing_admin_token" };
  }

  const legacyResult = await postJsonWithDetails("/api/content", data, { "X-Admin-Token": token });
  if (legacyResult.ok) return { ...legacyResult, mode: "legacy" };
  if (legacyResult.status === 401) sessionStorage.removeItem("zeng-admin-token");
  return {
    ok: false,
    mode: "legacy",
    error: legacyResult.error || tenantResult.error || "request_failed",
    status: legacyResult.status || tenantResult.status
  };
}

async function postJsonWithDetails(url, data, headers = {}) {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(data)
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok || payload.ok === false) {
      return { ok: false, status: res.status, error: payload.error || `http_${res.status}` };
    }
    return { ok: true, status: res.status, source: payload.source || "server" };
  } catch (error) {
    return { ok: false, error: error?.message || "network_error" };
  }
}

function getLegacyAdminToken() {
  const existingToken = sessionStorage.getItem("zeng-admin-token") || "";
  if (existingToken) return existingToken;
  const token = prompt(lang === "zh" ? "\u79df\u6237\u4fdd\u5b58\u4e0d\u53ef\u7528\uff0c\u8bf7\u8f93\u5165\u5355\u7ad9\u70b9\u7ba1\u7406\u4ee4\u724c ADMIN_TOKEN\u3002" : "Tenant save is unavailable. Enter the single-site ADMIN_TOKEN.");
  if (!token) return "";
  sessionStorage.setItem("zeng-admin-token", token);
  return token;
}

function saveFailureMessage(result) {
  const detail = result?.error ? ` (${result.error}${result.status ? ` ${result.status}` : ""})` : "";
  return lang === "zh"
    ? `\u7ebf\u4e0a\u4fdd\u5b58\u5931\u8d25${detail}\uff0c\u5df2\u4e34\u65f6\u4fdd\u5b58\u5230\u5f53\u524d\u6d4f\u89c8\u5668\u3002`
    : `Online save failed${detail}. Changes were saved temporarily in this browser.`;
}

function visitorId() {
  const key = "academic-site-visitor-id";
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const value = `visitor_${Math.random().toString(16).slice(2)}_${Date.now()}`;
  localStorage.setItem(key, value);
  return value;
}

function trackVisit() {
  if (routeFromPath() === "admin" || routeFromPath() === "super-admin") return;
  const payload = JSON.stringify({
    path: location.pathname || "/",
    referrer: document.referrer || "",
    visitorId: visitorId()
  });
  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/tenant/analytics", new Blob([payload], { type: "application/json" }));
    return;
  }
  fetch("/api/tenant/analytics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true
  }).catch(() => {});
}

async function apiJson(url, options = {}) {
  const res = await fetch(url, {
    cache: "no-store",
    credentials: "same-origin",
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || payload.ok === false) throw new Error(payload.error || "request_failed");
  return payload;
}

async function loadAuthContext() {
  try {
    authContext = await apiJson("/api/auth/me", { method: "GET", headers: {} });
  } catch {
    authContext = { authenticated: false };
  }
  return authContext;
}
