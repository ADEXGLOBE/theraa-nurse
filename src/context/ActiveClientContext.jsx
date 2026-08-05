// src/context/ActiveClientContext.jsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useAuth } from "./AuthContext";
import { useWorkspace } from "./WorkspaceContext";
import { getParticipantsForWorkspace } from "../services/patientAccessService";

const ActiveClientContext = createContext(null);

const ACTIVE_PARTICIPANT_KEY =
  "tn_active_participant_id_v2";

export function ActiveClientProvider({ children }) {
  const { user } = useAuth();

  const {
    organisationId,
    role,
    workspaceReady,
  } = useWorkspace();

  const [clients, setClients] = useState([]);
  const [activeClientId, setActiveClientId] =
    useState("");
  const [clientsReady, setClientsReady] =
    useState(false);
  const [clientsError, setClientsError] =
    useState("");

  const refreshClients = useCallback(async () => {
    if (
      !user?.id ||
      !organisationId ||
      !workspaceReady
    ) {
      setClients([]);
      setActiveClientId("");
      setClientsReady(true);
      return;
    }

    setClientsReady(false);
    setClientsError("");

    try {
      const loaded =
        await getParticipantsForWorkspace({
          userId: user.id,
          organisationId,
          role,
        });

      setClients(loaded);

      const storageKey = `${ACTIVE_PARTICIPANT_KEY}:${organisationId}`;
      const stored =
        localStorage.getItem(storageKey) || "";

      const storedExists = loaded.some(
        (client) => client.id === stored
      );

      const nextId = storedExists
        ? stored
        : loaded[0]?.id || "";

      setActiveClientId(nextId);

      if (nextId) {
        localStorage.setItem(storageKey, nextId);
      } else {
        localStorage.removeItem(storageKey);
      }
    } catch (error) {
      console.error(
        "Unable to load shared participants:",
        error
      );

      setClients([]);
      setActiveClientId("");
      setClientsError(
        error?.message ||
          "Shared participants could not be loaded."
      );
    } finally {
      setClientsReady(true);
    }
  }, [
    user?.id,
    organisationId,
    role,
    workspaceReady,
  ]);

  useEffect(() => {
    void refreshClients();
  }, [refreshClients]);

  useEffect(() => {
    if (!activeClientId || !organisationId) {
      return;
    }

    localStorage.setItem(
      `${ACTIVE_PARTICIPANT_KEY}:${organisationId}`,
      activeClientId
    );
  }, [activeClientId, organisationId]);

  const activeClient = useMemo(
    () =>
      clients.find(
        (client) =>
          client.id === activeClientId
      ) || null,
    [clients, activeClientId]
  );

  const value = useMemo(
    () => ({
      clients,
      setClients,

      activeClientId,
      setActiveClientId,
      activeClient,

      clientsReady,
      clientsError,

      refreshClients,
    }),
    [
      clients,
      activeClientId,
      activeClient,
      clientsReady,
      clientsError,
      refreshClients,
    ]
  );

  return (
    <ActiveClientContext.Provider value={value}>
      {children}
    </ActiveClientContext.Provider>
  );
}

export function useActiveClient() {
  const context = useContext(ActiveClientContext);

  if (!context) {
    throw new Error(
      "useActiveClient must be used inside ActiveClientProvider"
    );
  }

  return context;
}