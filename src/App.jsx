// src/App.jsx
import { useState } from "react";
import Sidebar from "./components/Sidebar";

import TherapyZone from "./pages/TherapyZone";
import MedicationZone from "./pages/MedicationZone";
import StaffZone from "./pages/StaffZone";
import VpnZone from "./pages/VpnZone";
import ParamedicZone from "./pages/ParamedicZone";
import CarePlanZone from "./pages/CarePlanZone";
import ClientFiles from "./pages/ClientFiles";
import Clients from "./pages/Clients";
import ClientInsights from "./pages/ClientInsights";
import HomeDashboard from "./pages/HomeDashboard";
import AuthPage from "./pages/AuthPage";
import KnowledgeEngine from "./pages/KnowledgeEngine";
import ParticipantTimeline from "./pages/ParticipantTimeline";
import KnowledgeLibrary from "./pages/KnowledgeLibrary";

import {
  AuthProvider,
  useAuth,
} from "./context/AuthContext";

import {
  WorkspaceProvider,
  useWorkspace,
} from "./context/WorkspaceContext";

import {
  ActiveClientProvider,
  useActiveClient,
} from "./context/ActiveClientContext";

function LoadingScreen({ message }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "#f8fafc",
      }}
    >
      <div
        style={{
          width: "min(440px, 100%)",
          padding: 24,
          border: "1px solid #e2e8f0",
          borderRadius: 20,
          background: "#ffffff",
          textAlign: "center",
          boxShadow:
            "0 20px 45px rgba(15, 23, 42, 0.08)",
        }}
      >
        <div style={{ fontSize: 32 }}>🩺</div>

        <h2 style={{ margin: "12px 0 5px" }}>
          Theraa Nurse
        </h2>

        <p
          style={{
            margin: 0,
            color: "#64748b",
          }}
        >
          {message}
        </p>
      </div>
    </div>
  );
}

function NoWorkspaceScreen() {
  const { signOut } = useAuth();
  const { workspaceError } = useWorkspace();

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "#f8fafc",
      }}
    >
      <div
        style={{
          width: "min(560px, 100%)",
          padding: 28,
          border: "1px solid #e2e8f0",
          borderRadius: 22,
          background: "#ffffff",
          boxShadow:
            "0 20px 45px rgba(15, 23, 42, 0.08)",
        }}
      >
        <div style={{ fontSize: 34 }}>🏢</div>

        <h2>No active workspace found</h2>

        <p
          style={{
            color: "#64748b",
            lineHeight: 1.6,
          }}
        >
          Your account is authenticated, but it has not
          been added to an active Theraa Nurse provider
          organisation.
        </p>

        {workspaceError ? (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 12,
              background: "#fef2f2",
              color: "#991b1b",
              fontSize: 12,
            }}
          >
            {workspaceError}
          </div>
        ) : null}

        <p
          style={{
            color: "#475569",
            fontSize: 13,
          }}
        >
          Ask a Provider Admin to add this account to
          organisation membership.
        </p>

        <button
          type="button"
          className="btn-primary"
          onClick={() => void signOut()}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

function AppWorkspace() {
  const [selectedZone, setSelectedZone] =
    useState("home");

  const {
    workspaceReady,
    activeWorkspace,
  } = useWorkspace();

  const { clientsReady } = useActiveClient();

  if (!workspaceReady) {
    return (
      <LoadingScreen message="Loading your provider workspace…" />
    );
  }

  if (!activeWorkspace) {
    return <NoWorkspaceScreen />;
  }

  if (!clientsReady) {
    return (
      <LoadingScreen message="Loading authorised participants…" />
    );
  }

  const renderMain = () => {
    switch (selectedZone) {
      case "home":
        return <HomeDashboard />;

      case "clients":
        return <Clients />;

      case "documents":
        return <ClientFiles />;

      case "insights":
        return <ClientInsights />;

      case "timeline":
        return <ParticipantTimeline />;

      case "careplan":
        return <CarePlanZone />;

      case "therapy":
        return <TherapyZone />;

      case "meds":
        return <MedicationZone />;

      case "staff":
        return <StaffZone />;

      case "vpn":
        return <VpnZone />;

      case "paramedic":
        return <ParamedicZone />;

      case "knowledge":
        return <KnowledgeEngine />;

      case "knowledgeLibrary":
        return <KnowledgeLibrary />;

      default:
        return <HomeDashboard />;
    }
  };

  return (
    <div className="app-root">
      <Sidebar
        selectedZone={selectedZone}
        setSelectedZone={setSelectedZone}
      />

      <main className="main-content">
        {renderMain()}
      </main>
    </div>
  );
}

function AuthenticatedApp() {
  const { user, authReady } = useAuth();

  if (!authReady) {
    return (
      <LoadingScreen message="Checking secure access…" />
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <WorkspaceProvider>
      <ActiveClientProvider>
        <AppWorkspace />
      </ActiveClientProvider>
    </WorkspaceProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  );
}