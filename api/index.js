const content = require("./content");
const authRegister = require("./auth/register");
const authVerifyEmail = require("./auth/verify-email");
const authLogin = require("./auth/login");
const authLogout = require("./auth/logout");
const authMe = require("./auth/me");
const authChangePassword = require("./auth/change-password");
const platformConfig = require("./platform/config");
const tenantContent = require("./tenant/content");
const tenantAi = require("./tenant/ai");
const tenantOnboarding = require("./tenant/onboarding");
const tenantOnboardingTask = require("./tenant/onboarding-task");
const tenantSettings = require("./tenant/settings");
const tenantAnalytics = require("./tenant/analytics");
const tenantReviewQueue = require("./tenant/review-queue");
const wechatReviewItems = require("./wechat/review-items");
const superTenants = require("./super/tenants");

const routes = new Map([
  ["/api/auth/register", authRegister],
  ["/api/auth/verify-email", authVerifyEmail],
  ["/api/auth/login", authLogin],
  ["/api/auth/logout", authLogout],
  ["/api/auth/me", authMe],
  ["/api/auth/change-password", authChangePassword],
  ["/api/platform/config", platformConfig],
  ["/api/tenant/content", tenantContent],
  ["/api/tenant/ai", tenantAi],
  ["/api/tenant/onboarding", tenantOnboarding],
  ["/api/tenant/onboarding-task", tenantOnboardingTask],
  ["/api/tenant/settings", tenantSettings],
  ["/api/tenant/analytics", tenantAnalytics],
  ["/api/tenant/review-queue", tenantReviewQueue],
  ["/api/wechat/review-items", wechatReviewItems],
  ["/api/super/tenants", superTenants],
  ["/api/content", content]
]);

module.exports = async function handler(req, res) {
  const url = new URL(req.url, `https://${req.headers.host || "localhost"}`);
  const route = routes.get(url.pathname);
  if (!route) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, error: "not_found" }));
    return;
  }
  return route(req, res);
};
