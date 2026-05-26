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

function pathDelete(obj, path) {
  const parts = path.split(".");
  const key = parts.pop();
  const parent = parts.reduce((cursor, part) => BLOCKED_MERGE_KEYS.has(part) ? undefined : cursor?.[part], obj);
  if (!parent || BLOCKED_MERGE_KEYS.has(key)) return false;
  if (Array.isArray(parent) && /^\d+$/.test(key)) {
    parent.splice(Number(key), 1);
    return true;
  }
  if (Object.prototype.hasOwnProperty.call(parent, key)) {
    delete parent[key];
    return true;
  }
  return false;
}

function pathMove(obj, path, direction) {
  const parts = path.split(".");
  const key = parts.pop();
  const parent = parts.reduce((cursor, part) => BLOCKED_MERGE_KEYS.has(part) ? undefined : cursor?.[part], obj);
  if (!Array.isArray(parent) || !/^\d+$/.test(key)) return false;
  const from = Number(key);
  const to = from + Number(direction);
  if (from < 0 || from >= parent.length || to < 0 || to >= parent.length) return false;
  const [item] = parent.splice(from, 1);
  parent.splice(to, 0, item);
  return true;
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
    news: lang === "zh" ? "新闻" : "News",
    join: lang === "zh" ? "加入我们" : "Join",
    contact: lang === "zh" ? "联系" : "Contact",
    settings: lang === "zh" ? "设置" : "Settings"
  };
  const fixed = ["home", "team", "papers", "research", "news", "join", "contact", "settings"]
    .map((route) => ({ value: route, label: labels[route] }));
  const dynamic = dynamicPages().map((page) => ({ value: `page:${page.slug}`, label: page.title }));
  return [...fixed, ...dynamic]
    .map((item) => `<option value="${esc(item.value)}" ${adminPreviewRoute === item.value ? "selected" : ""}>${esc(item.label)}</option>`)
    .join("");
}

function routeFromAdminHref(href = "") {
  const clean = href.replace(/^\.?\//, "").replace(/\/+$/, "");
  if (!clean || clean === "#") return "home";
  if (["team", "papers", "research", "news", "join", "contact"].includes(clean)) return clean;
  return findDynamicPage(clean) ? `page:${clean}` : "";
}

function injectAdminChrome() {
  app.insertAdjacentHTML("beforeend", `
    <div class="admin-preview-toolbar" role="region" aria-label="Admin preview controls">
      <strong>${lang === "zh" ? "所见即所得编辑" : "Visual Editor"}</strong>
      <label>
        <span>${lang === "zh" ? "预览页面" : "Preview"}</span>
        <select id="admin-page-select">${adminRouteOptions()}</select>
      </label>
      <button id="save-admin" class="save" type="button">${lang === "zh" ? "保存生效" : "Save"}</button>
      <button id="reset-admin" type="button">${lang === "zh" ? "恢复默认" : "Reset"}</button>
      <button id="admin-panel-toggle" type="button">${lang === "zh" ? "字段面板" : "Fields"}</button>
      <a class="button secondary" href="${hrefToRoute("/")}">${lang === "zh" ? "退出后台" : "Exit"}</a>
    </div>
    <aside class="admin-dock ${adminPanelOpen ? "open" : ""}" id="admin-dock">
      <div class="admin-dock-head">
        <div>
          <p class="eyebrow">Structured editor</p>
          <h2>${lang === "zh" ? "字段面板" : "Field Panel"}</h2>
        </div>
        <button id="admin-dock-close" type="button" aria-label="Close">×</button>
      </div>
      <p class="admin-dock-note">${lang === "zh" ? "用于批量编辑结构化字段；页面上的按钮用于所见即所得编辑。" : "Use this panel for structured field edits; use on-page buttons for visual editing."}</p>
      <div class="admin-panel">${renderEditor(siteData, "root")}</div>
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
  installAdminHandlers();
}

function installAdminHandlers() {
  $("#admin-panel-toggle")?.addEventListener("click", () => {
    adminPanelOpen = !adminPanelOpen;
    $("#admin-dock")?.classList.toggle("open", adminPanelOpen);
  });
  $("#admin-dock-close")?.addEventListener("click", () => {
    adminPanelOpen = false;
    $("#admin-dock")?.classList.remove("open");
  });

  $("#admin-page-select")?.addEventListener("change", (event) => {
    syncAdminFields();
    adminPreviewRoute = event.target.value;
    sessionStorage.setItem("zeng-admin-preview-route", adminPreviewRoute);
    renderAdminPreview();
  });

  document.querySelectorAll("[data-inline-edit]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openInlineEditor(button.dataset.inlineEdit, button.dataset.editType || "text");
    });
  });

  document.querySelectorAll("[data-inline-add]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openAddEditor(button.dataset.inlineAdd, button.dataset.addType || "item");
    });
  });

  document.querySelectorAll("[data-inline-delete]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      deleteInlineItem(button.dataset.inlineDelete);
    });
  });

  document.querySelectorAll("[data-inline-move]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      moveInlineItem(button.dataset.inlineMove, button.dataset.direction);
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
    const result = await saveServerData(siteData);
    if (result.ok) {
      localStorage.removeItem(STORAGE_KEY);
      const message = result.mode === "legacy"
        ? (lang === "zh" ? "\u5df2\u4fdd\u5b58\uff1a\u5df2\u901a\u8fc7\u5355\u7ad9\u70b9\u540e\u53f0\u4fdd\u5b58\u5230\u7ebf\u4e0a\u5b58\u50a8\u3002" : "Saved through the single-site admin backend.")
        : (lang === "zh" ? "\u5df2\u4fdd\u5b58\u5230\u79df\u6237\u7ebf\u4e0a\u5b58\u50a8\u3002" : "Saved to tenant online storage.");
      alert(message);
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(siteData));
    alert(saveFailureMessage(result));
  });

  $("#reset-admin")?.addEventListener("click", async () => {
    if (!confirm("确定恢复默认内容？")) return;
    siteData = {
      zh: structuredClone(window.DEFAULT_SITE_DATA.zh),
      en: structuredClone(window.DEFAULT_SITE_DATA.en)
    };
    localStorage.removeItem(STORAGE_KEY);
    const result = await saveServerData({});
    if (!result.ok) localStorage.setItem(STORAGE_KEY, JSON.stringify(siteData));
    renderAdminPreview();
  });
}

function closeInlineEditor() {
  $("#inline-edit-modal")?.setAttribute("hidden", "");
}

function isPlainEditableObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function collectGroupFields(value, basePath, depth = 0) {
  if (!isPlainEditableObject(value) || depth > 3) return [];
  return Object.entries(value).flatMap(([key, child]) => {
    if (BLOCKED_MERGE_KEYS.has(key)) return [];
    const path = `${basePath}.${key}`;
    if (Array.isArray(child)) {
      return child.every((item) => item == null || ["string", "number", "boolean"].includes(typeof item))
        ? [{ path, key, value: child.join(", ") }]
        : [];
    }
    if (isPlainEditableObject(child)) return collectGroupFields(child, path, depth + 1);
    return [{ path, key, value: child }];
  });
}

function fieldLabel(path) {
  return adminFieldLabel(path);
}

const ADMIN_FIELD_LABELS = {
  zh: {
    title: "标题",
    intro: "页面简介",
    copy: "正文",
    body: "正文",
    name: "英文名",
    cn: "中文名",
    role: "角色",
    started: "入组/去向信息",
    destination: "去向",
    bio: "简介",
    image: "图片",
    heroImage: "首页大图",
    teamImage: "团队图片",
    email: "邮箱",
    link: "链接",
    href: "链接",
    text: "显示文字",
    year: "年份",
    journal: "期刊",
    authors: "作者",
    tags: "标签",
    date: "日期",
    featured: "是否精选论文",
    homeFeatured: "是否首页展示",
    eyebrow: "眉标题",
    featureTitle: "特色标题",
    featureCopy: "特色正文",
    value: "数值",
    label: "标签"
  },
  en: {
    title: "Title",
    intro: "Page intro",
    copy: "Body",
    body: "Body",
    name: "English name",
    cn: "Chinese name",
    role: "Role",
    started: "Start / destination",
    destination: "Destination",
    bio: "Bio",
    image: "Image",
    heroImage: "Hero image",
    teamImage: "Team image",
    email: "Email",
    link: "Link",
    href: "Link",
    text: "Display text",
    year: "Year",
    journal: "Journal",
    authors: "Authors",
    tags: "Tags",
    date: "Date",
    featured: "Featured paper",
    homeFeatured: "Show on home",
    eyebrow: "Eyebrow",
    featureTitle: "Feature title",
    featureCopy: "Feature body",
    value: "Value",
    label: "Label"
  }
};

const TEAM_ROLE_OPTIONS = {
  zh: [
    "大总管",
    "教师",
    "博士后",
    "在读博士",
    "在读硕士",
    "在读本科生",
    "科研教学助理",
    "访问学者",
    "访问学生",
    "已出站博士后",
    "已毕业博士",
    "已毕业硕士",
    "已毕业本科生",
    "已离职科研助理",
    "历史访问人员"
  ],
  en: [
    "Lab Manager",
    "Faculty",
    "Postdoctoral Researcher",
    "PhD Student",
    "Master Student",
    "Undergraduate Student",
    "Research and Teaching Assistant",
    "Visiting Scholar",
    "Visiting Student",
    "Former Postdoctoral Fellow",
    "PhD Alumni",
    "Master Alumni",
    "Undergraduate Alumni",
    "Former Research Assistant",
    "Former Visitor"
  ]
};

function adminFieldLabel(path) {
  const key = path.replace(/^root\./, "").split(".").pop();
  return ADMIN_FIELD_LABELS[lang]?.[key] || key;
}

function isTeamRoleField(path = "") {
  return /\.team\.(sections|alumniSections)\.\d+\.members\.\d+\.role$/.test(path)
    || /\.team\.(sections|alumniSections)\.\d+\.members\.role$/.test(path)
    || /\.team\.(sections|alumniSections)\.members\.role$/.test(path);
}

function roleSelect(path, value = "") {
  const options = TEAM_ROLE_OPTIONS[lang] || TEAM_ROLE_OPTIONS.zh;
  const selected = String(value || "");
  const extra = selected && !options.includes(selected) ? [selected] : [];
  return `
    <select data-inline-field="${esc(path)}">
      ${[...extra, ...options].map((role) => `<option value="${esc(role)}" ${role === selected ? "selected" : ""}>${esc(role)}</option>`).join("")}
    </select>
  `;
}

function groupFieldControl(field) {
  const value = field.value;
  const path = field.path;
  if (isTeamRoleField(path)) {
    return `
      <label class="inline-edit-field">
        <span>${esc(fieldLabel(path))}</span>
        ${roleSelect(path, value)}
      </label>
    `;
  }
  if (typeof value === "boolean") {
    return `
      <label class="inline-edit-field inline-edit-field--checkbox">
        <span>${esc(fieldLabel(path))}</span>
        <input data-inline-field="${esc(path)}" type="checkbox" ${value ? "checked" : ""} />
      </label>
    `;
  }
  const stringValue = value == null ? "" : String(value);
  const long = /title|intro|copy|body|bio|abstract|description/i.test(path) || stringValue.length > 80;
  const mediaUpload = isImageField(path) ? `
    <label class="inline-edit-field inline-edit-field--upload">
      <span>${lang === "zh" ? "上传图片" : "Upload image"}</span>
      <input data-inline-file="${esc(path)}" type="file" accept="image/*" />
    </label>
  ` : "";
  return `
    <label class="inline-edit-field">
      <span>${esc(fieldLabel(path))}</span>
      ${long ? `<textarea data-inline-field="${esc(path)}">${esc(stringValue)}</textarea>` : `<input data-inline-field="${esc(path)}" value="${esc(stringValue)}" />`}
    </label>
    ${mediaUpload}
  `;
}

function groupEditorControl(path, value) {
  const fields = collectGroupFields(value, path);
  if (!fields.length) {
    return `<p class="inline-edit-empty">${lang === "zh" ? "这一组没有可直接编辑的文本、图片或开关字段。" : "This group has no directly editable text, image, or toggle fields."}</p>`;
  }
  return `
    <div class="inline-edit-grid">
      ${fields.map(groupFieldControl).join("")}
    </div>
    <p class="inline-edit-hint">${lang === "zh" ? "列表的新增、删除和排序请使用卡片上的按钮；复杂子列表暂不在此弹窗中编辑。" : "Use the card buttons to add, delete, and reorder list items. Complex nested lists are not edited in this dialog yet."}</p>
  `;
}

function blankItem(type) {
  const year = String(new Date().getFullYear());
  const templates = {
    paper: {
      year,
      title: "",
      authors: "",
      journal: "",
      tags: "",
      link: "",
      featured: false,
      homeFeatured: false
    },
    news: {
      date: new Date().toISOString().slice(0, 10),
      title: "",
      copy: "",
      image: "",
      link: ""
    },
    resource: {
      title: "",
      copy: "",
      image: "",
      link: ""
    },
    researchDirection: {
      title: "",
      copy: "",
      image: ""
    },
    dynamicText: {
      type: "text",
      title: "",
      copy: ""
    },
    dynamicPage: {
      slug: "new-page",
      title: "New page",
      intro: "",
      enabled: true,
      order: dynamicPages().length + 1,
      modules: [{ type: "text", title: "", copy: "" }]
    },
    teamMember: {
      name: "",
      cn: "",
      role: lang === "zh" ? "在读博士" : "PhD Student",
      started: "",
      destination: "",
      bio: "",
      image: "",
      email: ""
    }
  };
  return structuredClone(templates[type] || templates.resource);
}

function normalizeAddedItem(type, item) {
  if (type === "paper") {
    return {
      ...item,
      tags: typeof item.tags === "string"
        ? item.tags.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean)
        : (item.tags || [])
    };
  }
  return item;
}

function normalizeInlineValue(path, value, field) {
  if (/\.tags$/.test(path)) {
    return String(value || "").split(/[,，]/).map((tag) => tag.trim()).filter(Boolean);
  }
  return field?.type === "checkbox" ? Boolean(value) : value;
}

function openAddEditor(path, type = "item") {
  syncAdminFields();
  const cleanPath = path.replace(/^root\./, "");
  const value = blankItem(type);
  const modal = $("#inline-edit-modal");
  const body = $("#inline-edit-body");
  if (!modal || !body) return;
  modal.removeAttribute("hidden");
  modal.dataset.path = cleanPath;
  modal.dataset.type = "add";
  modal.dataset.addType = type;
  $("#inline-edit-title").textContent = lang === "zh" ? "新增卡片" : "Add Card";
  body.innerHTML = groupEditorControl(path, value);

  document.querySelectorAll("[data-inline-file]").forEach((input) => {
    input.addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith("image/") || file.size > 2 * 1024 * 1024) {
        alert("请选择 2MB 以内的图片文件。");
        input.value = "";
        return;
      }
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        const field = $(`[data-inline-field="${CSS.escape(input.dataset.inlineFile)}"]`);
        if (field) field.value = reader.result;
      });
      reader.readAsDataURL(file);
    });
  });

  document.querySelectorAll("[data-inline-close]").forEach((button) => {
    button.addEventListener("click", closeInlineEditor, { once: true });
  });

  $("#inline-edit-form").onsubmit = (event) => {
    event.preventDefault();
    const nextItem = {};
    document.querySelectorAll("[data-inline-field]").forEach((field) => {
      const key = field.dataset.inlineField.split(".").pop();
      nextItem[key] = normalizeInlineValue(field.dataset.inlineField, field.type === "checkbox" ? field.checked : field.value, field);
    });
    const collection = pathGet(siteData, cleanPath);
    if (Array.isArray(collection)) {
      collection.unshift(normalizeAddedItem(type, nextItem));
    }
    closeInlineEditor();
    paperPage = 1;
    newsPage = 1;
    renderAdminPreview();
  };
}

function deleteInlineItem(path) {
  if (!path) return;
  syncAdminFields();
  const label = lang === "zh" ? "确定删除这张卡片吗？" : "Delete this card?";
  if (!confirm(label)) return;
  pathDelete(siteData, path.replace(/^root\./, ""));
  closeInlineEditor();
  paperPage = 1;
  newsPage = 1;
  renderAdminPreview();
}

function moveInlineItem(path, direction) {
  if (!path) return;
  syncAdminFields();
  pathMove(siteData, path.replace(/^root\./, ""), direction);
  renderAdminPreview();
}

function inlineEditorControl(path, type, value) {
  if (type === "group" && isPlainEditableObject(value)) {
    return groupEditorControl(path, value);
  }
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
      <span>${esc(fieldLabel(path))}</span>
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
  $("#inline-edit-title").textContent = fieldLabel(path);
  body.innerHTML = inlineEditorControl(path, type, value);
  installImageFallbacks(body);

  const handleInlineUpload = (event, targetPath = "") => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 2 * 1024 * 1024) {
      alert("请选择 2MB 以内的图片文件。");
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const selector = targetPath ? `[data-inline-field="${CSS.escape(targetPath)}"]` : "#inline-edit-value";
      const field = $(selector);
      if (field) field.value = reader.result;
    });
    reader.readAsDataURL(file);
  };

  $("#inline-edit-file")?.addEventListener("change", (event) => {
    handleInlineUpload(event);
  });

  document.querySelectorAll("[data-inline-file]").forEach((input) => {
    input.addEventListener("change", (event) => {
      handleInlineUpload(event, input.dataset.inlineFile);
    });
  });

  document.querySelectorAll("[data-inline-close]").forEach((button) => {
    button.addEventListener("click", closeInlineEditor, { once: true });
  });

  $("#inline-edit-form").onsubmit = (event) => {
    event.preventDefault();
    if (modal.dataset.type === "group") {
      document.querySelectorAll("[data-inline-field]").forEach((field) => {
        const nextValue = field.type === "checkbox" ? field.checked : field.value;
        pathSet(siteData, field.dataset.inlineField.replace(/^root\./, ""), normalizeInlineValue(field.dataset.inlineField, nextValue, field));
      });
      closeInlineEditor();
      renderAdminPreview();
      return;
    }
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
    contact: renderContact,
    settings: renderTenantSettings
  };
  if (adminPreviewRoute.startsWith("page:")) {
    renderDynamicPage(adminPreviewRoute.slice(5));
    return;
  }
  (map[adminPreviewRoute] || renderTeam)();
}
