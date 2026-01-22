const STORAGE_KEY = "theraaNurseSessions_v2";

export function loadSessions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error("Failed to load sessions", e);
    return {};
  }
}

export function saveSessions(all) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch (e) {
    console.error("Failed to save sessions", e);
  }
}
