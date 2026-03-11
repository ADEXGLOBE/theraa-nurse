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

export function loadCarePlanVersions(clientId) {

  const all = loadAll();
  const list = all[clientId] || [];

  return [...list].sort(
    (a, b) => (a.createdAt < b.createdAt ? 1 : -1)
  );

}

export function saveCarePlanVersion({
  clientId,
  status = "draft",
  plan,
  evidenceCount = 0
}) {

  if (!clientId) return null;

  const all = loadAll();
  const existing = all[clientId] || [];

  const version = {
    id: uid(),
    clientId,
    status,
    plan,
    evidenceCount,
    createdAt: new Date().toISOString()
  };

  all[clientId] = [version, ...existing];

  saveAll(all);

  return version;

}

/* NEW */

export function updateCarePlan(clientId, updatedPlan) {

  const all = loadAll();

  if (!all[clientId]) return;

  all[clientId][0].plan = updatedPlan;

  saveAll(all);

}

export function loadCarePlans() {

  const all = loadAll();
  const latestByClient = {};

  Object.keys(all).forEach(clientId => {

    const versions = all[clientId] || [];

    if (versions.length > 0) {
      latestByClient[clientId] = versions[0].plan;
    }

  });

  return latestByClient;

}