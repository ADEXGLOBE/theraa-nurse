// src/pages/Clients.jsx
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { loadClients, saveClient, deleteClient } from "../data/clientsStore";

const emptyForm = {
  name: "",
  age: "",
  dob: "",
  gender: "",
  ndisNumber: "",
  contactNumber: "",
  emergencyContact: "",
  address: "",
  notes: "",
};

export default function Clients() {
  const { user } = useAuth();
  const [form, setForm] = useState(emptyForm);
  const [setRefreshKey] = useState(0);

  const clients = loadClients(user?.id);

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleAddClient() {
    if (!form.name.trim()) {
      alert("Client name is required.");
      return;
    }

    saveClient(form, user.id);
    setForm(emptyForm);
    setRefreshKey((k) => k + 1);
    alert("Client added.");
  }

  function handleDeleteClient(clientId) {
    deleteClient(clientId, user.id);
    setRefreshKey((k) => k + 1);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Clients</h1>
          <p className="page-subtitle">
            Only your clients are visible to your account.
          </p>
        </div>
      </div>

      <div className="two-column">
        <div className="card">
          <div className="card-title">Add Client</div>
          <div className="card-subtitle">
            Create a participant record owned by your login.
          </div>

          {Object.keys(emptyForm).map((field) => (
            <label
              key={field}
              className="section-title-sm"
              style={{ display: "block", marginTop: 10 }}
            >
              {field}
              {field === "notes" ? (
                <textarea
                  className="textarea"
                  rows={4}
                  value={form[field]}
                  onChange={(e) => updateField(field, e.target.value)}
                />
              ) : (
                <input
                  className="input"
                  value={form[field]}
                  onChange={(e) => updateField(field, e.target.value)}
                />
              )}
            </label>
          ))}

          <button
            type="button"
            className="btn-primary"
            style={{ marginTop: 12 }}
            onClick={handleAddClient}
          >
            Save Client
          </button>
        </div>

        <div className="card">
          <div className="card-title">My Clients</div>
          <div className="card-subtitle">
            These clients belong only to your account.
          </div>

          {clients.length === 0 ? (
            <p style={{ fontSize: 13 }}>No clients yet.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {clients.map((client) => (
                <div
                  key={client.id}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    padding: 12,
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{client.name}</div>
                  <div style={{ fontSize: 13, color: "#475569", marginTop: 4 }}>
                    Age: {client.age || "—"} | NDIS: {client.ndisNumber || "—"}
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <button
                      type="button"
                      className="btn-primary"
                      style={{ background: "#b91c1c" }}
                      onClick={() => handleDeleteClient(client.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}