import { useEffect, useMemo, useState } from "react";
import { loadClients } from "../data/clientsStore";
import {
  loadCarePlanVersions,
  saveCarePlanVersion,
} from "../data/carePlanStore";
import { generateCarePlanPdf } from "../features/careplans/carePlanPdf";

export default function CarePlanZone() {
  const clients = loadClients();
  const [selectedClientId, setSelectedClientId] = useState(
    clients[0]?.id || ""
  );

  const [versions, setVersions] = useState([]);
  const [activePlan, setActivePlan] = useState(null);

  useEffect(() => {
    if (!selectedClientId) return;
    const v = loadCarePlanVersions(selectedClientId);
    setVersions(v);
    setActivePlan(v[0]?.plan || null);
  }, [selectedClientId]);

  const client = useMemo(
    () => clients.find((c) => c.id === selectedClientId),
    [clients, selectedClientId]
  );

  if (!client) {
    return (
      <div className="card">
        <div className="card-title">Care Plan</div>
        <div className="card-subtitle">No client selected.</div>
      </div>
    );
  }

  const updateField = (field, value) => {
    setActivePlan((p) => ({ ...p, [field]: value }));
  };

  function saveReviewed() {
    saveCarePlanVersion({
      clientId: client.id,
      status: "reviewed",
      plan: activePlan,
      evidenceCount: versions[0]?.evidenceCount || 0,
    });
    alert("Care plan saved as reviewed.");
    const v = loadCarePlanVersions(client.id);
    setVersions(v);
  }

  return (
    <div className="zone-page">
      <div className="zone-header">
        <h2>Care Plan</h2>
        <div style={{ fontSize: 12, color: "#6b7280" }}>
          Versioned · Evidence-bound · Reviewable
        </div>
      </div>

      <div className="card">
        <label>
          <div className="label">Client</div>
          <select
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.age})
              </option>
            ))}
          </select>
        </label>

        {versions.length > 0 && (
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>
            Latest version: {versions[0].status} ·{" "}
            {new Date(versions[0].createdAt).toLocaleString()}
          </div>
        )}
      </div>

      {activePlan && (
        <div className="two-column" style={{ marginTop: 12 }}>
          <div className="stack">
            <div className="card">
              <div className="card-title">Short-term goals</div>
              <textarea
                rows={4}
                value={activePlan.goalsShort || ""}
                onChange={(e) =>
                  updateField("goalsShort", e.target.value)
                }
              />
            </div>

            <div className="card">
              <div className="card-title">Long-term goals</div>
              <textarea
                rows={4}
                value={activePlan.goalsLong || ""}
                onChange={(e) =>
                  updateField("goalsLong", e.target.value)
                }
              />
            </div>

            <div className="card">
              <div className="card-title">Risks</div>
              <textarea
                rows={3}
                value={activePlan.risks || ""}
                onChange={(e) =>
                  updateField("risks", e.target.value)
                }
              />
            </div>
          </div>

          <div className="stack">
            <div className="card">
              <div className="card-title">Communication</div>
              <textarea
                rows={3}
                value={activePlan.communication || ""}
                onChange={(e) =>
                  updateField("communication", e.target.value)
                }
              />
            </div>

            <div className="card">
              <div className="card-title">Supports</div>
              <textarea
                rows={3}
                value={activePlan.supports || ""}
                onChange={(e) =>
                  updateField("supports", e.target.value)
                }
              />
            </div>

            <div className="card">
              <div className="card-title">Legal & ethical</div>
              <textarea
                rows={3}
                value={activePlan.legalEthical || ""}
                onChange={(e) =>
                  updateField("legalEthical", e.target.value)
                }
              />

              <button
                className="primary"
                style={{ marginTop: 10 }}
                onClick={saveReviewed}
              >
                💾 Save as Reviewed
              </button>

              <button
                className="primary"
                style={{ marginTop: 8, background: "#0f766e" }}
                onClick={() =>
                  generateCarePlanPdf({
                    client,
                    planVersion: versions[0],
                  })
                }
              >
                📄 Download Care Plan (PDF)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
