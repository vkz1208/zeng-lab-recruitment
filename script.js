const PASSWORD = "zenglab2026";
const STORAGE_KEY = "zeng-lab-full-site-data-v6";
const PAGE_SIZE = 10;
const app = document.querySelector("#app");

let siteData = structuredClone(window.DEFAULT_SITE_DATA);
let lang = localStorage.getItem("zeng-lab-lang") || "zh";
let paperTab = "featured";
let paperYear = "all";
let paperTag = "all";
let newsYear = "all";
let teamTab = "current";
let paperPage = 1;
let newsPage = 1;

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

function linkAttrs(href = "") {
  const external = /^https?:\/\//.test(href);
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
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);
  return `
    <nav class="pagination" data-pagination="${esc(name)}" aria-label="${esc(name)} pagination">
      <span>${lang === "zh" ? `共 ${totalItems} 条` : `${totalItems} items`}</span>
      <div>
        <button type="button" data-page="${page - 1}" ${page <= 1 ? "disabled" : ""}>${lang === "zh" ? "上一页" : "Prev"}</button>
        ${pages.map((item) => `<button type="button" data-page="${item}" class="${item === page ? "active" : ""}">${item}</button>`).join("")}
        <button type="button" data-page="${page + 1}" ${page >= totalPages ? "disabled" : ""}>${lang === "zh" ? "下一页" : "Next"}</button>
      </div>
    </nav>
  `;
}

function hrefToRoute(href = "") {
  if (/^(https?:|mailto:|#)/.test(href)) return href;
  const base = document.querySelector("base") ? "../" : "";
  const clean = href.replace(/^\//, "");
  return base + (clean ? `${clean}/` : "");
}

function routeFromPath() {
  const path = location.pathname.replace(/\/+$/, "") || "/";
  const last = path.split("/").filter(Boolean).pop();
  if (!last || last === "zzz" || last === "zeng-lab-recruitment") return "home";
  if (last === "admin") return "admin";
  return ["team", "papers", "research", "resources", "news", "join"].includes(last) ? last : "home";
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
    const res = await fetch("/api/content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    if (patch[key] && typeof patch[key] === "object" && !Array.isArray(patch[key])) {
      base[key] = mergeData(base[key] || {}, patch[key]);
    } else {
      base[key] = patch[key];
    }
  }
  return base;
}

function pageHero(title, intro) {
  return `
    <section class="page-hero">
      <div class="main-container">
        <p class="eyebrow">${esc(data().meta.labName)}</p>
        <h1>${esc(title)}</h1>
        <p>${esc(intro)}</p>
      </div>
    </section>
  `;
}

function data() {
  return siteData[lang] || siteData.zh;
}

function isHomeRepresentativePaper(paper) {
  return Boolean(paper.homeFeatured);
}

function renderShell(content) {
  const d = data();
  const f = d.footer || d.contact || {};
  app.innerHTML = `
    <header class="site-header">
      <a class="brand" href="${hrefToRoute("/")}">
        <span class="brand-mark"><img src="assets/branding/lab-logo.png" alt="${esc(d.meta.labName)}" /></span>
        <span><strong>${esc(d.meta.labName)}</strong><small>${esc(d.meta.labNameEn)}</small></span>
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
          ${(f.links || []).map((l) => `<a href="${esc(l.href)}" target="_blank" rel="noopener">${esc(l.text)}</a>`).join("")}
        </div>
      </div>
      <div class="footer-bottom">
        <span>${esc(f.funding || "")}</span>
        <a href="${hrefToRoute("/admin")}">Admin</a>
      </div>
    </footer>
  `;

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
  const featuredPapers = (d.papers?.items || []).filter(isHomeRepresentativePaper);
  renderShell(`
    <section class="hero">
      ${cardImage(h.heroImage, "AI for Climate", "hero", "hero-bg")}
      <div class="hero-overlay"></div>
      <div class="hero-inner main-container">
        <div class="hero-lab-name">
          <div class="hero-school-lockup">
            <img class="school-lockup-logo" src="${lang === "zh" ? "assets/branding/sustech-lockup-cn-en-crop.png" : "assets/branding/sustech-lockup-en-crop.png"}" alt="Southern University of Science and Technology" />
          </div>
        </div>
        <p class="eyebrow">${esc(h.eyebrow)}</p>
        <h1>${esc(h.title)}</h1>
        <p class="hero-copy">${esc(h.copy)}</p>
        <div class="hero-actions">
          <a class="button primary" href="${hrefToRoute(h.primary.href)}">${esc(h.primary.text)}</a>
          <a class="button secondary" href="${hrefToRoute(h.secondary.href)}">${esc(h.secondary.text)}</a>
        </div>
        <div class="hero-stats">${h.stats.map((s) => `<div><strong>${esc(s.value)}</strong><span>${esc(s.label)}</span></div>`).join("")}</div>
      </div>
    </section>
    <section class="split band">
      <div>
        <p class="section-kicker">${esc(d.meta.labNameEn)}</p>
        <h2>${esc(h.featureTitle)}</h2>
      </div>
      <p>${esc(h.featureCopy)}</p>
    </section>
    <section class="media-section">
      ${cardImage(h.teamImage, "Team photo", "wide")}
      <div class="card-grid three research-preview-grid">${homeDirections.map((x) => `
        <article class="research-preview-card">
          ${cardImage(x.image, x.title, "research")}
          <div>
            <h3>${esc(x.title)}</h3>
            <p>${esc(x.copy)}</p>
          </div>
        </article>
      `).join("")}</div>
    </section>
    <section class="featured-papers-section band">
      <div class="section-head">
        <p class="section-kicker">${lang === "zh" ? "精选论文" : "Selected Papers"}</p>
        <h2>${lang === "zh" ? "正刊 Nature 与 Science 代表作" : "Representative Papers in Nature and Science"}</h2>
      </div>
      <div class="home-paper-grid">
        ${featuredPapers.map((paper) => `
          <a class="home-paper-card" href="${paper.link ? esc(paper.link) : "#"}" ${linkAttrs(paper.link)}>
            <span>${esc(paper.year)} · ${esc(paper.journal)}</span>
            <strong>${esc(paper.title)}</strong>
            <p>${esc(paper.authors)}</p>
          </a>
        `).join("")}
      </div>
    </section>
  `);
}

function memberCard(m) {
  m = enrichedMember(m);
  const image = cardImage(m.image, m.name, "avatar") || avatarFallback(m.name);
  return `
    <article class="member-card">
      ${image}
      <div>
        <h3>${esc(m.name)} <span>${esc(m.cn || "")}</span></h3>
        <p class="role">${esc(m.role || "")}</p>
        ${m.started ? `<p>${esc(m.started)}</p>` : ""}
        ${m.destination ? `<p class="destination">${lang === "zh" ? "去向：" : "Destination: "}${esc(m.destination)}</p>` : ""}
        ${m.bio ? `<p>${esc(m.bio)}</p>` : ""}
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
  return `
    <article class="pi-card">
      <div class="pi-photo">
        ${cardImage(pi.image, pi.name, "avatar") || avatarFallback(pi.name)}
      </div>
      <div class="pi-body">
        <h2>${esc(primaryName)} <span>${esc(secondaryName || "")}</span></h2>
        <p class="role">${esc(pi.role || "")}</p>
        <p>${esc(pi.bio || "")}</p>
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
          ${(pi.links || []).map((l) => `<a href="${esc(l.href)}" target="_blank" rel="noopener">${esc(l.text)}</a>`).join("")}
        </div>
      </div>
    </article>
  `;
}

function renderTeam() {
  const t = data().team;
  const pi = t.pi || t.sections?.[0]?.members?.[0] || {};
  const sections = (t.sections || []).filter((section, index) => index !== 0);
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
    ${pageHero(t.title, t.intro)}
    <section class="content-section compact-section">
      <div class="tab-strip" data-filter="team-tab">
        <button type="button" data-value="current" class="${teamTab === "current" ? "active" : ""}">Current</button>
        <button type="button" data-value="alumni" class="${teamTab === "alumni" ? "active" : ""}">Alumni</button>
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
  const items = p.items || [];
  const years = [...new Set(items.map((paper) => yearOf(paper.year)).filter(Boolean))].sort((a, b) => b.localeCompare(a));
  const tags = [...new Set(items.flatMap((paper) => paper.tags || []))].sort();
  const filtered = items.filter((paper) => {
    const matchesTab = paperTab === "all" || paper.featured;
    const matchesYear = paperYear === "all" || yearOf(paper.year) === paperYear;
    const matchesTag = paperTag === "all" || (paper.tags || []).includes(paperTag);
    return matchesTab && matchesYear && matchesTag;
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  paperPage = Math.min(Math.max(1, paperPage), totalPages);
  const pageItems = filtered.slice((paperPage - 1) * PAGE_SIZE, paperPage * PAGE_SIZE);
  renderShell(`
    ${pageHero(p.title, p.intro)}
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
        ${pageItems.map((paper) => `
          <a class="paper-row" href="${paper.link ? esc(paper.link) : "#"}" ${linkAttrs(paper.link)}>
            <span>${esc(paper.year)}</span>
            <div>
              <strong>${esc(paper.title)}</strong>
              <p>${esc(paper.authors)} · ${esc(paper.journal)}</p>
              ${(paper.tags || []).length ? `<div class="tag-list">${paper.tags.map((tag) => `<em>${esc(tag)}</em>`).join("")}</div>` : ""}
            </div>
          </a>
        `).join("")}
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
    ${pageHero(r.title, r.intro)}
    <section class="content-section">
      <div class="section-head"><h2>${lang === "zh" ? "研究方向" : "Research Directions"}</h2></div>
      <div class="card-grid direction-grid">${r.directions.map((x) => `<article><h3>${esc(x.title)}</h3><p>${esc(x.copy)}</p></article>`).join("")}</div>
    </section>
    <section class="content-section band">
      <div class="section-head">
        <h2>${lang === "zh" ? "开放数据与代码资源" : "Open Data & Code Resources"}</h2>
        <p>${esc(d.resources?.intro || "")}</p>
      </div>
      <div class="resource-grid merged">
        ${resources.map((item) => `
          <a class="resource-card" href="${esc(item.link || "#")}" ${linkAttrs(item.link)}>
            ${cardImage(item.image, item.title, "resource")}
            <div>
              <h3>${esc(item.title)}</h3>
              <p>${esc(item.copy)}</p>
            </div>
          </a>
        `).join("")}
      </div>
    </section>
  `);
}

function renderNews() {
  const n = data().news;
  const items = n.items || [];
  const years = [...new Set(items.map((item) => yearOf(item.date)).filter(Boolean))].sort((a, b) => b.localeCompare(a));
  const filtered = items.filter((item) => newsYear === "all" || yearOf(item.date) === newsYear);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  newsPage = Math.min(Math.max(1, newsPage), totalPages);
  const pageItems = filtered.slice((newsPage - 1) * PAGE_SIZE, newsPage * PAGE_SIZE);
  renderShell(`
    ${pageHero(n.title, n.intro)}
    <section class="content-section">
      <div class="filter-panel news-filter">
        <div class="filter-block">
          <span>${lang === "zh" ? "年份" : "Year"}</span>
          ${chipGroup("news-year", years, newsYear, n.filterLabels?.allYears || "All years")}
        </div>
      </div>
      <div class="paper-list news-list">
        ${pageItems.map((item) => `
        <a class="${item.image ? "news-card" : "paper-row news-row"}" href="${hrefToRoute(item.link || "#")}" ${linkAttrs(item.link)}>
          ${cardImage(item.image, item.title, "news") || `<span>${esc(item.date)}</span>`}
          <div>
            ${item.image ? `<span>${esc(item.date)}</span>` : ""}
            <strong>${esc(item.title)}</strong>
            <p>${esc(item.copy)}</p>
          </div>
        </a>
      `).join("")}
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
    ${pageHero(r.title, r.intro)}
    <section class="content-section">
      <div class="resource-grid">
        ${r.items.map((item) => `
          <a class="resource-card" href="${esc(item.link || "#")}" ${linkAttrs(item.link)}>
            ${cardImage(item.image, item.title, "resource")}
            <div>
              <h3>${esc(item.title)}</h3>
              <p>${esc(item.copy)}</p>
            </div>
          </a>
        `).join("")}
      </div>
    </section>
  `);
}

function renderJoin() {
  const j = data().join;
  renderShell(`
    ${pageHero(j.title, j.intro)}
    <section class="join-page">
      ${cardImage(j.image, "Team", "wide")}
      <div>
        <h2>AI for Climate</h2>
        <p>${esc(j.body)}</p>
        <div class="card-grid">${j.benefits.map((x) => `<article><h3>${esc(x.title)}</h3><p>${esc(x.copy)}</p></article>`).join("")}</div>
        <h2 class="compact-title">${lang === "zh" ? "开放岗位" : "Open Positions"}</h2>
        <div class="card-grid">${(j.openings || []).map((x) => `<article><h3>${esc(x.title)}</h3><p>${esc(x.copy)}</p></article>`).join("")}</div>
        <h2 class="compact-title">${lang === "zh" ? "申请材料" : "Application Materials"}</h2>
        <ul class="material-list">${(j.materials || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
        <a class="button primary wide" href="${esc(j.contact.href)}">${esc(j.contact.text)}</a>
      </div>
    </section>
  `);
}

function renderContact() {
  const c = data().contact;
  renderShell(`
    ${pageHero(c.title, c.intro)}
    <section class="contact-section">
      <a class="button primary wide" href="${esc(c.email.href)}">${esc(c.email.text)}</a>
      ${c.links.map((l) => `<a href="${esc(l.href)}" target="_blank" rel="noopener">${esc(l.text)}</a>`).join("")}
    </section>
  `);
}

function pathSet(obj, path, value) {
  const parts = path.split(".");
  let cursor = obj;
  while (parts.length > 1) {
    const key = parts.shift();
    cursor[key] = cursor[key] || {};
    cursor = cursor[key];
  }
  cursor[parts[0]] = value;
}

function pathGet(obj, path) {
  return path.split(".").reduce((cursor, key) => cursor?.[key], obj);
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

function renderAdmin() {
  const ok = sessionStorage.getItem("zeng-admin-ok") === "1" || prompt("请输入管理密码") === PASSWORD;
  if (!ok) {
    alert("密码错误");
    location.href = hrefToRoute("/");
    return;
  }
  sessionStorage.setItem("zeng-admin-ok", "1");
  app.innerHTML = `
    <main class="admin-page">
      <section class="admin-top">
        <div>
          <p class="eyebrow">Admin</p>
          <h1>网站编辑模式</h1>
          <p>可编辑文字、图片路径、链接，并对团队、论文、新闻、研究方向等卡片进行添加或删除。保存后本地服务器会写入 content.json；静态部署会保存到当前浏览器。</p>
        </div>
        <a class="button secondary" href="${hrefToRoute("/")}">返回网站</a>
      </section>
      <section class="admin-panel">
        <div class="admin-actions sticky">
          <button id="save-admin" class="save" type="button">保存生效</button>
          <button id="reset-admin" type="button">恢复默认</button>
        </div>
        ${renderEditor(siteData, "root")}
      </section>
    </main>
  `;

  document.querySelectorAll("[data-upload]").forEach((input) => {
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) return;
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
    });
  });

  document.querySelectorAll("[data-add]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      const arr = pathGet(siteData, button.dataset.add.replace(/^root\./, ""));
      const sample = arr[0] ? structuredClone(arr[0]) : { title: "新卡片", copy: "请编辑内容", link: "" };
      arr.push(sample);
      renderAdmin();
    });
  });

  document.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      const arr = pathGet(siteData, button.dataset.delete.replace(/^root\./, ""));
      arr.splice(Number(button.dataset.index), 1);
      renderAdmin();
    });
  });

  $("#save-admin").addEventListener("click", async () => {
    document.querySelectorAll("[data-field]").forEach((field) => pathSet(siteData, field.dataset.field.replace(/^root\./, ""), field.value));
    const saved = await saveServerData(siteData);
    localStorage.setItem(STORAGE_KEY, saved ? "" : JSON.stringify(siteData));
    alert(saved ? "已保存到 content.json。" : "已保存到当前浏览器。静态部署如需全站同步，需要后端存储。");
  });

  $("#reset-admin").addEventListener("click", async () => {
    if (!confirm("确定恢复默认内容？")) return;
    siteData = structuredClone(window.DEFAULT_SITE_DATA);
    localStorage.removeItem(STORAGE_KEY);
    await saveServerData({});
    renderAdmin();
  });
}

function render() {
  const route = routeFromPath();
  if (route === "admin") return renderAdmin();
  const map = { home: renderHome, team: renderTeam, papers: renderPapers, research: renderResearch, resources: renderResources, news: renderNews, join: renderJoin };
  map[route]();
}

async function init() {
  if (Array.isArray(window.PAPER_LIST) && window.PAPER_LIST.length) {
    siteData.zh.papers.items = window.PAPER_LIST;
    siteData.en.papers.items = window.PAPER_LIST;
  }
  const serverData = await getServerData();
  const localData = localStorage.getItem(STORAGE_KEY);
  mergeData(siteData, serverData);
  if (localData) mergeData(siteData, JSON.parse(localData));
  normalizeTeamData();
  applyTeamRoleOrder();
  render();
}

init();
