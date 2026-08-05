// src/context/WorkspaceContext.jsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useAuth } from "./AuthContext";
import {
  getRoleLabel,
  getUserWorkspaces,
} from "../services/workspaceService";

const WorkspaceContext = createContext(null);

const ACTIVE_WORKSPACE_KEY =
  "tn_active_workspace_id_v1";

export function WorkspaceProvider({ children }) {
  const { user, authReady } = useAuth();

  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspaceId, setActiveWorkspaceId] =
    useState("");
  const [workspaceReady, setWorkspaceReady] =
    useState(false);
  const [workspaceError, setWorkspaceError] =
    useState("");

  const refreshWorkspaces = useCallback(async () => {
    if (!user?.id) {
      setWorkspaces([]);
      setActiveWorkspaceId("");
      setWorkspaceReady(true);
      return;
    }

    setWorkspaceReady(false);
    setWorkspaceError("");

    try {
      const loaded = await getUserWorkspaces(user.id);
      setWorkspaces(loaded);

      const stored =
        localStorage.getItem(ACTIVE_WORKSPACE_KEY) ||
        "";

      const storedExists = loaded.some(
        (workspace) =>
          workspace.organisationId === stored
      );

      const nextWorkspaceId = storedExists
        ? stored
        : loaded[0]?.organisationId || "";

      setActiveWorkspaceId(nextWorkspaceId);

      if (nextWorkspaceId) {
        localStorage.setItem(
          ACTIVE_WORKSPACE_KEY,
          nextWorkspaceId
        );
      } else {
        localStorage.removeItem(
          ACTIVE_WORKSPACE_KEY
        );
      }
    } catch (error) {
      console.error("Workspace loading failed:", error);

      setWorkspaces([]);
      setActiveWorkspaceId("");
      setWorkspaceError(
        error?.message ||
          "Your workspace could not be loaded."
      );
    } finally {
      setWorkspaceReady(true);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!authReady) return;
    void refreshWorkspaces();
  }, [authReady, refreshWorkspaces]);

  useEffect(() => {
    if (!activeWorkspaceId) return;

    localStorage.setItem(
      ACTIVE_WORKSPACE_KEY,
      activeWorkspaceId
    );
  }, [activeWorkspaceId]);

  const activeWorkspace = useMemo(
    () =>
      workspaces.find(
        (workspace) =>
          workspace.organisationId ===
          activeWorkspaceId
      ) || null,
    [workspaces, activeWorkspaceId]
  );

  const value = useMemo(
    () => ({
      workspaces,
      activeWorkspace,
      activeWorkspaceId,

      organisationId:
        activeWorkspace?.organisationId || "",
      organisationName:
        activeWorkspace?.organisationName || "",
      role: activeWorkspace?.role || "",
      roleLabel: getRoleLabel(
        activeWorkspace?.role
      ),

      workspaceReady,
      workspaceError,

      setActiveWorkspaceId,
      refreshWorkspaces,
    }),
    [
      workspaces,
      activeWorkspace,
      activeWorkspaceId,
      workspaceReady,
      workspaceError,
      refreshWorkspaces,
    ]
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);

  if (!context) {
    throw new Error(
      "useWorkspace must be used inside WorkspaceProvider"
    );
  }

  return context;
}