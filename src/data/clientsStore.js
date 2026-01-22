// src/data/clientsStore.js
const KEY = "theraa_clients_v1";

/**
 * Seed localStorage clients from mockClients the first time
 * so existing demos still work.
 */
export function ensureSeedClients(seedClients = []) {
  const existing = loadClients();
  if (existing.length > 0) return existing;

  const seeded = (seedClients || []).map((c) => ({
    id: c.id,
    name: c.name || "",
    age: Number(c.age ?? 0),
    primaryZone: c.primaryZone || "THERAPY",
    diagnoses: Array.isArray(c.diagnoses) ? c.diagnoses : [],
    keyRisks: Array.isArray(c.keyRisks) ? c.keyRisks : [],
    notes: c.notes || "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));

  saveClients(seeded);
  return seeded;
}

export function loadClients() {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = JSON.parse(raw || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveClients(clients) {
  localStorage.setItem(KEY, JSON.stringify(clients || []));
}

export function getClientById(clientId) {
  return loadClients().find((c) => c.id === clientId) || null;
}

export function addClient(client) {
  const clients = loadClients();
  const now = new Date().toISOString();
  const id = client.id || makeClientId(client.name);

  const record = {
    id,
    name: (client.name || "").trim(),
    age: Number(client.age ?? 0),
    primaryZone: client.primaryZone || "THERAPY",
    diagnoses: Array.isArray(client.diagnoses) ? client.diagnoses : [],
    keyRisks: Array.isArray(client.keyRisks) ? client.keyRisks : [],
    notes: client.notes || "",
    createdAt: now,
    updatedAt: now,
  };

  saveClients([record, ...clients]);
  return record;
}

export function updateClient(clientId, patch) {
  const clients = loadClients();
  const now = new Date().toISOString();

  const updated = clients.map((c) => {
    if (c.id !== clientId) return c;
    return {
      ...c,
      ...patch,
      updatedAt: now,
    };
  });

  saveClients(updated);
  return updated.find((c) => c.id === clientId) || null;
}

export function deleteClient(clientId) {
  const clients = loadClients();
  saveClients(clients.filter((c) => c.id !== clientId));
}

function makeClientId(name) {
  const base = (name || "client")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return `${base || "client"}-${Date.now().toString(36)}`;
}
