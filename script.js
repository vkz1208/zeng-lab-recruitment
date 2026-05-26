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
      "已出站博士后",
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
  "大总管": "Lab Manager",
  "教师": "Faculty",
  "博士后": "Postdoctoral Researcher",
  "在读博士": "PhD Student",
  "在读硕士": "Master Student",
  "在读本科生": "Undergraduate Student",
  "科研教学助理": "Research and Teaching Assistant",
  "访问学者": "Visiting Scholar",
  "访问学生": "Visiting Student",
  "已出站博士后": "Former Postdoctoral Fellow",
  "已毕业博士": "PhD Alumni",
  "已毕业硕士": "Master Alumni",
  "已毕业本科生": "Undergraduate Alumni",
  "已离职科研助理": "Former Research Assistant",
  "历史访问人员": "Former Visitor"
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
  if (!shouldApplyDefaultTeamOrder) return;
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

function memberCard(m, basePath = "") {
  m = enrichedMember(m);
  const image = editableImage(m.image, basePath ? `${basePath}.image` : "", m.name, "avatar") || avatarFallback(m.name);
  return `
      <article class="member-card">
      ${adminGroupButton(basePath, m.name)}
      ${adminDeleteButton(basePath, m.name)}
      ${adminMoveButtons(basePath, m.name)}
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

function memberBasePath(member, collectionPath, sections = []) {
  if (Number.isInteger(member?._sourceSectionIndex) && Number.isInteger(member?._sourceMemberIndex)) {
    return `${collectionPath}.${member._sourceSectionIndex}.members.${member._sourceMemberIndex}`;
  }
  for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex += 1) {
    const memberIndex = (sections[sectionIndex].members || []).findIndex((candidate) => {
      return (candidate.email && candidate.email === member.email)
        || (candidate.name && candidate.name === member.name && (candidate.cn || "") === (member.cn || ""));
    });
    if (memberIndex >= 0) return `${collectionPath}.${sectionIndex}.members.${memberIndex}`;
  }
  return "";
}

function firstMemberCollectionPath(section, fallbackPath) {
  const first = section?.members?.[0];
  if (Number.isInteger(first?._sourceSectionIndex)) {
    return `root.${lang}.team.sections.${first._sourceSectionIndex}.members`;
  }
  return fallbackPath;
}

function normalizeAlumniSections(rawSections = [], langKey = "zh") {
  return rawSections.map((section, sectionIndex) => ({
    title: section.title,
    members: (section.members || []).map((member, memberIndex) => ({
      ...member,
      _sourceSectionIndex: sectionIndex,
      _sourceMemberIndex: memberIndex
    }))
  })).filter((section) => section.members.length);
}

function preserveCurrentTeamSections(rawSections = []) {
  return rawSections
    .map((section, sectionIndex) => ({ section, sectionIndex }))
    .filter(({ section, sectionIndex }) => sectionIndex !== 0 && (section.members || []).length)
    .map(({ section, sectionIndex }) => ({
      title: section.title,
      members: (section.members || []).map((member, memberIndex) => ({
        ...member,
        _sourceSectionIndex: sectionIndex,
        _sourceMemberIndex: memberIndex
      }))
    }));
}

function piCard(pi) {
  pi = enrichedMember(pi);
  const primaryName = lang === "zh" ? (pi.cn || pi.name) : pi.name;
  const secondaryName = lang === "zh" ? pi.name : pi.cn;
  const basePath = `root.${lang}.team.pi`;
  return `
    <article class="pi-card">
      ${adminGroupButton(basePath, primaryName)}
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
  const sections = shouldApplyDefaultTeamOrder
    ? normalizeCurrentTeamSections(t.sections || [], lang)
    : preserveCurrentTeamSections(t.sections || []);
  const alumniSections = normalizeAlumniSections(t.alumniSections || [], lang);
  const teamAddPath = teamTab === "alumni" ? `root.${lang}.team.alumniSections.0.members` : `root.${lang}.team.sections.1.members`;
  const currentContent = `
    <section class="content-section">
      <div class="section-head"><h2>${lang === "zh" ? "负责人" : "Principal Investigator"}</h2></div>
      ${piCard(pi)}
    </section>
    ${sections.map((section) => `
      <section class="content-section">
        <div class="section-head"><h2>${esc(section.title)}</h2></div>
        <div class="member-grid">${section.members.map((member) => memberCard(member, memberBasePath(member, `root.${lang}.team.sections`, t.sections || []))).join("")}</div>
      </section>
    `).join("")}
  `;
  const alumniContent = alumniSections.length ? `
    <section class="content-section alumni-section">
      <div class="section-head"><h2>${lang === "zh" ? "已毕业成员" : "Alumni"}</h2></div>
      ${alumniSections.map((section) => `
        <div class="alumni-group">
          <h3>${esc(section.title)}</h3>
          <div class="member-grid">${section.members.map((member) => memberCard(member, memberBasePath(member, `root.${lang}.team.alumniSections`, t.alumniSections || []))).join("")}</div>
        </div>
      `).join("")}
    </section>
  ` : "";
  renderShell(`
    ${pageHero(t.title, t.intro, `root.${lang}.team.title`, `root.${lang}.team.intro`, `root.${lang}.team`)}
    <section class="content-section compact-section">
      <div class="tab-strip" data-filter="team-tab">
        <button type="button" data-value="current" class="${teamTab === "current" ? "active" : ""}">${lang === "zh" ? "当前成员" : "Current"}</button>
        <button type="button" data-value="alumni" class="${teamTab === "alumni" ? "active" : ""}">${lang === "zh" ? "已毕业成员" : "Alumni"}</button>
      </div>
      <div class="admin-section-actions">${adminAddButton(teamAddPath, "teamMember", lang === "zh" ? "新增团队成员" : "Add member")}</div>
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

function normalizeCurrentTeamSections(rawSections = [], langKey = "zh") {
  const source = rawSections.filter((section, index) => index !== 0);
  const allMembers = source.flatMap((section) => (section.members || []).map((member) => ({
    ...member,
    _sectionTitle: section.title,
    _sourceSectionIndex: rawSections.indexOf(section),
    _sourceMemberIndex: (section.members || []).indexOf(member)
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
