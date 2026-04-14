// src/data/carePlanStore.js
const STORAGE_KEY = "theraa_nurse_careplans_v2";

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

function ownerKey(ownerId) {
  return ownerId || "__public__";
}

export function loadCarePlanVersions(clientId, ownerId = null) {
  const all = loadAll();
  const ownerBucket = all[ownerKey(ownerId)] || {};
  const list = ownerBucket[clientId] || [];
  return [...list].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function saveCarePlanVersion({
  clientId,
  status = "draft",
  plan,
  evidenceCount = 0,
  ownerId = null,
}) {
  if (!clientId) return null;

  const all = loadAll();
  const key = ownerKey(ownerId);

  if (!all[key]) all[key] = {};
  const existing = all[key][clientId] || [];

  const version = {
    id: uid(),
    clientId,
    ownerId,
    status,
    plan: plan || {},
    evidenceCount: typeof evidenceCount === "number" ? evidenceCount : 0,
    createdAt: new Date().toISOString(),
  };

  all[key][clientId] = [version, ...existing];
  saveAll(all);

  return version;
}

export function deleteCarePlansForClient(clientId, ownerId = null) {
  if (!clientId) return;
  const all = loadAll();
  const key = ownerKey(ownerId);
  if (!all[key]) return;
  delete all[key][clientId];
  saveAll(all);
}

export function loadCarePlans(ownerId = null) {
  const all = loadAll();
  const ownerBucket = all[ownerKey(ownerId)] || {};
  const latestByClient = {};

  Object.keys(ownerBucket).forEach((clientId) => {
    const versions = ownerBucket[clientId] || [];
    if (versions.length > 0) {
      latestByClient[clientId] = versions[0].plan;
    }
  });

  return latestByClient;
}