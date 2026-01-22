// src/data/carePlanVersionsStore.js

const KEY = "theraa_care_plan_versions_v1";

/**
 * Shape:
 * {
 *   [clientId]: [
 *     {
 *       id, clientId, status, createdAt,
 *       authorName, authorRole,
 *       plan: { goalsShort, goalsLong, risks, communication, supports, legalEthical },
 *       evidence: { documentIds: [], docCount: number, lastDocAt: string|null },
 *       changeSummary: string
 *     }
 *   ]
 * }
 */

function safeParse(raw, fallback) {
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? v : fallback;
  } catch {
    return fallback;
  }
}

export function loadCarePlanVersionsMap() {
  const raw = localStorage.getItem(KEY);
  return safeParse(raw || "{}", {});
}

export function saveCarePlanVersionsMap(map) {
  localStorage.setItem(KEY, JSON.stringify(map || {}));
}

export function listCarePlanVersions(clientId) {
  const map = loadCarePlanVersionsMap();
  return Array.isArray(map[clientId]) ? map[clientId] : [];
}

export function addCarePlanVersion(clientId, version) {
  const map = loadCarePlanVersionsMap();
  const arr = Array.isArray(map[clientId]) ? map[clientId] : [];
  const next = [version, ...arr]; // newest first
  map[clientId] = next;
  saveCarePlanVersionsMap(map);
  return next;
}

export function getLatestCarePlanVersion(clientId) {
  const list = listCarePlanVersions(clientId);
  return list[0] || null;
}

export function promoteCarePlanVersion(clientId, versionId, newStatus) {
  const map = loadCarePlanVersionsMap();
  const arr = Array.isArray(map[clientId]) ? map[clientId] : [];
  const idx = arr.findIndex((v) => v.id === versionId);
  if (idx === -1) return arr;

  const updated = {
    ...arr[idx],
    status: newStatus,
    promotedAt: new Date().toISOString(),
  };

  const next = [...arr];
  next[idx] = updated;
  map[clientId] = next;
  saveCarePlanVersionsMap(map);
  return next;
}
