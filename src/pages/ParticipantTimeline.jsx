import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { loadClients } from "../data/clientsStore";
import { listDocumentsForClient } from "../features/documents/documentService";
import { loadCarePlanVersions } from "../data/carePlanStore";
import { loadSessions } from "../data/sessionStore";

function formatDate(value) {
  if (!value) return "Unknown date";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "Unknown date";
  }
}

function TimelineItem({ item }) {
  return (
    <div className="timeline-item-pro">
      <div className="timeline-dot-pro">{item.icon}</div>
      <div className="timeline-content-pro">
        <div className="timeline-title-pro">{item.title}</div>
        <div className="timeline-meta-pro">{formatDate(item.date)}</div>
        <p>{item.description}</p>
      </div>
    </div>
  );
}

export default function ParticipantTimeline() {
  const { user } = useAuth();
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [documents, setDocuments] = useState([]);

  useEffect(() => {
    if (!user?.id) return;

    const loaded = loadClients(user.id);
    setClients(loaded);

    if (loaded.length > 0) {
      setSelectedClientId((current) =>
        loaded.some((c) => c.id === current) ? current : loaded[0].id
      );
    }
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;

    async function loadDocs() {
      if (!selectedClientId) {
        setDocuments([]);
        return;
      }

      const docs = await listDocumentsForClient(selectedClientId);
      if (!cancelled) setDocuments(Array.isArray(docs) ? docs : []);
    }

    loadDocs();

    return () => {
      cancelled = true;
    };
  }, [selectedClientId]);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedClientId) || null,
    [clients, selectedClientId]
  );

  const timeline = useMemo(() => {
    if (!selectedClient) return [];

    const sessionsMap = loadSessions(user?.id);
    const sessions = sessionsMap?.[selectedClient.id] || [];
    const carePlans = loadCarePlanVersions(selectedClient.id, user?.id) || [];

    const docEvents = documents.map((doc) => ({
      type: "document",
      icon: "📄",
      title: doc.name || doc.filename || doc.title || "Document uploaded",
      description: "Participant evidence was added to the record.",
      date: doc.createdAt,
    }));

    const sessionEvents = sessions.map((s) => ({
      type: "session",
      icon: "📝",
      title: s.zone || s.sessionType || "Session note added",
      description: s.notes || "Support session recorded.",
      date: s.createdAt || s.date,
    }));

    const planEvents = carePlans.map((v) => ({
      type: "careplan",
      icon: v.status === "reviewed" ? "✅" : "🎯",
      title:
        v.status === "reviewed"
          ? "Care plan reviewed"
          : "Care plan draft saved",
      description: "Purpose-centred care plan version saved.",
      date: v.createdAt,
    }));

    return [...docEvents, ...sessionEvents, ...planEvents].sort(
      (a, b) => new Date(b.date || 0) - new Date(a.date || 0)
    );
  }, [selectedClient, documents, user?.id]);

  return (
    <div className="zone-page timeline-page-pro">
      <div className="timeline-hero-pro">
        <div>
          <div className="eyebrow">Participant Story</div>
          <h1>Intelligence Timeline</h1>
          <p>
            View participant evidence, care plan changes, session notes and support
            activity in one clear chronological story.
          </p>
        </div>

        <div className="timeline-stat-card-pro">
          <div className="timeline-stat-number-pro">{timeline.length}</div>
          <div className="timeline-stat-label-pro">Timeline Events</div>
          <small>{selectedClient?.name || "No participant selected"}</small>
        </div>
      </div>

      <div className="card premium-card">
        <div className="card-title">Select Participant</div>
        <select
          className="input"
          value={selectedClientId}
          onChange={(e) => setSelectedClientId(e.target.value)}
        >
          {clients.length === 0 ? (
            <option value="">No participants</option>
          ) : (
            clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.age ? `(${c.age})` : ""}
              </option>
            ))
          )}
        </select>
      </div>

      <div className="card premium-card" style={{ marginTop: 16 }}>
        <div className="card-title">Participant Timeline</div>
        <div className="card-subtitle">
          This helps providers understand what has happened over time.
        </div>

        {timeline.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🕒</div>
            <div>No timeline events yet.</div>
            <small>Add documents, sessions or care plan versions.</small>
          </div>
        ) : (
          <div className="timeline-list-pro">
            {timeline.map((item, index) => (
              <TimelineItem key={`${item.type}-${index}`} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}