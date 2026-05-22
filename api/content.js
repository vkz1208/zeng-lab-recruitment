const { validateContentData } = require("../content-schema");
const { readContentData, writeContentData } = require("../content-store");

const adminToken = process.env.ADMIN_TOKEN || "";

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > 2 * 1024 * 1024) {
        reject(new Error("payload_too_large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    const { data, source } = await readContentData();
    send(res, 200, { ok: true, source, data });
    return;
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    send(res, 405, { ok: false, error: "method_not_allowed" });
    return;
  }

  if (!adminToken || req.headers["x-admin-token"] !== adminToken) {
    send(res, 401, { ok: false, error: "unauthorized" });
    return;
  }

  try {
    const body = await readBody(req);
    const data = JSON.parse(body || "{}");
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      send(res, 400, { ok: false, error: "invalid_content" });
      return;
    }
    const validation = validateContentData(data);
    if (!validation.valid) {
      send(res, 400, { ok: false, error: "invalid_schema", details: validation.errors });
      return;
    }
    const { source } = await writeContentData(data);
    send(res, 200, { ok: true, source });
  } catch (error) {
    send(res, error.message === "payload_too_large" ? 413 : 400, { ok: false, error: error.message || "bad_request" });
  }
};
