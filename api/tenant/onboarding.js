const { validateContentData } = require("../../content-schema");
const { writeTenantContentData } = require("../../content-store");
const { errorStatus, methodNotAllowed, readJson, sendJson } = require("../../api-utils");
const { generateAcademicSiteDraft } = require("../../academic-site-generator");
const { generateAcademicSiteDraftWithAi, reviseAcademicSiteDraftWithAi } = require("../../ai-provider");
const {
  blockMap,
  createTask,
  estimateSeconds,
  getOnboardingSession,
  sanitizeFiles,
  saveDraftVersion,
  updateOnboardingSession,
  updateTask
} = require("../../onboarding-workflow");
const { markTenantInitialized, requireTenantAdmin } = require("../../tenant-auth");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, "POST");
  try {
    const input = await readJson(req);
    const context = await requireTenantAdmin(req);
    if (input.action === "draft") {
      const files = sanitizeFiles(Array.isArray(input.files) ? input.files : []);
      const fallbackDraft = generateAcademicSiteDraft({ tenant: context.tenant, files });
      const result = await generateAcademicSiteDraftWithAi({ tenant: context.tenant, files, fallbackDraft });
      const session = await updateOnboardingSession(context.tenant.id, (draftSession) => {
        draftSession.files = files;
        saveDraftVersion(draftSession, result.draft, "initial_draft");
        return draftSession;
      });
      sendJson(res, 200, { ok: true, draft: result.draft, session, blocks: blockMap, mode: result.mode, warning: result.warning, tenant: context.tenant });
      return;
    }
    if (input.action === "regenerate") {
      const session = await getOnboardingSession(context.tenant.id);
      const extraPrompt = String(input.instructions || "").trim();
      const files = [...(session.files || [])];
      if (extraPrompt) {
        files.push({ name: "regeneration-instructions.txt", type: "text/plain", size: extraPrompt.length, text: extraPrompt });
      }
      if (!files.length) throw new Error("missing_onboarding_materials");
      const fallbackDraft = generateAcademicSiteDraft({ tenant: context.tenant, files });
      const result = await generateAcademicSiteDraftWithAi({ tenant: context.tenant, files, fallbackDraft });
      const nextSession = await updateOnboardingSession(context.tenant.id, (draftSession) => {
        draftSession.files = session.files || [];
        saveDraftVersion(draftSession, result.draft, "regenerate");
        return draftSession;
      });
      sendJson(res, 200, { ok: true, draft: result.draft, session: nextSession, blocks: blockMap, mode: result.mode, warning: result.warning, tenant: context.tenant });
      return;
    }
    if (input.action === "comment") {
      const session = await getOnboardingSession(context.tenant.id);
      const currentDraft = input.draft && typeof input.draft === "object" && !Array.isArray(input.draft)
        ? input.draft
        : session.currentDraft;
      if (!currentDraft) throw new Error("missing_preview_draft");
      const blockId = String(input.blockId || "");
      if (!blockMap[blockId]) throw new Error("invalid_block");
      const comment = String(input.comment || "").trim();
      if (comment.length < 3) throw new Error("missing_comment");
      const task = createTask({
        type: "comment",
        blockId,
        comment,
        estimatedSeconds: estimateSeconds({ comment, files: session.files || [] })
      });
      await updateOnboardingSession(context.tenant.id, (draftSession) => {
        draftSession.currentDraft = currentDraft;
        draftSession.comments = [...(draftSession.comments || []), {
          id: `comment_${Date.now()}`,
          blockId,
          blockLabel: blockMap[blockId].label,
          comment,
          createdAt: new Date().toISOString()
        }].slice(-50);
        draftSession.tasks = [task, ...(draftSession.tasks || [])].slice(0, 30);
        return draftSession;
      });

      updateTask(task, "analyzing", "Reading the target section and your requested change.");
      updateTask(task, "editing", "Revising the preview draft while preserving the existing website structure.");
      const result = await reviseAcademicSiteDraftWithAi({
        tenant: context.tenant,
        draft: currentDraft,
        files: session.files || [],
        blockId,
        blockLabel: blockMap[blockId].label,
        comment
      });
      updateTask(task, "validating", "Checking that the revised draft still matches the website schema.");
      const validation = validateContentData(result.draft);
      if (!validation.valid) {
        updateTask(task, "failed", "The revised draft did not pass content validation.");
        task.error = validation.errors.join("; ");
      } else {
        task.resultDraft = result.draft;
        task.mode = result.mode;
        task.warning = result.warning || "";
        updateTask(task, "complete", "The revised preview is ready to review.");
      }
      const nextSession = await updateOnboardingSession(context.tenant.id, (draftSession) => {
        draftSession.tasks = [task, ...(draftSession.tasks || []).filter((item) => item.id !== task.id)].slice(0, 30);
        if (task.status === "complete") saveDraftVersion(draftSession, task.resultDraft, `comment:${blockId}`);
        return draftSession;
      });
      sendJson(res, 200, { ok: true, task, session: nextSession });
      return;
    }
    if (input.action === "confirm") {
      const data = input.data;
      if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("invalid_content");
      const validation = validateContentData(data);
      if (!validation.valid) {
        sendJson(res, 400, { ok: false, error: "invalid_schema", details: validation.errors });
        return;
      }
      const saved = await writeTenantContentData(context.tenant.id, data);
      await updateOnboardingSession(context.tenant.id, (draftSession) => {
        draftSession.currentDraft = data;
        saveDraftVersion(draftSession, data, "confirmed");
        return draftSession;
      });
      const tenant = await markTenantInitialized(req);
      sendJson(res, 200, { ok: true, source: saved.source, tenant });
      return;
    }
    throw new Error("invalid_action");
  } catch (error) {
    sendJson(res, errorStatus(error), { ok: false, error: error.message || "bad_request" });
  }
};
