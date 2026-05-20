const PASSWORD = "zenglab2026";
const STORAGE_KEY = "zenglab_recruit_site_v1";

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

function getSavedData() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

async function getServerData() {
  try {
    const response = await fetch("/content.json", { cache: "no-store" });
    if (!response.ok) return {};
    return await response.json();
  } catch {
    return {};
  }
}

async function saveServerData(data) {
  try {
    const response = await fetch("/api/content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return response.ok;
  } catch {
    return false;
  }
}

function setByPath(target, path, value) {
  const parts = path.split(".");
  let cursor = target;
  parts.slice(0, -1).forEach((part) => {
    cursor[part] ||= {};
    cursor = cursor[part];
  });
  cursor[parts.at(-1)] = value;
}

function getByPath(target, path) {
  return path.split(".").reduce((cursor, part) => cursor?.[part], target);
}

function applyData(data) {
  $$("[data-edit]").forEach((node) => {
    const value = getByPath(data, node.dataset.edit);
    if (typeof value === "string") node.textContent = value;
  });

  $$("[data-edit-link]").forEach((node) => {
    const value = getByPath(data, node.dataset.editLink);
    if (!value) return;
    if (value.text) node.textContent = value.text;
    if (value.href) {
      node.setAttribute("href", value.href);
      if (value.href.startsWith("http")) {
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener");
      } else {
        node.removeAttribute("target");
        node.removeAttribute("rel");
      }
    }
  });

  $$("[data-edit-image]").forEach((node) => {
    const value = getByPath(data, node.dataset.editImage);
    if (value) node.setAttribute("src", value);
  });
}

function collectCurrentData() {
  const data = {};
  $$("[data-edit]").forEach((node) => setByPath(data, node.dataset.edit, node.textContent.trim()));
  $$("[data-edit-link]").forEach((node) => {
    setByPath(data, node.dataset.editLink, {
      text: node.textContent.trim(),
      href: node.getAttribute("href") || "",
    });
  });
  $$("[data-edit-image]").forEach((node) => setByPath(data, node.dataset.editImage, node.getAttribute("src") || ""));
  return data;
}

function inputId(path) {
  return `field-${path.replace(/[^a-z0-9]/gi, "-")}`;
}

function buildAdmin() {
  const shell = $("#admin-shell");
  const current = collectCurrentData();
  shell.hidden = false;
  document.body.classList.add("edit-highlight");

  const textFields = $$("[data-edit]").map((node) => {
    const path = node.dataset.edit;
    const id = inputId(path);
    const multiline = node.textContent.trim().length > 56;
    const tag = multiline
      ? `<textarea id="${id}" data-field="${path}">${node.textContent.trim()}</textarea>`
      : `<input id="${id}" data-field="${path}" value="${node.textContent.trim().replaceAll('"', "&quot;")}" />`;
    return `<label>${path}${tag}</label>`;
  });

  const linkFields = $$("[data-edit-link]").flatMap((node) => {
    const path = node.dataset.editLink;
    return [
      `<label>${path}.text<input data-link-text="${path}" value="${node.textContent.trim().replaceAll('"', "&quot;")}" /></label>`,
      `<label>${path}.href<input data-link-href="${path}" value="${(node.getAttribute("href") || "").replaceAll('"', "&quot;")}" /></label>`,
    ];
  });

  const imageFields = $$("[data-edit-image]").map((node) => {
    const path = node.dataset.editImage;
    return `<label>${path}<input data-image="${path}" value="${(node.getAttribute("src") || "").replaceAll('"', "&quot;")}" /></label>
      <label>${path}.upload<input type="file" accept="image/*" data-image-upload="${path}" /></label>`;
  });

  shell.innerHTML = `
    <h2>网页编辑模式</h2>
    <p>修改文字、链接或图片后点击保存。上传图片会以浏览器本地数据保存，适合先快速迭代内容。</p>
    ${textFields.join("")}
    ${linkFields.join("")}
    ${imageFields.join("")}
    <div class="admin-actions">
      <button type="button" id="reset-site">恢复默认</button>
      <button type="button" class="save" id="save-site">保存生效</button>
    </div>
  `;

  $$("[data-image-upload]", shell).forEach((input) => {
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        const paired = $(`[data-image="${input.dataset.imageUpload}"]`, shell);
        paired.value = reader.result;
      });
      reader.readAsDataURL(file);
    });
  });

  $("#save-site").addEventListener("click", async () => {
    $$("[data-field]", shell).forEach((input) => setByPath(current, input.dataset.field, input.value));
    $$("[data-link-text]", shell).forEach((input) => {
      const value = getByPath(current, input.dataset.linkText) || {};
      value.text = input.value;
      setByPath(current, input.dataset.linkText, value);
    });
    $$("[data-link-href]", shell).forEach((input) => {
      const value = getByPath(current, input.dataset.linkHref) || {};
      value.href = input.value;
      setByPath(current, input.dataset.linkHref, value);
    });
    $$("[data-image]", shell).forEach((input) => setByPath(current, input.dataset.image, input.value));
    const savedOnServer = await saveServerData(current);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedOnServer ? {} : current));
    applyData(current);
    alert(savedOnServer ? "已保存到网站内容文件，普通页面会立即显示最新内容。" : "已保存到当前浏览器，普通页面会立即显示最新内容。");
  });

  $("#reset-site").addEventListener("click", async () => {
    if (!confirm("确定恢复默认内容？")) return;
    await saveServerData({});
    localStorage.removeItem(STORAGE_KEY);
    location.href = "/";
  });
}

function startAdminIfNeeded() {
  if (!location.pathname.endsWith("/admin")) return;
  const password = window.prompt("请输入管理密码");
  if (password === PASSWORD) {
    buildAdmin();
  } else {
    alert("密码错误");
    location.href = "/";
  }
}

async function init() {
  const serverData = await getServerData();
  applyData({ ...serverData, ...getSavedData() });
  startAdminIfNeeded();
}

init();
