const defaultPlans = [
  {
    id: "starter",
    name: "Starter",
    priceMode: "manual",
    services: ["AI draft generation", "Tenant admin", "Platform subdomain"],
    aiQuota: 20,
    domainLimit: 1,
    autoFetchFrequency: "manual",
    analyticsLevel: "basic",
    collaboratorLimit: 1,
    features: {
      aiDraft: true,
      customDomain: false,
      styleSwitching: true,
      dynamicPages: true,
      analytics: false,
      autoMaintenance: false,
      wechatReview: false,
      collaborators: false
    },
    enabled: true
  },
  {
    id: "professional",
    name: "Professional",
    priceMode: "manual",
    services: ["AI draft generation", "Custom domain", "Style switching", "Basic analytics"],
    aiQuota: 200,
    domainLimit: 3,
    autoFetchFrequency: "weekly",
    analyticsLevel: "standard",
    collaboratorLimit: 5,
    features: {
      aiDraft: true,
      customDomain: true,
      styleSwitching: true,
      dynamicPages: true,
      analytics: true,
      autoMaintenance: false,
      wechatReview: false,
      collaborators: true
    },
    enabled: true
  },
  {
    id: "institution",
    name: "Institution",
    priceMode: "manual",
    services: ["Multiple domains", "Advanced analytics", "Review workflow", "Priority support"],
    aiQuota: 1000,
    domainLimit: 10,
    autoFetchFrequency: "daily",
    analyticsLevel: "advanced",
    collaboratorLimit: 20,
    features: {
      aiDraft: true,
      customDomain: true,
      styleSwitching: true,
      dynamicPages: true,
      analytics: true,
      autoMaintenance: true,
      wechatReview: true,
      collaborators: true
    },
    enabled: true
  }
];

const defaultStylePlugins = [
  {
    id: "sustech-lab",
    name: "SUSTech Lab",
    version: "1.0.0",
    status: "enabled",
    pages: ["home", "team", "papers", "research", "news", "join", "contact", "dynamic"],
    modules: ["hero", "cards", "paper-list", "member-list", "news-list", "rich-text"],
    assetPath: "styles.css",
    previewImage: "",
    theme: { palette: "academic-green", density: "editorial" },
    defaults: {},
    schemaVersion: "content-v1"
  },
  {
    id: "minimal-academic",
    name: "Minimal Academic",
    version: "0.1.0",
    status: "enabled",
    pages: ["home", "team", "papers", "research", "news", "contact", "dynamic"],
    modules: ["hero", "cards", "paper-list", "member-list", "news-list", "rich-text"],
    assetPath: "styles.css",
    previewImage: "",
    theme: { palette: "neutral", density: "compact" },
    defaults: {},
    schemaVersion: "content-v1"
  }
];

const defaultFeatureSet = {
  aiDraft: true,
  customDomain: false,
  styleSwitching: true,
  dynamicPages: true,
  analytics: false,
  autoMaintenance: false,
  wechatReview: false,
  collaborators: false
};

function listPlans() {
  return defaultPlans.map((plan) => ({ ...plan, services: [...plan.services], features: { ...plan.features } }));
}

function planById(planId = "") {
  return listPlans().find((plan) => plan.id === planId) || listPlans().find((plan) => plan.id === "starter") || listPlans()[0];
}

function listStylePlugins() {
  return defaultStylePlugins.map((plugin) => ({
    ...plugin,
    pages: [...plugin.pages],
    modules: [...plugin.modules],
    theme: { ...plugin.theme },
    defaults: { ...plugin.defaults }
  }));
}

function enabledPlanIds() {
  return new Set(defaultPlans.filter((plan) => plan.enabled).map((plan) => plan.id));
}

function enabledStylePluginIds() {
  return new Set(defaultStylePlugins.filter((plugin) => plugin.status === "enabled").map((plugin) => plugin.id));
}

function publicPlatformConfig() {
  return {
    plans: listPlans(),
    stylePlugins: listStylePlugins(),
    defaultFeatures: { ...defaultFeatureSet }
  };
}

module.exports = {
  defaultFeatureSet,
  enabledPlanIds,
  enabledStylePluginIds,
  listPlans,
  listStylePlugins,
  planById,
  publicPlatformConfig
};
