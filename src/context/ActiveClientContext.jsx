// src/context/ActiveClientContext.jsx
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { loadClients } from "../data/clientsStore";

const ActiveClientContext = createContext(null);

const STORAGE_KEY = "tn_active_client_id_v1";

export function ActiveClientProvider({ children }) {
  const [clients, setClients] = useState([]);
  const [activeClientId, setActiveClientId] = useState("");

  useEffect(() => {
    const c = loadClients();
    setClients(c);

    const stored = localStorage.getItem(STORAGE_KEY) || "";
    const initial =
      stored && c.some((x) => x.id === stored) ? stored : c[0]?.id || "";
    setActiveClientId(initial);
    if (initial) localStorage.setItem(STORAGE_KEY, initial);
  }, []);

  useEffect(() => {
    if (activeClientId) localStorage.setItem(STORAGE_KEY, activeClientId);
  }, [activeClientId]);

  const activeClient = useMemo(
    () => clients.find((c) => c.id === activeClientId) || null,
    [clients, activeClientId]
  );

  const value = useMemo(
    () => ({
      clients,
      setClients,
      activeClientId,
      setActiveClientId,
      activeClient,
      refreshClients: () => setClients(loadClients()),
    }),
    [clients, activeClientId, activeClient]
  );

  return (
    <ActiveClientContext.Provider value={value}>
      {children}
    </ActiveClientContext.Provider>
  );
}

export function useActiveClient() {
  const ctx = useContext(ActiveClientContext);
  if (!ctx) {
    throw new Error("useActiveClient must be used inside ActiveClientProvider");
  }
  return ctx;
}
