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

import { ActiveClientProvider } from "./context/ActiveClientContext";
import { AuthProvider, useAuth } from "./context/AuthContext";

function AppShell() {
  const [selectedZone, setSelectedZone] = useState("home");
  const { user, authReady } = useAuth();

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

  if (!authReady) {
    return <div style={{ padding: 24 }}>Loading Theraa Nurse...</div>;
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <ActiveClientProvider>
      <div className="app-root">
        <Sidebar selectedZone={selectedZone} setSelectedZone={setSelectedZone} />
        <main className="main-content">{renderMain()}</main>
      </div>
    </ActiveClientProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}