const { generateAcademicSiteDraft, generateProfessorUnderstandingPipeline } = require("./academic-site-generator");
const { applyLocalCommentToDraft } = require("./onboarding-workflow");

const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";

function cleanBaseUrl(value = "") {
  return String(value || "").replace(/\/+$/, "");
}

function providerConfig() {
  const provider = String(process.env.AI_PROVIDER || "openai").trim().toLowerCase();
  const apiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY || "";
  return {
    provider,
    apiKey,
    baseUrl: cleanBaseUrl(process.env.AI_BASE_URL || process.env.OPENAI_BASE_URL || DEFAULT_OPENAI_BASE_URL),
    apiStyle: String(process.env.AI_API_STYLE || "responses").trim().toLowerCase(),
    textModel: process.env.AI_TEXT_MODEL || process.env.OPENAI_TEXT_MODEL || "gpt-5.5",
    imageProvider: String(process.env.AI_IMAGE_PROVIDER || process.env.AI_PROVIDER || "openai").trim().toLowerCase(),
    imageApiKey: process.env.AI_IMAGE_API_KEY || process.env.AI_API_KEY || process.env.OPENAI_API_KEY || "",
    imageBaseUrl: cleanBaseUrl(process.env.AI_IMAGE_BASE_URL || process.env.AI_BASE_URL || process.env.OPENAI_BASE_URL || DEFAULT_OPENAI_BASE_URL),
    imageModel: process.env.AI_IMAGE_MODEL || process.env.OPENAI_IMAGE_MODEL || "image2",
    timeoutMs: Number(process.env.AI_TIMEOUT_MS || 90000)
  };
}

function aiStatus() {
  const config = providerConfig();
  return {
    configured: Boolean(config.apiKey),
    provider: config.provider,
    apiStyle: config.apiStyle,
    textModel: config.textModel,
    imageProvider: config.imageProvider,
    imageConfigured: Boolean(config.imageApiKey),
    imageModel: config.imageModel,
    baseUrl: config.baseUrl
  };
}

function requireAiConfig() {
  const config = providerConfig();
  if (!config.apiKey) throw new Error("ai_not_configured");
  return config;
}

function authHeaders(config) {
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${config.apiKey}`
  };
}

async function postProviderJson(path, body, config = requireAiConfig()) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const res = await fetch(`${config.baseUrl}${path}`, {
      method: "POST",
      headers: authHeaders(config),
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = payload.error?.message || payload.error || `ai_http_${res.status}`;
      throw new Error(String(message));
    }
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

function extractResponseText(payload) {
  if (typeof payload.output_text === "string") return payload.output_text;
  const chunks = [];
  (payload.output || []).forEach((item) => {
    (item.content || []).forEach((part) => {
      if (typeof part.text === "string") chunks.push(part.text);
      if (typeof part.output_text === "string") chunks.push(part.output_text);
    });
  });
  return chunks.join("\n").trim();
}

async function generateText({ system = "", prompt = "", maxOutputTokens = 6000 } = {}) {
  const config = requireAiConfig();
  if (config.apiStyle === "chat") {
    const payload = await postProviderJson("/chat/completions", {
      model: config.textModel,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      max_tokens: maxOutputTokens
    }, config);
    return payload.choices?.[0]?.message?.content || "";
  }

  const payload = await postProviderJson("/responses", {
    model: config.textModel,
    instructions: system,
    input: prompt,
    max_output_tokens: maxOutputTokens,
    truncation: "auto"
  }, config);
  return extractResponseText(payload);
}

function parseJsonFromText(text) {
  const raw = String(text || "").trim();
  if (!raw) throw new Error("empty_ai_response");
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return JSON.parse((fenced ? fenced[1] : raw).trim());
}

function summarizeAcademicFiles(files = []) {
  return files.slice(0, 20).map((file) => ({
    name: String(file.name || "").slice(0, 120),
    type: String(file.type || "").slice(0, 80),
    size: Number(file.size || 0),
    text: String(file.text || "").replace(/\s+/g, " ").trim().slice(0, 12000)
  }));
}

function summarizeAcademicFileMetadata(files = []) {
  return files.slice(0, 20).map((file) => ({
    name: String(file.name || "").slice(0, 120),
    type: String(file.type || "").slice(0, 80),
    size: Number(file.size || 0),
    sourceUrl: file.sourceUrl || ""
  }));
}

function publicPipelineForPrompt(pipeline = {}) {
  const { draft_context, ...safePipeline } = pipeline || {};
  return safePipeline;
}

function buildContentBrief(files = [], localDraft = {}, pipeline = {}) {
  return {
    sourceCount: files.length,
    linkedWebpages: files.filter((file) => file.sourceUrl).map((file) => file.sourceUrl),
    pipelineVersion: pipeline.version || "",
    structuredProfessorSchema: pipeline.professor_schema || {},
    semanticUnderstanding: pipeline.semantic_understanding || {},
    positioning: pipeline.positioning || {},
    copywritingPlan: pipeline.copywriting_plan || {},
    aiDiscoveriesRequireReview: pipeline.ai_discoveries || [],
    inferredLabName: localDraft.zh?.meta?.labName || localDraft.en?.meta?.labName || "",
    inferredPi: localDraft.zh?.team?.pi?.name || localDraft.en?.team?.pi?.name || "",
    inferredThemes: (localDraft.en?.research?.directions || []).map((item) => ({
      title: item.title,
      evidence: item.copy
    })),
    candidatePublications: (localDraft.en?.papers?.items || []).slice(0, 10),
    candidateResources: (localDraft.en?.resources?.items || []).slice(0, 8)
  };
}

async function generateAcademicSiteDraftWithAi({ tenant = {}, files = [], fallbackDraft, pipeline = null } = {}) {
  const understanding = pipeline || generateProfessorUnderstandingPipeline({ tenant, files });
  if (!aiStatus().configured) {
    return {
      draft: fallbackDraft || generateAcademicSiteDraft({ tenant, files, pipeline: understanding }),
      pipeline: understanding,
      mode: "local",
      warning: "ai_not_configured"
    };
  }

  const localDraft = fallbackDraft || generateAcademicSiteDraft({ tenant, files, pipeline: understanding });
  const system = [
    "You are an academic website strategist and copywriter.",
    "Use the staged professor understanding pipeline, structured schema, semantic understanding, positioning, and fallback draft before writing.",
    "Do not use raw uploaded materials as a direct source for website copy. The pipeline schema is the source of truth for this stage.",
    "Synthesize facts into a polished website narrative; do not merely copy filenames or raw lines.",
    "Create useful homepage copy, research direction cards, project/resource cards, PI/team summaries, publication entries, and image paths.",
    "Return JSON only. Do not include markdown or explanatory text.",
    "The JSON must match the existing site content shape with zh and en roots.",
    "Use image paths from the local draft when relevant; otherwise keep image empty.",
    "Keep links empty, real uploaded webpage URLs, or relative paths such as /research, /team, /papers, /news.",
    "Use uploaded facts conservatively; do not invent specific publications, people, dates, grants, or metrics.",
    "AI discoveries are review suggestions only. Do not publish them as facts unless they are already present in the structured schema.",
    "If information is missing, write polished placeholders that clearly invite later editing.",
    "Make zh and en both readable. If Chinese facts are unavailable, zh may keep proper names in English but should still be coherent."
  ].join(" ");
  const prompt = JSON.stringify({
    task: "Create a first website draft by understanding and abstracting uploaded academic materials and linked webpages.",
    tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug, emailDomain: tenant.emailDomain },
    fileMetadata: summarizeAcademicFileMetadata(files),
    professorUnderstandingPipeline: publicPipelineForPrompt(understanding),
    contentBrief: buildContentBrief(files, localDraft, understanding),
    localDraft,
    requiredTopLevelKeys: ["zh", "en"],
    requiredSections: [
      "home hero with title/copy/stats/highlights",
      "research direction cards with title/copy/image",
      "PI profile and team sections",
      "publication list",
      "projects/resources cards",
      "news placeholder",
      "join/contact/footer"
    ]
  });

  try {
    const text = await generateText({ system, prompt, maxOutputTokens: 12000 });
    const draft = parseJsonFromText(text);
    return { draft, pipeline: understanding, mode: "ai", provider: aiStatus().provider };
  } catch (error) {
    return { draft: localDraft, pipeline: understanding, mode: "local", warning: error.message || "ai_failed" };
  }
}

async function reviseAcademicSiteDraftWithAi({ tenant = {}, draft = {}, files = [], pipeline = null, blockId = "", blockLabel = "", comment = "" } = {}) {
  const localDraft = applyLocalCommentToDraft(draft, { blockId, comment });
  const understanding = pipeline || generateProfessorUnderstandingPipeline({ tenant, files });
  if (!aiStatus().configured) {
    return { draft: localDraft, pipeline: understanding, mode: "local", warning: "ai_not_configured" };
  }

  const system = [
    "You revise bilingual academic lab website JSON content.",
    "Return JSON only. Do not include markdown or explanatory text.",
    "Preserve the existing content shape with zh and en roots.",
    "Use the user's section-specific comment to improve the draft.",
    "Use the professor understanding pipeline and current draft as the source of truth. Do not directly parse raw source materials for page copy.",
    "Do not invent specific people, publications, dates, grants, or metrics unless they appear in the structured schema or existing draft.",
    "Keep links empty or relative paths such as /research, /team, /papers, /news."
  ].join(" ");
  const prompt = JSON.stringify({
    task: "Revise the current website preview draft according to a tenant comment.",
    tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug, emailDomain: tenant.emailDomain },
    targetBlock: { id: blockId, label: blockLabel },
    comment,
    fileMetadata: summarizeAcademicFileMetadata(files),
    professorUnderstandingPipeline: publicPipelineForPrompt(understanding),
    currentDraft: draft,
    fallbackDraft: localDraft
  });

  try {
    const text = await generateText({ system, prompt, maxOutputTokens: 12000 });
    return { draft: parseJsonFromText(text), pipeline: understanding, mode: "ai", provider: aiStatus().provider };
  } catch (error) {
    return { draft: localDraft, pipeline: understanding, mode: "local", warning: error.message || "ai_failed" };
  }
}

async function generateImage({ prompt, size = "1024x1024", quality = "medium" } = {}) {
  const config = providerConfig();
  if (!config.imageApiKey) throw new Error("ai_image_not_configured");
  const safePrompt = String(prompt || "").trim();
  if (!safePrompt) throw new Error("missing_prompt");
  const imageConfig = {
    ...config,
    provider: config.imageProvider,
    apiKey: config.imageApiKey,
    baseUrl: config.imageBaseUrl
  };
  const payload = await postProviderJson("/images/generations", {
    model: config.imageModel,
    prompt: safePrompt,
    size,
    quality,
    n: 1
  }, imageConfig);
  const image = payload.data?.[0] || {};
  if (image.b64_json) return { dataUrl: `data:image/png;base64,${image.b64_json}`, provider: config.imageProvider, model: config.imageModel };
  if (image.url) return { url: image.url, provider: config.imageProvider, model: config.imageModel };
  throw new Error("empty_image_response");
}

module.exports = {
  aiStatus,
  generateAcademicSiteDraftWithAi,
  generateImage,
  generateText,
  reviseAcademicSiteDraftWithAi,
  providerConfig
};
