const pageDirs = ["admin", "super-admin", "team", "papers", "research", "resources", "news", "join", "contact"];

const publicRootFiles = [
  "index.html",
  "styles.css",
  "admin.css",
  "api-client.js",
  "admin-ui.js",
  "admin-auth-ui.js",
  "public-pages-ui.js",
  "team-ui.js",
  "script.js",
  "site-data.js",
  "papers-data.js",
  "content.json"
];

const serverRuntimeFiles = [
  "api-utils.js",
  "content-schema.js",
  "content-store.js",
  "analytics-store.js",
  "review-store.js",
  "academic-site-generator.js",
  "ai-provider.js",
  "platform-config.js",
  "tenant-auth.js",
  "tenant-model.js",
  "tenant-store.js"
];

const copyDirs = ["assets", "data"];

function pageIndexFiles() {
  return pageDirs.map((dir) => `${dir}/index.html`);
}

function vercelFiles() {
  return [
    ...publicRootFiles,
    ...serverRuntimeFiles,
    ...pageIndexFiles()
  ];
}

module.exports = {
  copyDirs,
  pageDirs,
  pageIndexFiles,
  publicRootFiles,
  serverRuntimeFiles,
  vercelFiles
};
