function renderAuthCard(mode = "login", message = "") {
  adminMode = false;
  const verifyParams = new URLSearchParams(location.search);
  const email = verifyParams.get("email") || "";
  app.innerHTML = `
    <main class="auth-page">
      <section class="auth-card">
        <p class="eyebrow">Tenant Admin</p>
        <h1>${mode === "register" ? "Register tenant" : mode === "verify" ? "Verify email" : "Sign in"}</h1>
        ${message ? `<p class="auth-message">${esc(message)}</p>` : ""}
        <form id="auth-form" data-mode="${esc(mode)}">
          ${mode === "register" ? `
            <label>Tenant name<input name="tenantName" required minlength="2" autocomplete="organization" /></label>
            <label>Tenant slug<input name="slug" required minlength="3" pattern="[a-zA-Z0-9-]+" autocomplete="off" /></label>
          ` : ""}
          <label>Email<input name="email" type="email" required autocomplete="email" value="${esc(email)}" /></label>
          ${mode === "verify" ? `<label>Verification token<input name="token" required autocomplete="one-time-code" value="${esc(verifyParams.get("verify") || "")}" /></label>` : `<label>Password<input name="password" type="password" required minlength="8" autocomplete="${mode === "register" ? "new-password" : "current-password"}" /></label>`}
          <button class="save" type="submit">${mode === "register" ? "Register" : mode === "verify" ? "Verify email" : "Sign in"}</button>
        </form>
        <div class="auth-links">
          ${mode !== "login" ? `<button type="button" data-auth-mode="login">Sign in</button>` : `<button type="button" data-auth-mode="register">Register tenant</button>`}
          ${mode !== "verify" ? `<button type="button" data-auth-mode="verify">Verify email</button>` : ""}
        </div>
      </section>
    </main>
  `;
  installAuthHandlers();
}

function installAuthHandlers() {
  document.querySelectorAll("[data-auth-mode]").forEach((button) => {
    button.addEventListener("click", () => renderAuthCard(button.dataset.authMode));
  });
  $("#auth-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      if (form.dataset.mode === "register") {
        const result = await apiJson("/api/auth/register", { method: "POST", body: JSON.stringify(data) });
        const token = result.verifyUrl?.split("verify=")[1]?.split("&")[0] || "";
        renderAuthCard("verify", `Registration created. In development, the verification link is printed in the server console. Token: ${token}`);
        return;
      }
      if (form.dataset.mode === "verify") {
        await apiJson("/api/auth/verify-email", { method: "POST", body: JSON.stringify(data) });
        renderAuthCard("login", "Email verified. You can sign in now.");
        return;
      }
      await apiJson("/api/auth/login", { method: "POST", body: JSON.stringify(data) });
      await enterAdminEditor();
    } catch (error) {
      renderAuthCard(form.dataset.mode, `Request failed: ${error.message}`);
    }
  });
}

function fileReadPromise(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve({
      name: file.name,
      type: file.type || "",
      size: file.size,
      text: String(reader.result || "").slice(0, 120000)
    }));
    reader.addEventListener("error", () => resolve({
      name: file.name,
      type: file.type || "",
      size: file.size,
      text: ""
    }));
    reader.readAsText(file);
  });
}

function mergeDraftWithDefaults(draft) {
  const next = {
    zh: structuredClone(window.DEFAULT_SITE_DATA.zh),
    en: structuredClone(window.DEFAULT_SITE_DATA.en)
  };
  mergeData(next, draft || {});
  ["zh", "en"].forEach((locale) => {
    if (!Array.isArray(next[locale].pages)) next[locale].pages = [];
  });
  return next;
}

function renderTenantOnboarding(message = "") {
  adminMode = false;
  onboardingDraft = onboardingDraft || null;
  const hasDraft = Boolean(onboardingDraft);
  app.innerHTML = `
    <main class="onboarding-page">
      <section class="onboarding-hero">
        <p class="eyebrow">First-time setup</p>
        <h1>${hasDraft ? "Review and refine your website preview" : "Let us draft your academic website from the materials you already have"}</h1>
        <p>${hasDraft ? "Comment on a specific section, regenerate the whole draft with new guidance, or publish when it feels ready. These changes only affect the preview until you confirm." : "Share the files and links that best describe your lab. We will use them to prepare a first version of your homepage, research directions, team page, publication list, and project highlights. You can review everything before it is published."}</p>
      </section>
      ${hasDraft ? renderOnboardingWorkbench(message) : `
        <section class="onboarding-grid">
          <form id="onboarding-form" class="onboarding-panel">
          <label>Academic files
            <span class="field-help">You can upload your CV, project descriptions, publication lists, student/team lists, lab photos, member photos, BibTeX/RIS exports, Markdown, TXT, CSV, or other materials that help us understand your academic profile.</span>
            <input id="onboarding-files" name="files" type="file" multiple accept=".txt,.md,.csv,.tsv,.bib,.ris,.json,.pdf,.doc,.docx" />
          </label>
          <label>Official school or department website
            <input id="onboarding-school-url" type="url" placeholder="https://www.example.edu/department" />
          </label>
          <label>Personal or lab homepage
            <input id="onboarding-homepage-url" type="url" placeholder="https://your-lab.example.edu" />
          </label>
          <label>Google Scholar profile
            <input id="onboarding-scholar-url" type="url" placeholder="https://scholar.google.com/citations?user=..." />
          </label>
          <label>Other useful links
            <textarea id="onboarding-links" rows="3" placeholder="ORCID, ResearchGate, GitHub, university profile, project pages, datasets..."></textarea>
          </label>
          <label>Anything you want us to pay special attention to
            <textarea id="onboarding-notes" rows="5" placeholder="For example: main research areas, PI name, important grants, key students, preferred tone, Chinese/English priority..."></textarea>
          </label>
          <label>Design style
            <select id="onboarding-style">${stylePluginOptions(onboardingStylePluginId)}</select>
          </label>
          <button class="save" type="submit">Create my first website draft</button>
          ${message ? `<p class="auth-message">${esc(message)}</p>` : ""}
          </form>
          <section class="onboarding-panel onboarding-preview">
            <h2>Your draft preview</h2>
            <p>After you upload materials, a preview summary will appear here. Nothing will be published until you confirm it.</p>
          </section>
        </section>
      `}
    </main>
  `;
  installOnboardingHandlers();
}

function renderOnboardingWorkbench(message = "") {
  return `
    <section class="onboarding-workbench">
      <section class="onboarding-preview-page">
        <div class="preview-page-head">
          <div>
            <p class="eyebrow">Preview workspace</p>
            <h2>${esc(onboardingDraft?.zh?.home?.title || onboardingDraft?.zh?.meta?.labName || "Academic website draft")}</h2>
          </div>
          <button id="confirm-onboarding" class="save" type="button">Looks good. Publish this draft</button>
        </div>
        ${message ? `<p class="auth-message">${esc(message)}</p>` : ""}
        ${onboardingSummary(onboardingDraft)}
        <div class="comment-block-grid">
          ${onboardingCommentBlocks().map((block) => `
            <article class="comment-block-card" data-block-id="${esc(block.id)}">
              <div>
                <span>${esc(block.label)}</span>
                <p>${esc(block.summary)}</p>
              </div>
              <button type="button" data-comment-block="${esc(block.id)}">Comment</button>
            </article>
          `).join("")}
        </div>
      </section>
      <aside class="onboarding-task-panel">
        <section class="onboarding-panel">
          <h2>Regenerate draft</h2>
          <p>Use this when the whole direction feels off, or when you want a different tone, structure, or emphasis.</p>
          <label>Guidance for regeneration
            <textarea id="regenerate-instructions" rows="4" placeholder="Example: make the homepage more PI-centered, emphasize remote sensing and climate AI, use a more formal academic tone..."></textarea>
          </label>
          <button id="regenerate-draft" type="button">Regenerate preview</button>
        </section>
        <section class="onboarding-panel" id="comment-panel">
          <h2>Section comments</h2>
          <p>Select a section on the left and tell AI what to improve. We will show the estimated time, progress, and concise modification steps.</p>
          <div id="comment-form-slot"><p>No section selected yet.</p></div>
        </section>
        <section class="onboarding-panel" id="task-status-panel">
          ${renderTaskStatus(onboardingLatestTask())}
        </section>
      </aside>
    </section>
  `;
}

function onboardingSummary(draft) {
  const zh = draft.zh || {};
  const papers = zh.papers?.items || [];
  const members = (zh.team?.sections || []).flatMap((section) => section.members || []);
  const directions = zh.research?.directions || [];
  return `
    <div class="draft-summary">
      <h3>${esc(zh.home?.title || zh.meta?.labName || "Academic website")}</h3>
      <p>${esc(zh.home?.copy || zh.meta?.shortIntro || "")}</p>
      <div class="draft-metrics">
        <span>${papers.length} papers</span>
        <span>${members.length} members</span>
        <span>${directions.length} directions</span>
      </div>
      <ol>
        ${directions.slice(0, 4).map((item) => `<li>${esc(item.title || item.copy || "")}</li>`).join("")}
      </ol>
    </div>
  `;
}

function onboardingCommentBlocks() {
  const zh = onboardingDraft?.zh || {};
  const blocks = onboardingBlocks && Object.keys(onboardingBlocks).length ? onboardingBlocks : {
    "home.hero": { label: "Homepage hero" },
    "team.pi": { label: "PI profile" },
    "team.members": { label: "Team members" },
    "papers.items": { label: "Publications" },
    "research.directions": { label: "Research directions" },
    "resources.items": { label: "Projects and resources" },
    "news.items": { label: "News" }
  };
  const summaries = {
    "home.hero": zh.home?.copy || zh.meta?.shortIntro || "",
    "home.highlights": (zh.home?.highlights || []).map((item) => item.title).join(", "),
    "team.pi": [zh.team?.pi?.name, zh.team?.pi?.role].filter(Boolean).join(" - "),
    "team.members": `${(zh.team?.sections || []).flatMap((section) => section.members || []).length} members identified`,
    "papers.items": `${(zh.papers?.items || []).length} publication items`,
    "research.directions": (zh.research?.directions || []).map((item) => item.title).join(", "),
    "resources.items": `${(zh.resources?.items || []).length} project/resource items`,
    "news.items": `${(zh.news?.items || []).length} news items`
  };
  return Object.entries(blocks).map(([id, block]) => ({
    id,
    label: block.label || id,
    summary: summaries[id] || "Comment on this section."
  }));
}

function onboardingLatestTask() {
  return onboardingSession?.tasks?.[0] || null;
}

function renderTaskStatus(task) {
  if (!task) {
    return `
      <h2>AI modification progress</h2>
      <p>No active task yet. Submit a section comment to start a revision.</p>
    `;
  }
  const remaining = Math.max(0, Number(task.estimatedSeconds || 0) - Math.round((Number(task.progressPercent || 0) / 100) * Number(task.estimatedSeconds || 0)));
  return `
    <h2>AI modification progress</h2>
    <div class="task-progress-head">
      <strong>${esc(task.blockLabel || "Website draft")}</strong>
      <span>${esc(task.status || "queued")}</span>
    </div>
    <div class="task-progress-bar"><span style="width:${Math.max(0, Math.min(100, Number(task.progressPercent || 0)))}%"></span></div>
    <p>Estimated time: ${Number(task.estimatedSeconds || 0)}s · Remaining: about ${remaining}s</p>
    <ol class="task-step-list">
      ${(task.steps || []).map((step) => `<li class="${esc(step.status)}"><strong>${esc(step.label)}</strong>${step.detail ? `<span>${esc(step.detail)}</span>` : ""}</li>`).join("")}
    </ol>
    ${task.error ? `<p class="auth-message">Revision failed: ${esc(task.error)}</p>` : ""}
    ${task.status === "complete" && task.resultDraft ? `<button id="apply-task-draft" class="save" type="button" data-task-id="${esc(task.id)}">Apply revised preview</button>` : ""}
  `;
}

function installOnboardingHandlers() {
  $("#onboarding-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = $("#onboarding-files");
    const files = await Promise.all([...input.files].slice(0, 20).map(fileReadPromise));
    const links = [
      ["Official school or department website", $("#onboarding-school-url")?.value],
      ["Personal or lab homepage", $("#onboarding-homepage-url")?.value],
      ["Google Scholar profile", $("#onboarding-scholar-url")?.value],
      ["Other useful links", $("#onboarding-links")?.value]
    ].filter(([, value]) => String(value || "").trim());
    const notes = $("#onboarding-notes")?.value?.trim();
    onboardingStylePluginId = $("#onboarding-style")?.value || onboardingStylePluginId;
    if (links.length) {
      files.push({
        name: "academic-links.txt",
        type: "text/plain",
        size: links.reduce((total, [, value]) => total + String(value || "").length, 0),
        text: links.map(([label, value]) => `${label}: ${value}`).join("\n")
      });
    }
    if (notes) files.push({ name: "extra-instructions.txt", type: "text/plain", size: notes.length, text: notes });
    if (!files.length) {
      renderTenantOnboarding("Please upload at least one file, add a useful link, or write a short note so we have something to start from.");
      return;
    }
    try {
      const payload = await apiJson("/api/tenant/onboarding", {
        method: "POST",
        body: JSON.stringify({ action: "draft", files })
      });
      onboardingDraft = mergeDraftWithDefaults(payload.draft);
      onboardingSession = payload.session || null;
      onboardingBlocks = payload.blocks || onboardingBlocks || {};
      const source = payload.mode === "ai" ? "Your AI draft is ready." : "Your first draft is ready.";
      renderTenantOnboarding(`${source} Please review the summary, then publish it when it feels like a good starting point.`);
    } catch (error) {
      renderTenantOnboarding(`We could not create the draft yet: ${error.message}`);
    }
  });

  $("#regenerate-draft")?.addEventListener("click", async () => {
    const instructions = $("#regenerate-instructions")?.value || "";
    try {
      const payload = await apiJson("/api/tenant/onboarding", {
        method: "POST",
        body: JSON.stringify({ action: "regenerate", instructions })
      });
      onboardingDraft = mergeDraftWithDefaults(payload.draft);
      onboardingSession = payload.session || onboardingSession;
      onboardingBlocks = payload.blocks || onboardingBlocks || {};
      renderTenantOnboarding(payload.mode === "ai" ? "A new AI draft is ready." : "A new preview draft is ready.");
    } catch (error) {
      renderTenantOnboarding(`We could not regenerate the draft yet: ${error.message}`);
    }
  });

  document.querySelectorAll("[data-comment-block]").forEach((button) => {
    button.addEventListener("click", () => {
      const block = onboardingCommentBlocks().find((item) => item.id === button.dataset.commentBlock);
      const slot = $("#comment-form-slot");
      if (!slot || !block) return;
      slot.innerHTML = `
        <form id="section-comment-form" data-block-id="${esc(block.id)}">
          <p><strong>${esc(block.label)}</strong></p>
          <label>Your improvement request
            <textarea name="comment" rows="5" required placeholder="Example: make this section more specific, emphasize PI research direction, add clearer student information..."></textarea>
          </label>
          <button class="save" type="submit">Ask AI to revise this section</button>
        </form>
      `;
      installSectionCommentHandler();
    });
  });

  $("#confirm-onboarding")?.addEventListener("click", async () => {
    if (!onboardingDraft) return;
    try {
      await apiJson("/api/tenant/onboarding", {
        method: "POST",
        body: JSON.stringify({ action: "confirm", data: onboardingDraft })
      });
      await apiJson("/api/tenant/settings", {
        method: "POST",
        body: JSON.stringify({ stylePluginId: onboardingStylePluginId })
      }).catch(() => {});
      siteData = structuredClone(onboardingDraft);
      onboardingDraft = null;
      await enterAdminEditor(true);
    } catch (error) {
      renderTenantOnboarding(`We could not publish the draft yet: ${error.message}`);
    }
  });

  installApplyTaskHandler();
}

function installApplyTaskHandler() {
  $("#apply-task-draft")?.addEventListener("click", () => {
    const task = onboardingLatestTask();
    if (!task?.resultDraft) return;
    onboardingDraft = mergeDraftWithDefaults(task.resultDraft);
    renderTenantOnboarding("The revised preview has been applied. You can keep commenting, regenerate again, or publish this version.");
  });
}

function installSectionCommentHandler() {
  $("#section-comment-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const comment = new FormData(form).get("comment");
    try {
      const payload = await apiJson("/api/tenant/onboarding", {
        method: "POST",
        body: JSON.stringify({
          action: "comment",
          blockId: form.dataset.blockId,
          comment,
          draft: onboardingDraft
        })
      });
      onboardingSession = payload.session || onboardingSession;
      const task = payload.task;
      onboardingActiveTaskId = task?.id || "";
      $("#task-status-panel").innerHTML = renderTaskStatus(task);
      if (onboardingActiveTaskId) pollOnboardingTask(onboardingActiveTaskId);
    } catch (error) {
      $("#task-status-panel").innerHTML = renderTaskStatus({
        status: "failed",
        blockLabel: "Revision request",
        estimatedSeconds: 0,
        progressPercent: 100,
        steps: [],
        error: error.message
      });
    }
  });
}

async function pollOnboardingTask(taskId, attempts = 0) {
  if (!taskId || attempts > 20) return;
  try {
    const payload = await apiJson(`/api/tenant/onboarding-task?id=${encodeURIComponent(taskId)}`, { method: "GET", headers: {} });
    onboardingSession = payload.session || onboardingSession;
    const panel = $("#task-status-panel");
    if (panel) {
      panel.innerHTML = renderTaskStatus(payload.task);
      installApplyTaskHandler();
    }
    if (!["complete", "failed"].includes(payload.task?.status)) {
      setTimeout(() => pollOnboardingTask(taskId, attempts + 1), 1200);
    }
  } catch {
    if (attempts < 3) setTimeout(() => pollOnboardingTask(taskId, attempts + 1), 1500);
  }
}

async function enterAdminEditor() {
  await loadPlatformConfig();
  await loadAuthContext();
  if (!authContext?.authenticated) {
    if (["localhost", "127.0.0.1"].includes(location.hostname) && !new URLSearchParams(location.search).has("verify")) {
      legacyTokenAdmin();
      return;
    }
    renderAuthCard(new URLSearchParams(location.search).has("verify") ? "verify" : "login");
    return;
  }
  if (authContext.tenant && !authContext.tenant.initializedAt) {
    renderTenantOnboarding();
    return;
  }
  const serverData = await getServerData();
  mergeData(siteData, serverData);
  ensureContentExtensions();
  normalizeTeamData();
  applyTeamRoleOrder();
  adminMode = true;
  adminPreviewRoute = sessionStorage.getItem("zeng-admin-preview-route") || adminPreviewRoute;
  if (adminPreviewRoute === "resources") adminPreviewRoute = "research";
  renderAdminPreview();
}

function renderAdmin() {
  enterAdminEditor();
}

async function renderSuperAdmin() {
  await loadPlatformConfig();
  await loadAuthContext();
  if (!authContext?.authenticated || authContext.user?.role !== "super_admin") {
    renderAuthCard("login", "Super admin access requires a super admin account.");
    return;
  }
  try {
    const payload = await apiJson("/api/super/tenants", { method: "GET", headers: {} });
    const planOptions = (selected) => platformConfig.plans
      .map((plan) => `<option value="${esc(plan.id)}" ${plan.id === selected ? "selected" : ""}>${esc(plan.name)}</option>`)
      .join("");
    const styleOptions = (selected) => platformConfig.stylePlugins
      .map((plugin) => `<option value="${esc(plugin.id)}" ${plugin.id === selected ? "selected" : ""}>${esc(plugin.name)}</option>`)
      .join("");
    const featureFields = (features = {}) => Object.keys({ ...platformConfig.defaultFeatures, ...features })
      .map((key) => `
        <label class="tenant-feature">
          <input type="checkbox" data-tenant-feature="${esc(key)}" ${features[key] ? "checked" : ""} />
          <span>${esc(key)}</span>
        </label>
      `).join("");
    app.innerHTML = `
      <main class="super-admin-page">
        <section class="super-admin-head">
          <p class="eyebrow">Super Admin</p>
          <h1>Tenants</h1>
          <button id="logout-admin" type="button">Logout</button>
        </section>
        <section class="tenant-table">
          ${payload.tenants.map((tenant) => `
            <article class="tenant-row" data-tenant-id="${esc(tenant.id)}">
              <div>
                <h2>${esc(tenant.name)}</h2>
                <p>${esc(tenant.slug)} - ${esc(tenant.status)} - ${esc(tenant.emailDomain || "")}</p>
                <p>${esc((tenant.domainFlags || []).join(", "))}</p>
              </div>
              <label>Status
                <select data-tenant-status>
                  <option value="active" ${tenant.status === "active" ? "selected" : ""}>active</option>
                  <option value="disabled" ${tenant.status === "disabled" ? "selected" : ""}>disabled</option>
                  <option value="frozen" ${tenant.status === "frozen" ? "selected" : ""}>frozen</option>
                </select>
              </label>
              <label>Plan
                <select data-tenant-plan>${planOptions(tenant.planId)}</select>
              </label>
              <label>Style
                <select data-tenant-style>${styleOptions(tenant.stylePluginId)}</select>
              </label>
              <label>Subdomain
                <input data-tenant-subdomain value="${esc(tenant.subdomain || tenant.slug || "")}" />
              </label>
              <label>Domains
                <input data-tenant-domains value="${esc((tenant.domains || []).join(", "))}" />
              </label>
              <label>AI config ref
                <input data-tenant-ai-ref value="${esc(tenant.aiProviderConfigRef || "platform-default")}" />
              </label>
              <div class="tenant-features">${featureFields(tenant.features || {})}</div>
              <button type="button" data-save-tenant>Save</button>
            </article>
          `).join("") || `<p>No tenants yet.</p>`}
        </section>
      </main>
    `;
    installSuperAdminHandlers();
  } catch (error) {
    renderAuthCard("login", `Unable to load tenants: ${error.message}`);
  }
}

function installSuperAdminHandlers() {
  $("#logout-admin")?.addEventListener("click", async () => {
    await apiJson("/api/auth/logout", { method: "POST", body: "{}" }).catch(() => {});
    renderAuthCard("login");
  });
  document.querySelectorAll("[data-save-tenant]").forEach((button) => {
    button.addEventListener("click", async () => {
      const row = button.closest("[data-tenant-id]");
      const domains = row.querySelector("[data-tenant-domains]").value.split(",").map((item) => item.trim()).filter(Boolean);
      const features = {};
      row.querySelectorAll("[data-tenant-feature]").forEach((input) => {
        features[input.dataset.tenantFeature] = input.checked;
      });
      await apiJson("/api/super/tenants", {
        method: "POST",
        body: JSON.stringify({
          id: row.dataset.tenantId,
          status: row.querySelector("[data-tenant-status]").value,
          planId: row.querySelector("[data-tenant-plan]").value,
          stylePluginId: row.querySelector("[data-tenant-style]").value,
          subdomain: row.querySelector("[data-tenant-subdomain]").value,
          domains,
          aiProviderConfigRef: row.querySelector("[data-tenant-ai-ref]").value,
          features
        })
      });
      renderSuperAdmin();
    });
  });
}

function legacyTokenAdmin() {
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
  legacyAdminMode = true;
  adminMode = true;
  adminPreviewRoute = sessionStorage.getItem("zeng-admin-preview-route") || adminPreviewRoute;
  if (adminPreviewRoute === "resources") adminPreviewRoute = "research";
  renderAdminPreview();
}
