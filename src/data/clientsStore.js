const STORAGE_KEY = "theraa_nurse_clients_v2";

function loadAllClients() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch (e) {
    console.error("Failed to load clients", e);
    return [];
  }
}

function saveAllClients(clients) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clients || []));
  } catch (e) {
    console.error("Failed to save clients", e);
  }
}

function uid() {
  return `client-${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`;
}

export function loadClients(ownerId = null) {
  const all = loadAllClients();
  if (!ownerId) return all;
  return all.filter((c) => c.ownerId === ownerId);
}

export function loadClientById(clientId, ownerId = null) {
  const all = loadClients(ownerId);
  return all.find((c) => c.id === clientId) || null;
}

export function saveClient(client, ownerId) {
  if (!ownerId) {
    throw new Error("ownerId is required to save a client.");
  }

  const all = loadAllClients();

  if (client?.id) {
    const updated = all.map((c) =>
      c.id === client.id
        ? {
            ...c,
            ...client,
            ownerId,
            updatedAt: new Date().toISOString(),
          }
        : c
    );
    saveAllClients(updated);
    return client.id;
  }

  const newClient = {
    id: uid(),
    ownerId,
    name: client?.name || "New Client",
    age: client?.age || "",
    dob: client?.dob || "",
    gender: client?.gender || "",
    ndisNumber: client?.ndisNumber || "",
    contactNumber: client?.contactNumber || "",
    emergencyContact: client?.emergencyContact || "",
    address: client?.address || "",
    notes: client?.notes || "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  saveAllClients([newClient, ...all]);
  return newClient.id;
}

export function deleteClient(clientId, ownerId = null) {
  const all = loadAllClients();
  const filtered = all.filter((c) =>
    ownerId ? !(c.id === clientId && c.ownerId === ownerId) : c.id !== clientId
  );
  saveAllClients(filtered);
}

export function clientBelongsToUser(clientId, ownerId) {
  if (!ownerId) return false;
  const client = loadClientById(clientId, ownerId);
  return !!client;
}