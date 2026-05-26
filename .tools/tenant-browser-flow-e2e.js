const assert = require("assert");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const { chromium } = require("playwright-core");

const root = path.resolve(__dirname, "..");
const port = 34631;
const baseDomain = "example.test";
const runId = Date.now();
const email = `tenant-browser-${runId}@example.edu`;
const password = "correct-password";
const tenantName = `Tenant Browser Flow Lab ${runId}`;
const slug = `tenant-browser-${runId}`;
const publicBase = `http://${slug}.${baseDomain}:${port}`;
const adminBase = publicBase;

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
        hostname: "127.0.0.1",
        port,
        path: pathname,
        method: options.method || "GET",
        headers
      },
      (res) => {
        let text = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => { text += chunk; });
        res.on("end", () => {
          let json = null;
          try {
            json = text ? JSON.parse(text) : null;
          } catch {
            // HTML responses are expected for page routes.
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
  assert(res.json, `${pathname} should return JSON, got ${res.status}: ${res.text.slice(0, 180)}`);
  assert(res.status >= 200 && res.status < 300, `${pathname} failed with ${res.status}: ${res.text}`);
  assert.notStrictEqual(res.json.ok, false, `${pathname} returned ok=false: ${res.text}`);
  return res;
}

async function waitForServer(child) {
  const started = Date.now();
  while (Date.now() - started < 10000) {
    if (child.exitCode != null) throw new Error(`server exited early with ${child.exitCode}`);
    try {
      const res = await request("/");
      if (res.status === 200) return;
    } catch {
      // Wait until local-server is ready.
    }
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  throw new Error("server did not start");
}

function attr(name, value) {
  return `[${name}="${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"]`;
}

async function assertVisibleText(page, text, message) {
  const locator = page.getByText(text, { exact: false });
  await locator.first().waitFor({ state: "visible", timeout: 12000 });
  assert((await locator.count()) > 0, message || `Expected visible text: ${text}`);
}

async function fillField(page, fieldPath, value) {
  const field = page.locator(attr("data-field", fieldPath)).first();
  await field.waitFor({ state: "attached", timeout: 12000 });
  await field.evaluate((element, nextValue) => {
    element.value = nextValue;
    element.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
}

async function addArrayItem(page, arrayPath) {
  const before = await page.locator(attr("data-delete", arrayPath)).count();
  await page.locator(attr("data-add", arrayPath)).first().evaluate((element) => element.click());
  await page.locator(attr("data-delete", arrayPath)).nth(before).waitFor({ state: "attached", timeout: 12000 });
  return before;
}

async function deleteArrayItem(page, arrayPath, index) {
  await page.locator(`${attr("data-delete", arrayPath)}${attr("data-index", String(index))}`).evaluate((element) => element.click());
}

async function saveAdmin(page) {
  const dialogPromise = page.waitForEvent("dialog");
  await page.locator("#save-admin").click();
  const dialog = await dialogPromise;
  assert(/Saved|已保存/.test(dialog.message()), `unexpected save dialog: ${dialog.message()}`);
  await dialog.accept();
}

function writeTempMaterials() {
  const profilePath = path.join(os.tmpdir(), `tenant-browser-profile-${runId}.txt`);
  fs.writeFileSync(profilePath, [
    `${tenantName} studies climate AI, remote sensing, carbon-water interactions, and Earth system change.`,
    "2026 Nature Climate Change. Tenant Browser Flow Paper about climate AI and remote sensing. doi:10.1234/browser-flow",
    "National project Tenant Browser Flow Carbon Observatory project grant for sustainable energy and water security.",
    "Ada Chen, PhD student, works on climate AI and data-driven ecology."
  ].join("\n"), "utf8");

  const imagePath = path.join(os.tmpdir(), `tenant-browser-hero-${runId}.png`);
  fs.writeFileSync(imagePath, Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lK3q9wAAAABJRU5ErkJggg==",
    "base64"
  ));
  return { profilePath, imagePath };
}

async function run() {
  const materials = writeTempMaterials();
  const server = spawn(process.execPath, ["local-server.js"], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port),
      ADMIN_TOKEN: `tenant-browser-admin-${runId}`,
      SESSION_SECRET: `tenant-browser-session-${runId}`,
      PLATFORM_BASE_DOMAIN: baseDomain,
      AI_API_KEY: "",
      OPENAI_API_KEY: ""
    },
    stdio: "ignore"
  });

  let browser;
  try {
    await waitForServer(server);

    const register = await api("/api/auth/register", {
      method: "POST",
      body: { email, password, tenantName, slug }
    });
    const token = new URL(register.json.verifyUrl).searchParams.get("verify");
    await api("/api/auth/verify-email", { method: "POST", body: { email, token } });

    browser = await chromium.launch({
      headless: true,
      args: [
        "--proxy-server=direct://",
        "--proxy-bypass-list=*",
        `--host-resolver-rules=MAP *.${baseDomain} 127.0.0.1`
      ]
    });
    const page = await browser.newPage();
    page.on("pageerror", (error) => {
      throw error;
    });

    await page.goto(`${adminBase}/admin/`);
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill(password);
    await page.locator("#auth-form button.save").click();

    await page.waitForSelector("#onboarding-form", { timeout: 15000 });
    await page.setInputFiles("#onboarding-files", materials.profilePath);
    await page.locator("#onboarding-school-url").fill("https://example.edu/climate-ai");
    await page.locator("#onboarding-homepage-url").fill("https://existing-lab.example.edu");
    await page.locator("#onboarding-scholar-url").fill("https://scholar.google.com/citations?user=tenant-flow");
    await page.locator("#onboarding-links").fill("https://github.com/example/climate-ai\nhttps://orcid.org/0000-0000-0000-0000");
    await page.locator("#onboarding-notes").fill("Please generate a bilingual professor lab website with project pages, papers, team, and climate AI imagery placeholders.");
    await page.locator("#onboarding-form button.save").click();

    await page.waitForSelector("#confirm-onboarding", { timeout: 20000 });
    await assertVisibleText(page, tenantName, "draft preview should include tenant name");
    await page.locator("#confirm-onboarding").click();
    await page.waitForSelector("#save-admin", { timeout: 20000 });

    await page.goto(`${publicBase}/`);
    await page.waitForLoadState("load");
    await assertVisibleText(page, tenantName, "published homepage should include generated tenant name");
    await page.goto(`${publicBase}/papers/`);
    await page.waitForLoadState("load");
    await page.locator('[data-filter="paper-tab"] [data-value="all"]').click();
    await assertVisibleText(page, "Tenant Browser Flow Paper", "generated papers page should include uploaded publication clue");
    await page.goto(`${publicBase}/research/`);
    await page.waitForLoadState("load");
    await assertVisibleText(page, "Tenant Browser Flow Carbon Observatory", "generated research/resources should include uploaded project clue");

    await page.goto(`${adminBase}/admin/`);
    await page.waitForSelector("#save-admin", { timeout: 15000 });
    const editedHomeTitle = `${tenantName} Edited Homepage`;
    const addedNewsTitle = `${tenantName} Added News`;
    const deletedNewsTitle = `${tenantName} Temporary News`;
    const heroField = "root.zh.home.heroImage";

    await fillField(page, "root.zh.home.title", editedHomeTitle);
    await page.locator(attr("data-upload", heroField)).first().setInputFiles(materials.imagePath);
    await page.waitForFunction((fieldPath) => {
      const input = document.querySelector(`[data-field="${CSS.escape(fieldPath)}"]`);
      return input?.value?.startsWith("data:image/png");
    }, heroField);

    const newsIndex = await addArrayItem(page, "root.zh.news.items");
    await fillField(page, `root.zh.news.items.${newsIndex}.date`, "2099");
    await fillField(page, `root.zh.news.items.${newsIndex}.title`, addedNewsTitle);
    await fillField(page, `root.zh.news.items.${newsIndex}.copy`, "Tenant browser flow added news body.");
    await fillField(page, `root.zh.news.items.${newsIndex}.link`, "");

    const deleteIndex = await addArrayItem(page, "root.zh.news.items");
    await fillField(page, `root.zh.news.items.${deleteIndex}.date`, "2099");
    await fillField(page, `root.zh.news.items.${deleteIndex}.title`, deletedNewsTitle);
    await fillField(page, `root.zh.news.items.${deleteIndex}.copy`, "This item should be deleted before publish.");
    await deleteArrayItem(page, "root.zh.news.items", deleteIndex);

    await saveAdmin(page);

    await page.goto(`${publicBase}/`);
    await page.waitForLoadState("load");
    await assertVisibleText(page, editedHomeTitle, "edited homepage title should appear on public site");
    const heroSrc = await page.locator(".hero img.card-media--hero").first().getAttribute("src");
    assert(heroSrc?.startsWith("data:image/png"), "uploaded hero image should be saved and rendered on public homepage");

    await page.goto(`${publicBase}/news/`);
    await page.waitForLoadState("load");
    const yearChip = page.locator('[data-filter="news-year"] [data-value="2099"]');
    if (await yearChip.count()) await yearChip.click();
    await assertVisibleText(page, addedNewsTitle, "added news should appear on public news page");
    assert.strictEqual(await page.getByText(deletedNewsTitle, { exact: false }).count(), 0, "deleted news should not appear on public news page");

    const tenantContent = await api("/api/tenant/content", {
      headers: { Host: `${slug}.${baseDomain}` }
    });
    const json = JSON.stringify(tenantContent.json.data);
    assert(json.includes(editedHomeTitle), "tenant content API should persist edited homepage title");
    assert(json.includes(addedNewsTitle), "tenant content API should persist added news");
    assert(!json.includes(deletedNewsTitle), "tenant content API should not persist deleted news");

    console.log("Tenant browser flow E2E passed");
  } finally {
    if (browser) await browser.close();
    server.kill();
    fs.rmSync(materials.profilePath, { force: true });
    fs.rmSync(materials.imagePath, { force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
