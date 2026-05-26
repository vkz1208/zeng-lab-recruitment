const STORAGE_KEY = "zeng-lab-full-site-data-v6";
const PAGE_SIZE = 10;
const SAFE_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);
const BLOCKED_MERGE_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const app = document.querySelector("#app");

let siteData = {
  zh: structuredClone(window.DEFAULT_SITE_DATA.zh),
  en: structuredClone(window.DEFAULT_SITE_DATA.en)
};
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

function yearOf(value = "") {
  return String(value).match(/\d{4}/)?.[0] || "";
}

function chipGroup(name, values, active, allLabel) {
  return `
    <div class="chip-group" data-filter="${esc(name)}">
      <button type="button" data-value="all" class="${active === "all" ? "active" : ""}">${esc(allLabel)}</button>
      ${values.map((value) => `<button type="button" data-value="${esc(value)}" class="${active === value ? "active" : ""}">${esc(value)}</button>`).join("")}
    </div>
  `;
}

function paginationControls(name, page, totalPages, totalItems) {
  if (totalPages <= 1) return "";
  const pages = compactPageList(page, totalPages);
  return `
    <nav class="pagination" data-pagination="${esc(name)}" aria-label="${esc(name)} pagination">
      <span>${lang === "zh" ? `共 ${totalItems} 条` : `${totalItems} items`}</span>
      <div>
        <button type="button" data-page="${page - 1}" ${page <= 1 ? "disabled" : ""}>${lang === "zh" ? "上一页" : "Prev"}</button>
        ${pages.map((item) => item === "…" ? `<span class="pagination-ellipsis">…</span>` : `<button type="button" data-page="${item}" class="${item === page ? "active" : ""}">${item}</button>`).join("")}
        <button type="button" data-page="${page + 1}" ${page >= totalPages ? "disabled" : ""}>${lang === "zh" ? "下一页" : "Next"}</button>
      </div>
    </nav>
  `;
}

function compactPageList(page, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const pages = new Set([1, totalPages, page - 1, page, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((item) => pages.add(item));
  if (page >= totalPages - 2) [totalPages - 3, totalPages - 2, totalPages - 1].forEach((item) => pages.add(item));
  const ordered = [...pages].filter((item) => item >= 1 && item <= totalPages).sort((a, b) => a - b);
  return ordered.flatMap((item, index) => index && item - ordered[index - 1] > 1 ? ["…", item] : [item]);
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

function pageHero(title, intro, titlePath = "", introPath = "", groupPath = "") {
  return `
    <section class="page-hero">
      ${adminGroupButton(groupPath, title)}
      <div class="main-container">
        <p class="eyebrow">${esc(data().meta.labName)}</p>
        ${editableText(title, titlePath, "h1")}
        ${editableText(intro, introPath, "p", "", "long")}
      </div>
    </section>
  `;
}

function data() {
  return siteData[lang] || siteData.zh;
}

function isEnabledFlag(value) {
  if (value === true || value === 1) return true;
  if (typeof value !== "string") return false;
  return ["true", "yes", "y", "是", "√", "1"].includes(value.trim().toLowerCase());
}

function isHomeRepresentativePaper(paper) {
  return isEnabledFlag(paper.homeFeatured);
}

function homePaperCard(paper, index = -1) {
  const basePath = index >= 0 ? `root.${lang}.papers.items.${index}` : "";
  const clickable = !adminMode && isClickableHref(paper.link);
  const tag = clickable ? "a" : "article";
  const attrs = clickable ? ` href="${safeHref(paper.link)}" ${linkAttrs(paper.link)}` : "";
  return `
    <${tag} class="home-paper-card ${clickable ? "is-clickable" : "is-static"}"${attrs}>
      ${adminGroupButton(basePath, paper.title)}
      ${adminDeleteButton(basePath, paper.title)}
      ${adminMoveButtons(basePath, paper.title)}
      <span>${editableInline(paper.year, `${basePath}.year`)} · ${editableInline(paper.journal, `${basePath}.journal`)}</span>
      <strong>${editableInline(paper.title, `${basePath}.title`, "long")}</strong>
      ${editableText(paper.authors, `${basePath}.authors`, "p", "", "long")}
    </${tag}>
  `;
}

function paperRow(paper, index = -1) {
  const basePath = index >= 0 ? `root.${lang}.papers.items.${index}` : "";
  const clickable = !adminMode && isClickableHref(paper.link);
  const tag = clickable ? "a" : "article";
  const attrs = clickable ? ` href="${safeHref(paper.link)}" ${linkAttrs(paper.link)}` : "";
  return `
    <${tag} class="paper-row ${clickable ? "is-clickable" : "is-static"}"${attrs}>
      ${adminGroupButton(basePath, paper.title)}
      ${adminDeleteButton(basePath, paper.title)}
      ${adminMoveButtons(basePath, paper.title)}
      <span>${editableInline(paper.year, `${basePath}.year`)}</span>
      <div>
        <strong>${editableInline(paper.title, `${basePath}.title`, "long")}</strong>
        <p>${editableInline(paper.authors, `${basePath}.authors`, "long")} · ${editableInline(paper.journal, `${basePath}.journal`)}</p>
        ${(paper.tags || []).length ? `<div class="tag-list">${paper.tags.map((tag) => `<em>${esc(tag)}</em>`).join("")}</div>` : ""}
      </div>
    </${tag}>
  `;
}

function resourceCard(item, index = -1) {
  const basePath = index >= 0 ? `root.${lang}.resources.items.${index}` : "";
  const clickable = !adminMode && isClickableHref(item.link);
  const tag = clickable ? "a" : "article";
  const attrs = clickable ? ` href="${safeHref(item.link)}" ${linkAttrs(item.link)}` : "";
  const wideThumb = /GGWS|Fig1|floating/i.test(item.image || "");
  return `
    <${tag} class="resource-card ${wideThumb ? "resource-card--wide-thumb" : ""} ${clickable ? "is-clickable" : "is-static"}"${attrs}>
      ${adminGroupButton(basePath, item.title)}
      ${adminDeleteButton(basePath, item.title)}
      ${adminMoveButtons(basePath, item.title)}
      ${editableImage(item.image, `${basePath}.image`, item.title, "resource")}
      <div>
        ${editableText(item.title, `${basePath}.title`, "h3")}
        ${editableText(item.copy, `${basePath}.copy`, "p", "", "long")}
      </div>
    </${tag}>
  `;
}

function newsItemCard(item, index = -1) {
  const basePath = index >= 0 ? `root.${lang}.news.items.${index}` : "";
  const clickable = !adminMode && isClickableHref(item.link);
  const className = item.image ? "news-card" : "paper-row news-row";
  const tag = clickable ? "a" : "article";
  const attrs = clickable ? ` href="${hrefToRoute(item.link)}" ${linkAttrs(item.link)}` : "";
  return `
    <${tag} class="${className} ${clickable ? "is-clickable" : "is-static"}"${attrs}>
      ${adminGroupButton(basePath, item.title)}
      ${adminDeleteButton(basePath, item.title)}
      ${adminMoveButtons(basePath, item.title)}
      ${editableImage(item.image, `${basePath}.image`, item.title, "news") || `<span>${editableInline(item.date, `${basePath}.date`)}</span>`}
      <div>
        ${item.image ? `<span>${editableInline(item.date, `${basePath}.date`)}</span>` : ""}
        <strong>${editableInline(item.title, `${basePath}.title`, "long")}</strong>
        ${editableText(item.copy, `${basePath}.copy`, "p", "", "long")}
      </div>
    </${tag}>
  `;
}

function renderShell(content) {
  const d = data();
  const f = d.footer || d.contact || {};
  document.body.classList.toggle("admin-preview-mode", adminMode);
  app.innerHTML = `
    <header class="site-header">
      <a class="brand" href="${hrefToRoute("/")}">
        <span class="brand-school-lockup"><img src="${lang === "zh" ? "assets/branding/sustech-lockup-cn-en-crop.png" : "assets/branding/sustech-lockup-en-crop.png"}" alt="${lang === "zh" ? "南方科技大学" : "Southern University of Science and Technology"}" /></span>
      </a>
      <nav class="desktop-nav">
        ${visibleNavItems().map((item) => `<a href="${hrefToRoute(item.href)}">${esc(item.label)}</a>`).join("")}
      </nav>
      <div class="header-actions">
        <button class="ghost-button" id="language-toggle" type="button">${lang === "zh" ? "EN" : "中文"}</button>
        <button class="menu-button" id="menu-toggle" type="button" aria-label="Menu">☰</button>
      </div>
    </header>
    <div class="mobile-drawer" id="mobile-drawer">
      ${visibleNavItems().map((item) => `<a href="${hrefToRoute(item.href)}">${esc(item.label)}</a>`).join("")}
    </div>
    <main>${content}</main>
    <footer>
      <div class="footer-grid">
        <div>
          <strong>${esc(f.lab || d.meta.labName)}</strong>
          <span>${esc(f.school || d.meta.school)}</span>
          ${f.address ? `<span>${esc(f.address)}</span>` : ""}
        </div>
        <div>
          <strong>${lang === "zh" ? "联系" : "Contact"}</strong>
          ${f.email ? `<a href="mailto:${esc(f.email)}">${lang === "zh" ? "课题组负责人 曾振中：" : "Principal Investigator: Zhenzhong Zeng · "}${esc(f.email)}</a>` : ""}
          ${f.assistant ? `<a href="mailto:zengbb@mail.sustech.edu.cn">${esc(f.assistant)}</a>` : ""}
        </div>
        <div>
          <strong>${lang === "zh" ? "相关链接" : "Links"}</strong>
          ${(f.links || []).map((l) => `<a href="${safeHref(l.href)}" ${linkAttrs(l.href)}>${esc(l.text)}</a>`).join("")}
        </div>
      </div>
      <div class="footer-bottom">
        <span>${esc(f.funding || "")}</span>
        <a href="${hrefToRoute("/admin")}">Admin</a>
      </div>
    </footer>
  `;
  installImageFallbacks(app);
  if (adminMode) injectAdminChrome();

  $("#language-toggle").addEventListener("click", () => {
    lang = lang === "zh" ? "en" : "zh";
    localStorage.setItem("zeng-lab-lang", lang);
    render();
  });
  $("#menu-toggle").addEventListener("click", () => $("#mobile-drawer").classList.toggle("open"));
}

function renderHome() {
  const d = data();
  const h = d.home;
  const homeDirections = h.highlights || [];
  const featuredPapers = (d.papers?.items || [])
    .map((paper, index) => ({ paper, index }))
    .filter(({ paper }) => isHomeRepresentativePaper(paper));
  renderShell(`
    <section class="hero">
      ${adminGroupButton(`root.${lang}.home`, h.title)}
      ${editableImage(h.heroImage, `root.${lang}.home.heroImage`, "AI for Climate", "hero", "hero-bg")}
      <div class="hero-overlay"></div>
      <div class="hero-inner main-container">
        <div class="hero-lab-name">
          <div class="hero-lab-lockup">
            <span class="hero-lab-mark">${editableImage("assets/branding/lab-logo.png", "", d.meta.labName, "avatar")}</span>
            <span>
              <strong>${editableInline(d.meta.labName, `root.${lang}.meta.labName`)}</strong>
              <small>${editableInline(d.meta.labNameEn, `root.${lang}.meta.labNameEn`)}</small>
            </span>
          </div>
        </div>
        ${editableText(h.eyebrow, `root.${lang}.home.eyebrow`, "p", "eyebrow")}
        ${editableText(h.title, `root.${lang}.home.title`, "h1")}
        ${editableText(h.copy, `root.${lang}.home.copy`, "p", "hero-copy", "long")}
        <div class="hero-actions">
          <a class="button primary" href="${hrefToRoute(h.primary.href)}">${editableInline(h.primary.text, `root.${lang}.home.primary.text`)}</a>
          <a class="button secondary" href="${hrefToRoute(h.secondary.href)}">${editableInline(h.secondary.text, `root.${lang}.home.secondary.text`)}</a>
        </div>
        <div class="hero-stats">${h.stats.map((s, index) => `<div><strong>${editableInline(s.value, `root.${lang}.home.stats.${index}.value`)}</strong><span>${editableInline(s.label, `root.${lang}.home.stats.${index}.label`)}</span></div>`).join("")}</div>
      </div>
    </section>
    <section class="split band">
      ${adminGroupButton(`root.${lang}.home`, h.featureTitle)}
      <div>
        ${editableText(h.featureTitle, `root.${lang}.home.featureTitle`, "h2")}
      </div>
      ${editableText(h.featureCopy, `root.${lang}.home.featureCopy`, "p", "home-feature-copy", "long")}
    </section>
    <section class="media-section">
      ${editableImage(h.teamImage, `root.${lang}.home.teamImage`, "Team photo", "wide")}
      <div class="admin-section-actions">${adminAddButton(`root.${lang}.home.highlights`, "researchDirection", lang === "zh" ? "新增研究卡片" : "Add highlight")}</div>
      <div class="card-grid three research-preview-grid">${homeDirections.map((x, index) => `
        <article class="research-preview-card">
          ${adminGroupButton(`root.${lang}.home.highlights.${index}`, x.title)}
          ${adminDeleteButton(`root.${lang}.home.highlights.${index}`, x.title)}
          ${adminMoveButtons(`root.${lang}.home.highlights.${index}`, x.title)}
          ${editableImage(x.image, `root.${lang}.home.highlights.${index}.image`, x.title, "research")}
          <div>
            ${editableText(x.title, `root.${lang}.home.highlights.${index}.title`, "h3")}
            ${editableText(x.copy, `root.${lang}.home.highlights.${index}.copy`, "p", "", "long")}
          </div>
        </article>
      `).join("")}</div>
    </section>
    <section class="featured-papers-section band">
      <div class="section-head">
        <h2>${lang === "zh" ? "代表作" : "Representative Papers"}</h2>
      </div>
      ${adminAddButton(`root.${lang}.papers.items`, "paper", lang === "zh" ? "新增论文" : "Add paper")}
      <div class="home-paper-grid">
        ${featuredPapers.map(({ paper, index }) => homePaperCard(paper, index)).join("")}
      </div>
    </section>
  `);
}

function renderPapers() {
  const p = data().papers;
  const items = (p.items || []).map((paper, index) => ({ paper, index }));
  const years = [...new Set(items.map(({ paper }) => yearOf(paper.year)).filter(Boolean))].sort((a, b) => b.localeCompare(a));
  const tags = [...new Set(items.flatMap(({ paper }) => paper.tags || []))].sort();
  const filtered = items.filter(({ paper }) => {
    const matchesTab = paperTab === "all" || isEnabledFlag(paper.featured);
    const matchesYear = paperYear === "all" || yearOf(paper.year) === paperYear;
    const matchesTag = paperTag === "all" || (paper.tags || []).includes(paperTag);
    return matchesTab && matchesYear && matchesTag;
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  paperPage = Math.min(Math.max(1, paperPage), totalPages);
  const pageItems = filtered.slice((paperPage - 1) * PAGE_SIZE, paperPage * PAGE_SIZE);
  renderShell(`
    ${pageHero(p.title, p.intro, `root.${lang}.papers.title`, `root.${lang}.papers.intro`, `root.${lang}.papers`)}
    <section class="content-section">
      ${adminAddButton(`root.${lang}.papers.items`, "paper", lang === "zh" ? "新增论文" : "Add paper")}
      <div class="tab-strip" data-filter="paper-tab">
        <button type="button" data-value="featured" class="${paperTab === "featured" ? "active" : ""}">${esc(p.tabs?.featured || "Featured")}</button>
        <button type="button" data-value="all" class="${paperTab === "all" ? "active" : ""}">${esc(p.tabs?.all || "All")}</button>
      </div>
      <div class="filter-panel">
        <div class="filter-block">
          <span>${lang === "zh" ? "年份" : "Year"}</span>
          ${chipGroup("paper-year", years, paperYear, p.filterLabels?.allYears || "All years")}
        </div>
        <div class="filter-block">
          <span>${lang === "zh" ? "研究方向" : "Topic"}</span>
          ${chipGroup("paper-tag", tags, paperTag, p.filterLabels?.allTags || "All topics")}
        </div>
      </div>
      <div class="paper-list">
        ${pageItems.map(({ paper, index }) => paperRow(paper, index)).join("")}
      </div>
      ${paginationControls("papers", paperPage, totalPages, filtered.length)}
    </section>
  `);

  document.querySelectorAll("[data-filter='paper-tab'] button").forEach((button) => {
    button.addEventListener("click", () => {
      paperTab = button.dataset.value;
      paperPage = 1;
      renderPapers();
    });
  });
  document.querySelectorAll("[data-filter='paper-year'] button").forEach((button) => {
    button.addEventListener("click", () => {
      paperYear = button.dataset.value;
      paperPage = 1;
      renderPapers();
    });
  });
  document.querySelectorAll("[data-filter='paper-tag'] button").forEach((button) => {
    button.addEventListener("click", () => {
      paperTag = button.dataset.value;
      paperPage = 1;
      renderPapers();
    });
  });
  document.querySelectorAll("[data-pagination='papers'] button").forEach((button) => {
    button.addEventListener("click", () => {
      paperPage = Number(button.dataset.page);
      renderPapers();
    });
  });
}

function renderResearch() {
  const d = data();
  const r = d.research;
  const resources = d.resources?.items || [];
  renderShell(`
    ${pageHero(r.title, r.intro, `root.${lang}.research.title`, `root.${lang}.research.intro`, `root.${lang}.research`)}
    <section class="content-section">
      <div class="section-head"><h2>${lang === "zh" ? "研究方向" : "Research Directions"}</h2>${adminAddButton(`root.${lang}.research.directions`, "researchDirection", lang === "zh" ? "新增研究方向" : "Add direction")}</div>
      <div class="card-grid direction-grid">${r.directions.map((x, index) => `<article>${adminGroupButton(`root.${lang}.research.directions.${index}`, x.title)}${adminDeleteButton(`root.${lang}.research.directions.${index}`, x.title)}${adminMoveButtons(`root.${lang}.research.directions.${index}`, x.title)}${editableText(x.title, `root.${lang}.research.directions.${index}.title`, "h3")}${editableText(x.copy, `root.${lang}.research.directions.${index}.copy`, "p", "", "long")}</article>`).join("")}</div>
    </section>
    <section class="content-section band">
      <div class="section-head">
        <h2>${lang === "zh" ? "开放数据与代码资源" : "Open Data & Code Resources"}</h2>
        <p>${esc(d.resources?.intro || "")}</p>
      </div>
      ${adminAddButton(`root.${lang}.resources.items`, "resource", lang === "zh" ? "新增资源" : "Add resource")}
      <div class="resource-grid merged">
        ${resources.map((item, index) => resourceCard(item, index)).join("")}
      </div>
    </section>
  `);
}

function renderNews() {
  const n = data().news;
  const items = (n.items || []).map((item, index) => ({ item, index }));
  const years = [...new Set(items.map(({ item }) => yearOf(item.date)).filter(Boolean))].sort((a, b) => b.localeCompare(a));
  const filtered = items.filter(({ item }) => newsYear === "all" || yearOf(item.date) === newsYear);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  newsPage = Math.min(Math.max(1, newsPage), totalPages);
  const pageItems = filtered.slice((newsPage - 1) * PAGE_SIZE, newsPage * PAGE_SIZE);
  renderShell(`
    ${pageHero(n.title, n.intro, `root.${lang}.news.title`, `root.${lang}.news.intro`, `root.${lang}.news`)}
    <section class="content-section">
      <div class="filter-panel news-filter">
        <div class="filter-block">
          <span>${lang === "zh" ? "年份" : "Year"}</span>
          ${chipGroup("news-year", years, newsYear, n.filterLabels?.allYears || "All years")}
        </div>
      </div>
      ${adminAddButton(`root.${lang}.news.items`, "news", lang === "zh" ? "新增新闻" : "Add news")}
      <div class="paper-list news-list">
        ${pageItems.map(({ item, index }) => newsItemCard(item, index)).join("")}
      </div>
      ${paginationControls("news", newsPage, totalPages, filtered.length)}
    </section>
  `);
  document.querySelectorAll("[data-filter='news-year'] button").forEach((button) => {
    button.addEventListener("click", () => {
      newsYear = button.dataset.value;
      newsPage = 1;
      renderNews();
    });
  });
  document.querySelectorAll("[data-pagination='news'] button").forEach((button) => {
    button.addEventListener("click", () => {
      newsPage = Number(button.dataset.page);
      renderNews();
    });
  });
}

function renderResources() {
  const r = data().resources;
  renderShell(`
    ${pageHero(r.title, r.intro, `root.${lang}.resources.title`, `root.${lang}.resources.intro`, `root.${lang}.resources`)}
    <section class="content-section">
      ${adminAddButton(`root.${lang}.resources.items`, "resource", lang === "zh" ? "新增资源" : "Add resource")}
      <div class="resource-grid">
        ${r.items.map((item, index) => resourceCard(item, index)).join("")}
      </div>
    </section>
  `);
}

function renderJoin() {
  const j = data().join;
  renderShell(`
    ${pageHero(j.title, j.intro, `root.${lang}.join.title`, `root.${lang}.join.intro`, `root.${lang}.join`)}
    <section class="join-page">
      ${adminGroupButton(`root.${lang}.join`, j.title)}
      ${editableImage(j.image, `root.${lang}.join.image`, "Team", "wide")}
      <div>
        <h2>AI for Climate</h2>
        ${editableText(j.body, `root.${lang}.join.body`, "p", "", "long")}
        <div class="admin-section-actions">${adminAddButton(`root.${lang}.join.benefits`, "researchDirection", lang === "zh" ? "新增优势卡片" : "Add benefit")}</div>
        <div class="card-grid">${j.benefits.map((x, index) => `<article>${adminGroupButton(`root.${lang}.join.benefits.${index}`, x.title)}${adminDeleteButton(`root.${lang}.join.benefits.${index}`, x.title)}${adminMoveButtons(`root.${lang}.join.benefits.${index}`, x.title)}${editableText(x.title, `root.${lang}.join.benefits.${index}.title`, "h3")}${editableText(x.copy, `root.${lang}.join.benefits.${index}.copy`, "p", "", "long")}</article>`).join("")}</div>
        <h2 class="compact-title">${lang === "zh" ? "开放岗位" : "Open Positions"}</h2>
        <div class="admin-section-actions">${adminAddButton(`root.${lang}.join.openings`, "researchDirection", lang === "zh" ? "新增岗位卡片" : "Add opening")}</div>
        <div class="card-grid">${(j.openings || []).map((x, index) => `<article>${adminGroupButton(`root.${lang}.join.openings.${index}`, x.title)}${adminDeleteButton(`root.${lang}.join.openings.${index}`, x.title)}${adminMoveButtons(`root.${lang}.join.openings.${index}`, x.title)}${editableText(x.title, `root.${lang}.join.openings.${index}.title`, "h3")}${editableText(x.copy, `root.${lang}.join.openings.${index}.copy`, "p", "", "long")}</article>`).join("")}</div>
        <h2 class="compact-title">${lang === "zh" ? "申请材料" : "Application Materials"}</h2>
        <ul class="material-list">${(j.materials || []).map((x, index) => `<li>${editableInline(x, `root.${lang}.join.materials.${index}`, "long")}</li>`).join("")}</ul>
        <a class="button primary wide" href="${safeHref(j.contact.href)}">${editableInline(j.contact.text, `root.${lang}.join.contact.text`)}</a>
      </div>
    </section>
  `);
}

function renderContact() {
  const c = data().contact;
  renderShell(`
    ${pageHero(c.title, c.intro, `root.${lang}.contact.title`, `root.${lang}.contact.intro`, `root.${lang}.contact`)}
    <section class="contact-section">
      ${adminGroupButton(`root.${lang}.contact`, c.title)}
      <a class="button primary wide" href="${safeHref(c.email.href)}">${editableInline(c.email.text, `root.${lang}.contact.email.text`)}</a>
      ${c.links.map((l, index) => `<a href="${safeHref(l.href)}" ${linkAttrs(l.href)}>${editableInline(l.text, `root.${lang}.contact.links.${index}.text`)}</a>`).join("")}
    </section>
  `);
}

function renderDynamicModule(module, pageIndex, moduleIndex) {
  const basePath = `root.${lang}.pages.${pageIndex}.modules.${moduleIndex}`;
  if (module.type === "cards") {
    const items = Array.isArray(module.items) ? module.items : [];
    return `
      <section class="content-section">
        ${adminGroupButton(basePath, module.title)}
        <div class="section-head"><h2>${editableInline(module.title || "", `${basePath}.title`)}</h2>${adminAddButton(`${basePath}.items`, "resource", lang === "zh" ? "新增卡片" : "Add card")}</div>
        <div class="card-grid">
          ${items.map((item, index) => `<article>${adminGroupButton(`${basePath}.items.${index}`, item.title)}${adminDeleteButton(`${basePath}.items.${index}`, item.title)}${adminMoveButtons(`${basePath}.items.${index}`, item.title)}${editableText(item.title || "", `${basePath}.items.${index}.title`, "h3")}${editableText(item.copy || "", `${basePath}.items.${index}.copy`, "p", "", "long")}</article>`).join("")}
        </div>
      </section>
    `;
  }
  return `
    <section class="content-section dynamic-text-section">
      ${adminGroupButton(basePath, module.title)}
      ${module.title ? editableText(module.title, `${basePath}.title`, "h2") : ""}
      ${editableText(module.copy || "", `${basePath}.copy`, "p", "", "long")}
    </section>
  `;
}

function renderDynamicPage(slug) {
  const pages = siteData[lang]?.pages || [];
  const pageIndex = pages.findIndex((page) => page?.slug === slug && page.enabled !== false);
  const page = pages[pageIndex];
  if (!page) return renderHome();
  const modules = Array.isArray(page.modules) ? page.modules : [];
  renderShell(`
    ${pageHero(page.title, page.intro, `root.${lang}.pages.${pageIndex}.title`, `root.${lang}.pages.${pageIndex}.intro`, `root.${lang}.pages.${pageIndex}`)}
    ${adminGroupButton(`root.${lang}.pages.${pageIndex}`, page.title)}
    <section class="content-section">
      <div class="admin-section-actions">${adminAddButton(`root.${lang}.pages.${pageIndex}.modules`, "dynamicText", lang === "zh" ? "新增模块" : "Add module")}</div>
    </section>
    ${modules.map((module, index) => renderDynamicModule(module, pageIndex, index)).join("")}
  `);
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
