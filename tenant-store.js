const path = require("path");
const { readJsonStore, writeJsonStore } = require("./content-store");

const root = __dirname;
const storeDir = path.join(root, ".data");

const stores = {
  tenants: {
    blobPath: process.env.TENANTS_BLOB_PATH || "tenants.json",
    localFile: path.join(storeDir, "tenants.json"),
    fallback: { tenants: [] }
  },
  users: {
    blobPath: process.env.USERS_BLOB_PATH || "users.json",
    localFile: path.join(storeDir, "users.json"),
    fallback: { users: [] }
  },
  verifications: {
    blobPath: process.env.EMAIL_VERIFICATIONS_BLOB_PATH || "email-verifications.json",
    localFile: path.join(storeDir, "email-verifications.json"),
    fallback: { tokens: [] }
  }
};

async function readStore(name) {
  return readJsonStore(stores[name].blobPath, stores[name].localFile, stores[name].fallback);
}

async function writeStore(name, data) {
  return writeJsonStore(stores[name].blobPath, stores[name].localFile, data);
}

async function loadTenantData() {
  const [{ data: tenants }, { data: users }, { data: verifications }] = await Promise.all([
    readStore("tenants"),
    readStore("users"),
    readStore("verifications")
  ]);
  return {
    tenants: Array.isArray(tenants.tenants) ? tenants.tenants : [],
    users: Array.isArray(users.users) ? users.users : [],
    tokens: Array.isArray(verifications.tokens) ? verifications.tokens : []
  };
}

module.exports = {
  loadTenantData,
  readStore,
  writeStore
};
