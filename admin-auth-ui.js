let onboardingSelectedFiles = [];

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
    const isText = String(file.type || "").startsWith("text/") || /\.(txt|md|csv|tsv|bib|ris|json)$/i.test(file.name);
    const isDocx = /\.docx$/i.test(file.name);
    const isPdf = /\.pdf$/i.test(file.name) || String(file.type || "") === "application/pdf";
    const maxDocxBytes = 2 * 1024 * 1024;
    const maxPdfBytes = 6 * 1024 * 1024;
    const reader = new FileReader();
    const basic = {
      name: file.name,
      type: file.type || "",
      size: file.size
    };
    reader.addEventListener("load", () => resolve({
      ...basic,
      ...(isText
        ? { text: String(reader.result || "").slice(0, 120000) }
        : { dataBase64: String(reader.result || "").split(",")[1] || "", text: "" })
    }));
    reader.addEventListener("error", () => resolve({
      ...basic,
      text: `Uploaded file: ${file.name}. The browser could not read this file; please add a short description or upload a text/CSV/BibTeX version if the content is important.`
    }));
    if (isText) {
      reader.readAsText(file);
    } else if ((isDocx && file.size <= maxDocxBytes) || (isPdf && file.size <= maxPdfBytes)) {
      reader.readAsDataURL(file);
    } else {
      const kind = isDocx
        ? "Word document is larger than the first-version upload limit"
        : isPdf
          ? "PDF document is larger than the first-version upload limit"
          : String(file.type || "").startsWith("image/")
            ? "Image file uploaded for later visual use"
            : "Binary file uploaded";
      resolve({
        ...basic,
        text: `${kind}: ${file.name}. Please add the key facts in the notes field or upload a text/CSV/BibTeX/Markdown version so AI can use the content.`
      });
    }
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

function fileSizeLabel(size = 0) {
  const bytes = Number(size || 0);
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function fileStatusLabel(file) {
  const name = file.name || "";
  if (/\.(txt|md|csv|tsv|bib|ris|json)$/i.test(name) || String(file.type || "").startsWith("text/")) return "Readable text";
  if (/\.docx$/i.test(name) && file.size <= 2 * 1024 * 1024) return "Word text will be extracted";
  if (/\.docx$/i.test(name)) return "Large Word file; add key facts in notes";
  if (/\.pdf$/i.test(name) && file.size <= 6 * 1024 * 1024) return "PDF text will be extracted";
  if (/\.pdf$/i.test(name)) return "Large PDF; add key facts in notes";
  if (String(file.type || "").startsWith("image/")) return "Image queued as visual reference";
  return "File queued";
}

function renderSelectedFileList() {
  if (!onboardingSelectedFiles.length) {
    return `<p class="upload-empty">No files selected yet. You can choose several files together.</p>`;
  }
  return onboardingSelectedFiles.map((file, index) => `
    <article class="upload-file-row">
      <div>
        <strong>${esc(file.name)}</strong>
        <span>${esc(fileStatusLabel(file))} · ${esc(fileSizeLabel(file.size))}</span>
      </div>
      <button type="button" data-remove-upload="${index}" aria-label="Remove ${esc(file.name)}">Remove</button>
    </article>
  `).join("");
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
          <div class="upload-field">
            <label for="onboarding-files">Academic files</label>
            <span class="field-help">Upload multiple files at once: CV, project descriptions, publication lists, student/team lists, lab photos, member photos, BibTeX/RIS exports, Markdown, TXT, CSV, Word documents, or other materials that help us understand your academic profile.</span>
            <div class="upload-dropzone" id="onboarding-dropzone">
              <strong>Drop files here or click to browse</strong>
              <span>Best for AI: PDF under 6MB, DOCX under 2MB, TXT, Markdown, CSV, BibTeX, RIS, JSON. Photos are kept as visual references.</span>
              <input id="onboarding-files" name="files" type="file" multiple accept=".txt,.md,.csv,.tsv,.bib,.ris,.json,.pdf,.doc,.docx,image/*" />
            </div>
            <div class="upload-file-list" id="onboarding-file-list">${renderSelectedFileList()}</div>
          </div>
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
            <p>After you upload materials, this will become a live website preview. You can review the real page layout before anything is published.</p>
          </section>
        </section>
      `}
    </main>
  `;
  installOnboardingHandlers();
}

function previewData(draft) {
  const zh = draft?.zh || {};
  return {
    meta: zh.meta || {},
    home: zh.home || {},
    team: zh.team || {},
    papers: zh.papers || {},
    research: zh.research || {},
    resources: zh.resources || {},
    news: zh.news || {}
  };
}

function sectionCommentButton(blockId) {
  const block = onboardingCommentBlocks().find((item) => item.id === blockId);
  return `<button class="preview-comment-pin" type="button" data-comment-block="${esc(blockId)}">Comment${block ? `: ${esc(block.label)}` : ""}</button>`;
}

function renderWebsitePreview(draft) {
  const d = previewData(draft);
  const h = d.home;
  const directions = d.research.directions || h.highlights || [];
  const papers = d.papers.items || [];
  const members = (d.team.sections || []).flatMap((section) => section.members || []);
  const resources = d.resources.items || [];
  const news = d.news.items || [];
  return `
    <div class="wysiwyg-preview">
      <header class="wysiwyg-header">
        <strong>${esc(d.meta.labName || h.title || "Academic Lab")}</strong>
        <nav>
          <a>Home</a><a>Research</a><a>Team</a><a>Publications</a><a>Contact</a>
        </nav>
      </header>
      <section class="wysiwyg-hero" data-preview-section="home.hero">
        ${sectionCommentButton("home.hero")}
        <p class="eyebrow">${esc(h.eyebrow || "Academic website preview")}</p>
        <h1>${esc(h.title || d.meta.labName || "Academic Lab")}</h1>
        <p>${esc(h.copy || d.meta.shortIntro || "")}</p>
        <div class="wysiwyg-actions"><span>Research</span><span>Publications</span></div>
        <div class="wysiwyg-stats">${(h.stats || []).slice(0, 3).map((item) => `<div><strong>${esc(item.value)}</strong><span>${esc(item.label)}</span></div>`).join("")}</div>
      </section>
      <section class="wysiwyg-section" data-preview-section="research.directions">
        ${sectionCommentButton("research.directions")}
        <div class="wysiwyg-section-head"><h2>${esc(d.research.title || "Research")}</h2><p>${esc(d.research.intro || "")}</p></div>
        <div class="wysiwyg-card-grid">
          ${directions.slice(0, 6).map((item) => `<article><h3>${esc(item.title || "")}</h3><p>${esc(item.copy || "")}</p></article>`).join("") || "<article><h3>Research direction</h3><p>Add research materials to generate this section.</p></article>"}
        </div>
      </section>
      <section class="wysiwyg-section wysiwyg-two-col" data-preview-section="team.pi">
        ${sectionCommentButton("team.pi")}
        <div>
          <h2>${esc(d.team.title || "Team")}</h2>
          <h3>${esc(d.team.pi?.name || d.meta.labName || "Principal Investigator")}</h3>
          <p>${esc(d.team.pi?.role || "Principal Investigator")}</p>
          ${(d.team.pi?.details || []).slice(0, 2).map((item) => `<p>${esc(item)}</p>`).join("")}
        </div>
        <div data-preview-section="team.members">
          ${sectionCommentButton("team.members")}
          <h3>Members</h3>
          <ul>${members.slice(0, 8).map((member) => `<li><strong>${esc(member.name)}</strong><span>${esc(member.role || "")}</span></li>`).join("") || "<li><strong>No members identified yet</strong><span>Add a student/team list to fill this section.</span></li>"}</ul>
        </div>
      </section>
      <section class="wysiwyg-section" data-preview-section="papers.items">
        ${sectionCommentButton("papers.items")}
        <div class="wysiwyg-section-head"><h2>${esc(d.papers.title || "Publications")}</h2><p>${esc(d.papers.intro || "")}</p></div>
        <div class="wysiwyg-paper-list">
          ${papers.slice(0, 8).map((paper) => `<article><span>${esc(paper.year || "")}</span><div><strong>${esc(paper.title || "")}</strong><p>${esc(paper.authors || "")} · ${esc(paper.journal || "")}</p></div></article>`).join("") || "<article><span></span><div><strong>No publications identified yet</strong><p>Upload a publication list, BibTeX, RIS, or paste key publications in notes.</p></div></article>"}
        </div>
      </section>
      <section class="wysiwyg-section" data-preview-section="resources.items">
        ${sectionCommentButton("resources.items")}
        <div class="wysiwyg-section-head"><h2>${esc(d.resources.title || "Projects and Materials")}</h2><p>${esc(d.resources.intro || "")}</p></div>
        <div class="wysiwyg-card-grid">${resources.slice(0, 4).map((item) => `<article><h3>${esc(item.title || "")}</h3><p>${esc(item.copy || "")}</p></article>`).join("") || "<article><h3>Projects</h3><p>Add project materials to generate this section.</p></article>"}</div>
      </section>
      <section class="wysiwyg-section" data-preview-section="news.items">
        ${sectionCommentButton("news.items")}
        <div class="wysiwyg-section-head"><h2>${esc(d.news.title || "News")}</h2></div>
        <div class="wysiwyg-news-row">${news.slice(0, 3).map((item) => `<article><span>${esc(item.date || "")}</span><strong>${esc(item.title || "")}</strong><p>${esc(item.copy || "")}</p></article>`).join("")}</div>
      </section>
    </div>
  `;
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
        ${renderWebsitePreview(onboardingDraft)}
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
        <section class="onboarding-panel pipeline-panel" id="pipeline-review-panel">
          ${renderPipelineReview()}
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

function currentPipeline() {
  return onboardingSession?.pipeline || null;
}

function renderPipelineReview() {
  const pipeline = currentPipeline();
  if (!pipeline) {
    return `
      <h2>Understanding pipeline</h2>
      <p>The structured professor understanding record will appear after draft generation.</p>
    `;
  }
  const schema = pipeline.professor_schema || {};
  const positioning = pipeline.positioning || {};
  const discoveries = pipeline.ai_discoveries || [];
  const stages = pipeline.stages || [];
  return `
    <h2>Understanding pipeline</h2>
    <p>AI output is a draft. Publishing still requires CMS confirmation.</p>
    <div class="pipeline-stage-list">
      ${stages.map((stage) => `<span>${esc(stage.key)}: ${esc(stage.status)}</span>`).join("")}
    </div>
    <dl class="pipeline-facts">
      <div><dt>Professor</dt><dd>${esc(schema.profile?.name || "Not identified")}</dd></div>
      <div><dt>Primary domain</dt><dd>${esc((schema.research?.areas || [])[0] || positioning.hero_direction || "Not identified")}</dd></div>
      <div><dt>Core message</dt><dd>${esc(positioning.core_message || "Pending")}</dd></div>
      <div><dt>Review-only discoveries</dt><dd>${discoveries.length}</dd></div>
    </dl>
    ${discoveries.length ? `
      <div class="pipeline-discoveries">
        ${discoveries.slice(0, 3).map((item) => `
          <article>
            <strong>${esc(item.title || item.type || "Discovery")}</strong>
            <p>${esc(item.description || "")}</p>
          </article>
        `).join("")}
      </div>
    ` : ""}
  `;
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
  const fileInput = $("#onboarding-files");
  const fileList = $("#onboarding-file-list");
  const refreshFileList = () => {
    if (fileList) fileList.innerHTML = renderSelectedFileList();
    document.querySelectorAll("[data-remove-upload]").forEach((button) => {
      button.addEventListener("click", () => {
        onboardingSelectedFiles.splice(Number(button.dataset.removeUpload), 1);
        refreshFileList();
      });
    });
  };
  fileInput?.addEventListener("change", () => {
    const nextFiles = [...fileInput.files];
    const existing = new Set(onboardingSelectedFiles.map((file) => `${file.name}:${file.size}:${file.lastModified}`));
    nextFiles.forEach((file) => {
      const key = `${file.name}:${file.size}:${file.lastModified}`;
      if (!existing.has(key)) onboardingSelectedFiles.push(file);
    });
    onboardingSelectedFiles = onboardingSelectedFiles.slice(0, 20);
    fileInput.value = "";
    refreshFileList();
  });
  $("#onboarding-dropzone")?.addEventListener("click", (event) => {
    if (event.target !== fileInput) fileInput?.click();
  });
  refreshFileList();

  $("#onboarding-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const files = await Promise.all(onboardingSelectedFiles.slice(0, 20).map(fileReadPromise));
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
    const requestBytes = new Blob([JSON.stringify({ action: "draft", files })]).size;
    if (requestBytes > 12 * 1024 * 1024) {
      renderTenantOnboarding("The selected files are too large for this preview step. Please upload fewer files, remove large photos/PDFs, or paste the key facts into the notes field.");
      return;
    }
    try {
      const payload = await apiJson("/api/tenant/onboarding", {
        method: "POST",
        body: JSON.stringify({ action: "draft", files })
      });
      onboardingDraft = mergeDraftWithDefaults(payload.draft);
      onboardingSession = payload.session || null;
      if (payload.pipeline && onboardingSession) onboardingSession.pipeline = payload.pipeline;
      onboardingBlocks = payload.blocks || onboardingBlocks || {};
      const source = payload.mode === "ai"
        ? "Your AI draft is ready."
        : "A rule-based preview is ready. Configure an AI key for deeper synthesis and copywriting.";
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
      if (payload.pipeline && onboardingSession) onboardingSession.pipeline = payload.pipeline;
      onboardingBlocks = payload.blocks || onboardingBlocks || {};
      renderTenantOnboarding(payload.mode === "ai" ? "A new AI draft is ready." : "A new rule-based preview is ready. Configure an AI key for deeper synthesis.");
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
