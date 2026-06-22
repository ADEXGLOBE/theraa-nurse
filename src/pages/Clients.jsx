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

function ParticipantCard({ client, onDelete }) {
  return (
    <div className="participant-card-pro">
      <div className="participant-card-top">
        <div className="participant-card-avatar">
          {client.name?.charAt(0)?.toUpperCase() || "P"}
        </div>

        <div>
          <div className="participant-card-name">{client.name}</div>
          <div className="participant-card-status">Active Participant</div>
        </div>
      </div>

      <div className="participant-card-grid">
        <div>
          <span>Age</span>
          <strong>{client.age || "—"}</strong>
        </div>

        <div>
          <span>Gender</span>
          <strong>{client.gender || "—"}</strong>
        </div>

        <div>
          <span>NDIS</span>
          <strong>{client.ndisNumber || "—"}</strong>
        </div>

        <div>
          <span>Contact</span>
          <strong>{client.contactNumber || "—"}</strong>
        </div>
      </div>

      {client.notes ? (
        <div className="participant-card-notes">
          <strong>Support Notes</strong>
          <p>{client.notes}</p>
        </div>
      ) : null}

      <div className="participant-card-footer">
        <small>
          Last updated:{" "}
          {client.updatedAt
            ? new Date(client.updatedAt).toLocaleString()
            : "—"}
        </small>

        <button
          type="button"
          className="btn-danger-soft"
          onClick={() => onDelete(client.id)}
        >
          Delete
        </button>
      </div>
    </div>
  );
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
    const confirmed = window.confirm("Delete this participant?");
    if (!confirmed) return;

    deleteClient(clientId, user.id);
    setRefreshKey((k) => k + 1);
  }

  return (
    <div className="zone-page participants-page">
      <div className="participants-hero">
        <div>
          <div className="eyebrow">Participant Management</div>
          <h1>Participants</h1>
          <p>
            Create and manage secure participant records for purpose-centred
            support coordination and care planning.
          </p>
        </div>

        <div className="participants-count-card">
          <div className="count-number">{clients.length}</div>
          <div className="count-label">Participants</div>
          <small>Owned by this account</small>
        </div>
      </div>

      <div className="two-column participants-layout">
        <div className="card premium-card">
          <div className="card-title">Add Participant</div>
          <div className="card-subtitle">
            Add a participant record linked only to this logged-in account.
          </div>

          <div className="form-grid-pro">
            {Object.keys(emptyForm).map((field) => (
              <label
                key={field}
                className={field === "notes" || field === "address" ? "form-wide" : ""}
              >
                <span>{labelText(field)}</span>

                {field === "notes" || field === "address" ? (
                  <textarea
                    className="textarea"
                    rows={field === "notes" ? 4 : 3}
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
          </div>

          <button
            type="button"
            className="btn-primary btn-wide"
            onClick={handleAddClient}
          >
            Save Participant
          </button>
        </div>

        <div className="card premium-card">
          <div className="section-heading-row">
            <div>
              <div className="card-title">My Participants</div>
              <div className="card-subtitle">
                Visible only to: {user?.email || "Not logged in"}
              </div>
            </div>
          </div>

          {clients.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">👥</div>
              <div>No participants yet.</div>
              <small>Add your first participant using the form.</small>
            </div>
          ) : (
            <div className="participant-card-list">
              {clients.map((client) => (
                <ParticipantCard
                  key={client.id}
                  client={client}
                  onDelete={handleDeleteClient}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}