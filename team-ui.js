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
