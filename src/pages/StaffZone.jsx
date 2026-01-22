import { useState } from "react";
import { loadSessions, saveSessions } from "../data/sessionStore";
import mockClients from "../data/mockClients";

export default function StaffZone() {
  const [selectedClientId, setSelectedClientId] = useState(mockClients[0].id);
  const [tasks, setTasks] = useState({
    reviewedHistory: false,
    checkedEnvironment: false,
    checkedAssistiveTech: false,
    escalationPlanKnown: false,
  });
  const [notes, setNotes] = useState("");
  const [safeguardingConcern, setSafeguardingConcern] = useState(false);
  const [safeguardingNotes, setSafeguardingNotes] = useState("");

  const selectedClient = mockClients.find((c) => c.id === selectedClientId);

  const toggleTask = (key) => {
    setTasks((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSaveStaffEntry = () => {
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
      [selectedClientId]: [
        payload,
        ...(all[selectedClientId] || []),
      ],
    };

    saveSessions(updated);
    alert("Staff entry saved.");

    setNotes("");
    setSafeguardingConcern(false);
    setSafeguardingNotes("");
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Staff / AI Zone</h1>
          <p className="page-subtitle">
            Simple shift prompts and documentation area. Later, AI-style suggestions
            can be layered on top to help with decision-making and report writing.
          </p>
          {selectedClient && (
            <div style={{ fontSize: 12, color: "#4b5563", marginTop: 4 }}>
              Client: <strong>{selectedClient.name}</strong> (
              {selectedClient.age} yrs)
            </div>
          )}
        </div>
        <div style={{ fontSize: 12, color: "#6b7280", textAlign: "right" }}>
          Theraa Nurse · Worker Support
          <br />
          Designed for support workers, nurses and paramedics.
        </div>
      </div>

      <div className="card">
        <div className="card-title">Select client for this entry</div>
        <label className="section-title-sm">
          Client
          <select
            className="input"
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
          >
            {mockClients.map((c) => (
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
          <div className="card-subtitle">
            Use these prompts at the beginning of a shift or before a home visit.
          </div>
          <ul style={{ listStyle: "none", paddingLeft: 0, fontSize: 13 }}>
            <li>
              <label style={{ display: "flex", gap: 6 }}>
                <input
                  type="checkbox"
                  checked={tasks.reviewedHistory}
                  onChange={() => toggleTask("reviewedHistory")}
                />
                Reviewed last 3 sessions for red flags.
              </label>
            </li>
            <li>
              <label style={{ display: "flex", gap: 6 }}>
                <input
                  type="checkbox"
                  checked={tasks.checkedEnvironment}
                  onChange={() => toggleTask("checkedEnvironment")}
                />
                Checked environment for hazards (falls, clutter, safety).
              </label>
            </li>
            <li>
              <label style={{ display: "flex", gap: 6 }}>
                <input
                  type="checkbox"
                  checked={tasks.checkedAssistiveTech}
                  onChange={() => toggleTask("checkedAssistiveTech")}
                />
                Confirmed assistive technology is in place (glasses, crutch, etc.).
              </label>
            </li>
            <li>
              <label style={{ display: "flex", gap: 6 }}>
                <input
                  type="checkbox"
                  checked={tasks.escalationPlanKnown}
                  onChange={() => toggleTask("escalationPlanKnown")}
                />
                Aware of escalation plan (who to call, when to call 000).
              </label>
            </li>
          </ul>
        </div>

        <div className="card">
          <div className="card-title">Staff notes / AI prompt base</div>
          <div className="card-subtitle">
            Write in plain language. Later, Theraa Nurse AI can turn this into formal
            shift reports, incident reports or NDIS progress notes.
          </div>
          <textarea
            className="textarea"
            rows={5}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Example: Noted changes in Jason's eating, may be related to frustration with cutlery. Margaret appears more withdrawn; Douglas reports feeling depressed..."
          />

          <div
            style={{
              marginTop: 10,
              borderTop: "1px solid #e5e7eb",
              paddingTop: 8,
            }}
          >
            <div className="card-title" style={{ fontSize: 14 }}>
              Safeguarding (abuse / neglect / exploitation)
            </div>
            <div className="card-subtitle">
              Use this when you notice something that could indicate abuse, neglect or
              exploitation, based on your case studies.
            </div>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 13,
                marginTop: 6,
              }}
            >
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
              placeholder="Example: Client appears to have lost significant weight; clothes consistently dirty; sudden fear of a particular carer after home visit..."
              style={{ marginTop: 6 }}
            />
          </div>

          <button
            type="button"
            className="btn-primary"
            onClick={handleSaveStaffEntry}
          >
            💾 Save staff entry
          </button>
        </div>
      </div>
    </div>
  );
}
