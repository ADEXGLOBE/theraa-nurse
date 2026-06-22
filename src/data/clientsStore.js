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

export function loadClients(ownerId) {
  if (!ownerId) return [];
  const all = loadAllClients();
  return all.filter((c) => c.ownerId === ownerId);
}

export function loadClientById(clientId, ownerId) {
  if (!ownerId || !clientId) return null;
  return loadClients(ownerId).find((c) => c.id === clientId) || null;
}

export function saveClient(client, ownerId) {
  if (!ownerId) throw new Error("ownerId is required to save a client.");

  const all = loadAllClients();
  const now = new Date().toISOString();

  if (client?.id) {
    const updated = all.map((c) => {
      if (c.id !== client.id) return c;

      if (c.ownerId !== ownerId) {
        throw new Error("You cannot edit a client owned by another user.");
      }

      return {
        ...c,
        ...client,
        ownerId,
        updatedAt: now,
      };
    });

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
    createdAt: now,
    updatedAt: now,
  };

  saveAllClients([newClient, ...all]);
  return newClient.id;
}

export function deleteClient(clientId, ownerId) {
  if (!ownerId || !clientId) return;

  const all = loadAllClients();
  const filtered = all.filter(
    (c) => !(c.id === clientId && c.ownerId === ownerId)
  );

  saveAllClients(filtered);
}

export function clientBelongsToUser(clientId, ownerId) {
  return !!loadClientById(clientId, ownerId);
}

export function getClientCount(ownerId) {
  return loadClients(ownerId).length;
}