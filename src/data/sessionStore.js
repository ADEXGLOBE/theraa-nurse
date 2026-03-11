const STORAGE_KEY = "theraaNurseSessions_v3";

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

/* NEW */

export function addSession(clientId, session) {

  const sessions = loadSessions();

  if (!sessions[clientId]) {
    sessions[clientId] = [];
  }

  sessions[clientId].push({
    ...session,
    id: Date.now(),
    createdAt: new Date().toISOString()
  });

  saveSessions(sessions);

}