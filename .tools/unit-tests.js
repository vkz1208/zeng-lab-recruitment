const assert = require("assert");
const { validateContentData } = require("../content-schema");
const {
  analyzeEmailDomain,
  listTenants,
  hashPassword,
  login,
  registerTenant,
  resolveTenantByHost,
  publicTenantForVisitor,
  sessionCookie,
  updateTenant,
  updateTenantSettings,
  verifyEmailToken,
  verifyPassword
} = require("../tenant-auth");
const { readTenantContentData, writeTenantContentData } = require("../content-store");
const { generateAcademicSiteDraft, generateProfessorUnderstandingPipeline } = require("../academic-site-generator");
const {
  applyLocalCommentToDraft,
  blockMap,
  createTask,
  estimateSeconds,
  getBlockPath,
  progressForStatus,
  sanitizeFilesAsync,
  updateTask
} = require("../onboarding-workflow");

function testContentSchema() {
  assert.deepStrictEqual(validateContentData({}), { valid: true, errors: [] });

  const valid = validateContentData({
    zh: {
      papers: {
        items: [
          {
            year: "2099",
            journal: "E2E Journal",
            title: "Valid paper",
            authors: "Admin CRUD",
            link: "https://example.com/paper",
            tags: ["test"]
          }
        ]
      },
      news: {
        items: [
          {
            date: "2099",
            title: "Valid news",
            copy: "Valid copy",
            link: "/news"
          }
        ]
      },
      resources: {
        items: [
          {
            title: "Valid resource",
            copy: "Valid copy",
            image: "assets/resources/Fig1.png",
            link: "mailto:zengbb@mail.sustech.edu.cn"
          }
        ]
      }
    }
  });
  assert.strictEqual(valid.valid, true, valid.errors.join("; "));

  const invalidLink = validateContentData({
    zh: {
      resources: {
        items: [
          {
            title: "Bad",
            copy: "Bad",
            link: "javascript:alert(1)"
          }
        ]
      }
    }
  });
  assert.strictEqual(invalidLink.valid, false);
  assert(invalidLink.errors.some((item) => item.includes("unsupported URL")));

  const invalidPaper = validateContentData({
    zh: {
      papers: {
        items: [{ title: "Missing fields" }]
      }
    }
  });
  assert.strictEqual(invalidPaper.valid, false);
  assert(invalidPaper.errors.some((item) => item.includes("year")));
}

async function testTenantAuth() {
  const passwordHash = await hashPassword("correct-password");
  assert.strictEqual(await verifyPassword("correct-password", passwordHash), true);
  assert.strictEqual(await verifyPassword("wrong-password", passwordHash), false);

  assert(analyzeEmailDomain("pi@university.edu").flags.includes("academic"));
  assert(analyzeEmailDomain("person@gmail.com").flags.includes("freemail"));

  const suffix = Date.now();
  const email = `tenant-${suffix}@example.edu`;
  const registered = await registerTenant({
    email,
    password: "correct-password",
    tenantName: "Tenant Test",
    slug: `tenant-test-${suffix}`,
    origin: "http://localhost:3000"
  });
  assert.strictEqual(registered.user.emailVerified, false);
  await assert.rejects(() => login({ email, password: "correct-password" }), /email_not_verified/);

  const token = new URL(registered.verifyUrl).searchParams.get("verify");
  await verifyEmailToken({ email, token });
  const loggedIn = await login({ email, password: "correct-password" });
  assert.strictEqual(loggedIn.user.email, email);
  assert(sessionCookie({ userId: loggedIn.user.id }).includes("HttpOnly"));

  const superReq = { headers: { "x-super-admin-token": "unit-super" } };
  process.env.SUPER_ADMIN_TOKEN = "unit-super";
  const updated = await updateTenant(superReq, { id: registered.tenant.id, planId: "professional" });
  assert.strictEqual(updated.planId, "professional");
  assert.strictEqual(updated.features.customDomain, true);
  assert.strictEqual(updated.features.analytics, true);
  const visitorTenant = publicTenantForVisitor(updated);
  assert.strictEqual(visitorTenant.planId, undefined);
  assert.strictEqual(visitorTenant.features, undefined);
  assert.strictEqual(visitorTenant.aiProviderConfigRef, undefined);
  const listed = await listTenants(superReq);
  assert(listed.some((tenant) => tenant.id === registered.tenant.id && tenant.planId === "professional"));

  process.env.PLATFORM_BASE_DOMAIN = "example.test";
  const resolved = await resolveTenantByHost(`${registered.tenant.slug}.example.test`);
  assert.strictEqual(resolved.id, registered.tenant.id);

  await writeTenantContentData(registered.tenant.id, { zh: { home: { title: "Tenant A" } } });
  await writeTenantContentData("tenant_other", { zh: { home: { title: "Tenant B" } } });
  const first = await readTenantContentData(registered.tenant.id);
  const second = await readTenantContentData("tenant_other");
  assert.strictEqual(first.data.zh.home.title, "Tenant A");
  assert.strictEqual(second.data.zh.home.title, "Tenant B");

  const tenantReq = { headers: { cookie: sessionCookie({ userId: loggedIn.user.id, tenantId: loggedIn.user.tenantId, role: loggedIn.user.role }).match(/^[^;]+/)?.[0] || "" } };
  await assert.rejects(
    () => updateTenantSettings(tenantReq, { domains: ["a.example.com", "b.example.com", "c.example.com", "d.example.com"] }),
    /domain_limit_exceeded/
  );
}

function testAcademicDraftGenerator() {
  const input = {
    tenant: { id: "tenant_unit", name: "Climate AI Lab" },
    files: [{
      name: "cv.txt",
      text: [
        "Jane Doe, Professor, climate and remote sensing.",
        "2024 Nature Climate Change. Machine learning for climate risk. doi:10.0000/test",
        "National project on carbon cycle and water resources."
      ].join("\n")
    }]
  };
  const pipeline = generateProfessorUnderstandingPipeline(input);
  assert.strictEqual(pipeline.version, "professor-understanding-pipeline-v1");
  assert.strictEqual(pipeline.tenant_id, "tenant_unit");
  assert.strictEqual(pipeline.constraints.ai_output_is_draft, true);
  assert.strictEqual(pipeline.professor_schema.profile.name, "Jane Doe");
  assert(pipeline.professor_schema.research.areas.length >= 1);
  assert(pipeline.semantic_understanding.academic_identity.primary_domain);
  assert(pipeline.positioning.core_message);
  assert(Array.isArray(pipeline.ai_discoveries));

  const draft = generateAcademicSiteDraft({ ...input, pipeline });
  assert(draft.zh.home.title.includes("Climate AI Lab"));
  assert(draft.zh.papers.items.length >= 1);
  assert(draft.zh.research.directions.length >= 1);
}

function testOnboardingWorkflow() {
  assert.deepStrictEqual(getBlockPath("home.hero"), ["zh.home", "en.home"]);
  assert(blockMap["papers.items"]);
  const seconds = estimateSeconds({ comment: "Please make the homepage more specific.", files: [{ name: "cv.txt" }] });
  assert(seconds >= 18);
  const task = createTask({ type: "comment", blockId: "home.hero", comment: "Improve headline", estimatedSeconds: seconds });
  assert.strictEqual(task.status, "queued");
  assert.strictEqual(task.progressPercent, progressForStatus("queued"));
  updateTask(task, "editing", "Updating draft.");
  assert.strictEqual(task.status, "editing");
  assert(task.steps.some((step) => step.key === "editing" && step.status === "active"));
  const draft = {
    zh: { home: { title: "Lab", copy: "Original" }, news: { items: [] } },
    en: { home: { title: "Lab", copy: "Original" }, news: { items: [] } }
  };
  const revised = applyLocalCommentToDraft(draft, { blockId: "home.hero", comment: "Emphasize climate AI." });
  assert(revised.zh.home.copy.includes("Emphasize climate AI."));
  assert.strictEqual(draft.zh.home.copy, "Original");
}

async function testPdfExtraction() {
  const pdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >> endobj
4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
5 0 obj << /Length 84 >> stream
BT /F1 12 Tf 72 720 Td (Chen Professor PDF Climate AI Publication) Tj ET
endstream endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000241 00000 n 
0000000311 00000 n 
trailer << /Size 6 /Root 1 0 R >>
startxref
445
%%EOF`;
  const files = await sanitizeFilesAsync([{
    name: "chen-cv.pdf",
    type: "application/pdf",
    size: Buffer.byteLength(pdf),
    dataBase64: Buffer.from(pdf).toString("base64"),
    text: ""
  }]);
  assert(files[0].text.includes("Chen Professor PDF Climate AI Publication"));
}

(async () => {
  testContentSchema();
  testAcademicDraftGenerator();
  testOnboardingWorkflow();
  await testPdfExtraction();
  await testTenantAuth();
  console.log("Unit tests passed");
})();
