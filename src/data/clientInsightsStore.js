// src/data/clientInsightsStore.js
const KEY = "theraa_client_insights_v1";

export function loadInsights() {
  try {
    const raw = localStorage.getItem(KEY);
    const obj = JSON.parse(raw || "{}");
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
}

export function saveInsights(map) {
  localStorage.setItem(KEY, JSON.stringify(map || {}));
}

export function getClientInsight(clientId) {
  const map = loadInsights();
  return map[clientId] || null;
}

export function saveClientInsight(clientId, payload) {
  const map = loadInsights();
  const now = new Date().toISOString();

  map[clientId] = {
    clientId,
    updatedAt: now,
    docCount: payload?.docCount ?? 0,
    lastDocAt: payload?.lastDocAt ?? null,
    findings: payload?.findings || null,
  };

  saveInsights(map);
  return map[clientId];
}

export function clearClientInsight(clientId) {
  const map = loadInsights();
  delete map[clientId];
  saveInsights(map);
}
