import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { loadClients } from "../data/clientsStore";
import {
  saveDocumentForClient,
  listDocumentsForClient,
  deleteDocument,
} from "../features/documents/documentService";

export default function ClientFiles() {
  const { user } = useAuth();

  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [documents, setDocuments] = useState([]);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Progress Note");
  const [textContent, setTextContent] = useState("");
  const [file, setFile] = useState(null);

  useEffect(() => {
    if (!user?.id) return;

    const loaded = loadClients(user.id);
    setClients(loaded);

    if (loaded.length > 0) {
      setSelectedClientId(loaded[0].id);
    }
  }, [user?.id]);

  useEffect(() => {
    refreshDocuments();
  }, [selectedClientId]);

  async function refreshDocuments() {
    if (!selectedClientId) {
      setDocuments([]);
      return;
    }

    const docs = await listDocumentsForClient(selectedClientId, user?.id);
    setDocuments(docs);
  }

  async function handleUpload() {
    if (!selectedClientId) {
      alert("Please select a participant.");
      return;
    }

    if (!file && !textContent.trim()) {
      alert("Please upload a file or paste document text.");
      return;
    }

    await saveDocumentForClient({
      clientId: selectedClientId,
      ownerId: user.id,
      title,
      category,
      file,
      textContent,
    });

    setTitle("");
    setTextContent("");
    setFile(null);
    await refreshDocuments();

    alert("Document saved to participant evidence.");
  }

  function handleDelete(id) {
    if (!window.confirm("Delete this document?")) return;
    deleteDocument(id, user?.id);
    refreshDocuments();
  }

  return (
    <div className="zone-page evidence-page">
      <div className="evidence-hero">
        <div>
          <div className="eyebrow">Participant Evidence</div>
          <h1>Documents & Evidence</h1>
          <p>
            Upload participant documents, progress notes, assessments and support
            evidence for care plan generation and Knowledge Engine enhancement.
          </p>
        </div>

        <div className="evidence-hero-card">
          <div className="evidence-hero-number">{documents.length}</div>
          <div className="evidence-hero-label">Evidence Items</div>
          <small>For selected participant</small>
        </div>
      </div>

      <div className="two-column">
        <div className="card premium-card">
          <div className="card-title">Upload Evidence</div>
          <div className="card-subtitle">
            Supports text files now. For PDFs, paste the extracted content until PDF extraction is added.
          </div>

          <label className="section-title-sm">
            Participant
            <select
              className="input"
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
            >
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name} {client.age ? `(${client.age})` : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="section-title-sm">
            Document Title
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. OT Report, Progress Note, Intake Assessment"
            />
          </label>

          <label className="section-title-sm">
            Category
            <select
              className="input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option>Progress Note</option>
              <option>NDIS Plan</option>
              <option>Care Plan</option>
              <option>Risk Assessment</option>
              <option>Incident Report</option>
              <option>Allied Health Report</option>
              <option>Behaviour Support</option>
              <option>Medication</option>
              <option>General</option>
            </select>
          </label>

          <label className="section-title-sm">
            Upload File
            <input
              className="input"
              type="file"
              accept=".txt,.md,.csv,.json,.html,.doc,.docx,.pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </label>

          <label className="section-title-sm">
            Paste Document Text
            <textarea
              className="textarea"
              rows={8}
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              placeholder="Paste document content, progress notes or assessment details here..."
            />
          </label>

          <button className="btn-primary btn-wide" onClick={handleUpload}>
            Save Evidence
          </button>
        </div>

        <div className="card premium-card">
          <div className="card-title">Saved Evidence</div>
          <div className="card-subtitle">
            These documents feed Theraa Nurse care plans and Knowledge Engine.
          </div>

          {documents.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📄</div>
              <div>No documents yet.</div>
              <small>Upload participant evidence to begin.</small>
            </div>
          ) : (
            <div className="evidence-list">
              {documents.map((doc) => (
                <div className="evidence-card" key={doc.id}>
                  <div className="evidence-icon">📄</div>

                  <div className="evidence-main">
                    <div className="evidence-title">{doc.title || doc.name}</div>
                    <div className="evidence-meta">
                      {doc.category} · {doc.fileName || "Manual entry"} ·{" "}
                      {new Date(doc.createdAt).toLocaleString()}
                    </div>

                    <div className="evidence-preview">
                      {(doc.textContent || doc.extractedText || doc.text || "")
                        .slice(0, 220)}
                      {(doc.textContent || doc.extractedText || doc.text || "")
                        .length > 220
                        ? "..."
                        : ""}
                    </div>
                  </div>

                  <button
                    className="btn-danger-soft"
                    onClick={() => handleDelete(doc.id)}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}