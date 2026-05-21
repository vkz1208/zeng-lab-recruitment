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

function editableText(value, path, tag = "span", className = "", type = "text") {
  const classes = ["editable-fragment", className].filter(Boolean).join(" ");
  return `<${tag} class="${classes}"><span class="editable-value">${esc(value)}</span>${adminEditButton(path, value, type)}</${tag}>`;
}

function editableInline(value, path, type = "text") {
  return `${esc(value)}${adminEditButton(path, value, type)}`;
}

function editableImage(src, path, alt = "", type = "card", extraClass = "") {
  const image = cardImage(src, alt, type, extraClass);
  if (!adminMode || !path || !image) return image;
  return `<span class="editable-media">${image}${adminEditButton(path, alt || path, "image")}</span>`;
}

function installImageFallbacks(root = app) {
  root.querySelectorAll("img").forEach((img) => {
    img.addEventListener("error", () => {
      img.classList.add("is-broken");
      img.setAttribute("aria-hidden", "true");
      img.removeAttribute("src");
    }, { once: true });
  });
}

function avatarFallback(label = "?") {
  return `<div class="avatar-fallback">${esc((label || "?").slice(0, 1))}</div>`;
}

const TEAM_MEMBER_TEXT = {
  "Zhenzhong Zeng": {
    zh: {
      started: "南方科技大学",
      email: "zengzz@sustech.edu.cn",
      details: ["北京大学博士，普林斯顿大学博士后", "研究方向：地球系统过程、全球变化、气候影响与 AI for climate and energy", "成果发表于 Nature、Science 等期刊，多次入选 Highly Cited Researchers"]
    },
    en: {
      started: "Southern University of Science and Technology",
      email: "zengzz@sustech.edu.cn",
      details: ["Ph.D. from Peking University; postdoctoral training at Princeton University", "Research: Earth system processes, global change, climate impacts, and AI for climate and energy", "Published in Nature, Science, and related journals; repeatedly listed among Highly Cited Researchers"]
    }
  },
  "Rongrong Xu": { zh: { started: "2020.01 入组", email: "xurr@sustech.edu.cn" }, en: { started: "Joined 2020.01", email: "xurr@sustech.edu.cn" } },
  "Khan Muhammad Asif": { zh: { started: "2022.07 入组", email: "asif@sustech.edu.cn" }, en: { started: "Joined 2022.07", email: "asif@sustech.edu.cn" } },
  "Tianyun Dong": { zh: { started: "2023.08 入组", email: "1418619971@qq.com" }, en: { started: "Joined 2023.08", email: "1418619971@qq.com" } },
  "Shuxin Luo": { zh: { started: "2024.01 入组", email: "luosx@sustech.edu.cn" }, en: { started: "Joined 2024.01", email: "luosx@sustech.edu.cn" } },
  "Xinyue He": { zh: { started: "2019.09 入组", email: "11959003@mail.sustech.edu.cn" }, en: { started: "Joined 2019.09", email: "11959003@mail.sustech.edu.cn" } },
  "Jie Wu": { zh: { started: "2020.09 入组", email: "wuj6@mail.sustech.edu.cn" }, en: { started: "Joined 2020.09", email: "wuj6@mail.sustech.edu.cn" } },
  "Junyu Zou": { zh: { started: "2020.09 入组", email: "12031156@mail.sustech.edu.cn" }, en: { started: "Joined 2020.09", email: "12031156@mail.sustech.edu.cn" } },
  "Xin Jiang": { zh: { started: "2021.09 入组", email: "jiangxiaobaix@outlook.com" }, en: { started: "Joined 2021.09", email: "jiangxiaobaix@outlook.com" } },
  "Baoni Li": { zh: { started: "2021.09 入组", email: "12131073@mail.sustech.edu.cn" }, en: { started: "Joined 2021.09", email: "12131073@mail.sustech.edu.cn" } },
  "Jiayu Xu": { zh: { started: "2022.09 入组", email: "12231090@mail.sustech.edu.cn" }, en: { started: "Joined 2022.09", email: "12231090@mail.sustech.edu.cn" } },
  "Yingzuo Qin": { zh: { started: "2023.08 入组", email: "qinyz2023@mail.sustech.edu.cn" }, en: { started: "Joined 2023.08", email: "qinyz2023@mail.sustech.edu.cn" } },
  "Shijing Liang": { zh: { started: "2021.09 入组", email: "111712638@mail.sustech.edu.cn" }, en: { started: "Joined 2021.09", email: "111712638@mail.sustech.edu.cn" } },
  "Yubin Jin": { zh: { started: "2021.09 入组", email: "12132204@mail.sustech.edu.cn" }, en: { started: "Joined 2021.09", email: "12132204@mail.sustech.edu.cn" } },
  "Qiaomei Feng": { zh: { started: "2021.09 入组", email: "12132197@mail.sustech.edu.cn" }, en: { started: "Joined 2021.09", email: "12132197@mail.sustech.edu.cn" } },
  "Xiaowen Huang": { zh: { started: "2022.09 入组", email: "12232269@mail.sustech.edu.cn" }, en: { started: "Joined 2022.09", email: "12232269@mail.sustech.edu.cn" } },
  "Lili Liang": { zh: { started: "2022.09 入组", email: "12232258@mail.sustech.edu.cn" }, en: { started: "Joined 2022.09", email: "12232258@mail.sustech.edu.cn" } },
  "Sihuan Wei": { zh: { started: "2022.09 入组", email: "12232264@mail.sustech.edu.cn" }, en: { started: "Joined 2022.09", email: "12232264@mail.sustech.edu.cn" } },
  "Xiaoye Liu": { zh: { started: "2023.09 入组", email: "12332278@mail.sustech.edu.cn" }, en: { started: "Joined 2023.09", email: "12332278@mail.sustech.edu.cn" } },
  "Yuxin Liang": { zh: { started: "2023.09 入组", email: "liangyuxin4916@126.com" }, en: { started: "Joined 2023.09", email: "liangyuxin4916@126.com" } },
  "Yanan Zhao": { zh: { started: "2021.06 入组", email: "12010842@mail.sustech.edu.cn" }, en: { started: "Joined 2021.06", email: "12010842@mail.sustech.edu.cn" } },
  "Xinrong Yang": { zh: { started: "2021.06 入组", email: "12012538@mail.sustech.edu.cn" }, en: { started: "Joined 2021.06", email: "12012538@mail.sustech.edu.cn" } },
  "Yue Yan": { zh: { started: "2023.06 入组", email: "12211052@mail.sustech.edu.cn" }, en: { started: "Joined 2023.06", email: "12211052@mail.sustech.edu.cn" } },
  "Ziyue Lin": { zh: { started: "2023.06 入组", email: "12212657@sustech.edu.cn" }, en: { started: "Joined 2023.06", email: "12212657@sustech.edu.cn" } },
  "Binbin Zeng": { zh: { started: "2019.09 入组", email: "zengbb@mail.sustech.edu.cn" }, en: { started: "Joined 2019.09", email: "zengbb@mail.sustech.edu.cn" } }
};

TEAM_MEMBER_TEXT["Yaotong Cai"] = { zh: { image: "assets/team/yaotong_cai.jpg" }, en: { image: "assets/team/yaotong_cai.jpg" } };
TEAM_MEMBER_TEXT["Qun Luo"] = { zh: { image: "assets/team/qun_luo.jpg" }, en: { image: "assets/team/qun_luo.jpg" } };

const TEAM_ROLE_ORDER = {
  "current": [
    [
      "博士后",
      "江鑫"
    ],
    [
      "博士后",
      "蔡耀通"
    ],
    [
      "教师",
      "徐荣嵘"
    ],
    [
      "教师",
      "罗舒心"
    ],
    [
      "博士后",
      "谢舒笛"
    ],
    [
      "博士后",
      "张萌"
    ],
    [
      "在读博士",
      "徐嘉玉"
    ],
    [
      "在读博士",
      "覃颖祚"
    ],
    [
      "在读博士",
      "刘小叶"
    ],
    [
      "在读博士",
      "冯巧梅"
    ],
    [
      "在读硕士",
      "梁雨欣"
    ],
    [
      "在读硕士",
      "严涵阳"
    ],
    [
      "在读本科生",
      "严悦"
    ],
    [
      "在读本科生",
      "林子越"
    ],
    [
      "在读本科生",
      "邹欣妤"
    ],
    [
      "在读本科生",
      "高舸帆"
    ],
    [
      "在读本科生",
      "秦思锦"
    ],
    [
      "在读博士",
      "金宇斌"
    ],
    [
      "在读博士",
      "魏思焕"
    ],
    [
      "在读博士",
      "赵雅楠"
    ],
    [
      "科研教学助理",
      "罗群"
    ],
    [
      "大总管",
      "曾斌斌"
    ]
  ],
  "alumni": [
    [
      "出站博士后",
      "王大山"
    ],
    [
      "已出站博士后",
      "杨锋"
    ],
    [
      "已出站博士后",
      "KHAN MUHAMMAD ASIF"
    ],
    [
      "已毕业博士",
      "何心悦"
    ],
    [
      "已毕业博士",
      "武婕"
    ],
    [
      "已毕业博士",
      "冯禹"
    ],
    [
      "已毕业博士",
      "陈鹤"
    ],
    [
      "已毕业博士",
      "邹俊宇"
    ],
    [
      "已毕业博士",
      "江鑫"
    ],
    [
      "已毕业硕士",
      "周俐宏"
    ],
    [
      "已毕业硕士",
      "金宇斌"
    ],
    [
      "已毕业硕士",
      "梁时婧"
    ],
    [
      "已毕业硕士",
      "梁莉莉"
    ],
    [
      "已毕业硕士",
      "黄筱雯"
    ],
    [
      "已毕业硕士",
      "魏思焕"
    ],
    [
      "已毕业本科生",
      "胡世杰"
    ],
    [
      "已毕业本科生",
      "刘怡"
    ],
    [
      "已毕业本科生",
      "赵雅楠"
    ],
    [
      "已毕业本科生",
      "杨欣荣"
    ],
    [
      "已毕业本科生",
      "徐嘉玉"
    ],
    [
      "已离职科研助理",
      "范文新"
    ],
    [
      "已离职科研助理",
      "彭展翔"
    ],
    [
      "历史访问人员",
      "林子裕"
    ],
    [
      "历史访问人员",
      "刘洋"
    ],
    [
      "历史访问人员",
      "王新月"
    ],
    [
      "历史访问人员",
      "郭亚东"
    ],
    [
      "历史访问人员",
      "丁晟平"
    ],
    [
      "已出站博士后",
      "董天云"
    ],
    [
      "已毕业本科生",
      "梁时婧"
    ],
    [
      "已毕业本科生",
      "黄晓雯"
    ]
  ]
};

const ROLE_TRANSLATIONS = {
  "???": "Lab Manager",
  "??": "Faculty",
  "????": "Visiting Student",
  "?????": "Master Alumni",
  "??????": "Former Visitor",
  "???????????????": "Former Research Assistant Professor / Postdoctoral Fellow",
  "???????": "Former Research Assistant"
};

function memberExtra(member, langKey) {
  return TEAM_MEMBER_TEXT[member.name]?.[langKey] || TEAM_MEMBER_TEXT[member.cn]?.[langKey] || {};
}

function mergeMemberText(member, extra = {}) {
  const details = [...(extra.details || []), ...(member.details || [])]
    .filter((item, index, list) => item && list.indexOf(item) === index);
  return {
    ...member,
    image: member.image || extra.image || "",
    started: member.started || extra.started || "",
    email: member.email || extra.email || "",
    bio: member.bio || extra.bio || "",
    details
  };
}

function enrichedMember(member) {
  return mergeMemberText(member, memberExtra(member, lang));
}

function normalizeTeamMember(member, langKey) {
  return mergeMemberText(member, memberExtra(member, langKey));
}

function normalizeTeamData() {
  ["zh", "en"].forEach((langKey) => {
    const team = siteData[langKey]?.team;
    if (!team) return;
    if (team.pi) team.pi = normalizeTeamMember(team.pi, langKey);
    (team.sections || []).forEach((section) => {
      section.members = (section.members || []).map((member) => normalizeTeamMember(member, langKey));
    });
    (team.alumniSections || []).forEach((section) => {
      section.members = (section.members || []).map((member) => normalizeTeamMember(member, langKey));
    });
  });
}

function memberMatches(member, cnName, langKey) {
  const target = cnName.toLowerCase();
  const values = [member.name, member.cn].filter(Boolean).map((value) => String(value).toLowerCase());
  if (target === "khan muhammad asif") return values.some((value) => value.includes("khan muhammad asif"));
  return values.includes(target);
}

function sectionTitle(role, langKey) {
  return langKey === "zh" ? role : (ROLE_TRANSLATIONS[role] || role);
}

function roleLabel(role, langKey) {
  return sectionTitle(role, langKey);
}

function reorderMembersByRole(sections = [], roleRows, langKey, keepFirstSection = false) {
  const preserved = keepFirstSection ? sections.slice(0, 1) : [];
  const sourceSections = keepFirstSection ? sections.slice(1) : sections;
  const pool = sourceSections.flatMap((section) => section.members || []);
  const used = new Set();
  const grouped = [];

  roleRows.forEach(([role, cnName]) => {
    const index = pool.findIndex((member, memberIndex) => !used.has(memberIndex) && memberMatches(member, cnName, langKey));
    if (index < 0) return;
    used.add(index);
    let section = grouped.find((item) => item.title === sectionTitle(role, langKey));
    if (!section) {
      section = { title: sectionTitle(role, langKey), members: [] };
      grouped.push(section);
    }
    section.members.push({ ...pool[index], role: roleLabel(role, langKey) });
  });

  return [...preserved, ...grouped];
}

function applyTeamRoleOrder() {
  ["zh", "en"].forEach((langKey) => {
    const team = siteData[langKey]?.team;
    if (!team) return;
    team.sections = reorderMembersByRole(team.sections || [], TEAM_ROLE_ORDER.current, langKey, true);
    team.alumniSections = reorderMembersByRole(team.alumniSections || [], TEAM_ROLE_ORDER.alumni, langKey, false);
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
  return ["team", "papers", "research", "resources", "news", "join", "contact"].includes(last) ? last : "home";
}

async function getServerData() {
  try {
    const res = await fetch("content.json", { cache: "no-store" });
    if (!res.ok) return {};
    return await res.json();
  } catch {
    return {};
  }
}

async function saveServerData(data) {
  try {
    const token = sessionStorage.getItem("zeng-admin-token") || "";
    const res = await fetch("/api/content", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Admin-Token": token },
      body: JSON.stringify(data)
    });
    return res.ok;
  } catch {
    return false;
  }
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

function pageHero(title, intro, titlePath = "", introPath = "") {
  return `
    <section class="page-hero">
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
        ${d.nav.map((item) => `<a href="${hrefToRoute(item.href)}">${esc(item.label)}</a>`).join("")}
      </nav>
      <div class="header-actions">
        <button class="ghost-button" id="language-toggle" type="button">${lang === "zh" ? "EN" : "中文"}</button>
        <button class="menu-button" id="menu-toggle" type="button" aria-label="Menu">☰</button>
      </div>
    </header>
    <div class="mobile-drawer" id="mobile-drawer">
      ${d.nav.map((item) => `<a href="${hrefToRoute(item.href)}">${esc(item.label)}</a>`).join("")}
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
      <div>
        ${editableText(h.featureTitle, `root.${lang}.home.featureTitle`, "h2")}
      </div>
      ${editableText(h.featureCopy, `root.${lang}.home.featureCopy`, "p", "home-feature-copy", "long")}
    </section>
    <section class="media-section">
      ${editableImage(h.teamImage, `root.${lang}.home.teamImage`, "Team photo", "wide")}
      <div class="card-grid three research-preview-grid">${homeDirections.map((x, index) => `
        <article class="research-preview-card">
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
      <div class="home-paper-grid">
        ${featuredPapers.map(({ paper, index }) => homePaperCard(paper, index)).join("")}
      </div>
    </section>
  `);
}

function memberCard(m, basePath = "") {
  m = enrichedMember(m);
  const image = editableImage(m.image, basePath ? `${basePath}.image` : "", m.name, "avatar") || avatarFallback(m.name);
  return `
    <article class="member-card">
      ${image}
      <div>
        <h3>${editableInline(m.name, basePath ? `${basePath}.name` : "")} <span>${editableInline(m.cn || "", basePath ? `${basePath}.cn` : "")}</span></h3>
        ${editableText(m.role || "", basePath ? `${basePath}.role` : "", "p", "role")}
        ${m.started ? editableText(m.started, basePath ? `${basePath}.started` : "", "p") : ""}
        ${m.destination ? `<p class="destination">${lang === "zh" ? "去向：" : "Destination: "}${editableInline(m.destination, basePath ? `${basePath}.destination` : "")}</p>` : ""}
        ${m.bio ? editableText(m.bio, basePath ? `${basePath}.bio` : "", "p", "", "long") : ""}
        ${(m.details || []).length ? `<ul class="member-details">${m.details.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>` : ""}
        ${m.email ? `<a href="mailto:${esc(m.email)}">${esc(m.email)}</a>` : ""}
      </div>
    </article>
  `;
}

function piCard(pi) {
  pi = enrichedMember(pi);
  const primaryName = lang === "zh" ? (pi.cn || pi.name) : pi.name;
  const secondaryName = lang === "zh" ? pi.name : pi.cn;
  const basePath = `root.${lang}.team.pi`;
  return `
    <article class="pi-card">
      <div class="pi-photo">
        ${editableImage(pi.image, `${basePath}.image`, pi.name, "avatar") || avatarFallback(pi.name)}
      </div>
      <div class="pi-body">
        <h2>${editableInline(primaryName, lang === "zh" ? `${basePath}.cn` : `${basePath}.name`)} <span>${editableInline(secondaryName || "", lang === "zh" ? `${basePath}.name` : `${basePath}.cn`)}</span></h2>
        ${editableText(pi.role || "", `${basePath}.role`, "p", "role")}
        ${editableText(pi.bio || "", `${basePath}.bio`, "p", "", "long")}
        <div class="pi-columns">
          <div>
            <h3>${lang === "zh" ? "教育经历" : "Education"}</h3>
            <ul>${(pi.education || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
          </div>
          ${pi.experience ? `<div>
            <h3>${lang === "zh" ? "任职经历" : "Experience"}</h3>
            <ul>${(pi.experience || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
          </div>` : ""}
          <div>
            <h3>${lang === "zh" ? "奖项与荣誉" : "Selected Honors"}</h3>
            <ul>${(pi.honors || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
          </div>
        </div>
        <div class="pi-links">
          ${pi.email ? `<a href="mailto:${esc(pi.email)}">${esc(pi.email)}</a>` : ""}
          ${(pi.links || []).map((l) => `<a href="${safeHref(l.href)}" ${linkAttrs(l.href)}>${esc(l.text)}</a>`).join("")}
        </div>
      </div>
    </article>
  `;
}

function renderTeam() {
  const t = data().team;
  const pi = t.pi || t.sections?.[0]?.members?.[0] || {};
  const sections = normalizeCurrentTeamSections(t.sections || [], lang);
  const currentContent = `
    <section class="content-section">
      <div class="section-head"><h2>${lang === "zh" ? "负责人" : "Principal Investigator"}</h2></div>
      ${piCard(pi)}
    </section>
    ${sections.map((section) => `
      <section class="content-section">
        <div class="section-head"><h2>${esc(section.title)}</h2></div>
        <div class="member-grid">${section.members.map(memberCard).join("")}</div>
      </section>
    `).join("")}
  `;
  const alumniContent = (t.alumniSections || []).length ? `
    <section class="content-section alumni-section">
      <div class="section-head"><h2>${lang === "zh" ? "已毕业成员" : "Alumni"}</h2></div>
      ${t.alumniSections.map((section) => `
        <div class="alumni-group">
          <h3>${esc(section.title)}</h3>
          <div class="member-grid">${section.members.map(memberCard).join("")}</div>
        </div>
      `).join("")}
    </section>
  ` : "";
  renderShell(`
    ${pageHero(t.title, t.intro, `root.${lang}.team.title`, `root.${lang}.team.intro`)}
    <section class="content-section compact-section">
      <div class="tab-strip" data-filter="team-tab">
        <button type="button" data-value="current" class="${teamTab === "current" ? "active" : ""}">${lang === "zh" ? "当前成员" : "Current"}</button>
        <button type="button" data-value="alumni" class="${teamTab === "alumni" ? "active" : ""}">${lang === "zh" ? "已毕业成员" : "Alumni"}</button>
      </div>
    </section>
    ${teamTab === "current" ? currentContent : alumniContent}
  `);

  document.querySelectorAll("[data-filter='team-tab'] button").forEach((button) => {
    button.addEventListener("click", () => {
      teamTab = button.dataset.value;
      renderTeam();
    });
  });
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
    ${pageHero(p.title, p.intro, `root.${lang}.papers.title`, `root.${lang}.papers.intro`)}
    <section class="content-section">
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
    ${pageHero(r.title, r.intro, `root.${lang}.research.title`, `root.${lang}.research.intro`)}
    <section class="content-section">
      <div class="section-head"><h2>${lang === "zh" ? "研究方向" : "Research Directions"}</h2></div>
      <div class="card-grid direction-grid">${r.directions.map((x, index) => `<article>${editableText(x.title, `root.${lang}.research.directions.${index}.title`, "h3")}${editableText(x.copy, `root.${lang}.research.directions.${index}.copy`, "p", "", "long")}</article>`).join("")}</div>
    </section>
    <section class="content-section band">
      <div class="section-head">
        <h2>${lang === "zh" ? "开放数据与代码资源" : "Open Data & Code Resources"}</h2>
        <p>${esc(d.resources?.intro || "")}</p>
      </div>
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
    ${pageHero(n.title, n.intro, `root.${lang}.news.title`, `root.${lang}.news.intro`)}
    <section class="content-section">
      <div class="filter-panel news-filter">
        <div class="filter-block">
          <span>${lang === "zh" ? "年份" : "Year"}</span>
          ${chipGroup("news-year", years, newsYear, n.filterLabels?.allYears || "All years")}
        </div>
      </div>
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
    ${pageHero(r.title, r.intro, `root.${lang}.resources.title`, `root.${lang}.resources.intro`)}
    <section class="content-section">
      <div class="resource-grid">
        ${r.items.map((item, index) => resourceCard(item, index)).join("")}
      </div>
    </section>
  `);
}

function renderJoin() {
  const j = data().join;
  renderShell(`
    ${pageHero(j.title, j.intro, `root.${lang}.join.title`, `root.${lang}.join.intro`)}
    <section class="join-page">
      ${editableImage(j.image, `root.${lang}.join.image`, "Team", "wide")}
      <div>
        <h2>AI for Climate</h2>
        ${editableText(j.body, `root.${lang}.join.body`, "p", "", "long")}
        <div class="card-grid">${j.benefits.map((x, index) => `<article>${editableText(x.title, `root.${lang}.join.benefits.${index}.title`, "h3")}${editableText(x.copy, `root.${lang}.join.benefits.${index}.copy`, "p", "", "long")}</article>`).join("")}</div>
        <h2 class="compact-title">${lang === "zh" ? "开放岗位" : "Open Positions"}</h2>
        <div class="card-grid">${(j.openings || []).map((x, index) => `<article>${editableText(x.title, `root.${lang}.join.openings.${index}.title`, "h3")}${editableText(x.copy, `root.${lang}.join.openings.${index}.copy`, "p", "", "long")}</article>`).join("")}</div>
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
    ${pageHero(c.title, c.intro, `root.${lang}.contact.title`, `root.${lang}.contact.intro`)}
    <section class="contact-section">
      <a class="button primary wide" href="${safeHref(c.email.href)}">${editableInline(c.email.text, `root.${lang}.contact.email.text`)}</a>
      ${c.links.map((l, index) => `<a href="${safeHref(l.href)}" ${linkAttrs(l.href)}>${editableInline(l.text, `root.${lang}.contact.links.${index}.text`)}</a>`).join("")}
    </section>
  `);
}

function pathSet(obj, path, value) {
  const parts = path.split(".");
  let cursor = obj;
  while (parts.length > 1) {
    const key = parts.shift();
    if (BLOCKED_MERGE_KEYS.has(key)) return;
    cursor[key] = cursor[key] || {};
    cursor = cursor[key];
  }
  if (BLOCKED_MERGE_KEYS.has(parts[0])) return;
  cursor[parts[0]] = value;
}

function pathGet(obj, path) {
  return path.split(".").reduce((cursor, key) => BLOCKED_MERGE_KEYS.has(key) ? undefined : cursor?.[key], obj);
}

function syncAdminFields() {
  document.querySelectorAll("[data-field]").forEach((field) => {
    const value = field.type === "checkbox" ? field.checked : field.value;
    pathSet(siteData, field.dataset.field.replace(/^root\./, ""), value);
  });
}

function isImageField(path = "") {
  return /image|Image|heroImage|teamImage/.test(path);
}

function renderAdminImagePreview(value, path) {
  if (!isImageField(path)) return "";
  const type = imageTypeFromPath(path);
  return `
    <div class="admin-image-preview admin-image-preview--${esc(type)}" data-preview="${esc(path)}">
      ${cardImage(value, path, type)}
    </div>
  `;
}

function renderEditor(value, path) {
  if (Array.isArray(value)) {
    return `
      <details open class="admin-group">
        <summary>${esc(path)} <button data-add="${esc(path)}" type="button">添加卡片</button></summary>
        ${value.map((item, index) => `
          <div class="admin-array-item">
            <button data-delete="${esc(path)}" data-index="${index}" type="button">删除</button>
            ${renderEditor(item, `${path}.${index}`)}
          </div>
        `).join("")}
      </details>
    `;
  }
  if (value && typeof value === "object") {
    return `<details open class="admin-group"><summary>${esc(path)}</summary>${Object.keys(value).map((key) => renderEditor(value[key], `${path}.${key}`)).join("")}</details>`;
  }
  if (typeof value === "boolean") {
    return `
      <label class="admin-field admin-field--checkbox">
        <span>${esc(path)}</span>
        <input type="checkbox" data-field="${esc(path)}" ${value ? "checked" : ""} />
      </label>
    `;
  }
  const stringValue = value == null ? "" : String(value);
  const isLong = stringValue.length > 70;
  return `
    <label class="admin-field">
      <span>${esc(path)}</span>
      ${isLong ? `<textarea data-field="${esc(path)}">${esc(stringValue)}</textarea>` : `<input data-field="${esc(path)}" value="${esc(stringValue)}" />`}
      ${renderAdminImagePreview(stringValue, path)}
      ${isImageField(path) ? `<input type="file" accept="image/*" data-upload="${esc(path)}" />` : ""}
    </label>
  `;
}

function adminRouteOptions() {
  const labels = {
    home: lang === "zh" ? "首页" : "Home",
    team: lang === "zh" ? "团队" : "Team",
    papers: lang === "zh" ? "论文" : "Papers",
    research: lang === "zh" ? "研究" : "Research",
    resources: lang === "zh" ? "资源" : "Resources",
    news: lang === "zh" ? "新闻" : "News",
    join: lang === "zh" ? "加入我们" : "Join",
    contact: lang === "zh" ? "联系" : "Contact"
  };
  return ["home", "team", "papers", "research", "resources", "news", "join", "contact"]
    .map((route) => `<option value="${route}" ${adminPreviewRoute === route ? "selected" : ""}>${esc(labels[route])}</option>`)
    .join("");
}

function routeFromAdminHref(href = "") {
  const clean = href.replace(/^\.?\//, "").replace(/\/+$/, "");
  if (!clean || clean === "#") return "home";
  return ["team", "papers", "research", "resources", "news", "join", "contact"].includes(clean) ? clean : "";
}

function injectAdminChrome() {
  app.insertAdjacentHTML("beforeend", `
    <div class="admin-preview-toolbar" role="region" aria-label="Admin preview controls">
      <strong>${lang === "zh" ? "所见即所得编辑" : "Visual Editor"}</strong>
      <label>
        <span>${lang === "zh" ? "预览页面" : "Preview"}</span>
        <select id="admin-page-select">${adminRouteOptions()}</select>
      </label>
      <button id="admin-panel-toggle" type="button">${adminPanelOpen ? (lang === "zh" ? "收起高级编辑" : "Hide advanced") : (lang === "zh" ? "高级编辑" : "Advanced edit")}</button>
      <button id="save-admin" class="save" type="button">${lang === "zh" ? "保存生效" : "Save"}</button>
      <button id="reset-admin" type="button">${lang === "zh" ? "恢复默认" : "Reset"}</button>
      <a class="button secondary" href="${hrefToRoute("/")}">${lang === "zh" ? "退出后台" : "Exit"}</a>
    </div>
    <aside class="admin-dock ${adminPanelOpen ? "open" : ""}" id="admin-dock" aria-label="Admin editor">
      <div class="admin-dock-head">
        <div>
          <p class="eyebrow">Admin</p>
          <h2>${lang === "zh" ? "内容编辑" : "Content Editor"}</h2>
        </div>
        <button id="admin-dock-close" type="button" aria-label="Close editor">×</button>
      </div>
      <p class="admin-dock-note">${lang === "zh" ? "左侧页面使用正式网页同一套布局渲染。修改字段后保存即可生效；新增、删除卡片会保留当前未保存输入。" : "The page behind this panel uses the same renderer as the public site. Save after editing fields."}</p>
      <section class="admin-panel visual-editor-panel">
        ${renderEditor(siteData, "root")}
      </section>
    </aside>
    <div class="inline-edit-modal" id="inline-edit-modal" hidden>
      <div class="inline-edit-backdrop" data-inline-close></div>
      <form class="inline-edit-dialog" id="inline-edit-form">
        <div class="inline-edit-head">
          <div>
            <p class="eyebrow">Edit</p>
            <h2 id="inline-edit-title">${lang === "zh" ? "编辑内容" : "Edit Content"}</h2>
          </div>
          <button type="button" data-inline-close aria-label="Close">×</button>
        </div>
        <div class="inline-edit-body" id="inline-edit-body"></div>
        <div class="inline-edit-actions">
          <button type="button" data-inline-close>${lang === "zh" ? "取消" : "Cancel"}</button>
          <button class="save" type="submit">${lang === "zh" ? "应用" : "Apply"}</button>
        </div>
      </form>
    </div>
  `);
  installImageFallbacks($("#admin-dock"));
  installAdminHandlers();
}

function installAdminHandlers() {
  $("#admin-page-select")?.addEventListener("change", (event) => {
    syncAdminFields();
    adminPreviewRoute = event.target.value;
    sessionStorage.setItem("zeng-admin-preview-route", adminPreviewRoute);
    renderAdminPreview();
  });

  $("#admin-panel-toggle")?.addEventListener("click", () => {
    adminPanelOpen = !adminPanelOpen;
    $("#admin-dock")?.classList.toggle("open", adminPanelOpen);
    $("#admin-panel-toggle").textContent = adminPanelOpen ? (lang === "zh" ? "收起高级编辑" : "Hide advanced") : (lang === "zh" ? "高级编辑" : "Advanced edit");
  });

  $("#admin-dock-close")?.addEventListener("click", () => {
    adminPanelOpen = false;
    $("#admin-dock")?.classList.remove("open");
    $("#admin-panel-toggle").textContent = lang === "zh" ? "高级编辑" : "Advanced edit";
  });

  document.querySelectorAll("[data-inline-edit]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openInlineEditor(button.dataset.inlineEdit, button.dataset.editType || "text");
    });
  });

  document.querySelectorAll(".site-header a, .mobile-drawer a").forEach((link) => {
    link.addEventListener("click", (event) => {
      const route = routeFromAdminHref(link.getAttribute("href") || "");
      if (!route) return;
      event.preventDefault();
      syncAdminFields();
      adminPreviewRoute = route;
      sessionStorage.setItem("zeng-admin-preview-route", adminPreviewRoute);
      renderAdminPreview();
    });
  });

  document.querySelectorAll("[data-upload]").forEach((input) => {
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) return;
      if (!file.type.startsWith("image/") || file.size > 2 * 1024 * 1024) {
        alert("请选择 2MB 以内的图片文件。");
        input.value = "";
        return;
      }
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        const field = document.querySelector(`[data-field="${CSS.escape(input.dataset.upload)}"]`);
        if (field) {
          field.value = reader.result;
          field.dispatchEvent(new Event("input", { bubbles: true }));
        }
      });
      reader.readAsDataURL(file);
    });
  });

  document.querySelectorAll("[data-field]").forEach((field) => {
    if (!isImageField(field.dataset.field)) return;
    field.addEventListener("input", () => {
      const preview = document.querySelector(`[data-preview="${CSS.escape(field.dataset.field)}"]`);
      if (preview) preview.innerHTML = cardImage(field.value, field.dataset.field, imageTypeFromPath(field.dataset.field));
      installImageFallbacks(preview);
    });
  });

  document.querySelectorAll("[data-add]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      syncAdminFields();
      const arr = pathGet(siteData, button.dataset.add.replace(/^root\./, ""));
      if (!Array.isArray(arr)) return;
      const sample = arr[0] ? structuredClone(arr[0]) : { title: "新卡片", copy: "请编辑内容", link: "" };
      arr.push(sample);
      renderAdminPreview();
    });
  });

  document.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      syncAdminFields();
      const arr = pathGet(siteData, button.dataset.delete.replace(/^root\./, ""));
      if (!Array.isArray(arr)) return;
      arr.splice(Number(button.dataset.index), 1);
      renderAdminPreview();
    });
  });

  $("#save-admin")?.addEventListener("click", async () => {
    syncAdminFields();
    const saved = await saveServerData(siteData);
    localStorage.setItem(STORAGE_KEY, saved ? "" : JSON.stringify(siteData));
    alert(saved ? "已保存到 content.json。" : "已保存到当前浏览器。静态部署如需全站同步，需要后端存储。");
  });

  $("#reset-admin")?.addEventListener("click", async () => {
    if (!confirm("确定恢复默认内容？")) return;
    siteData = {
      zh: structuredClone(window.DEFAULT_SITE_DATA.zh),
      en: structuredClone(window.DEFAULT_SITE_DATA.en)
    };
    localStorage.removeItem(STORAGE_KEY);
    await saveServerData({});
    renderAdminPreview();
  });
}

function closeInlineEditor() {
  $("#inline-edit-modal")?.setAttribute("hidden", "");
}

function inlineEditorControl(path, type, value) {
  if (type === "image") {
    return `
      <label class="inline-edit-field">
        <span>${lang === "zh" ? "图片路径" : "Image path"}</span>
        <input id="inline-edit-value" value="${esc(value || "")}" />
      </label>
      <label class="inline-edit-field">
        <span>${lang === "zh" ? "上传图片" : "Upload image"}</span>
        <input id="inline-edit-file" type="file" accept="image/*" />
      </label>
      ${value ? `<div class="inline-edit-preview">${cardImage(value, path, imageTypeFromPath(path))}</div>` : ""}
    `;
  }
  if (typeof value === "boolean") {
    return `
      <label class="inline-edit-field inline-edit-field--checkbox">
        <span>${lang === "zh" ? "启用" : "Enabled"}</span>
        <input id="inline-edit-value" type="checkbox" ${value ? "checked" : ""} />
      </label>
    `;
  }
  const stringValue = value == null ? "" : String(value);
  const long = type === "long" || stringValue.length > 80;
  return `
    <label class="inline-edit-field">
      <span>${esc(path.replace(/^root\./, ""))}</span>
      ${long ? `<textarea id="inline-edit-value">${esc(stringValue)}</textarea>` : `<input id="inline-edit-value" value="${esc(stringValue)}" />`}
    </label>
  `;
}

function openInlineEditor(path, type = "text") {
  syncAdminFields();
  const cleanPath = path.replace(/^root\./, "");
  const value = pathGet(siteData, cleanPath);
  const modal = $("#inline-edit-modal");
  const body = $("#inline-edit-body");
  if (!modal || !body) return;
  modal.removeAttribute("hidden");
  modal.dataset.path = cleanPath;
  modal.dataset.type = type;
  $("#inline-edit-title").textContent = path.replace(/^root\./, "");
  body.innerHTML = inlineEditorControl(path, type, value);
  installImageFallbacks(body);

  $("#inline-edit-file")?.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 2 * 1024 * 1024) {
      alert("请选择 2MB 以内的图片文件。");
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const field = $("#inline-edit-value");
      if (field) field.value = reader.result;
    });
    reader.readAsDataURL(file);
  });

  document.querySelectorAll("[data-inline-close]").forEach((button) => {
    button.addEventListener("click", closeInlineEditor, { once: true });
  });

  $("#inline-edit-form").onsubmit = (event) => {
    event.preventDefault();
    const field = $("#inline-edit-value");
    const nextValue = field?.type === "checkbox" ? field.checked : field?.value;
    pathSet(siteData, modal.dataset.path, nextValue ?? "");
    closeInlineEditor();
    renderAdminPreview();
  };
}

function renderAdminPreview() {
  const map = {
    home: renderHome,
    team: renderTeam,
    papers: renderPapers,
    research: renderResearch,
    resources: renderResources,
    news: renderNews,
    join: renderJoin,
    contact: renderContact
  };
  (map[adminPreviewRoute] || renderTeam)();
}

function renderAdmin() {
  const existingToken = sessionStorage.getItem("zeng-admin-token");
  const token = existingToken || prompt("请输入管理令牌。请将本地服务环境变量 ADMIN_TOKEN 设置为相同值。");
  const ok = Boolean(token);
  if (!ok) {
    alert("缺少管理令牌");
    location.href = hrefToRoute("/");
    return;
  }
  sessionStorage.setItem("zeng-admin-ok", "1");
  sessionStorage.setItem("zeng-admin-token", token);
  adminMode = true;
  adminPreviewRoute = sessionStorage.getItem("zeng-admin-preview-route") || adminPreviewRoute;
  renderAdminPreview();
}

function render() {
  const route = routeFromPath();
  if (route === "admin") return renderAdmin();
  adminMode = false;
  document.body.classList.remove("admin-preview-mode");
  const map = { home: renderHome, team: renderTeam, papers: renderPapers, research: renderResearch, resources: renderResources, news: renderNews, join: renderJoin, contact: renderContact };
  map[route]();
}

async function init() {
  if (Array.isArray(window.PAPER_LIST) && window.PAPER_LIST.length) {
    siteData.zh.papers.items = structuredClone(window.PAPER_LIST);
    siteData.en.papers.items = structuredClone(window.PAPER_LIST);
  }
  const serverData = await getServerData();
  const localData = localStorage.getItem(STORAGE_KEY);
  mergeData(siteData, serverData);
  if (localData) {
    try {
      mergeData(siteData, JSON.parse(localData));
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
  normalizeTeamData();
  applyTeamRoleOrder();
  render();
}

function normalizeCurrentTeamSections(rawSections = [], langKey = "zh") {
  const source = rawSections.filter((section, index) => index !== 0);
  const allMembers = source.flatMap((section) => (section.members || []).map((member) => ({
    ...member,
    _sectionTitle: section.title
  })));
  const isBinbin = (member) => /曾斌斌|Binbin Zeng/.test(`${member.name || ""} ${member.cn || ""}`);
  const titleMap = langKey === "zh"
    ? ["大总管", "教师", "博士后", "在读博士", "在读硕士", "在读本科生", "科研教学助理", "访问学者"]
    : ["Lab Manager", "Faculty", "Postdoctoral Researcher", "PhD Student", "Master Student", "Undergraduate Student", "Research and Teaching Assistant", "Visiting Scholar"];
  const roleTests = [
    isBinbin,
    (member) => /教师|Faculty/.test(`${member.role || ""} ${member._sectionTitle || ""}`),
    (member) => /博士后|Postdoctoral/.test(`${member.role || ""} ${member._sectionTitle || ""}`) && !isBinbin(member),
    (member) => /在读博士|PhD Student/.test(`${member.role || ""} ${member._sectionTitle || ""}`),
    (member) => /在读硕士|Master Student/.test(`${member.role || ""} ${member._sectionTitle || ""}`),
    (member) => /在读本科生|Undergraduate Student/.test(`${member.role || ""} ${member._sectionTitle || ""}`),
    (member) => /科研教学助理|Research and Teaching Assistant/.test(`${member.role || ""} ${member._sectionTitle || ""}`) && !isBinbin(member),
    (member) => /访问学者|Visiting Scholar/.test(`${member.role || ""} ${member._sectionTitle || ""}`)
  ];
  const used = new Set();
  const sections = titleMap.map((title, index) => {
    const members = allMembers.filter((member, memberIndex) => {
      if (used.has(memberIndex) || !roleTests[index](member)) return false;
      used.add(memberIndex);
      return true;
    }).map(({ _sectionTitle, ...member }) => member);
    return { title, members };
  });
  const remaining = allMembers.filter((_, index) => !used.has(index)).map(({ _sectionTitle, ...member }) => member);
  if (remaining.length) {
    const visitingIndex = sections.length - 1;
    sections[visitingIndex].members = [...remaining, ...sections[visitingIndex].members];
  }
  return sections;
}

init();
