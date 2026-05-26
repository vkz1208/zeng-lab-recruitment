const STORAGE_KEY = "zeng-lab-full-site-data-v6";
const PAGE_SIZE = 10;
const SAFE_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);
const BLOCKED_MERGE_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const app = document.querySelector("#app");

let siteData = { zh: {}, en: {} };
let lang = localStorage.getItem("zeng-lab-lang") || "zh";
let paperTab = "featured";
let paperYear = "all";
let paperTag = "all";
let newsYear = "all";
let teamTab = "current";
let paperPage = 1;
let newsPage = 1;
let adminMode = false;
let adminPreviewRoute = "team";
let adminPanelOpen = false;
let authContext = null;
let onboardingDraft = null;
let onboardingSession = null;
let onboardingBlocks = {};
let onboardingActiveTaskId = "";
let platformConfig = { plans: [], stylePlugins: [], defaultFeatures: {} };
let onboardingStylePluginId = "sustech-lab";
let legacyAdminMode = false;
let shouldApplyDefaultTeamOrder = true;

function $(selector, root = document) {
  return root.querySelector(selector);
}

function esc(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function safeHref(href = "") {
  const value = String(href || "").trim().replace(/[\u0000-\u001F"'<>`]/g, "");
  if (!value) return "#";
  if (value.startsWith("#") || value.startsWith("/")) return value;
  try {
    const url = new URL(value, window.location.origin);
    return SAFE_PROTOCOLS.has(url.protocol) ? value : "#";
  } catch {
    return "#";
  }
}

function isClickableHref(href = "") {
  return safeHref(href) !== "#";
}

function linkAttrs(href = "") {
  const safe = safeHref(href);
  const external = /^https?:\/\//.test(safe);
  return `${external ? 'target="_blank" rel="noopener"' : ""}`;
}

function imageTypeFromPath(path = "") {
  if (/heroImage/.test(path)) return "hero";
  if (/teamImage|join\.image/.test(path)) return "wide";
  if (/team|alumniSections|sections|pi/.test(path)) return "avatar";
  if (/home\.highlights|research\.directions/.test(path)) return "research";
  if (/news/.test(path)) return "news";
  if (/resources/.test(path)) return "resource";
  return "card";
}

function cardImage(src, alt = "", type = "card", extraClass = "") {
  if (!src) return "";
  const classes = ["card-media", `card-media--${type}`, extraClass].filter(Boolean).join(" ");
  return `<img class="${classes}" src="${esc(src)}" alt="${esc(alt)}" loading="lazy" />`;
}

function adminEditButton(path, label = "", type = "text") {
  if (!adminMode || !path) return "";
  return `<button class="inline-edit-button" type="button" data-inline-edit="${esc(path)}" data-edit-type="${esc(type)}" aria-label="${esc(label || path)}">编辑</button>`;
}

function adminGroupButton(path, label = "") {
  return adminEditButton(path, label, "group");
}

function adminAddButton(path, type, label = "") {
  if (!adminMode || !path || !type) return "";
  return `<button class="inline-add-button" type="button" data-inline-add="${esc(path)}" data-add-type="${esc(type)}" aria-label="${esc(label || path)}">${lang === "zh" ? "新增" : "Add"}</button>`;
}

function adminDeleteButton(path, label = "") {
  if (!adminMode || !path) return "";
  return `<button class="inline-delete-button" type="button" data-inline-delete="${esc(path)}" aria-label="${esc(label || path)}">${lang === "zh" ? "删除" : "Delete"}</button>`;
}

function adminMoveButtons(path, label = "") {
  if (!adminMode || !path) return "";
  return `
    <span class="inline-move-actions" aria-label="${esc(label || path)}">
      <button type="button" data-inline-move="${esc(path)}" data-direction="-1">${lang === "zh" ? "上移" : "Up"}</button>
      <button type="button" data-inline-move="${esc(path)}" data-direction="1">${lang === "zh" ? "下移" : "Down"}</button>
    </span>
  `;
}

function editableText(value, path, tag = "span", className = "", type = "text") {
  const classes = ["editable-fragment", className].filter(Boolean).join(" ");
  return `<${tag} class="${classes}"><span class="editable-value">${esc(value)}</span></${tag}>`;
}

function editableInline(value, path, type = "text") {
  return `${esc(value)}`;
}

function editableImage(src, path, alt = "", type = "card", extraClass = "") {
  const image = cardImage(src, alt, type, extraClass);
  if (!adminMode || !path || !image) return image;
  return `<span class="editable-media">${image}</span>`;
}

function installImageFallbacks(root = app) {
  if (!root) return;
  root.querySelectorAll("img").forEach((img) => {
    img.addEventListener("error", () => {
      img.classList.add("is-broken");
      img.setAttribute("aria-hidden", "true");
      img.removeAttribute("src");
    }, { once: true });
  });
}

function hrefToRoute(href = "") {
  const safe = safeHref(href);
  if (/^(https?:|mailto:|#)/.test(safe)) return safe;
  const clean = safe.replace(/^\//, "");
  return clean ? `${clean}/` : "./";
}

function routeFromPath() {
  const path = location.pathname.replace(/\/+$/, "") || "/";
  const last = path.split("/").filter(Boolean).pop();
  if (!last || last === "zzz" || last === "zeng-lab-recruitment") return "home";
  if (last === "admin") return "admin";
  if (last === "super-admin") return "super-admin";
  if (["team", "papers", "research", "resources", "news", "join", "contact"].includes(last)) return last;
  return findDynamicPage(last) ? `page:${last}` : "home";
}

function dynamicPages(langKey = lang) {
  return (siteData[langKey]?.pages || [])
    .filter((page) => page && page.enabled !== false && page.slug && page.title)
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
}

function findDynamicPage(slug, langKey = lang) {
  return dynamicPages(langKey).find((page) => page.slug === slug);
}

function visibleNavItems() {
  const d = data();
  const existing = d.nav || [];
  const dynamic = dynamicPages().map((page) => ({ label: page.title, href: `/${page.slug}` }));
  return [...existing, ...dynamic];
}

function mergeData(base, patch) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return base;
  for (const key of Object.keys(patch)) {
    if (BLOCKED_MERGE_KEYS.has(key)) continue;
    if (patch[key] && typeof patch[key] === "object" && !Array.isArray(patch[key])) {
      base[key] = mergeData(base[key] || {}, patch[key]);
    } else {
      base[key] = patch[key];
    }
  }
  return base;
}

function ensureContentExtensions() {
  ["zh", "en"].forEach((locale) => {
    siteData[locale] = siteData[locale] || {};
    if (!Array.isArray(siteData[locale].pages)) siteData[locale].pages = [];
  });
}

function planName(planId = "") {
  return platformConfig.plans.find((plan) => plan.id === planId)?.name || planId || "Starter";
}

function stylePluginOptions(selected = "") {
  const plugins = platformConfig.stylePlugins.length ? platformConfig.stylePlugins : [{ id: "sustech-lab", name: "SUSTech Lab" }];
  return plugins
    .filter((plugin) => plugin.status !== "disabled")
    .map((plugin) => `<option value="${esc(plugin.id)}" ${plugin.id === selected ? "selected" : ""}>${esc(plugin.name)} ${plugin.version ? `v${esc(plugin.version)}` : ""}</option>`)
    .join("");
}

function renderTenantSettings() {
  const tenant = authContext?.tenant || {};
  const features = tenant.features || {};
  renderShell(`
    ${pageHero("Tenant Settings", "Manage the website style, domain routing, password, and enabled services.", "", "", "")}
    <section class="tenant-settings content-section">
      <form id="tenant-settings-form" class="settings-panel">
        <h2>Website settings</h2>
        <label>Current plan<input value="${esc(planName(tenant.planId))}" disabled /></label>
        <label>Style plugin
          <select name="stylePluginId" ${features.styleSwitching ? "" : "disabled"}>${stylePluginOptions(tenant.stylePluginId)}</select>
        </label>
        <label>Platform subdomain
          <input name="subdomain" value="${esc(tenant.subdomain || tenant.slug || "")}" />
        </label>
        <label>Custom domains
          <textarea name="domains" rows="3" ${features.customDomain ? "" : "disabled"}>${esc((tenant.domains || []).join(", "))}</textarea>
        </label>
        <div class="feature-grid">
          ${Object.entries(features).map(([key, enabled]) => `<span class="${enabled ? "enabled" : ""}">${esc(key)}: ${enabled ? "on" : "off"}</span>`).join("")}
        </div>
        <button class="save" type="submit">Save settings</button>
      </form>
      <form id="tenant-password-form" class="settings-panel">
        <h2>Password</h2>
        <label>Current password<input name="currentPassword" type="password" autocomplete="current-password" required /></label>
        <label>New password<input name="newPassword" type="password" autocomplete="new-password" minlength="8" required /></label>
        <button class="save" type="submit">Change password</button>
      </form>
      <section class="settings-panel">
        <div class="section-head"><h2>Dynamic pages</h2>${adminAddButton(`root.${lang}.pages`, "dynamicPage", "Add page")}</div>
        <div class="settings-page-list">
          ${(siteData[lang]?.pages || []).map((page, index) => `
            <article>
              ${adminGroupButton(`root.${lang}.pages.${index}`, page.title)}
              ${adminDeleteButton(`root.${lang}.pages.${index}`, page.title)}
              ${adminMoveButtons(`root.${lang}.pages.${index}`, page.title)}
              <strong>${esc(page.title || page.slug || "Untitled")}</strong>
              <span>/${esc(page.slug || "")} - ${page.enabled === false ? "hidden" : "visible"}</span>
            </article>
          `).join("") || `<p>No custom pages yet.</p>`}
        </div>
      </section>
      <section class="settings-panel">
        <h2>Analytics</h2>
        <div id="tenant-analytics-panel"><p>Loading analytics...</p></div>
      </section>
      <section class="settings-panel">
        <h2>Review queue</h2>
        <div id="tenant-review-panel"><p>Loading review items...</p></div>
      </section>
    </section>
  `);
  installTenantSettingsHandlers();
  loadTenantDashboardPanels();
}

async function loadTenantDashboardPanels() {
  try {
    const analytics = await apiJson("/api/tenant/analytics", { method: "GET", headers: {} });
    const panel = $("#tenant-analytics-panel");
    if (panel) {
      panel.innerHTML = `
        <div class="draft-metrics">
          <span>${Number(analytics.totals?.pv || 0)} PV</span>
          <span>${Number(analytics.totals?.uv || 0)} UV</span>
        </div>
        <div class="settings-page-list">
          ${(analytics.days || []).slice(0, 7).map((day) => `<article><strong>${esc(day.date)}</strong><span>${Number(day.pv || 0)} PV / ${Number(day.uv || 0)} UV</span></article>`).join("") || "<p>No visits recorded yet.</p>"}
        </div>
      `;
    }
  } catch {
    const panel = $("#tenant-analytics-panel");
    if (panel) panel.innerHTML = "<p>Analytics are not available yet.</p>";
  }
  try {
    const queue = await apiJson("/api/tenant/review-queue", { method: "GET", headers: {} });
    const panel = $("#tenant-review-panel");
    if (panel) {
      panel.innerHTML = `
        <div class="settings-page-list">
          ${(queue.items || []).slice(0, 10).map((item) => `
            <article data-review-id="${esc(item.id)}">
              <strong>${esc(item.title)}</strong>
              <span>${esc(item.status)} - ${esc(item.target || "news")}</span>
              <p>${esc(item.summary || item.aiSuggestion || "")}</p>
              <div class="auth-links">
                <button type="button" data-review-status="approved">Approve</button>
                <button type="button" data-review-status="rejected">Reject</button>
                <button type="button" data-review-status="needs_revision">Needs revision</button>
              </div>
            </article>
          `).join("") || "<p>No pending review items.</p>"}
        </div>
      `;
      installReviewHandlers();
    }
  } catch {
    const panel = $("#tenant-review-panel");
    if (panel) panel.innerHTML = "<p>Review queue is not available yet.</p>";
  }
}

function installReviewHandlers() {
  document.querySelectorAll("[data-review-status]").forEach((button) => {
    button.addEventListener("click", async () => {
      const row = button.closest("[data-review-id]");
      if (!row) return;
      try {
        await apiJson("/api/tenant/review-queue", {
          method: "POST",
          body: JSON.stringify({ id: row.dataset.reviewId, status: button.dataset.reviewStatus })
        });
        loadTenantDashboardPanels();
      } catch (error) {
        alert(`Review update failed: ${error.message}`);
      }
    });
  });
}

function installTenantSettingsHandlers() {
  $("#tenant-settings-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    data.domains = String(data.domains || "").split(",").map((item) => item.trim()).filter(Boolean);
    try {
      const payload = await apiJson("/api/tenant/settings", { method: "POST", body: JSON.stringify(data) });
      authContext.tenant = payload.tenant;
      alert("Settings saved.");
      renderTenantSettings();
    } catch (error) {
      alert(`Settings failed: ${error.message}`);
    }
  });
  $("#tenant-password-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      await apiJson("/api/auth/change-password", { method: "POST", body: JSON.stringify(data) });
      form.reset();
      alert("Password changed.");
    } catch (error) {
      alert(`Password change failed: ${error.message}`);
    }
  });
}

function render() {
  const route = routeFromPath();
  if (route === "admin") return renderAdmin();
  if (route === "super-admin") return renderSuperAdmin();
  adminMode = false;
  document.body.classList.remove("admin-preview-mode");
  const map = { home: renderHome, team: renderTeam, papers: renderPapers, research: renderResearch, resources: renderResources, news: renderNews, join: renderJoin, contact: renderContact };
  if (route.startsWith("page:")) {
    renderDynamicPage(route.slice(5));
    trackVisit();
    return;
  }
  map[route]();
  trackVisit();
}

async function init() {
  if (typeof window.loadDefaultSiteData === "function") await window.loadDefaultSiteData();
  siteData = {
    zh: structuredClone(window.DEFAULT_SITE_DATA.zh || {}),
    en: structuredClone(window.DEFAULT_SITE_DATA.en || {})
  };
  await loadPlatformConfig();
  if (typeof window.loadPaperList === "function") await window.loadPaperList();
  if (Array.isArray(window.PAPER_LIST) && window.PAPER_LIST.length) {
    siteData.zh.papers.items = structuredClone(window.PAPER_LIST);
    siteData.en.papers.items = structuredClone(window.PAPER_LIST);
  }
  const serverData = await getServerData();
  const localData = localStorage.getItem(STORAGE_KEY);
  shouldApplyDefaultTeamOrder = !serverData || !Object.keys(serverData).length;
  mergeData(siteData, serverData);
  if (localData) {
    try {
      mergeData(siteData, JSON.parse(localData));
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
  ensureContentExtensions();
  normalizeTeamData();
  applyTeamRoleOrder();
  render();
}

init();
