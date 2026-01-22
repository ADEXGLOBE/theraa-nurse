import { useEffect, useState } from "react";
import { loadSessions, saveSessions } from "../data/sessionStore";
import { loadCarePlans } from "../data/carePlanStore";
import mockClients from "../data/mockClients";

const BODY_SYSTEMS = [
  "Respiratory",
  "Cardiovascular / circulation",
  "Gastrointestinal / digestion",
  "Musculoskeletal / mobility",
  "Neurological / cognition",
  "Skin / integumentary",
];

const MOOD_STATES = [
  "Calm",
  "Content",
  "Happy",
  "Flat",
  "Sad",
  "Anxious",
  "Irritable",
  "Agitated",
];

export default function TherapyZone() {
  const [selectedClientId, setSelectedClientId] = useState(mockClients[0].id);
  const [checkedSystems, setCheckedSystems] = useState([]);
  const [mood, setMood] = useState("");
  const [notes, setNotes] = useState("");
  const [allSessions, setAllSessions] = useState({});
  const [reportText, setReportText] = useState("");
  const [reportRange, setReportRange] = useState("today"); // "today" | "last7"

  // load sessions on mount
  useEffect(() => {
    setAllSessions(loadSessions());
  }, []);

  const selectedClient = mockClients.find((c) => c.id === selectedClientId);

  const toggleSystem = (system) => {
    setCheckedSystems((prev) =>
      prev.includes(system)
        ? prev.filter((s) => s !== system)
        : [...prev, system]
    );
  };

  const handleSaveTherapySession = () => {
    const timestamp = new Date().toISOString();

    const payload = {
      timestamp,
      clientId: selectedClientId,
      zone: "therapy",
      bodySystems: checkedSystems,
      mood,
      notes,
    };

    const updated = {
      ...allSessions,
      [selectedClientId]: [
        payload,
        ...(allSessions[selectedClientId] || []),
      ],
    };

    setAllSessions(updated);
    saveSessions(updated);

    // reset
    setCheckedSystems([]);
    setMood("");
    setNotes("");
    alert("Therapy session saved.");
  };

  const clientSessions = (allSessions[selectedClientId] || []).filter((s) =>
    ["therapy", "paramedic", "meds"].includes(s.zone || "therapy")
  );

  const handleGenerateReport = () => {
    const sessions = allSessions[selectedClientId] || [];
    const now = new Date();

    const inRange = (iso) => {
      if (!iso) return false;
      const d = new Date(iso);
      if (reportRange === "today") {
        return d.toDateString() === now.toDateString();
      }
      if (reportRange === "last7") {
        const diffMs = now.getTime() - d.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        return diffDays <= 7;
      }
      return false;
    };

    const rangeLabel =
      reportRange === "today"
        ? `Today (${now.toLocaleDateString()})`
        : `Last 7 days (ending ${now.toLocaleDateString()})`;

    const rangedSessions = sessions.filter((s) => inRange(s.timestamp));

    const therapySessions = rangedSessions.filter((s) => s.zone === "therapy");
    const medsSessions = rangedSessions.filter((s) => s.zone === "meds");
    const paramedicSessions = rangedSessions.filter(
      (s) => s.zone === "paramedic"
    );
    const staffSessions = rangedSessions.filter((s) => s.zone === "staff");
    const vpnSessions = rangedSessions.filter((s) => s.zone === "vpn");

    // mood summary
    const moodCounts = {};
    therapySessions.forEach((s) => {
      if (s.mood) {
        moodCounts[s.mood] = (moodCounts[s.mood] || 0) + 1;
      }
    });
    const moodSummary = Object.entries(moodCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([m, c]) => `${m} (${c})`)
      .join(", ");

    const lines = [];

    lines.push(
      `Client Summary – ${selectedClient?.name || "Client"} (${selectedClient?.age ?? "?"} yrs)`
    );
    lines.push(`Range: ${rangeLabel}`);
    lines.push("");

    // 1. Overview
    lines.push("1. Overview");
    if (rangedSessions.length === 0) {
      lines.push("- No sessions recorded in Theraa Nurse for this period.");
    } else {
      if (moodSummary) {
        lines.push(`- Mood pattern in this period: ${moodSummary}.`);
      } else {
        lines.push("- No mood entries recorded in this period.");
      }

      if (paramedicSessions.length > 0) {
        const callouts = paramedicSessions
          .map((s) => s.calloutType || "unspecified")
          .join(", ");
        lines.push(
          `- Paramedic involvement: ${paramedicSessions.length} callout(s) (${callouts}).`
        );
      }

      if (medsSessions.length > 0) {
        const medsNeedingFollowup = medsSessions.filter(
          (s) => s.followUp
        );
        lines.push(
          `- Medication: ${medsSessions.length} entry(ies); ${medsNeedingFollowup.length} flagged for follow-up.`
        );
      }

      const safeguarding = staffSessions.filter(
        (s) => s.safeguardingConcern
      );
      if (safeguarding.length > 0) {
        lines.push(
          `- Safeguarding: ${safeguarding.length} concern(s) raised by staff in this period.`
        );
      }

      if (vpnSessions.length > 0) {
        lines.push(
          `- Remote contact: ${vpnSessions.length} call(s) or telehealth session(s) logged.`
        );
      }
    }

    // 2. Sessions by type
    lines.push("");
    lines.push("2. Sessions by type (most recent in this period)");

    const addLatestSection = (title, arr, formatter) => {
      if (arr.length === 0) return;
      const latest = arr[0];
      lines.push("");
      lines.push(`${title} (${arr.length}):`);
      formatter(latest);
    };

    addLatestSection("Therapy", therapySessions, (latest) => {
      if (latest.mood) lines.push(`- Latest mood: ${latest.mood}.`);
      if (latest.bodySystems && latest.bodySystems.length > 0) {
        lines.push(
          `- Body systems checked: ${latest.bodySystems.join(", ")}.`
        );
      }
      if (latest.notes) {
        lines.push(`- Latest notes: ${latest.notes}`);
      }
    });

    addLatestSection("Medication", medsSessions, (latest) => {
      if (latest.medications) {
        const taken = latest.medications
          .filter((m) => m.taken)
          .map((m) => m.name);
        if (taken.length > 0) {
          lines.push(`- Taken: ${taken.join(", ")}.`);
        }
      }
      if (latest.followUp) {
        lines.push("- Follow-up required (flagged in Medication Zone).");
      }
      if (latest.notes) {
        lines.push(`- Notes: ${latest.notes}`);
      }
    });

    addLatestSection("Paramedic", paramedicSessions, (latest) => {
      if (latest.calloutType) {
        lines.push(`- Callout type: ${latest.calloutType}.`);
      }
      if (latest.vitals) {
        const v = latest.vitals;
        lines.push(
          `- Vitals: BP ${v.bpSystolic || "?"}/${v.bpDiastolic || "?"}, HR ${
            v.hr || "?"
          }, RR ${v.rr || "?"}, SpO2 ${v.spo2 || "?"}%, Temp ${
            v.temp || "?"
          }°C.`
        );
      }
      if (latest.handover) {
        lines.push(`- SBAR handover: ${latest.handover}`);
      }
    });

    addLatestSection("Staff", staffSessions, (latest) => {
      if (latest.safeguardingConcern) {
        lines.push("- Safeguarding concern recorded in this period.");
        if (latest.safeguardingNotes) {
          lines.push(`- Safeguarding notes: ${latest.safeguardingNotes}`);
        }
      }
      if (latest.notes) {
        lines.push(`- Staff notes: ${latest.notes}`);
      }
    });

    addLatestSection("Remote / VPN", vpnSessions, (latest) => {
      if (latest.remoteType) {
        lines.push(`- Session type: ${latest.remoteType}.`);
      }
      if (latest.participants) {
        lines.push(`- Participants: ${latest.participants}`);
      }
      if (latest.summary) {
        lines.push(`- Summary: ${latest.summary}`);
      }
    });

    // 3. Care plan snapshot
    lines.push("");
    lines.push("3. Care plan (snapshot)");
    const carePlans = loadCarePlans();
    const plan = carePlans[selectedClientId];

    if (!plan) {
      lines.push("- No saved care plan yet for this client.");
    } else {
      if (plan.goalsShort) {
        lines.push("");
        lines.push("Short-term goals:");
        lines.push(plan.goalsShort);
      }
      if (plan.goalsLong) {
        lines.push("");
        lines.push("Long-term goals:");
        lines.push(plan.goalsLong);
      }
      if (plan.risks) {
        lines.push("");
        lines.push("Risks & safety:");
        lines.push(plan.risks);
      }
      if (plan.communication) {
        lines.push("");
        lines.push("Communication strategies:");
        lines.push(plan.communication);
      }
    }

    setReportText(lines.join("\n"));
  };

  const handleDownloadReport = () => {
    if (!reportText.trim()) {
      alert("Generate a report first.");
      return;
    }
    const blob = new Blob([reportText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const clientName = (selectedClient?.name || "client").replace(/\s+/g, "_");
    const rangeTag = reportRange === "today" ? "today" : "last7days";
    a.href = url;
    a.download = `theraa-nurse-report_${clientName}_${rangeTag}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Therapy Zone</h1>
          <p className="page-subtitle">
            Daily client check-in screen. Use this to track mood, basic body
            systems and session notes — ready for NDIS reports and paramedic
            handover.
          </p>
          {selectedClient && (
            <div style={{ fontSize: 12, color: "#4b5563", marginTop: 4 }}>
              Client: <strong>{selectedClient.name}</strong> (
              {selectedClient.age} yrs)
            </div>
          )}
        </div>
        <div style={{ fontSize: 12, color: "#6b7280", textAlign: "right" }}>
          Theraa Nurse · Client Experience View
          <br />
          Linked concept: Therapy segment in your Packet Tracer map.
        </div>
      </div>

      {/* Client selector */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">Select client</div>
        <div className="card-subtitle">
          Choose who you’re documenting this therapy session for.
        </div>
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

      {/* Layout grid */}
      <div className="two-column">
        {/* LEFT COLUMN */}
        <div className="stack">
          {/* Body systems card */}
          <div className="card">
            <div className="card-title">Body systems check (SUCQ aligned)</div>
            <div className="card-subtitle">
              Tick the systems you observed today for this client. This becomes
              your Recognise healthy body systems evidence.
            </div>
            <div className="grid-2">
              {BODY_SYSTEMS.map((system) => (
                <label
                  key={system}
                  style={{
                    fontSize: 13,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checkedSystems.includes(system)}
                    onChange={() => toggleSystem(system)}
                  />
                  {system}
                </label>
              ))}
            </div>
          </div>

          {/* Session notes card */}
          <div className="card">
            <div className="card-title">Session notes</div>
            <div className="card-subtitle">
              Briefly record what happened in this interaction. Focus on safety,
              triggers, what worked well, and any follow-up needed.
            </div>
            <textarea
              className="textarea"
              rows={6}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Example: Jason was calmer with rock music and adaptive cutlery. Needed prompts to wear glasses. Mild limp when walking with crutch..."
            />

            <button
              type="button"
              className="btn-primary"
              onClick={handleSaveTherapySession}
            >
              💾 Save therapy session
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="stack">
          {/* Mood + quick tags */}
          <div className="card">
            <div className="card-title">Mood / presentation</div>
            <div className="card-subtitle">
              Tap the mood that best describes the client at this session. Think
              like paramedics — what would you say in one sentence?
            </div>
            <div className="pill-group">
              {MOOD_STATES.map((m) => (
                <button
                  key={m}
                  type="button"
                  className={"pill" + (mood === m ? " active" : "")}
                  onClick={() => setMood(m)}
                >
                  {m}
                </button>
              ))}
            </div>

            <div
              style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}
            >
              Selected mood:{" "}
              <span style={{ fontWeight: 600 }}>
                {mood || "Not set"}
              </span>
            </div>
          </div>

          {/* Assistive tech & safety notes explanation */}
          <div className="card">
            <div className="card-title">Assistive tech & safety lens</div>
            <div className="card-subtitle">
              Jason-style needs (glasses, adaptive cutlery, crutches, continence
              aids) and aged care needs (Margaret & Douglas) can be tracked
              conceptually here and later turned into fields.
            </div>
            <ul
              style={{
                fontSize: 13,
                color: "#4b5563",
                paddingLeft: 18,
                marginTop: 4,
              }}
            >
              <li>Are prescribed glasses on and effective?</li>
              <li>
                Does the client need adaptive cutlery or support with meals?
              </li>
              <li>Is mobility safe (crutch, MS, arthritis, falls risk)?</li>
              <li>
                Any continence issues overnight that affect skin, sleep or
                dignity?
              </li>
            </ul>
            <p
              style={{
                fontSize: 12,
                color: "#6b7280",
                marginTop: 8,
              }}
            >
              This section informs how Theraa Nurse will generate reports for
              paramedics and NDIS providers.
            </p>
          </div>
        </div>
      </div>

      {/* History panel */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-title">
          Recent sessions for {selectedClient?.name}
        </div>
        <div className="card-subtitle">
          Therapy, medication and paramedic entries appear here so you can see
          patterns and give better handover.
        </div>
        {clientSessions.length === 0 ? (
          <p style={{ fontSize: 13 }}>No sessions recorded yet.</p>
        ) : (
          <div className="stack">
            {clientSessions.map((s, idx) => (
              <div
                key={idx}
                style={{
                  borderRadius: 10,
                  border: "1px solid #e5e7eb",
                  padding: "8px 10px",
                  fontSize: 13,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 4,
                  }}
                >
                  <span style={{ fontWeight: 600 }}>
                    {new Date(s.timestamp).toLocaleString()}
                  </span>
                  <span style={{ fontSize: 11, color: "#6b7280" }}>
                    Zone: {s.zone || "therapy"}
                  </span>
                </div>
                {s.mood && (
                  <div style={{ fontSize: 12 }}>
                    Mood: <strong>{s.mood}</strong>
                  </div>
                )}
                {s.bodySystems && s.bodySystems.length > 0 && (
                  <div style={{ fontSize: 12 }}>
                    Body systems: {s.bodySystems.join(", ")}
                  </div>
                )}
                {s.calloutType && (
                  <div style={{ fontSize: 12 }}>
                    Callout: {s.calloutType}
                  </div>
                )}
                {s.notes && (
                  <div style={{ fontSize: 12, marginTop: 2 }}>
                    Notes: {s.notes}
                  </div>
                )}
                {s.handover && !s.notes && (
                  <div style={{ fontSize: 12, marginTop: 2 }}>
                    Handover: {s.handover}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Report generator + download */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-title">
          Report for {selectedClient?.name}
        </div>
        <div className="card-subtitle">
          Generate a summary combining sessions and the care plan. Copy this into
          Word/PDF for assignments, NDIS notes or handover.
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            alignItems: "center",
            marginTop: 8,
          }}
        >
          <label
            className="section-title-sm"
            style={{ marginTop: 0, minWidth: 140 }}
          >
            Date range
            <select
              className="input"
              value={reportRange}
              onChange={(e) => setReportRange(e.target.value)}
            >
              <option value="today">Today</option>
              <option value="last7">Last 7 days</option>
            </select>
          </label>

          <button
            type="button"
            className="btn-primary"
            onClick={handleGenerateReport}
          >
            📝 Generate report
          </button>

          <button
            type="button"
            className="btn-primary"
            onClick={handleDownloadReport}
          >
            💾 Download report as .txt
          </button>
        </div>

        <textarea
          className="textarea"
          rows={10}
          value={reportText}
          readOnly
          style={{ marginTop: 10, fontFamily: "monospace" }}
          placeholder="Click 'Generate report' to create a summary..."
        />
      </div>
    </div>
  );
}
