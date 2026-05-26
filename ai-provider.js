const { generateAcademicSiteDraft } = require("./academic-site-generator");
const { applyLocalCommentToDraft, summarizeFiles } = require("./onboarding-workflow");

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

async function generateAcademicSiteDraftWithAi({ tenant = {}, files = [], fallbackDraft } = {}) {
  if (!aiStatus().configured) {
    return { draft: fallbackDraft || generateAcademicSiteDraft({ tenant, files }), mode: "local", warning: "ai_not_configured" };
  }

  const localDraft = fallbackDraft || generateAcademicSiteDraft({ tenant, files });
  const system = [
    "You generate bilingual academic lab website content.",
    "Return JSON only. Do not include markdown or explanatory text.",
    "The JSON must match the existing site content shape with zh and en roots.",
    "Keep links empty or relative paths such as /research, /team, /papers, /news.",
    "Use uploaded facts conservatively; do not invent specific publications, people, dates, grants, or metrics.",
    "If information is missing, write polished placeholders that the tenant can edit later."
  ].join(" ");
  const prompt = JSON.stringify({
    task: "Create a first website draft for this tenant from uploaded academic materials.",
    tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug, emailDomain: tenant.emailDomain },
    files: summarizeAcademicFiles(files),
    localDraft,
    requiredTopLevelKeys: ["zh", "en"]
  });

  try {
    const text = await generateText({ system, prompt, maxOutputTokens: 12000 });
    const draft = parseJsonFromText(text);
    return { draft, mode: "ai", provider: aiStatus().provider };
  } catch (error) {
    return { draft: localDraft, mode: "local", warning: error.message || "ai_failed" };
  }
}

async function reviseAcademicSiteDraftWithAi({ tenant = {}, draft = {}, files = [], blockId = "", blockLabel = "", comment = "" } = {}) {
  const localDraft = applyLocalCommentToDraft(draft, { blockId, comment });
  if (!aiStatus().configured) {
    return { draft: localDraft, mode: "local", warning: "ai_not_configured" };
  }

  const system = [
    "You revise bilingual academic lab website JSON content.",
    "Return JSON only. Do not include markdown or explanatory text.",
    "Preserve the existing content shape with zh and en roots.",
    "Use the user's section-specific comment to improve the draft.",
    "Do not invent specific people, publications, dates, grants, or metrics unless they appear in the provided materials or existing draft.",
    "Keep links empty or relative paths such as /research, /team, /papers, /news."
  ].join(" ");
  const prompt = JSON.stringify({
    task: "Revise the current website preview draft according to a tenant comment.",
    tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug, emailDomain: tenant.emailDomain },
    targetBlock: { id: blockId, label: blockLabel },
    comment,
    files: summarizeFiles(files),
    currentDraft: draft,
    fallbackDraft: localDraft
  });

  try {
    const text = await generateText({ system, prompt, maxOutputTokens: 12000 });
    return { draft: parseJsonFromText(text), mode: "ai", provider: aiStatus().provider };
  } catch (error) {
    return { draft: localDraft, mode: "local", warning: error.message || "ai_failed" };
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
