// src/pages/Clients.jsx
import { useMemo, useState } from "react";
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

function labelText(field) {
  const labels = {
    name: "Participant Name",
    age: "Age",
    dob: "Date of Birth",
    gender: "Gender",
    ndisNumber: "NDIS Number",
    contactNumber: "Contact Number",
    emergencyContact: "Emergency Contact",
    address: "Address",
    notes: "Support Notes",
  };

  return labels[field] || field;
}

export default function Clients() {
  const { user } = useAuth();
  const [form, setForm] = useState(emptyForm);
  const [refreshKey, setRefreshKey] = useState(0);

  const clients = useMemo(() => {
    if (!user?.id) return [];
    return loadClients(user.id);
  }, [user?.id, refreshKey]);

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleAddClient() {
    if (!user?.id) {
      alert("You must be logged in to add a participant.");
      return;
    }

    if (!form.name.trim()) {
      alert("Participant name is required.");
      return;
    }

    saveClient(form, user.id);
    setForm(emptyForm);
    setRefreshKey((k) => k + 1);
    alert("Participant added.");
  }

  function handleDeleteClient(clientId) {
    if (!user?.id) return;

    const confirmed = window.confirm("Delete this participant?");
    if (!confirmed) return;

    deleteClient(clientId, user.id);
    setRefreshKey((k) => k + 1);
  }

  return (
    <div className="zone-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Participants</h1>
          <p className="page-subtitle">
            Only participants created under this logged-in account are visible.
          </p>
        </div>
      </div>

      <div className="two-column">
        <div className="card">
          <div className="card-title">Add Participant</div>
          <div className="card-subtitle">
            Create a secure participant record owned by your login.
          </div>

          {Object.keys(emptyForm).map((field) => (
            <label
              key={field}
              className="section-title-sm"
              style={{ display: "block", marginTop: 10 }}
            >
              {labelText(field)}
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
            Save Participant
          </button>
        </div>

        <div className="card">
          <div className="card-title">My Participants</div>
          <div className="card-subtitle">
            Account owner: {user?.email || "Not logged in"}
          </div>

          {clients.length === 0 ? (
            <p style={{ fontSize: 13, color: "#64748b" }}>
              No participants yet for this account.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {clients.map((client) => (
                <div
                  key={client.id}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 14,
                    padding: 14,
                    background: "#ffffff",
                  }}
                >
                  <div style={{ fontWeight: 800 }}>{client.name}</div>

                  <div style={{ fontSize: 13, color: "#475569", marginTop: 4 }}>
                    Age: {client.age || "—"} | NDIS:{" "}
                    {client.ndisNumber || "—"}
                  </div>

                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                    Last updated:{" "}
                    {client.updatedAt
                      ? new Date(client.updatedAt).toLocaleString()
                      : "—"}
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