// src/pages/StaffZone.jsx
import { useMemo, useState, useEffect } from "react";
import { loadSessions, saveSessions } from "../data/sessionStore";
import { loadClients } from "../data/clientsStore";
import { useActiveClient } from "../context/ActiveClientContext";
import ClientSelectorBar from "../components/ClientSelectorBar";

export default function StaffZone() {
  const { activeClientId } = useActiveClient();
  const clients = useMemo(() => loadClients(), []);
  const fallbackId = clients[0]?.id || "";

  const [selectedClientId, setSelectedClientId] = useState(activeClientId || fallbackId);
  const [tasks, setTasks] = useState({
    reviewedHistory: false,
    checkedEnvironment: false,
    checkedAssistiveTech: false,
    escalationPlanKnown: false,
  });
  const [notes, setNotes] = useState("");
  const [safeguardingConcern, setSafeguardingConcern] = useState(false);
  const [safeguardingNotes, setSafeguardingNotes] = useState("");

  useEffect(() => {
    if (activeClientId) setSelectedClientId(activeClientId);
  }, [activeClientId]);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedClientId) || null,
    [clients, selectedClientId]
  );

  const toggleTask = (key) => setTasks((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleSaveStaffEntry = () => {
    if (!selectedClientId) return alert("Select a client first.");
    const all = loadSessions();
    const timestamp = new Date().toISOString();

    const payload = {
      timestamp,
      clientId: selectedClientId,
      zone: "staff",
      tasks,
      notes,
      safeguardingConcern,
      safeguardingNotes,
    };

    const updated = {
      ...all,
      [selectedClientId]: [payload, ...(all[selectedClientId] || [])],
    };

    saveSessions(updated);
    alert("Staff entry saved.");

    setNotes("");
    setSafeguardingConcern(false);
    setSafeguardingNotes("");
  };

  if (!clients.length) {
    return (
      <div className="card">
        <div className="card-title">Staff / AI Zone</div>
        <div className="card-subtitle">No clients found. Add a client in Clients first.</div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Staff / AI Zone</h1>
          <p className="page-subtitle">
            Shift prompts and documentation area. Later: AI can generate formal reports and approvals.
          </p>
          {selectedClient && (
            <div style={{ fontSize: 12, color: "#4b5563", marginTop: 4 }}>
              Client: <strong>{selectedClient.name}</strong> ({selectedClient.age} yrs)
            </div>
          )}
        </div>
        <div style={{ fontSize: 12, color: "#6b7280", textAlign: "right" }}>
          Theraa Nurse · Worker Support
        </div>
      </div>

      <ClientSelectorBar />

      <div className="card">
        <div className="card-title">Select client for this entry</div>
        <label className="section-title-sm">
          Client
          <select className="input" value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)}>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.age})
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="two-column">
        <div className="card">
          <div className="card-title">Shift checklist</div>
          <div className="card-subtitle">Use these prompts at the beginning of a shift or home visit.</div>
          <ul style={{ listStyle: "none", paddingLeft: 0, fontSize: 13 }}>
            <li>
              <label style={{ display: "flex", gap: 6 }}>
                <input type="checkbox" checked={tasks.reviewedHistory} onChange={() => toggleTask("reviewedHistory")} />
                Reviewed last 3 sessions for red flags.
              </label>
            </li>
            <li>
              <label style={{ display: "flex", gap: 6 }}>
                <input type="checkbox" checked={tasks.checkedEnvironment} onChange={() => toggleTask("checkedEnvironment")} />
                Checked environment for hazards (falls, clutter, safety).
              </label>
            </li>
            <li>
              <label style={{ display: "flex", gap: 6 }}>
                <input type="checkbox" checked={tasks.checkedAssistiveTech} onChange={() => toggleTask("checkedAssistiveTech")} />
                Confirmed assistive technology is in place (glasses, mobility aid, etc.).
              </label>
            </li>
            <li>
              <label style={{ display: "flex", gap: 6 }}>
                <input type="checkbox" checked={tasks.escalationPlanKnown} onChange={() => toggleTask("escalationPlanKnown")} />
                Aware of escalation plan (who to call, when to call 000).
              </label>
            </li>
          </ul>
        </div>

        <div className="card">
          <div className="card-title">Staff notes</div>
          <div className="card-subtitle">
            Write plain language notes. These can later be converted to NDIS notes / shift reports.
          </div>
          <textarea
            className="textarea"
            rows={5}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Example: Noted changes in appetite, engagement, routine, safety risks..."
          />

          <div style={{ marginTop: 10, borderTop: "1px solid #e5e7eb", paddingTop: 8 }}>
            <div className="card-title" style={{ fontSize: 14 }}>
              Safeguarding (abuse / neglect / exploitation)
            </div>
            <div className="card-subtitle">Use when you notice indicators of abuse, neglect, exploitation.</div>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, marginTop: 6 }}>
              <input
                type="checkbox"
                checked={safeguardingConcern}
                onChange={(e) => setSafeguardingConcern(e.target.checked)}
              />
              I am raising a safeguarding concern for this client today.
            </label>
            <textarea
              className="textarea"
              rows={3}
              value={safeguardingNotes}
              onChange={(e) => setSafeguardingNotes(e.target.value)}
              placeholder="Example: sudden weight loss; fear of a specific carer; poor hygiene patterns..."
              style={{ marginTop: 6 }}
            />
          </div>

          <button type="button" className="btn-primary" onClick={handleSaveStaffEntry}>
            💾 Save staff entry
          </button>
        </div>
      </div>
    </div>
  );
}
