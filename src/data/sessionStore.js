// src/data/sessionStore.js
const STORAGE_KEY = "theraaNurseSessions_v3";

function loadAllSessions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error("Failed to load sessions", e);
    return {};
  }
}

function saveAllSessions(all) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch (e) {
    console.error("Failed to save sessions", e);
  }
}

function ownerKey(ownerId) {
  return ownerId || "__public__";
}

export function loadSessions(ownerId = null) {
  const all = loadAllSessions();
  return all[ownerKey(ownerId)] || {};
}

export function saveSessions(allSessionsForOwner, ownerId = null) {
  const all = loadAllSessions();
  all[ownerKey(ownerId)] = allSessionsForOwner || {};
  saveAllSessions(all);
}