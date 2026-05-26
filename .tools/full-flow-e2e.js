const assert = require("assert");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { spawn } = require("child_process");

const root = path.resolve(__dirname, "..");
const contentFile = path.join(root, "content.json");
const backup = fs.existsSync(contentFile) ? fs.readFileSync(contentFile, "utf8") : "{}";
const port = 34623;
const baseHost = "127.0.0.1";
const baseDomain = "example.test";
const token = `full-flow-${Date.now()}`;
const superEmail = `super-${Date.now()}@example.edu`;
const superPassword = "correct-super-password";

function request(pathname, options = {}) {
  return new Promise((resolve, reject) => {
    const body = options.body ? JSON.stringify(options.body) : "";
    const headers = {
      ...(options.body ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) } : {}),
      ...(options.cookie ? { Cookie: options.cookie } : {}),
      ...(options.headers || {})
    };
    const req = http.request(
      {
        hostname: baseHost,
        port,
        path: pathname,
        method: options.method || "GET",
        headers
      },
      (res) => {
        let text = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          text += chunk;
        });
        res.on("end", () => {
          let json = null;
          try {
            json = text ? JSON.parse(text) : null;
          } catch {
            // Some routes return HTML.
          }
          resolve({ status: res.statusCode, text, json, headers: res.headers });
        });
      }
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function api(pathname, options = {}) {
  const res = await request(pathname, options);
  assert(res.json, `${pathname} should return JSON, got status ${res.status}: ${res.text.slice(0, 160)}`);
  assert(res.status >= 200 && res.status < 300, `${pathname} failed with ${res.status}: ${res.text}`);
  assert.notStrictEqual(res.json.ok, false, `${pathname} returned ok=false: ${res.text}`);
  return res;
}

function cookieFrom(res) {
  const header = res.headers["set-cookie"];
  assert(header?.length, "response should set a session cookie");
  return String(header[0]).split(";")[0];
}

async function waitForServer(child) {
  const started = Date.now();
  while (Date.now() - started < 10000) {
    if (child.exitCode != null) throw new Error(`server exited early with ${child.exitCode}`);
    try {
      const res = await request("/");
      if (res.status === 200) return;
    } catch {
      // Try again until the server is ready.
    }
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  throw new Error("server did not start");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function run() {
  fs.writeFileSync(contentFile, "{}", "utf8");
  const server = spawn(process.execPath, ["local-server.js"], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port),
      ADMIN_TOKEN: token,
      SUPER_ADMIN_EMAIL: superEmail,
      SUPER_ADMIN_PASSWORD: superPassword,
      SESSION_SECRET: `full-flow-session-${token}`,
      PLATFORM_BASE_DOMAIN: baseDomain,
      AI_API_KEY: "",
      OPENAI_API_KEY: ""
    },
    stdio: "ignore"
  });

  try {
    await waitForServer(server);

    const platform = await api("/api/platform/config");
    assert(platform.json.plans.some((plan) => plan.id === "professional"), "platform config should expose plans");
    assert(platform.json.stylePlugins.some((plugin) => plugin.id === "sustech-lab"), "platform config should expose style plugins");

    const suffix = Date.now();
    const email = `tenant-full-${suffix}@example.edu`;
    const slug = `tenant-full-${suffix}`;
    const register = await api("/api/auth/register", {
      method: "POST",
      body: { email, password: "correct-password", tenantName: "Full Flow Lab", slug }
    });
    assert.strictEqual(register.json.tenant.slug, slug);
    assert.strictEqual(register.json.tenant.planId, "starter");

    const tokenParam = new URL(register.json.verifyUrl).searchParams.get("verify");
    await api("/api/auth/verify-email", { method: "POST", body: { email, token: tokenParam } });

    const login = await api("/api/auth/login", { method: "POST", body: { email, password: "correct-password" } });
    const tenantCookie = cookieFrom(login);
    assert.strictEqual(login.json.user.email, email);

    const draft = await api("/api/tenant/onboarding", {
      method: "POST",
      cookie: tenantCookie,
      body: {
        action: "draft",
        files: [{
          name: "profile.txt",
          type: "text/plain",
          size: 120,
          text: [
            "Full Flow Lab studies climate AI, remote sensing, and Earth system change.",
            "2026 Nature Climate Change. A test publication about climate AI. doi:10.0000/full-flow",
            "National project on carbon, water, and sustainable energy."
          ].join("\n")
        }]
      }
    });
    assert(["ai", "local"].includes(draft.json.mode), "draft should use AI or local fallback mode");
    assert.strictEqual(draft.json.pipeline.version, "professor-understanding-pipeline-v1");
    assert.strictEqual(draft.json.pipeline.constraints.ai_output_is_draft, true);
    assert(draft.json.pipeline.professor_schema.research.areas.length >= 1, "draft should include structured professor schema");
    assert(draft.json.pipeline.positioning.core_message, "draft should include positioning analysis");
    assert(Array.isArray(draft.json.pipeline.ai_discoveries), "draft should include review-only AI discoveries");

    const siteDraft = clone(draft.json.draft);
    for (const locale of ["zh", "en"]) {
      siteDraft[locale].pages = [{
        slug: "projects",
        title: locale === "zh" ? "项目" : "Projects",
        intro: locale === "zh" ? "项目动态页面" : "Project dynamic page",
        enabled: true,
        order: 1,
        modules: [{ type: "text", title: locale === "zh" ? "重点项目" : "Featured project", copy: "Full-flow dynamic page body" }]
      }];
    }
    await api("/api/tenant/onboarding", { method: "POST", cookie: tenantCookie, body: { action: "confirm", data: siteDraft } });

    const meAfterInit = await api("/api/auth/me", { cookie: tenantCookie });
    assert.strictEqual(meAfterInit.json.tenant.onboardingStatus, "complete");

    const tenantContent = await api("/api/tenant/content", { cookie: tenantCookie });
    assert.strictEqual(tenantContent.json.data.zh.pages[0].slug, "projects");
    assert.strictEqual(tenantContent.json.data.pipeline, undefined, "published site content should not embed pipeline metadata");
    assert(!JSON.stringify(tenantContent.json.data).includes("ai_discoveries"), "AI discoveries should not be published as site content");

    const publicContent = await api("/api/tenant/content", {
      headers: { Host: `${slug}.${baseDomain}` }
    });
    assert.strictEqual(publicContent.json.tenant.slug, slug);
    assert.strictEqual(publicContent.json.tenant.planId, undefined, "public tenant payload should not expose planId");
    assert.strictEqual(publicContent.json.tenant.features, undefined, "public tenant payload should not expose features");
    assert.strictEqual(publicContent.json.tenant.aiProviderConfigRef, undefined, "public tenant payload should not expose AI config refs");

    const superLogin = await api("/api/auth/login", { method: "POST", body: { email: superEmail, password: superPassword } });
    const superCookie = cookieFrom(superLogin);
    const tenants = await api("/api/super/tenants", { cookie: superCookie });
    const tenant = tenants.json.tenants.find((item) => item.slug === slug);
    assert(tenant, "super admin should list the registered tenant");

    const updatedTenant = await api("/api/super/tenants", {
      method: "POST",
      cookie: superCookie,
      body: {
        id: tenant.id,
        planId: "professional",
        status: "active",
        stylePluginId: "minimal-academic",
        subdomain: slug,
        aiProviderConfigRef: "platform-default"
      }
    });
    assert.strictEqual(updatedTenant.json.tenant.planId, "professional");
    assert.strictEqual(updatedTenant.json.tenant.features.customDomain, true);
    assert.strictEqual(updatedTenant.json.tenant.features.analytics, true);

    await api("/api/tenant/settings", {
      method: "POST",
      cookie: tenantCookie,
      body: {
        stylePluginId: "sustech-lab",
        domains: [
          `${slug}-one.example.edu`,
          `${slug}-two.example.edu`,
          `${slug}-three.example.edu`
        ]
      }
    });
    const tooManyDomains = await request("/api/tenant/settings", {
      method: "POST",
      cookie: tenantCookie,
      body: {
        domains: [
          `${slug}-a.example.edu`,
          `${slug}-b.example.edu`,
          `${slug}-c.example.edu`,
          `${slug}-d.example.edu`
        ]
      }
    });
    assert.strictEqual(tooManyDomains.status, 400, "tenant domain limit should be enforced");
    assert(tooManyDomains.text.includes("domain_limit_exceeded"));

    await api("/api/tenant/analytics", {
      method: "POST",
      headers: { Host: `${slug}.${baseDomain}` },
      body: { path: "/projects/", referrer: "https://example.edu", visitorId: "full-flow-visitor-1" }
    });
    const analytics = await api("/api/tenant/analytics", { cookie: tenantCookie });
    assert(analytics.json.totals.pv >= 1, "analytics should record PV");
    assert(!JSON.stringify(analytics.json).includes("full-flow-visitor-1"), "analytics summary should not leak visitor keys");

    const review = await api("/api/tenant/review-queue", {
      method: "POST",
      cookie: tenantCookie,
      body: {
        action: "create",
        source: "manual",
        sourceUrl: "https://example.edu/news/full-flow",
        title: "Full flow candidate news",
        summary: "Candidate summary",
        aiSuggestion: "Suggested publication copy",
        target: "news"
      }
    });
    assert.strictEqual(review.json.item.status, "pending");
    const approved = await api("/api/tenant/review-queue", {
      method: "POST",
      cookie: tenantCookie,
      body: { id: review.json.item.id, status: "approved", reviewerNote: "Looks good" }
    });
    assert.strictEqual(approved.json.item.status, "approved");

    const wechatQueue = await api("/api/wechat/review-items", { cookie: tenantCookie });
    assert(wechatQueue.json.items.some((item) => item.id === review.json.item.id), "wechat-compatible review endpoint should expose review items with tenant session");

    await api("/api/auth/change-password", {
      method: "POST",
      cookie: tenantCookie,
      body: { currentPassword: "correct-password", newPassword: "new-correct-password" }
    });
    const relogin = await api("/api/auth/login", { method: "POST", body: { email, password: "new-correct-password" } });
    assert(cookieFrom(relogin), "tenant should be able to login with changed password");

    const dynamicShell = await request("/projects/");
    assert.strictEqual(dynamicShell.status, 200, "dynamic page direct route should return shell");
    assert(dynamicShell.text.includes("script.js"), "dynamic page shell should include script");

    console.log("Full flow E2E passed");
  } finally {
    fs.writeFileSync(contentFile, backup || "{}", "utf8");
    server.kill();
  }
}

run().catch((error) => {
  fs.writeFileSync(contentFile, backup || "{}", "utf8");
  console.error(error);
  process.exit(1);
});
