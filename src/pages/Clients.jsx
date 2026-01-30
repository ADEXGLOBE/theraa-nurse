// src/pages/Clients.jsx
import { useEffect, useMemo, useState } from "react";
import {
  addClient,
  updateClient,
  loadClients,
  deleteClient,
  deleteClientFull,
} from "../data/clientsStore";

const ZONES = ["THERAPY", "MEDS", "STAFF", "PARAMEDIC", "VPN"];

function parseCommaList(s) {
  return (s || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [selectedId, setSelectedId] = useState("");

  // form fields
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [primaryZone, setPrimaryZone] = useState("THERAPY");
  const [diagnoses, setDiagnoses] = useState("");
  const [keyRisks, setKeyRisks] = useState("");
  const [notes, setNotes] = useState("");

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedId) || null,
    [clients, selectedId]
  );

  /* ---------------------------------------
     Load clients on mount
  ---------------------------------------- */
  useEffect(() => {
    const loaded = loadClients();
    setClients(loaded);
    if (loaded.length > 0) setSelectedId(loaded[0].id);
  }, []);

  /* ---------------------------------------
     Populate form when selection changes
  ---------------------------------------- */
  useEffect(() => {
    if (!selectedClient) return;

    setName(selectedClient.name || "");
    setAge(String(selectedClient.age ?? ""));
    setPrimaryZone(selectedClient.primaryZone || "THERAPY");
    setDiagnoses((selectedClient.diagnoses || []).join(", "));
    setKeyRisks((selectedClient.keyRisks || []).join(", "));
    setNotes(selectedClient.notes || "");
  }, [selectedClient]);

  function refreshClients(nextSelectId) {
    const updated = loadClients();
    setClients(updated);

    if (nextSelectId) {
      setSelectedId(nextSelectId);
    } else if (updated.length > 0) {
      setSelectedId(updated[0].id);
    } else {
      clearForm();
    }
  }

  function clearForm() {
    setSelectedId("");
    setName("");
    setAge("");
    setPrimaryZone("THERAPY");
    setDiagnoses("");
    setKeyRisks("");
    setNotes("");
  }

  function handleCreateNew() {
    clearForm();
  }

  /* ---------------------------------------
     Save (create or update)
  ---------------------------------------- */
  function handleSave() {
    if (!name.trim()) {
      alert("Client name is required.");
      return;
    }

    const payload = {
      name: name.trim(),
      age: Number(age || 0),
      primaryZone,
      diagnoses: parseCommaList(diagnoses),
      keyRisks: parseCommaList(keyRisks),
      notes: notes || "",
    };

    if (selectedId) {
      updateClient(selectedId, payload);
      refreshClients(selectedId);
    } else {
      const created = addClient(payload);
      refreshClients(created.id);
    }

    alert("Client saved successfully.");
  }

  /* ---------------------------------------
     BASIC DELETE (legacy)
  ---------------------------------------- */
  function handleDeleteBasic() {
    if (!selectedId) return;

    const ok = confirm(
      "Delete this client ONLY?\n\nDocuments and care plans will remain in storage but will no longer be linked.\n\n(Not recommended for real use.)"
    );
    if (!ok) return;

    deleteClient(selectedId);
    refreshClients();
  }

  /* ---------------------------------------
     FULL DELETE (RECOMMENDED)
  ---------------------------------------- */
  async function handleDeleteFull() {
    if (!selectedId) return;

    const ok = confirm(
      "⚠️ PERMANENT DELETE\n\nThis will delete:\n• Client record\n• ALL documents\n• ALL care plans\n• ALL related data\n\nThis CANNOT be undone.\n\nContinue?"
    );
    if (!ok) return;

    await deleteClientFull(selectedId);
    refreshClients();

    alert("Client and all related data permanently deleted.");
  }

  /* ---------------------------------------
     UI
  ---------------------------------------- */
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Clients</h1>
          <p className="page-subtitle">
            Manage participants across care coordination, support delivery and
            care planning.
          </p>
        </div>
        <div style={{ fontSize: 12, color: "#6b7280", textAlign: "right" }}>
          Multi-client · Local-first MVP
        </div>
      </div>

      <div className="two-column">
        {/* LEFT COLUMN: Client list */}
        <div className="card">
          <div className="card-title">Client list</div>
          <div className="card-subtitle">
            Select a client to edit or manage, or create a new one.
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button className="btn-primary" onClick={handleCreateNew}>
              ➕ New client
            </button>
            <button
              className="btn-primary"
              style={{ background: "#4b5563" }}
              onClick={() => refreshClients(selectedId)}
            >
              ↻ Refresh
            </button>
          </div>

          <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
            {clients.length === 0 ? (
              <div style={{ fontSize: 13, color: "#6b7280" }}>
                No clients yet. Create your first client.
              </div>
            ) : (
              clients.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  style={{
                    textAlign: "left",
                    padding: 10,
                    borderRadius: 12,
                    border: "1px solid #e5e7eb",
                    background: c.id === selectedId ? "#eff6ff" : "white",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontWeight: 700 }}>
                    {c.name}{" "}
                    <span style={{ fontWeight: 400, color: "#6b7280" }}>
                      ({c.age})
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                    Zone: {c.primaryZone} · Risks:{" "}
                    {(c.keyRisks || []).slice(0, 2).join(", ") || "—"}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Edit / Create */}
        <div className="stack">
          <div className="card">
            <div className="card-title">
              {selectedId ? "Edit client" : "Create new client"}
            </div>
            <div className="card-subtitle">
              Core demographic and risk info. Clinical detail comes from
              documents and session notes.
            </div>

            <label className="section-title-sm">
              Full name
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>

            <label className="section-title-sm">
              Age
              <input
                className="input"
                value={age}
                onChange={(e) => setAge(e.target.value)}
              />
            </label>

            <label className="section-title-sm">
              Primary zone
              <select
                className="input"
                value={primaryZone}
                onChange={(e) => setPrimaryZone(e.target.value)}
              >
                {ZONES.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
            </label>

            <label className="section-title-sm">
              Diagnoses (comma-separated)
              <textarea
                className="textarea"
                rows={3}
                value={diagnoses}
                onChange={(e) => setDiagnoses(e.target.value)}
              />
            </label>

            <label className="section-title-sm">
              Key risks (comma-separated)
              <textarea
                className="textarea"
                rows={3}
                value={keyRisks}
                onChange={(e) => setKeyRisks(e.target.value)}
              />
            </label>

            <label className="section-title-sm">
              Notes / context
              <textarea
                className="textarea"
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
              <button className="btn-primary" onClick={handleSave}>
                💾 Save client
              </button>

              {selectedId && (
                <>
                  <button
                    className="btn-primary"
                    style={{ background: "#b91c1c" }}
                    onClick={handleDeleteFull}
                  >
                    🧨 Delete EVERYTHING
                  </button>

                  <button
                    className="btn-primary"
                    style={{ background: "#7c2d12" }}
                    onClick={handleDeleteBasic}
                  >
                    🗑 Delete (basic)
                  </button>
                </>
              )}

              <button
                className="btn-primary"
                style={{ background: "#4b5563" }}
                onClick={clearForm}
              >
                Clear
              </button>
            </div>

            {selectedClient?.updatedAt && (
              <p style={{ fontSize: 12, color: "#6b7280", marginTop: 10 }}>
                Last updated:{" "}
                {new Date(selectedClient.updatedAt).toLocaleString()}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
