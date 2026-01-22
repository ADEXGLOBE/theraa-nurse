import { useState } from "react";
import Sidebar from "./components/Sidebar";

import HomeDashboard from "./pages/HomeDashboard";
import Clients from "./pages/Clients";
import ClientFiles from "./pages/ClientFiles";
import CarePlanZone from "./pages/CarePlanZone";
import ClientInsights from "./pages/ClientInsights";

import TherapyZone from "./pages/TherapyZone";
import MedicationZone from "./pages/MedicationZone";
import StaffZone from "./pages/StaffZone";
import VpnZone from "./pages/VpnZone";
import ParamedicZone from "./pages/ParamedicZone";

export default function App() {
  const [selectedZone, setSelectedZone] = useState("home");

  const renderMain = () => {
    switch (selectedZone) {
      case "home":
        return <HomeDashboard />;

      case "clients":
        return <Clients />;

      case "documents":
        return <ClientFiles />;

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

      case "insights":
        return <ClientInsights />;


      default:
        return <HomeDashboard />;
    }
  };

  return (
    <div className="app-root">
      <Sidebar selectedZone={selectedZone} setSelectedZone={setSelectedZone} />
      <main className="main-content">{renderMain()}</main>
    </div>
  );
}
