function sendJson(res, status, body, headers = {}) {
  res.statusCode = status;
  Object.entries({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers
  }).forEach(([key, value]) => res.setHeader(key, value));
  res.end(JSON.stringify(body));
}

function readBody(req, maxBytes = 32 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > maxBytes) {
        reject(new Error("payload_too_large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

async function readJson(req) {
  const body = await readBody(req);
  return body ? JSON.parse(body) : {};
}

function methodNotAllowed(res, allow) {
  res.setHeader("Allow", allow);
  sendJson(res, 405, { ok: false, error: "method_not_allowed" });
}

function requestOrigin(req) {
  const proto = req.headers["x-forwarded-proto"] || "http";
  return `${proto}://${req.headers.host || "localhost"}`;
}

function errorStatus(error) {
  const code = error?.message || "";
  if (["unauthorized", "invalid_credentials", "email_not_verified"].includes(code)) return 401;
  if (["tenant_inactive"].includes(code)) return 403;
  if (["not_found"].includes(code)) return 404;
  if (["payload_too_large"].includes(code)) return 413;
  return 400;
}

module.exports = {
  errorStatus,
  methodNotAllowed,
  readJson,
  requestOrigin,
  sendJson
};
