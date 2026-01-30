// src/data/carePlanStore.js
const STORAGE_KEY = "theraa_nurse_careplans_v1";

function loadAll() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveAll(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data || {}));
}

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Load all versions for a client (newest first)
 */
export function loadCarePlanVersions(clientId) {
  const all = loadAll();
  const list = all[clientId] || [];
  return [...list].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/**
 * Save a new version of a care plan
 */
export function saveCarePlanVersion({
  clientId,
  status = "draft", // draft | reviewed
  plan,
  evidenceCount = 0,
}) {
  if (!clientId) return null;

  const all = loadAll();
  const existing = all[clientId] || [];

  const version = {
    id: uid(),
    clientId,
    status,
    plan: plan || {},
    evidenceCount: typeof evidenceCount === "number" ? evidenceCount : 0,
    createdAt: new Date().toISOString(),
  };

  all[clientId] = [version, ...existing];
  saveAll(all);

  return version;
}

/**
 * ✅ Delete ALL versions for a client
 */
export function deleteCarePlansForClient(clientId) {
  if (!clientId) return;
  const all = loadAll();
  delete all[clientId];
  saveAll(all);
}

/* ------------------------------------------------------------------
   🔁 BACKWARD COMPATIBILITY (IMPORTANT)
   Old zones still expect `loadCarePlans`
   This returns the LATEST plan per client
------------------------------------------------------------------- */
export function loadCarePlans() {
  const all = loadAll();
  const latestByClient = {};

  Object.keys(all).forEach((clientId) => {
    const versions = all[clientId] || [];
    if (versions.length > 0) {
      latestByClient[clientId] = versions[0].plan;
    }
  });

  return latestByClient;
}
