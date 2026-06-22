// src/pages/ClientFiles.jsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { loadClients } from "../data/clientsStore";
import { listDocumentsForClient } from "../features/documents/documentService";

function getDocIcon(type = "") {
  const t = String(type).toLowerCase();
  if (t.includes("pdf")) return "📕";
  if (t.includes("word") || t.includes("doc")) return "📘";
  if (t.includes("image") || t.includes("png") || t.includes("jpg")) return "🖼️";
  if (t.includes("text") || t.includes("txt")) return "📄";
  return "📎";
}

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "—";
  }
}

function EvidenceCard({ doc }) {
  const type = doc?.mimeType || doc?.type || doc?.fileType || "Document";
  const title = doc?.name || doc?.filename || doc?.title || "Untitled document";

  const extracted =
    doc?.textContent ||
    doc?.extractedText ||
    doc?.text ||
    doc?.summary ||
    "";

  return (
    <div className="evidence-card">
      <div className="evidence-icon">{getDocIcon(type)}</div>

      <div className="evidence-main">
        <div className="evidence-title">{title}</div>
        <div className="evidence-meta">
          {type} · Uploaded {formatDate(doc?.createdAt)}
        </div>

        {extracted ? (
          <div className="evidence-preview">
            {String(extracted).slice(0, 180)}
            {String(extracted).length > 180 ? "..." : ""}
          </div>
        ) : (
          <div className="evidence-preview muted">
            No extracted text yet. This file can still be stored as participant evidence.
          </div>
        )}
      </div>

      <div className="evidence-status">Evidence</div>
    </div>
  );
}

export default function ClientFiles() {
  const { user } = useAuth();

  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setClients([]);
      setSelectedClientId("");
      return;
    }

    const loaded = loadClients(user.id);
    setClients(loaded);

    if (loaded.length > 0) {
      setSelectedClientId((current) =>
        loaded.some((c) => c.id === current) ? current : loaded[0].id
      );
    } else {
      setSelectedClientId("");
    }
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;

    async function loadDocs() {
      if (!selectedClientId) {
        setDocuments([]);
        return;
      }

      setLoading(true);

      try {
        const docs = await listDocumentsForClient(selectedClientId);
        if (!cancelled) setDocuments(Array.isArray(docs) ? docs : []);
      } catch (e) {
        console.error("Failed to load documents", e);
        if (!cancelled) setDocuments([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
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

  const evidenceStats = useMemo(() => {
    const total = documents.length;
    const withText = documents.filter(
      (d) => d?.textContent || d?.extractedText || d?.text || d?.summary
    ).length;

    return {
      total,
      withText,
      pending: Math.max(0, total - withText),
    };
  }, [documents]);

  return (
    <div className="zone-page evidence-page">
      <div className="evidence-hero">
        <div>
          <div className="eyebrow">Participant Evidence</div>
          <h1>Evidence Hub</h1>
          <p>
            Store participant documents, session notes and support evidence that feed
            the Theraa Nurse care engine and future Knowledge Engine.
          </p>
        </div>

        <div className="evidence-hero-card">
          <div className="evidence-hero-number">{evidenceStats.total}</div>
          <div className="evidence-hero-label">Evidence Items</div>
          <small>{evidenceStats.withText} analysed · {evidenceStats.pending} pending</small>
        </div>
      </div>

      <div className="evidence-toolbar">
        <div>
          <div className="card-title">Select Participant</div>
          <div className="card-subtitle">
            Evidence is isolated to the logged-in user account.
          </div>
        </div>

        <select
          className="input evidence-select"
          value={selectedClientId}
          onChange={(e) => setSelectedClientId(e.target.value)}
        >
          {clients.length === 0 ? (
            <option value="">No participants</option>
          ) : (
            clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name} {client.age ? `(${client.age})` : ""}
              </option>
            ))
          )}
        </select>
      </div>

      <div className="metric-grid evidence-metrics">
        <div className="metric-card">
          <div className="metric-icon">📚</div>
          <div>
            <div className="metric-value">{evidenceStats.total}</div>
            <div className="metric-title">Total Evidence</div>
            <div className="metric-subtitle">For selected participant</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">🧠</div>
          <div>
            <div className="metric-value">{evidenceStats.withText}</div>
            <div className="metric-title">Analysed</div>
            <div className="metric-subtitle">Ready for care engine</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">⏳</div>
          <div>
            <div className="metric-value">{evidenceStats.pending}</div>
            <div className="metric-title">Pending</div>
            <div className="metric-subtitle">Awaiting extraction</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">🌟</div>
          <div>
            <div className="metric-value">KB</div>
            <div className="metric-title">Knowledge Engine</div>
            <div className="metric-subtitle">Coming next</div>
          </div>
        </div>
      </div>

      <div className="card premium-card">
        <div className="section-heading-row">
          <div>
            <div className="card-title">
              {selectedClient ? `${selectedClient.name}'s Evidence` : "Evidence"}
            </div>
            <div className="card-subtitle">
              Documents here become the intelligence source for support coordination.
            </div>
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="empty-icon">⏳</div>
            <div>Loading evidence...</div>
          </div>
        ) : documents.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📄</div>
            <div>No evidence uploaded yet.</div>
            <small>Upload documents from your existing document workflow.</small>
          </div>
        ) : (
          <div className="evidence-list">
            {documents.map((doc, index) => (
              <EvidenceCard key={doc?.id || index} doc={doc} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}